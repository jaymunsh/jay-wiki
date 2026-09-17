import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { LiveOperations } from '@/components/LiveOperations';

const MONITORING_SCOPE = [
  { label: 'METRICS', title: 'Prometheus aggregate', detail: '요청률, 오류율, 응답시간, 이벤트와 node 사용량을 공개 요약으로 읽습니다.' },
  { label: 'LOGS', title: 'Loki', detail: '서비스 로그 원문은 Access 보호된 Grafana에서 label과 trace 문맥으로 확인합니다.' },
  { label: 'TRACES', title: 'Tempo', detail: 'Saga와 서비스 호출 경로는 trace와 Service Graph로 교차 확인합니다.' },
] as const;

const READING_GUIDE = [
  { label: '01', title: 'Traffic', detail: '요청률 변화와 5xx 비율을 먼저 보고, p95 응답시간으로 사용자 체감 지연이 있는지 확인합니다.' },
  { label: '02', title: 'Event flow', detail: '소비 이벤트가 흐르는지 확인한 뒤 DLQ 누적과 Saga 실행 신호로 비동기 실패를 좁힙니다.' },
  { label: '03', title: 'Runtime & recovery', detail: 'Spring API와 Pod, miniPC의 Node Ready·CPU·메모리·디스크를 함께 보고, 마지막 백업 성공 시각으로 복구 경로도 확인합니다.' },
] as const;

export default function MonitoringPage() {
  return (
    <>
      <Header />
      <main id="main-content" className="monitoring-page">
        <section className="monitoring-hero" aria-labelledby="monitoring-title">
          <div>
            <div className="eyebrow">Observability console</div>
            <h1 id="monitoring-title">운영 신호를 한 화면에서 읽는다</h1>
            <p>공개 홈에는 구조를 남기고, 이 화면에서 트래픽, 이벤트 흐름과 k3s 실행 상태를 15초 간격으로 확인합니다.</p>
          </div>
          <aside aria-label="모니터링 경계">
            <span>PUBLIC VIEW</span>
            <strong>aggregate only</strong>
            <p>원본 metric label, 로그와 trace는 Grafana Access 경계 안에 둡니다.</p>
          </aside>
        </section>

        <LiveOperations />

        <section className="monitoring-reading" aria-labelledby="monitoring-reading-title">
          <header>
            <span>HOW TO READ</span>
            <h2 id="monitoring-reading-title">신호를 한 번에 보지 않는다</h2>
          </header>
          <div>
            {READING_GUIDE.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="monitoring-scope" aria-labelledby="monitoring-scope-title">
          <header>
            <span>OBSERVABILITY BOUNDARY</span>
            <h2 id="monitoring-scope-title">공개 요약과 상세 분석을 분리한다</h2>
          </header>
          <div>
            {MONITORING_SCOPE.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
