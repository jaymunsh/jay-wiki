import type { Metadata } from 'next';
import testSummary from '@/data/test-summary.json';
import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { getTabs } from '@/lib/api';
import { logPosition, TIME_SCALE_TICKS } from '@/lib/timeScale';
import { ORDERED_SCENARIOS, SCENARIO_EXECUTION } from '@/app/scenarios/scenarios';

export const metadata: Metadata = {
  title: '5분 포트폴리오',
  description: 'jay-wiki의 문제, 설계 결정, 실제 운영 증거와 한계를 5분 안에 읽는 개발자 포트폴리오.',
  robots: { index: false, follow: false },
};

/**
 * 로그 눈금 위에 올리는 운영 실측값. 날짜와 실행 조건이 고정된 값만 싣는다.
 * 지금 카운터를 읽어 오는 수치는 여기 넣지 않는다 — 볼 때마다 달라지면 증거가 아니다.
 */
const MEASUREMENTS: readonly {
  seconds: number; value: string; label: string; date?: string; note: string; href: string;
}[] = [
  { seconds: 2.1, value: '2.1초', label: '끝내 실패한 메시지를 따로 모으기', date: '2026-08-19', note: '0.5초 간격으로 세 번 재시도한 뒤 격리(Kafka DLQ)', href: '/wiki/kafka-dlq-rehearsal' },
  { seconds: 2.2, value: '2.2초', label: '백업 파일로 데이터베이스 되살리기', date: '2026-08-16', note: '임시 DB · 위키 70행·게시판 100,007행 대조 · 오류 0건', href: '/wiki/postgres-backup-restore' },
  { seconds: 9, value: '9초', label: '받을 수 없는 이미지를 배포하고 되돌리기', date: '2026-08-19', note: '그동안 들어온 요청 66회 전부 정상 응답', href: '/wiki/image-that-never-pulled' },
  { seconds: 35, value: '35초', label: '배포가 실패해 저절로 되돌아가기', date: '2026-08-16', note: '실패를 감지한 시각부터 복구를 확인하기까지', href: '/wiki/never-exercised-code' },
  { seconds: 60, value: '60초', label: '서버를 껐다 켜는 동안 사이트가 멈춘 시간', date: '2026-08-09', note: '컨테이너 23개가 모두 돌아오기까지는 91초', href: '/wiki/minipc-reboot-recovery-drill' },
  { seconds: 70, value: '70초', label: '돌고 있는 서비스를 새 버전으로 교체', note: '이미지 6개 · GitHub Actions run 32220470022', href: '/wiki/release-record-one-run' },
  { seconds: 1002, value: '16분 42초', label: '배포 한 판을 처음부터 끝까지', note: '코드를 빌드해서 공개 화면이 정상인지 확인하기까지', href: '/wiki/release-record-one-run' },
];

/** Complete Spring/Vitest runs generate this snapshot; browser and service suites are excluded. */
const TEST_TOTAL = testSummary.total;

/**
 * 운영에 처음 배포한 날. GitHub Actions 의 첫 실행이 2026-07-07 이고 같은 날 성공했다.
 * 저장소 첫 커밋은 7월 4일이지만 그것은 개발 시작이라 「운영 중」의 기준으로 쓰지 않는다.
 * 숫자를 손으로 적으면 다음 달에 틀리므로 여기서 계산한다.
 */
const STARTED_AT = Date.parse('2026-07-07T00:00:00+09:00');

/**
 * 지금 시각은 렌더 밖에서 읽는다. 컴포넌트 본문에서 Date.now 를 부르면 렌더가 순수하지 않다고
 * react-hooks 규칙이 막는다 — 서버 컴포넌트라 실제로는 요청마다 한 번이지만 규칙은 구분하지 않는다.
 */
async function elapsedWeeksSinceStart(): Promise<number> {
  return Math.max(1, Math.floor((Date.now() - STARTED_AT) / (7 * 24 * 60 * 60 * 1000)));
}

