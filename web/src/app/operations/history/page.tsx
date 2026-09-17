import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import {
  countByType,
  measuredCount,
  OPERATION_EVENT_LABELS,
  OPERATION_EVENT_RANGE,
  OPERATION_EVENTS,
  type OperationEventType,
} from './operationsHistory';

export const metadata: Metadata = {
  title: '운영 이력',
  robots: { index: false, follow: false },
  description: 'jay-wiki의 실제 배포, 장애, 복구와 운영 리허설을 발생일 기준으로 정리한 타임라인.',
};

const TYPE_ORDER: readonly OperationEventType[] = ['release', 'incident', 'recovery', 'drill'];

const dayFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' });
const rangeFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' });
const rangeWithoutYear = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' });
const yearOf = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric' });

function day(value: string): string {
  return dayFormat.format(new Date(value)).replace(/\.\s?/g, '.').replace(/\.$/, '');
}

export default function OperationsHistoryPage() {
  const measured = measuredCount();
  const counts = countByType();
  const firstDate = new Date(OPERATION_EVENT_RANGE.first);
  const lastDate = new Date(OPERATION_EVENT_RANGE.last);
  const first = rangeFormat.format(firstDate);
  // 같은 해라면 뒤쪽 연도를 되풀이하지 않는다.
  const last = (yearOf.format(firstDate) === yearOf.format(lastDate) ? rangeWithoutYear : rangeFormat).format(lastDate);

  return (
    <>
      <Header />
      <main id="main-content" className="history-page">
        <section className="history-hero" aria-labelledby="history-title">
          <h1 id="history-title">운영했다는 말을 사건과 시간으로 증명한다</h1>
          <p>
            miniPC 한 대에서 이 사이트를 직접 운영하는 동안 실제로 일어난 일입니다. 성공한 배포만 모아 두지는 않았고,
            실패를 감지하고 되돌린 과정과 사용자에게 미친 영향, 아직 남아 있는 한계까지 사건이 발생한 날짜 순서로
            정리했습니다. {first}부터 {last}까지 {OPERATION_EVENTS.length}건이며, 그 가운데 {measured}건은 초 단위까지
            측정했고 나머지 {OPERATION_EVENTS.length - measured}건은 측정하지 않았다는 사실을 그대로 밝혔습니다.
          </p>
          <div className="history-actions">
            <Link className="btn btn-primary" href="/portfolio">5분 포트폴리오 보기</Link>
            <Link className="btn" href="/monitoring">모니터링 보기</Link>
          </div>
        </section>

        <p className="history-counts">
          {TYPE_ORDER.map((type) => (
            <span data-type={type} key={type}>{OPERATION_EVENT_LABELS[type]} <b>{counts[type]}</b></span>
          ))}
        </p>

        <ol className="history-timeline">
          {OPERATION_EVENTS.map((event) => (
            <li className="history-event" data-type={event.type} id={event.id} key={event.id}>
              <div className="history-when">
                <time dateTime={event.occurredAt}>{day(event.occurredAt)}</time>
                <span>{OPERATION_EVENT_LABELS[event.type]}</span>
              </div>

              <div className="history-what">
                <h2>{event.title}</h2>
                <p>{event.summary}</p>
                <p className="history-steps">
                  {event.steps.map((step, index) => (
                    <span key={step}>
                      {index > 0 && <i aria-hidden="true">→</i>}
                      {step}
                    </span>
                  ))}
                </p>
                {event.followUp && (
                  <p className="history-follow-up"><span>그래서 바꾼 것</span>{event.followUp}</p>
                )}
                {/* 고친 것과 재발하지 않는 것을 확인한 것은 다른 일이다. 확인하지 않았으면 그렇게 적는다. */}
                {event.recheck && (
                  <p className="history-recheck" data-verified={event.recheck.verified}>
                    <span>{event.recheck.verified ? '재발 검증 · 확인함' : '재발 검증 · 아직 안 함'}</span>
                    {event.recheck.note}
                  </p>
                )}
                <p className="history-impact">
                  <span>사용자 영향 · {event.impact}</span>
                  <Link href={event.href}>{event.linkLabel} →</Link>
                </p>
              </div>

              <div className="history-measure">
                {event.durationSeconds === null && <span className="history-unmeasured">측정하지 않음</span>}
                <strong>{event.duration}</strong>
              </div>
            </li>
          ))}
        </ol>

        <section className="history-boundary" aria-labelledby="history-boundary-title">
          <h2 id="history-boundary-title">이 목록에 아직 없는 사건</h2>
          <p>
            컨테이너가 기동되더라도 핵심 기능이 동작하지 않는 이미지는 readiness 검사를 그대로 통과합니다. 배포가 끝난 뒤
            실제 브라우저로 공개 화면을 열어 보는 검사를 붙였고, 실패하면 텔레그램으로 알립니다.
          </p>
          {/* 왜 아직 자동 복구가 아닌지를 적지 않으면, 못 한 것인지 안 한 것인지가 읽히지 않는다. */}
          <p>
            다만 그 실패가 자동 복구로 이어지지는 않습니다. 이 검사는 글 제목이나 문구가 바뀌어도 깨질 수 있어서, 헛울림이
            실제로 얼마나 나는지 모르는 채로 되돌리는 권한을 주면 멀쩡한 배포까지 되돌아갑니다. 몇 판 지켜본 뒤에 잇겠습니다.
            기능이 깨진 이미지를 일부러 올려 이 경로가 실제로 잡아내는지도 아직 확인하지 않았습니다.{' '}
            <Link href="/wiki/alerting-inventory-and-gaps">알림 목록과 남은 구멍 읽기 →</Link>
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
