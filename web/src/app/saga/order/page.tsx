'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { ScenarioCaseBanner } from '@/app/scenarios/ScenarioCaseBanner';

const FAIL_OPTIONS = [
  { value: 'NONE', label: '정상 완료' },
  { value: 'INVENTORY_RESERVE', label: '재고 실패' },
  { value: 'PAYMENT_AUTHORIZE', label: '결제 실패' },
  { value: 'SHIPPING_REQUEST', label: '배송 실패' },
] as const;

type FailAt = (typeof FAIL_OPTIONS)[number]['value'];

type SagaStep = {
  readonly name: string;
  readonly status: string;
  readonly compensating: boolean;
  readonly message: string;
  readonly createdAt: string;
  /** 이 단계를 처리한 실물. service@pod 형식이고, 옛 실행에는 없어서 null 이 온다. */
  readonly actor: string | null;
};

type Customer = { readonly id: string; readonly name: string; readonly grade: string };

type SagaView = {
  readonly sagaId: string;
  readonly orderId: string;
  readonly status: string;
  readonly steps: readonly SagaStep[];
  // 구매자는 없을 수 있다. 이 기능 전에 만든 주문에는 customer_id 가 비어 있다.
  readonly customer: Customer | null;
  readonly order: { readonly status: string };
  readonly inventory: { readonly available: number; readonly reserved: number };
  // observedAt 은 "이 상태를 마지막으로 들은 시각" 이다. 결제는 이제 다른 서비스가 들고 있어
  // 화면이 보는 것은 원본이 아니라 사본이다. 그 사실을 숨기지 않는다.
  readonly payment: { readonly status: string; readonly observedAt: string | null };
  readonly shipping: { readonly status: string; readonly observedAt: string | null };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(value: Record<string, unknown>, key: string): string | null {
  const found = value[key];
  return typeof found === 'string' ? found : null;
}

function numberField(value: Record<string, unknown>, key: string): number | null {
  const found = value[key];
  return typeof found === 'number' ? found : null;
}

function parseStep(value: unknown): SagaStep | null {
  if (!isRecord(value)) return null;
  const name = stringField(value, 'name');
  const status = stringField(value, 'status');
  const message = stringField(value, 'message');
  const createdAt = stringField(value, 'createdAt');
  const compensating = value.compensating;
  if (!name || !status || !message || !createdAt || typeof compensating !== 'boolean') return null;
  return { name, status, compensating, message, createdAt, actor: stringField(value, 'actor') };
}

function parseSaga(value: unknown): SagaView | null {
  if (!isRecord(value)) return null;
  const sagaId = stringField(value, 'sagaId');
  const orderId = stringField(value, 'orderId');
  const status = stringField(value, 'status');
  const stepsValue = value.steps;
  const order = isRecord(value.order) ? stringField(value.order, 'status') : null;
  const payment = isRecord(value.payment) ? stringField(value.payment, 'status') : null;
  const paymentObservedAt = isRecord(value.payment) ? stringField(value.payment, 'observedAt') : null;
  const shipping = isRecord(value.shipping) ? stringField(value.shipping, 'status') : null;
  const shippingObservedAt = isRecord(value.shipping) ? stringField(value.shipping, 'observedAt') : null;
  const inventory = isRecord(value.inventory) ? value.inventory : null;
  const available = inventory ? numberField(inventory, 'available') : null;
  const reserved = inventory ? numberField(inventory, 'reserved') : null;
  if (!sagaId || !orderId || !status || !Array.isArray(stepsValue)) return null;
  if (!order || !payment || !shipping || available === null || reserved === null) return null;
  const steps = stepsValue.map(parseStep).filter((step): step is SagaStep => step !== null);
  return {
    sagaId,
    orderId,
    status,
    steps,
    customer: parseCustomer(value.customer),
    order: { status: order },
    inventory: { available, reserved },
    payment: { status: payment, observedAt: paymentObservedAt },
    shipping: { status: shipping, observedAt: shippingObservedAt },
  };
}

function parseCustomer(value: unknown): Customer | null {
  if (!isRecord(value)) return null;
  const id = stringField(value, 'id');
  const name = stringField(value, 'name');
  const grade = stringField(value, 'grade');
  return id && name && grade ? { id, name, grade } : null;
}

/**
 * 첫 단계로부터 몇 ms 뒤인지. Saga 는 수십 ms 안에 끝나서 시각을 그대로 적으면 전부 같아 보인다.
 * 사이 간격이 어디서 벌어지는지가 이 화면의 요점이라 상대값으로 적는다.
 */
function elapsedLabel(steps: readonly SagaStep[], index: number): string {
  const first = steps[0];
  const step = steps[index];
  if (!first || !step) return '';
  const gap = Date.parse(step.createdAt) - Date.parse(first.createdAt);
  return Number.isNaN(gap) ? '' : `+${gap}ms`;
}

type Participant = {
  readonly actor: string;
  readonly service: string;
  readonly pod: string | null;
  readonly forward: number;
  readonly compensated: number;
  readonly failed: number;
};

/**
 * 이번 실행에 실제로 참여한 프로세스를 처음 나온 순서대로 모은다.
 *
 * <p>단계 목록만으로는 "결제만 다른 프로세스가 했다"가 안 읽힌다. 일곱 줄이 같은 모양이라
 * 이름을 하나씩 읽어야 알기 때문이다. 그래서 누가 일했는지는 상자로 따로 세우고,
 * 언제 무엇을 했는지는 타임라인에 남긴다.
 */
function participantsOf(steps: readonly SagaStep[]): readonly Participant[] {
  const byActor = new Map<string, Participant>();
  for (const step of steps) {
    if (!step.actor) continue;
    const [service, pod] = step.actor.split('@');
    const found = byActor.get(step.actor) ?? {
      actor: step.actor, service, pod: pod || null, forward: 0, compensated: 0, failed: 0,
    };
    byActor.set(step.actor, {
      ...found,
      forward: found.forward + (step.compensating ? 0 : 1),
      compensated: found.compensated + (step.compensating ? 1 : 0),
      failed: found.failed + (step.status === 'FAILED' ? 1 : 0),
    });
  }
  return [...byActor.values()];
}

/** service@pod 를 사람이 읽는 꼴로. 파드 이름이 없으면 서비스만 남긴다. */
function actorLabel(actor: string): string {
  const [service, pod] = actor.split('@');
  return pod ? `${service} · ${pod}` : service;
}

async function readSagaResponse(response: Response): Promise<SagaView | null> {
  if (!response.ok) return null;
  return parseSaga(await response.json());
}

/**
 * 결제·배송 상태는 다른 서비스가 든 것을 이벤트로 받아 만든 사본이라 최신이 아닐 수 있다.
 * 폴링으로 매끄럽게 감추지 않고 "몇 초 전 기준" 인지를 적는다 — 감추면 분리한 것과
 * 안 한 것이 화면에서 구분되지 않는다.
 */
function projectionLabel(state: { readonly status: string; readonly observedAt: string | null }): string {
  if (state.status === 'NONE') return '확인 중 (아직 못 들음)';
  if (!state.observedAt) return state.status;
  const seconds = Math.max(0, Math.round((Date.now() - new Date(state.observedAt).getTime()) / 1000));
  return `${state.status} (${seconds}초 전 기준)`;
}

function newIdempotencyKey(): string {
  return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function OrderSagaPage() {
  const [failAt, setFailAt] = useState<FailAt>('NONE');
  const [customers, setCustomers] = useState<readonly Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [current, setCurrent] = useState<SagaView | null>(null);
  const [recent, setRecent] = useState<readonly SagaView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshRecent() {
    try {
      const response = await fetch('/api/bff/saga/orders?size=8', { cache: 'no-store' });
      if (!response.ok) return;
      const payload: unknown = await response.json();
      const next = Array.isArray(payload)
        ? payload.map(parseSaga).filter((item): item is SagaView => item !== null)
        : [];
      setRecent(next);
    } catch {
      // 최근 실행 목록은 보조 정보다. 실패해도 실행 폼은 계속 쓸 수 있어야 한다.
    }
  }

  useEffect(() => {
    void refreshRecent();
    // 구매자는 시드된 고정 목록이라 한 번만 읽는다.
    void (async () => {
      try {
        const response = await fetch('/api/bff/saga/customers', { cache: 'no-store' });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        if (!Array.isArray(payload)) return;
        const list = payload.map(parseCustomer).filter((item): item is Customer => item !== null);
        setCustomers(list);
        if (list[0]) setCustomerId(list[0].id);
      } catch {
        // 구매자 목록이 없어도 주문은 만들 수 있다. 그때는 '구매자 없음'으로 남는다.
      }
    })();
  }, []);

  async function runSaga() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/bff/saga/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerId: customerId || null,
          productCode: 'JAY-HOODIE',
          quantity,
          failAt,
          idempotencyKey: newIdempotencyKey(),
        }),
      });
      const result = await readSagaResponse(response);
      if (!result) {
        setError('Saga 실행 응답을 읽지 못했습니다.');
        return;
      }
      setCurrent(result);
      await refreshRecent();
    } finally {
      setLoading(false);
    }
  }

  const participants = useMemo(() => (current ? participantsOf(current.steps) : []), [current]);

  const states = useMemo(() => {
    if (!current) return [];
    return [
      ['Customer', current.customer ? `${current.customer.name} (${current.customer.grade})` : '구매자 없음'],
      ['Order', current.order.status],
      ['Inventory', `${current.inventory.available} available / ${current.inventory.reserved} reserved`],
      ['Payment', projectionLabel(current.payment)],
      ['Shipping', projectionLabel(current.shipping)],
    ] as const;
  }, [current]);

  return (
    <>
      <Header />
      <main id="main-content">
        <section className="saga-hero">
          <div>
            <div className="eyebrow">Saga pattern</div>
            <h1>주문결제 Saga 시뮬레이터</h1>
            <p>
              Spring이 전체 Saga를 오케스트레이션하고, FastAPI 결제 서비스가 독립 참여자로
              승인과 취소 보상 API를 담당합니다.
            </p>
            <p className="saga-hero-howto">
              아래 <strong>실행 조건</strong>에서 실패 지점을 하나 고르고 <strong>Saga 실행</strong>을 누르면,
              끝난 단계가 역순으로 보상되는 과정이 타임라인에 그려집니다.
            </p>
          </div>
          <div className={`saga-chip ${current?.status === 'FAILED' ? 'danger' : 'success'}`}>
            {current ? current.status : 'READY'}
          </div>
        </section>

        <ScenarioCaseBanner scenarioId="saga-observability" />

        {/* 실행 전에도 그린다. 이 시나리오가 어느 파드를 쓰는지는 누르기 전에 알 일이다. */}
        <SagaPodTrack
          participants={participants}
          steps={current?.steps ?? []}
          status={current?.status ?? null}
        />

        <section className="saga-layout">
          <div className="saga-panel">
            <h2>실행 조건</h2>
            <label className="saga-field">
              <span>구매자</span>
              <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                {customers.length === 0 && <option value="">구매자 없음</option>}
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} · {customer.grade}
                  </option>
                ))}
              </select>
            </label>
            <label className="saga-field">
              <span>상품</span>
              <input value="JAY-HOODIE" readOnly />
            </label>
            <label className="saga-field">
              <span>수량</span>
              <input
                min={1}
                max={3}
                type="number"
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
              />
            </label>
            <div className="saga-segments">
              {FAIL_OPTIONS.map((option) => (
                <button
                  className={failAt === option.value ? 'active' : ''}
                  key={option.value}
                  onClick={() => setFailAt(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button className="btn btn-primary saga-run" disabled={loading} onClick={runSaga}>
              {loading ? '실행 중' : 'Saga 실행'}
            </button>
            {error && <div className="saga-error">{error}</div>}
          </div>

          <div className="saga-panel saga-state-panel">
            <h2>현재 상태</h2>
            <div className="saga-state-grid">
              {states.length === 0 && <div className="saga-empty">아직 실행된 Saga가 없습니다.</div>}
              {states.map(([name, value]) => (
                <div className="saga-state" key={name}>
                  <span>{name}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="saga-panel saga-timeline">
            <h2>실행 타임라인</h2>
            {current ? (
              <ol>
                {current.steps.map((step, index) => {
                  // 되돌리기가 시작되는 자리에만 경계를 둔다. 앞 단계가 보상이 아니었던 첫 보상이다.
                  const turns = step.compensating && !current.steps[index - 1]?.compensating;
                  return (
                    <Fragment key={`${step.name}-${step.createdAt}`}>
                      {turns && (
                        <li className="saga-turn">여기서 꺾인다. 아래는 되돌리기다</li>
                      )}
                      <li className={step.status.toLowerCase()}>
                        <span className="saga-dot" />
                        <div>
                          <strong>
                            {step.compensating && <span aria-hidden="true">↩ </span>}
                            {step.name}
                          </strong>
                          <p>{step.message}</p>
                          {step.actor && <p className="saga-actor">{actorLabel(step.actor)}</p>}
                        </div>
                        <span className="saga-step-status">
                          <em>{elapsedLabel(current.steps, index)}</em>
                          {step.compensating ? 'COMPENSATED' : step.status}
                        </span>
                      </li>
                    </Fragment>
                  );
                })}
              </ol>
            ) : (
              <div className="saga-empty">실패 모드를 선택하고 Saga를 실행하세요.</div>
            )}
          </div>
        </section>

        <section className="saga-panel saga-recent">
          <h2>최근 실행</h2>
          <div className="saga-recent-list">
            {recent.map((item) => (
              <button key={item.sagaId} onClick={() => setCurrent(item)} type="button">
                <span>{item.status}</span>
                <strong>{item.sagaId.slice(0, 18)}</strong>
                <em>{item.steps.at(-1)?.name ?? 'STARTED'}</em>
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

/** k8s 로고와 같은 칠각형. 반지름 9 로 계산해 둔 좌표다. 레인 머리의 작은 표식이다. */
const POD_SHAPE = '0.0,-9.0 7.0,-5.6 8.8,2.0 3.9,8.1 -3.9,8.1 -8.8,2.0 -7.0,-5.6';

/**
 * Saga 에 관여하는 파드는 이 셋으로 정해져 있다. 이번 실행이 못 들른 파드도 세로선은 그린다 --
 * 결제에서 꺾여 배송까지 못 간 것과 배송이 아예 없는 것은 다른 이야기다.
 */
const SAGA_LIFELINES = [
  { service: 'spring', x: 66 },
  { service: 'payment-api', x: 244 },
  { service: 'shipping-api', x: 398 },
] as const;

const LIFELINE_X: Readonly<Record<string, number>> = Object.fromEntries(
  SAGA_LIFELINES.map((lane) => [lane.service, lane.x]),
);
const SPRING_X = 66;
const HEAD_BOTTOM = 52;
const FIRST_CALL_Y = 74;
const CALL_STEP = 42;
const RETURN_GAP = 19;
/** 마지막 칸은 라이프라인 첫 줄부터 끝 줄까지 덮는다. 그래야 실행이 끝난 선으로 읽힌다. */
const CLOSING_WIDTH = 398 - 66 + 20;

/** 참여자를 부른 단계의 짧은 이름. 없는 단계는 이름을 그대로 쓴다. */
const CALL_LABEL: Readonly<Record<string, string>> = {
  PAYMENT_AUTHORIZED: '승인',
  PAYMENT_CANCELLED: '취소',
  SHIPPING_REQUESTED: '배송 요청',
};

const CALL_ORDER_MARK = ['①', '②', '③', '④', '⑤', '⑥', '⑦'] as const;

type Call = {
  readonly service: string;
  readonly label: string;
  readonly failed: boolean;
  readonly compensating: boolean;
};

/**
 * 파드 경계를 넘은 호출만 순서대로 모은다.
 *
 * spring 이 자기 안에서 처리한 단계는 세지 않는다. 이 그림이 말하는 것은 프로세스 사이를 오간
 * 호출이고, 안에서 한 일까지 세면 번호가 아래 타임라인 줄과 어긋나 순서가 둘이 된다.
 */
function callsOf(steps: readonly SagaStep[]): readonly Call[] {
  const calls: Call[] = [];
  for (const step of steps) {
    if (!step.actor) continue;
    const [service] = step.actor.split('@');
    if (service === 'spring' || !(service in LIFELINE_X)) continue;
    calls.push({
      service,
      label: `${CALL_ORDER_MARK[calls.length] ?? `(${calls.length + 1})`} ${CALL_LABEL[step.name] ?? step.name}`,
      failed: step.status === 'FAILED',
      compensating: step.compensating,
    });
  }
  return calls;
}

/**
 * 이번 실행이 파드 사이를 오간 순서. 세로선 하나가 파드 하나이고 시간은 위에서 아래로 흐른다.
 *
 * 실선 화살표가 spring 이 건 호출이고 점선이 그 응답이다. 동기 호출이라 성공이든 실패든 제어는
 * spring 으로 돌아오며, 그래서 마지막 단계는 늘 spring 이 남긴다 -- 맨 아래 칸이 그 자리다.
 */
function SagaPodTrack({
  participants,
  steps,
  status,
}: {
  readonly participants: readonly Participant[];
  readonly steps: readonly SagaStep[];
  readonly status: string | null;
}) {
  const calls = callsOf(steps);
  const ran = steps.length > 0;
  const visited = (service: string) => participants.find((item) => item.service === service);
  const lastStep = steps[steps.length - 1];
  // 실행 전에도 세로선이 설 만큼은 자리를 준다. 칸만 덩그러니 있으면 그림이 아니라 상자가 된다.
  const closingY = calls.length > 0 ? FIRST_CALL_Y + calls.length * CALL_STEP + 4 : FIRST_CALL_Y + 24;
  const height = closingY + 30;

  return (
    <section className="saga-pods" aria-label="이번 실행이 파드 사이를 오간 순서">
      <h2>{ran ? `이번 실행이 오간 파드 ${participants.length}` : '이 시나리오가 쓰는 파드 3'}</h2>
      <div className="saga-pod-scroll">
        <svg
          className="saga-pod-track"
          viewBox={`0 0 516 ${height}`}
          role="img"
          aria-label={`spring 이 ${calls.map((call) => call.label).join(', ')} 순서로 참여자를 불렀고 제어는 spring 으로 돌아왔다`}
        >
          <defs>
            <marker id="saga-tip" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 z" />
            </marker>
            <marker id="saga-tip-back" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path className="back" d="M0,0 L7,3.5 L0,7 z" />
            </marker>
            <marker id="saga-tip-fail" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path className="fail" d="M0,0 L7,3.5 L0,7 z" />
            </marker>
          </defs>

          {SAGA_LIFELINES.map((lane) => {
            const participant = visited(lane.service);
            return (
              <g key={lane.service} className={`saga-life ${participant ? '' : 'idle'}`}>
                {/* 머리는 세로선 위에 세운다. 이름을 옆에 붙이면 줄과 어긋나 보인다. */}
                <g transform={`translate(${lane.x} 12)`}>
                  <polygon points={POD_SHAPE} />
                </g>
                <text className="saga-life-name" x={lane.x} y={34} textAnchor="middle">
                  {lane.service}
                </text>
                <text className="saga-life-pod" x={lane.x} y={45} textAnchor="middle">
                  {participant ? participant.pod ?? '이름 없음' : ran ? '못 들렀다' : '실행 전'}
                </text>
                <line className="saga-life-line" x1={lane.x} y1={HEAD_BOTTOM} x2={lane.x} y2={height - 6} />
              </g>
            );
          })}

          {calls.map((call, index) => {
            const y = FIRST_CALL_Y + index * CALL_STEP;
            const to = LIFELINE_X[call.service] ?? SPRING_X;
            const mid = (SPRING_X + to) / 2;
            return (
              <g key={`${call.label}-${call.service}`}>
                <text className="saga-call-label" x={mid} y={y - 6} textAnchor="middle">
                  {call.label}
                </text>
                <line
                  className={`saga-call-line ${call.compensating ? 'compensating' : ''}`}
                  x1={SPRING_X + 2}
                  y1={y}
                  x2={to - 7}
                  y2={y}
                  markerEnd="url(#saga-tip)"
                />
                <text
                  className={`saga-return-label ${call.failed ? 'failed' : ''}`}
                  x={mid}
                  y={y + RETURN_GAP - 5}
                  textAnchor="middle"
                >
                  {call.failed ? '거절' : '응답'}
                </text>
                <line
                  className={`saga-return-line ${call.failed ? 'failed' : ''}`}
                  x1={to - 2}
                  y1={y + RETURN_GAP}
                  x2={SPRING_X + 7}
                  y2={y + RETURN_GAP}
                  markerEnd={`url(#saga-tip-${call.failed ? 'fail' : 'back'})`}
                />
              </g>
            );
          })}

          {/* 제어가 돌아와 끝나는 자리. 사가의 마지막 단계는 늘 spring 이 남긴다.
              라이프라인 폭에 맞춰 가로로 깔면 "여기서 실행이 끝났다" 는 선 역할까지 한다. */}
          <g className={`saga-closing ${ran ? '' : 'waiting'} ${status === 'FAILED' ? 'failed' : ''}`}>
            <rect x={SPRING_X - 10} y={closingY} width={CLOSING_WIDTH} height={22} rx={4} />
            <text className="saga-closing-label" x={SPRING_X} y={closingY + 15}>
              {ran ? '마지막 단계' : '실행 결과'}
            </text>
            <text className="saga-closing-step" x={SPRING_X - 10 + CLOSING_WIDTH - 10} y={closingY + 15} textAnchor="end">
              {ran ? lastStep?.name ?? status : '아직 실행하지 않았다'}
            </text>
          </g>
        </svg>
      </div>
      <p className="saga-pod-note">
        {ran
          ? '시간은 위에서 아래로 흐른다. 실선이 spring 이 건 호출이고 점선이 그 응답이며, 점선을 끊어 그린 호출은 되돌리기다. 성공이든 실패든 제어는 spring 으로 돌아와 맨 아래 칸의 단계를 남긴다. 걸린 시간은 아래 타임라인에 ms 로 있다.'
          : '실행하면 spring 이 두 참여자를 부른 순서가 이 자리에 그려진다. 어느 파드까지 갔는지, 어디서 꺾여 무엇을 되돌렸는지가 화살표로 남는다.'}
      </p>
    </section>
  );
}
