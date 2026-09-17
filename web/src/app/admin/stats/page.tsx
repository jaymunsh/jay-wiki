import Link from 'next/link';
import { getAnalyticsReport, type AnalyticsDimension, type StatsSite } from '@/lib/blogAdmin';
import './stats.css';
import TrendChart from './TrendChart';

export const dynamic = 'force-dynamic';
const number = (n: number) => n.toLocaleString('ko-KR');
function label(s: string) {
  return ({direct:'직접 / 출처 미상',internal:'자체 사이트에서 이동',none:'캠페인 없음',pc:'PC',mobile:'모바일',unknown:'알 수 없음'} as Record<string,string>)[s] ?? s.replace(/^sns:/,'');
}
function delta(current: number, previous: number) {
  if (!previous) return current ? '이전 기간 집계 없음' : '변화 없음';
  const p = (current - previous) / previous * 100;
  return `${p > 0 ? '+' : ''}${p.toFixed(1)}% · 이전 ${number(previous)}`;
}
function Ranking({ title, rows, metric, description }: {title:string; rows:AnalyticsDimension[]; metric:'views'|'sessions'; description:string}) {
  return <section className="stats-panel"><h2>{title}</h2><p>{description}</p>
    {rows.length ? <ol className="stats-ranking">{rows.map(r=><li key={r.label}><span>{r.title !== r.label ? r.title : label(r.label)}{r.title !== r.label && <small>{r.label}</small>}</span><b>{number(r[metric])}</b></li>)}</ol>
      : <div className="stats-empty">새 방식으로 수집된 기록이 없습니다.</div>}
  </section>;
}
export default async function AdminStatsPage({searchParams}:{readonly searchParams:Promise<{site?:string;days?:string}>}) {
  const q=await searchParams;
  const site:StatsSite=q.site==='wiki'?'wiki':'blog';
  const days=[7,30,90].includes(Number(q.days))?Number(q.days):30;
  const data=await getAnalyticsReport(site,days);
  const {current:c,previous:p}=data;
  return <div className="stats-dashboard">
    <div className="admin-head"><div><div className="eyebrow">Audience overview</div><h1>방문과 읽기<span className="stats-version">브라우저 집계 v2</span></h1>
      <p className="admin-desc">어디에서 들어와 어떤 페이지를 읽었는지, 브라우저에서 확인한 방문을 기준으로 봅니다.</p></div></div>
    <nav className="stats-toolbar" aria-label="통계 범위">
      <div className="stats-switch">{(['blog','wiki'] as const).map(s=><Link key={s} aria-current={s===site?'page':undefined} href={`?site=${s}&days=${days}`}>{s==='blog'?'블로그':'위키'}</Link>)}</div>
      <div className="stats-switch">{[7,30,90].map(d=><Link key={d} aria-current={d===days?'page':undefined} href={`?site=${site}&days=${d}`}>{d}일</Link>)}</div>
    </nav>
    <p className="stats-notice">새 집계 시작: {data.startedAt.slice(0,10)} · 한국 시간 기준 · 오늘은 집계 중입니다. 이전 기간에 수집 전 날짜가 포함되면 비교에 주의하세요.</p>
    <section className="stats-cumulative" aria-label="이전 집계를 이월한 누적 통계">
      <div><span>참고용 누적 조회</span><strong>{number(data.cumulative.views)}</strong><small>{data.baseline.throughDate}까지 이전 집계 {number(data.baseline.views)}회 포함</small></div>
      <div><span>참고용 누적 일별 고유 브라우저 합계</span><strong>{number(data.cumulative.visitors)}</strong><small>{data.baseline.throughDate}까지 이전 집계 {number(data.baseline.visitors)}회 포함</small></div>
      <p>이월값은 새 이벤트를 만들지 않으며 아래 기간 그래프·방문·참여율에는 섞지 않습니다.</p>
    </section>
    <div className="stats-cards">{[
      ['조회',number(c.views),delta(c.views,p.views),'화면에 1초 이상 표시된 페이지'],
      ['방문',number(c.sessions),delta(c.sessions,p.sessions),'탭별 30분 비활동 후 새 방문'],
      ['일별 고유 브라우저 합계',number(c.visitors),delta(c.visitors,p.visitors),'여러 날의 같은 브라우저는 중복 포함'],
      ['방문당 조회',c.sessions?(c.views/c.sessions).toFixed(2):'—','조회 ÷ 방문','읽기 깊이를 살펴보는 보조 지표'],
      ['읽기 참여',c.views?`${(100*c.engaged/c.views).toFixed(1)}%`:'—',`${number(c.engaged)} / ${number(c.views)} 조회`,'표시 시간 30초 + 페이지 75% 도달'],
    ].map(([name,value,change,note])=><section key={name}><span>{name}</span><strong>{value}</strong><small>{change}</small><p>{note}</p></section>)}</div>
    <section className="stats-panel"><h2>조회와 방문 추이</h2><p><span className="stats-dot"/> 조회 <span className="stats-dot visits"/> 방문 · 선택한 기간 전체를 일별로 표시합니다.</p>
      {c.views === 0 ? <div className="stats-empty">선택한 기간에 기록된 조회가 없습니다. 수집을 시작한 뒤 추이가 표시됩니다.</div> : <TrendChart key={`${site}-${days}`} daily={data.daily}/>}
      <details><summary>날짜별 수치 보기</summary><div className="stats-table"><table><thead><tr><th>날짜</th><th>조회</th><th>방문</th><th>고유 브라우저</th></tr></thead><tbody>{data.daily.map(d=><tr key={d.date}><td>{d.date}</td><td>{d.views}</td><td>{d.sessions}</td><td>{d.visitors}</td></tr>)}</tbody></table></div></details>
    </section>
    <div className="stats-grid">
      <Ranking title="관측한 첫 유입 출처" rows={data.sources} metric="sessions" description="첫 문서 진입에서 관측한 출처입니다. 앱 공유·출처 누락·같은 문서의 방문 갱신은 출처 미상일 수 있습니다. 상위 50개."/>
      <Ranking title="공유 캠페인" rows={data.campaigns} metric="sessions" description="방문 시작 시 UTM source / medium / campaign입니다. 재공유된 링크의 라벨도 유지되므로 실제 공유 장소를 증명하지 않습니다."/>
      <Ranking title="첫 방문 페이지" rows={data.landings} metric="sessions" description="어떤 페이지가 방문의 입구였는지 봅니다. 방문 수 기준 상위 50개."/>
      <Ranking title="사용 기기" rows={data.devices} metric="sessions" description="방문 첫 요청의 기기 분류입니다. 사용자 에이전트 원문은 보관하지 않습니다."/>
    </div>
    <section className="stats-panel"><h2>페이지별 읽기</h2><p>조회 기준 상위 50개. 참여율은 읽었음을 증명하는 값이 아닌 화면 표시·스크롤 기반 근사입니다.</p>
      {data.pages.length?<div className="stats-table"><table><thead><tr><th>페이지</th><th>조회</th><th>참여</th><th>참여율</th></tr></thead><tbody>{data.pages.map(r=><tr key={r.label}><td><strong>{r.title !== r.label ? r.title : r.label === "/" ? "홈" : r.label}</strong><small>{r.label}</small></td><td>{number(r.views)}</td><td>{number(r.engaged)}</td><td>{r.views?`${(100*r.engaged/r.views).toFixed(1)}%`:'—'}</td></tr>)}</tbody></table></div>:<div className="stats-empty">방문이 쌓이면 페이지별 결과가 표시됩니다.</div>}
    </section>
    <section className="stats-panel"><h2>이 숫자를 읽는 기준</h2><ul>
      <li>관리자 로그인, 알려진 봇, 자동 브라우저, DNT·GPC 요청은 제외합니다. 모든 봇을 식별할 수는 없습니다.</li>
      <li>스크립트·저장소 차단, 전송 실패, 1초 미만 방문은 빠질 수 있습니다. 고유 브라우저는 실제 사람 수가 아닙니다.</li>
      <li>방문은 탭마다 구분하고 날짜가 바뀌면 나눕니다. 기간 고유 방문자로 합산하지 않습니다.</li>
      <li>홈·글·지정한 공개 목록만 수집하며 관리자·로그인·검색어·임의 경로는 수집하지 않습니다.</li>
      <li>일별 대조값은 오늘·어제만 유지하고 시간별 정리합니다. 영구 집계에는 개인 식별자를 남기지 않습니다.</li>
    </ul><details><summary>이전 집계 이월 기준</summary><p>{data.baseline.throughDate}까지의 API 조회 {number(data.baseline.views)}회와 일별 IP 방문 합계 {number(data.baseline.visitors)}회를 참고용 누적 카드에만 시작 잔액으로 더합니다. 새 조회는 계속 하루 집계에 1씩 추가되며, 이전 값은 기간 그래프·방문·참여율에 넣지 않습니다.</p></details></section>
  </div>;
}