/**
 * 운영 비용. 2026-08-23 확인.
 * 장비는 GenMachine Ren4000(Ryzen 7 4700U)에 메모리 16GB·SSD 512GB 를 더해 약 22만원.
 * 비교값인 AWS c6i.2xlarge(8 vCPU·16GiB) 서울 온디맨드 시간당 0.384달러는 2026-08-23 확인이다.
 * 730시간이면 280달러이고 gp3 512GB 를 더하면 320달러 남짓이라 화면에는 40만원대로 적었다.
 * 전기는 BIOS 전력 한도 20W 를 24시간으로 잡아 월 14.4kWh, 주택용 저압 2단계
 * 214.6원에 기후환경 9원·연료비조정 5원을 더하고 부가세와 기금을 붙여 약 3,700원이다.
 * 콘센트 실측은 아직 없다 — minipc-hardware-capacity-design 에도 재확인 필요로 적혀 있다.
 */
const MONTHLY_COST = '약 5천원 / 월';

const LAYERS = [
  { label: '화면', detail: 'Next.js가 위키와 블로그, 게시판, 시연 화면을 그립니다. 브라우저는 이 사이트 주소로만 요청하고 화면 서버가 그것을 안쪽으로 넘기기 때문에(BFF), 뒤쪽 서버 주소는 밖으로 드러나지 않습니다.' },
  { label: '서버', detail: 'Spring이 글의 수정 이력과 게시판, 주문 처리 흐름, 서비스 사이 메시지 전달 결과를 PostgreSQL에 기록합니다.' },
  { label: '저장소', detail: '저장소마다 맡는 것이 다릅니다. PostgreSQL은 원본, Redis는 로그인 상태와 대기열, Kafka는 서비스 사이 메시지 전달, OpenSearch는 언제든 다시 만들 수 있는 검색용 사본, MinIO는 이미지 같은 파일입니다.' },
  { label: '인프라', detail: '서버 한 대에 Kubernetes(k3s)를 올려 컨테이너를 굴립니다. 밖에서 들어오는 길과 내부끼리만 닿는 길을 갈라 두어서, 외부에 열린 것은 화면 서버 하나뿐입니다.' },
  { label: '관측', detail: '지표와 로그와 요청 추적을 한 화면에서 봅니다. 실패한 요청 하나를 골라 그 요청이 어느 서비스를 어떤 순서로 지났는지까지 따라갈 수 있습니다.' },
  { label: '배포', detail: 'GitHub에 코드를 올리면 자동으로 이미지를 만들고, 서버가 그것을 받아 교체한 다음 공개 화면이 정상인지 확인합니다. 배포 절차가 감지하는 실패는 직전 이미지로 되돌립니다. 접속 확인을 통과한 업무 기능 오류까지 자동 복구하는 것은 아닙니다.' },
] as const;

/** 선택마다 비용을 같이 적는다. 비용 없는 결정은 결정이 아니라 취향이다. */
const DECISIONS = [
  {
    title: '서비스 수보다 실패 경계로 나눴다',
    why: 'Spring이 주문 전체의 흐름과 최종 상태를 맡고, 실패를 따로 다뤄야 하는 결제와 배송, 외부 제휴사 역할만 별도 서비스로 떼어 냈습니다.',
    cost: '한 서비스 안에서 끝났을 일을 여러 서비스로 나눴습니다. 그래서 결제를 되돌리는 호출은 물론이고, 그 되돌리기마저 실패하는 경우까지 직접 처리해야 합니다.',
    href: '/wiki/why-only-five-services',
  },
  {
    title: '글은 배포와 따로 움직이게 했다',
    why: '지금 화면에 보이는 글은 데이터베이스가 원본입니다. 그래서 고치면 바로 반영되고 이전 판으로 되돌릴 수도 있습니다. 다만 검토를 마친 원고는 백업과 대조를 거쳐야 운영에 올라갑니다.',
    cost: '글을 한 편만 고쳐도 세 단계를 거칩니다. 저장소의 원고와 운영의 글이 어긋나도 화면에는 티가 나지 않아서, 검사 스크립트를 돌려야 알 수 있습니다.',
    href: '/wiki/content-origin-and-history-boundary',
  },
  {
    title: '서버가 한 대뿐이라는 사실을 숨기지 않았다',
    why: '부하가 늘면 컨테이너 수를 자동으로 늘리는 것까지만 확인했고, 이것을 무중단이라고 부르지 않습니다. 그 대신 서버를 껐다 켜는 시간과 백업을 되살리는 시간을 직접 쟀습니다.',
    cost: '서버가 한 대라서 그 한 대가 멈추면 전부 멈춥니다. 멈추지 않게 만드는 대신, 멈췄을 때 얼마나 빨리 돌아오는지를 아는 쪽을 골랐습니다.',
    href: '/wiki/zero-downtime-on-one-machine',
  },
] as const;

