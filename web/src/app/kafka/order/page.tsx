'use client';

import { useEffect, useMemo, useState } from 'react';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { ScenarioCaseBanner } from '@/app/scenarios/ScenarioCaseBanner';
import {
  KAFKA_CONSUMERS,
  KAFKA_FAIL_OPTIONS,
  type KafkaConsumerResult,
  type KafkaFailMode,
  type KafkaOrderView,
  isKafkaTerminal,
  parseKafkaOrder,
  parseKafkaOrders,
  statusTone,
} from './kafka-order-contract';

async function readOrder(response: Response): Promise<KafkaOrderView | null> {
  if (!response.ok) return null;
  return parseKafkaOrder(await response.json());
}

async function fetchOrder(orderId: string): Promise<KafkaOrderView | null> {
  return readOrder(await fetch(`/api/bff/kafka/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store' }));
}

function lastStage(order: KafkaOrderView | null): string {
  if (!order) return 'READY';
  return order.events.at(-1)?.stage ?? order.status;
}

function consumerResult(order: KafkaOrderView | null, name: string): KafkaConsumerResult | null {
  return order?.consumers.find((consumer) => consumer.consumerName === name) ?? null;
}

export default function KafkaOrderPage() {
  const [failMode, setFailMode] = useState<KafkaFailMode>('NONE');
  const [quantity, setQuantity] = useState(1);
  const [current, setCurrent] = useState<KafkaOrderView | null>(null);
  const [recent, setRecent] = useState<readonly KafkaOrderView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshRecent() {
    const response = await fetch('/api/bff/kafka/orders?size=8', { cache: 'no-store' });
    if (!response.ok) return;
    setRecent(parseKafkaOrders(await response.json()));
  }

  useEffect(() => {
    void refreshRecent();
  }, []);

  // 효과 안에서 current 를 통째로 읽지 않는다. 의존성에 current 를 넣으면 폴링이 setCurrent 로
  // 객체를 갈 때마다 인터벌이 재설치돼 1초마다 요청이 두 번 나간다. 쓰는 두 필드만 꺼내 둔다.
  const pollingOrderId = current?.orderId;
  const pollingStatus = current?.status;

  useEffect(() => {
    if (!pollingOrderId || !pollingStatus || isKafkaTerminal(pollingStatus)) return;
    const orderId = pollingOrderId;
    let active = true;
    async function tick() {
      const next = await fetchOrder(orderId);
      if (active && next) {
        setCurrent(next);
        await refreshRecent();
      }
    }
    const id = window.setInterval(() => void tick(), 1000);
    void tick();
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [pollingOrderId, pollingStatus]);

  async function runOrder() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/bff/kafka/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productCode: 'JAY-HOODIE', quantity, failMode }),
      });
      const result = await readOrder(response);
      if (!result) {
        setError('Kafka 주문 데모 응답을 읽지 못했습니다.');
        return;
      }
      setCurrent(result);
      await refreshRecent();
    } catch (caught) {
      if (caught instanceof Error) {
        setError(caught.message);
        return;
      }
      throw caught;
    } finally {
      setLoading(false);
    }
  }

  const topicRows = useMemo(() => {
    const kafka = current?.kafka;
    return [
      ['Kafka relay', kafka?.enabled ? 'ON' : 'OFF'],
      ['Topic', kafka?.orderTopic ?? 'jaywiki.order-events'],
      ['DLQ', kafka?.dlqTopic ?? 'jaywiki.order-events.dlq'],
      ['Last stage', lastStage(current)],
    ] as const;
  }, [current]);

  return (
    <>
      <Header />
      <main id="main-content">
        <section className="kafka-hero">
          <div>
            <div className="eyebrow">Kafka event pipeline</div>
            <h1>주문 이벤트 Kafka 팬아웃 데모</h1>
            <p>
              주문 생성은 DB 트랜잭션 안에서 Outbox에 기록되고, relay가 Kafka topic으로 발행합니다.
              서로 다른 consumer group이 같은 이벤트를 독립적으로 처리하며 실패 이벤트는 DLQ로 이동합니다.
            </p>
          </div>
          <div className={`kafka-chip ${statusTone(current?.status ?? 'READY')}`}>
            {current ? current.status : 'READY'}
          </div>
        </section>

        <ScenarioCaseBanner scenarioId="kafka-dlq" />

        <section className="kafka-layout">
          <div className="kafka-panel">
            <h2>실행 조건</h2>
            <label className="saga-field">
              <span>상품</span>
              <input value="JAY-HOODIE" readOnly />
            </label>
            <label className="saga-field">
              <span>수량</span>
              <input
                max={5}
                min={1}
                onChange={(event) => setQuantity(Number(event.target.value))}
                type="number"
                value={quantity}
              />
            </label>
            <div className="kafka-segments">
              {KAFKA_FAIL_OPTIONS.map((option) => (
                <button
                  className={failMode === option.value ? 'active' : ''}
                  key={option.value}
                  onClick={() => setFailMode(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button className="btn btn-primary kafka-run" disabled={loading} onClick={runOrder} type="button">
              {loading ? '발행 준비 중' : '주문 이벤트 생성'}
            </button>
            {error && <div className="saga-error">{error}</div>}
          </div>

          <div className="kafka-panel">
            <h2>Kafka 상태</h2>
            <div className="saga-state-grid">
              {topicRows.map(([name, value]) => (
                <div className="saga-state" key={name}>
                  <span>{name}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="kafka-panel kafka-consumers">
            <h2>Consumer groups</h2>
            {KAFKA_CONSUMERS.map((consumer) => {
              const result = consumerResult(current, consumer.name);
              return (
                <div className="kafka-consumer" key={consumer.name}>
                  <span className={`kafka-dot ${statusTone(result?.status ?? 'IDLE')}`} />
                  <div>
                    <strong>{consumer.label}</strong>
                    <p>{result?.lastError ?? result?.status ?? '아직 이벤트를 받지 않았습니다.'}</p>
                  </div>
                  <em>{result ? `${result.attemptCount}회` : '0회'}</em>
                </div>
              );
            })}
          </div>
        </section>

        <section className="kafka-panel kafka-flow">
          <h2>이벤트 타임라인</h2>
          {current ? (
            <ol>
              {current.events.map((event) => (
                <li className={statusTone(event.status)} key={`${event.stage}-${event.createdAt}`}>
                  <span className="kafka-line-dot" />
                  <div>
                    <strong>{event.stage}</strong>
                    <p>{event.message}</p>
                  </div>
                  <span>{event.status}</span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="saga-empty">실행 조건을 선택하고 주문 이벤트를 생성하세요.</div>
          )}
        </section>

        <section className="kafka-panel saga-recent">
          <h2>최근 실행</h2>
          <div className="saga-recent-list">
            {recent.map((item) => (
              <button key={item.orderId} onClick={() => setCurrent(item)} type="button">
                <span>{item.status}</span>
                <strong>{item.orderId.slice(0, 18)}</strong>
                <em>{item.failMode}</em>
              </button>
            ))}
            {recent.length === 0 && <div className="saga-empty">최근 실행이 없습니다.</div>}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