const DEMOS = [
  { minutes: '2분', title: '배송이 실패하면 결제와 재고가 되돌아가는지 본다', detail: '재고를 잡고 결제를 승인한 다음 배송을 일부러 실패시켜서, 결제 취소와 재고 반환이 거꾸로 차례차례 일어나는지 확인합니다.', href: '/saga/order', action: 'Saga 실행하기' },
  { minutes: '1분', title: '다시 보낼 메시지와 포기할 메시지를 가른다', detail: '정상 처리와 한 번 실패, 계속 실패를 차례로 실행해서 메시지를 다시 시도하는 모습과, 끝내 실패한 메시지를 따로 모아 두는 모습을 시간 순서로 봅니다.', href: '/kafka/order', action: 'Kafka 실행하기' },
  { minutes: '2분', title: '실패한 배포가 어떻게 복구됐는지 읽는다', detail: '성공한 목록이 아니라 문제를 알아챈 시각과 되돌리는 데 걸린 시간, 사용자가 받은 영향, 아직 남아 있는 한계를 사건 순서로 확인합니다.', href: '/operations/history', action: '운영 이력 보기' },
] as const;

const LIMITS = [
  { title: '서버가 한 대뿐입니다', detail: '컨테이너를 늘려도 전부 같은 miniPC 안에서 늘어납니다. 그 한 대가 멈추면 사이트도 멈춥니다.' },
  { title: '백업이 다른 장소에 없습니다', detail: '개발용 기계로 받아 되살리는 것까지 확인했지만, 두 기계가 같은 방에 있어서 화재나 도난은 못 막습니다.' },
  { title: '켜지긴 하는데 망가진 배포는 못 잡습니다', detail: '컨테이너 상태와 공개 경로의 응답 확인만으로 모든 업무 기능을 검증할 수는 없습니다. 그 확인을 통과한 기능 오류는 자동 롤백 대상에서 놓칠 수 있습니다.' },
] as const;

export default async function PortfolioPage() {
  const tabs = await getTabs();
  const publishedArticleCount = tabs.flatMap((tab) => tab.articles).filter((article) => article.status === 'published').length;
  const publicTabCount = tabs.filter((tab) => tab.articles.some((article) => article.status === 'published')).length;
  const wikiCount = publishedArticleCount > 0 ? `${publishedArticleCount}편 · ${publicTabCount}개 탭` : '운영 API 연결 대기';
  const liveScenarioCount = ORDERED_SCENARIOS.filter((scenario) => SCENARIO_EXECUTION[scenario.id].kind === 'live').length;
  const runningWeeks = await elapsedWeeksSinceStart();

  return (
    <>
      <Header />
      <main id="main-content" className="portfolio-page">
        <section className="portfolio-hero" aria-labelledby="portfolio-title">
          <p className="portfolio-byline">개인 프로젝트 · 1인 개발 · 2026년 7월 7일 첫 배포 · {runningWeeks}주째 운영 중</p>
          <h1 id="portfolio-title">jay-wiki: 실패를 설계하고, 실행과 복구로 검증합니다</h1>
          <p className="portfolio-thesis">백엔드 설계를 실행 가능한 시연과 운영 기록으로 연결한 개인 프로젝트입니다.</p>
          <p>위키·블로그는 설계와 운영 기록을 읽는 공간이고, 주문·결제·배송 시연은 그 설계를 실행해 확인하는 공간입니다. Ryzen 7 4700U·RAM 16GB miniPC 한 대에서 k3s로 직접 운영합니다.</p>
          <p className="portfolio-stack">Spring Boot · FastAPI · Next.js · Kafka · PostgreSQL · Redis · Kubernetes(k3s)</p>
          {/* 1인 개발로 이 규모를 이 기간에 했다면 반드시 묻는 질문이다. 먼저 밝히고 근거로 보낸다. */}
          <p className="portfolio-ai">
            조사·구현·테스트에는 AI 에이전트를 활용했습니다. 제 설계 판단은 서비스의 실패 경계, 글과 배포의 분리, 단일 서버의 복구 범위에 담았습니다. 아래에서 선택 이유와 감수한 비용을 확인할 수 있습니다. <Link href="/wiki/ai-assisted-development-harness">AI와 개발한 방식 →</Link>
          </p>
          <div className="portfolio-actions">
            <Link className="btn btn-primary" href="/saga/order">대표 사례 실행 →</Link>
            <Link className="btn" href="/operations/history">운영 이력 보기</Link>
          </div>

          <dl className="portfolio-facts" aria-label="프로젝트 현재 수치">
            <div><dt>유지비 추정 · 전기·도메인</dt><dd>{MONTHLY_COST}</dd></div>
            <div><dt>공개 위키</dt><dd>{wikiCount}</dd></div>
            <div><dt>시나리오</dt><dd>{ORDERED_SCENARIOS.length}개</dd></div>
            <div><dt>최근 전체 회귀 검증 · Spring/웹</dt><dd>{TEST_TOTAL}개</dd></div>
          </dl>
        </section>

        <section className="portfolio-case" aria-labelledby="portfolio-case-title">
          <p className="portfolio-demo-note">대표 사례 · 약 1분 읽기</p>
          <h2 id="portfolio-case-title">배송 실패 뒤, 이미 승인한 결제는 어떻게 처리할까</h2>
          <p>실제 상거래 서비스가 아니라 외부 서비스 실패와 보상 처리를 검증하는 시연입니다. 성공 경로보다 실패 후 남는 상태를 설계 대상으로 삼았습니다.</p>
          <dl className="portfolio-layers">
            <div><dt>문제</dt><dd>결제·배송이 별도 서비스이면 하나의 DB 트랜잭션으로 모두 되돌릴 수 없습니다. 응답이 없을 때는 요청이 거절된 것인지, 접수 후 응답만 유실된 것인지도 다릅니다.</dd></div>
            <div><dt>선택</dt><dd>Spring이 순서와 상태를 관리하고, 외부 호출은 DB 트랜잭션 밖에서 수행합니다. 단계별로 기록하고 명시적 실패와 응답 불명을 구분합니다.</dd></div>
            <div><dt>확인</dt><dd>배송 거절을 주입해 결제 취소와 재고 반환을 확인합니다. 화면에서 단계별 결과를 보고, 정상 주문과 실패 주문의 최종 상태를 비교할 수 있습니다.</dd></div>
            <div><dt>남은 한계</dt><dd>호출 도중 프로세스가 종료된 작업을 자동으로 이어받거나, 참여자에 남은 미결 상태를 사후 대조하는 절차는 아직 없습니다.</dd></div>
          </dl>
          <div className="portfolio-actions"><Link className="btn btn-primary" href="/saga/order">실패 상황 실행하기 →</Link><Link className="btn" href="/wiki/why-only-five-services">분리한 이유와 비용 →</Link></div>
        </section>

        <section className="portfolio-architecture" aria-labelledby="portfolio-architecture-title">
          <h2 id="portfolio-architecture-title">브라우저 요청 하나가 다섯 계층을 지납니다</h2>
          <div className="portfolio-system-map" aria-label="jay-wiki 시스템 구조">
            <div><span>사용자</span><strong>Browser</strong><small>portfolio · blog</small></div>
            <i aria-hidden="true">→</i>
            <div><span>입구</span><strong>Cloudflare · Traefik</strong><small>Tunnel · Access · Ingress</small></div>
            <i aria-hidden="true">→</i>
            <div className="accent"><span>화면</span><strong>Next.js + BFF</strong><small>same-origin boundary</small></div>
            <i aria-hidden="true">→</i>
            <div><span>서버</span><strong>Spring · FastAPI</strong><small>Saga · Outbox · simulator</small></div>
            <i aria-hidden="true">→</i>
            <div><span>저장소</span><strong>Postgres · Redis · Kafka</strong><small>OpenSearch · MinIO</small></div>
          </div>
          <div className="portfolio-observe-line"><span>관측</span><b>Prometheus · Loki · Tempo</b><i aria-hidden="true">→</i><b>Grafana · Telegram</b></div>
          <dl className="portfolio-layers">
            {LAYERS.map((layer) => (
              <div key={layer.label}><dt>{layer.label}</dt><dd>{layer.detail}</dd></div>
            ))}
          </dl>
        </section>

        <section className="portfolio-decisions" aria-labelledby="portfolio-decisions-title">
          <h2 id="portfolio-decisions-title">세 가지 선택과 감수한 비용</h2>
          <ol>
            {DECISIONS.map((decision) => (
              <li key={decision.href}>
                <h3><Link href={decision.href}>{decision.title} <i aria-hidden="true">→</i></Link></h3>
                <p>{decision.why}</p>
                <p className="portfolio-cost"><span>감수한 비용</span>{decision.cost}</p>
              </li>
            ))}
          </ol>
          {/* 「싸다」는 비교 대상이 있어야 뜻이 선다. 성능이 같지 않다는 단서를 바로 뒤에 붙인다. */}
          <details className="portfolio-cost-note portfolio-details">
            <summary>운영 비용과 장비 비교 · 산정 기준 펼치기</summary>
            <span>유지비 추정 · 장비·개발 인건비 제외 · 2026-08-23 산정</span>
            <p>
              달마다 나가는 돈은 전기 요금 4천원 안팎이 거의 전부입니다. 도메인은 1년에 5천원이고, 인터넷은 건물에서
              제공합니다. 포트포워딩이 막혀 있어 Cloudflare Tunnel로 외부에 내는데, 무료 등급이라 이것도 0원입니다.
            </p>
            <p>
              전기 값은 BIOS에 걸어 둔 전력 한도 20W를 24시간 기준으로 환산한 것입니다. 월 14kWh 남짓이고 주택용
              2단계 요금으로 4천원쯤인데, 콘센트에서 실제로 재 본 적은 아직 없습니다.
            </p>
            <p>
              장비 값은 처음 한 번만 들었습니다. Ryzen 7 4700U에 메모리 16GB와 SSD 512GB를 얹어 약 22만원입니다.
              같은 급을 AWS 서울 리전에서 빌린다면 c6i.2xlarge(8 vCPU · 16GiB)가 가깝고, 24시간 켜 두고 디스크까지
              더하면 한 달에 40만원대입니다. <b>클라우드로 한 달 빌리는 값이 이 장비를 통째로 사는 값보다 큽니다.</b>
            </p>
            <p>
              다만 성능이 같다는 뜻은 아닙니다. c6i는 서버용 Xeon을 쓰고 4700U는 저전력 노트북용입니다. 반대로 AWS가
              세는 8 vCPU는 하이퍼스레딩을 포함한 값이라 물리 코어로는 넷이고, 4700U는 8코어입니다. 어느 쪽도 성능
              측정이 아니라 코어 수와 메모리만 맞춰 세운 비교입니다.
            </p>
          </details>
        </section>

        <section className="portfolio-scale" aria-labelledby="portfolio-scale-title">
          <header>
            <h2 id="portfolio-scale-title">검증한 결과와 측정 범위를 함께 봅니다</h2>
            <p>서로 다른 작업의 기록이므로 시간의 대소로 성능을 비교하지 않습니다. DB 복원은 임시 DB의 데이터 검증이며 전체 서비스의 복구 시간이 아닙니다. 날짜와 범위를 고정한 기록을 근거 문서로 연결했습니다.</p>
          </header>
          <div className="portfolio-evidence">
            <article><h3>데이터를 되살릴 수 있는가</h3><strong>2.2초 · 임시 DB 복원</strong><p>2026-08-16, 위키 70행·게시판 100,007행을 대조하고 오류 0건을 확인했습니다. 서버 전체 복구와 원격 재해복구는 별도 과제입니다.</p><Link href="/wiki/postgres-backup-restore">복원 조건과 결과 →</Link></article>
            <article><h3>잘못된 배포의 영향은 무엇인가</h3><strong>9초 · 이미지 배포 복구</strong><p>2026-08-19, 받을 수 없는 이미지를 배포한 시험에서 관측한 요청 66회가 모두 정상 응답했습니다. 모든 장애의 무중단을 보장하지는 않습니다.</p><Link href="/wiki/image-that-never-pulled">실패 주입과 요청 기록 →</Link></article>
            <article><h3>서버 자체가 멈추면 어떻게 되는가</h3><strong>60초 · 사이트 중단</strong><p>2026-08-09 재부팅 시험에서 사이트 중단은 60초, 컨테이너 23개 복귀는 91초였습니다. 단일 노드의 장애 범위를 측정했습니다.</p><Link href="/wiki/minipc-reboot-recovery-drill">재부팅 복구 기록 →</Link></article>
          </div>
          <p className="portfolio-demo-note">회귀 검증은 {TEST_TOTAL}개라는 개수와 함께 범위를 봅니다. 이 합계는 Spring·웹 테스트이며, 브라우저 사용 흐름과 별도 서비스 검증까지 포함한 수치는 아닙니다.</p>
          <details className="portfolio-details"><summary>전체 측정 기록 7건 펼치기 · 작업별 시간, 성능 순위 아님</summary>
          <div className="scale-chart">
            <div className="scale-grid" aria-hidden="true">
              {TIME_SCALE_TICKS.map((tick) => (
                <i key={tick.seconds} style={{ left: `${logPosition(tick.seconds)}%` }}><b>{tick.label}</b></i>
              ))}
            </div>
            <ol>
              {MEASUREMENTS.map((item) => (
                <li key={`${item.href}-${item.label}`}>
                  <Link href={item.href}>
                    <strong>{item.label} <i aria-hidden="true">→</i></strong>
                    {/* 날짜와 조건을 한 줄에 이어 붙이면 어중간한 자리에서 접힌다. 잰 날을 윗줄에 세운다. */}
                    <small>{item.date && <time dateTime={item.date}>{item.date}</time>}{item.note}</small>
                  </Link>
                  <div className="scale-track">
                    <span style={{ width: `${Math.max(logPosition(item.seconds), 1.5)}%` }} />
                  </div>
                  <b>{item.value}</b>
                </li>
              ))}
            </ol>
          </div>          </details>

        </section>

        <section className="portfolio-demos" aria-labelledby="portfolio-demo-title">
          <h2 id="portfolio-demo-title">읽는 대신 직접 확인하는 세 장면</h2>
          <ol>
            {DEMOS.map((demo) => (
              <li key={demo.href}>
                <span>{demo.minutes}</span>
                <div>
                  <h3>{demo.title}</h3>
                  <p>{demo.detail}</p>
                </div>
                <Link className="btn" href={demo.href}>{demo.action} →</Link>
              </li>
            ))}
          </ol>
          <p className="portfolio-demo-note">
            시나리오는 전부 {ORDERED_SCENARIOS.length}편이고, 편마다 어디서 가져온 문제인지와 실제로 실행되는지를 배지로 밝힙니다.
            그 가운데 누를 때마다 진짜 서버가 도는 것은 {liveScenarioCount}편이고, 나머지는 정해 둔 흐름을 재생해 비교하는 용도입니다.
          </p>
        </section>

        <section className="portfolio-boundaries" aria-labelledby="portfolio-boundaries-title">
          <div>
            <h2 id="portfolio-boundaries-title">하지 않은 일도 정확히 말합니다</h2>
            <p className="portfolio-deeper">이 프로젝트에서 보여주려는 역량은 실패를 포함한 흐름 설계, 실행 결과의 관측, 배포·복구 검증입니다. 아래 한계를 포함한 근거 문서를 통해 각 판단을 더 깊게 확인할 수 있습니다.</p>
            <nav aria-label="포트폴리오 다음 경로">
              <Link className="btn" href="/wiki/jaywiki-main-map">프로젝트 지도</Link>
              <Link className="btn" href="/scenarios">시나리오 전체</Link>
            </nav>
          </div>
          <ul>
            {LIMITS.map((limit) => (
              <li key={limit.title}><strong>{limit.title}</strong><span>{limit.detail}</span></li>
            ))}
          </ul>
        </section>
      </main>
      <Footer />
    </>
  );
}
