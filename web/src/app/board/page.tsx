import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getPosts } from '@/lib/api';
import { formatKoreanBoardDate } from '@/lib/dateTime';

/**
 * 게시판 목록 — /board?page=N
 * 서버 컴포넌트로 SSR. 10만 건을 최신순으로 페이징(page/size).
 * 페이지 이동은 URL(?page=) 로 → 새로고침/공유 가능, 뒤로가기 자연스러움.
 */
export const dynamic = 'force-dynamic';

const SIZE = 20;

/** 현재 페이지 주변 + 처음/끝 만 노출하는 페이지 번호 목록. */
function pageWindow(current: number, total: number): number[] {
  const span = 2;
  const pages = new Set<number>();
  pages.add(0);
  pages.add(total - 1);
  for (let p = current - span; p <= current + span; p++) {
    if (p >= 0 && p < total) pages.add(p);
  }
  return [...pages].sort((a, b) => a - b);
}

export default async function BoardPage(props: { searchParams: Promise<{ page?: string }> }) {
  const sp = await props.searchParams;
  const page = Math.max(0, Number(sp.page ?? '0') || 0);
  const data = await getPosts(page, SIZE);
  const totalPages = data.totalPages || 1;
  const win = pageWindow(page, totalPages);

  const href = (p: number) => `/board?page=${p}`;

  return (
    <>
      <Header />
      <main id="main-content">
        <section className="board-head">
          <div>
            <div className="eyebrow">Community Board</div>
            <h1 style={{ margin: '4px 0 2px' }}>자유게시판</h1>
            <p style={{ color: 'var(--text-mute)', fontSize: 13, margin: 0 }}>
              총 <strong style={{ color: 'var(--text)' }}>{data.totalElements.toLocaleString()}</strong>개 · 누구나 익명으로 글을 쓸 수 있어요.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/board/search" className="btn">검색 비교</Link>
            <Link href="/board/new" className="btn btn-primary">글쓰기</Link>
          </div>
        </section>

        <div className="board-table">
          <div className="board-row board-row--head">
            <span className="c-num">번호</span>
            <span className="c-title">제목</span>
            <span className="c-author">글쓴이</span>
            <span className="c-num">조회</span>
            <span className="c-date">작성</span>
          </div>

          {data.content.length === 0 && (
            <div className="placeholder" style={{ margin: 12 }}>
              게시글이 없습니다. (백엔드가 떠 있고 V4 시드가 적용됐는지 확인)
            </div>
          )}

          {data.content.map((p) => (
            <Link key={p.id} href={`/board/${p.id}`} className="board-row board-row--item">
              <span className="c-num">{p.id}</span>
              <span className="c-title">
                {p.title}
                {p.commentCount > 0 && <em className="cc">[{p.commentCount}]</em>}
              </span>
              <span className="c-author">{p.authorName}</span>
              <span className="c-num">{p.views.toLocaleString()}</span>
              <span className="c-date">{formatKoreanBoardDate(p.createdAt)}</span>
            </Link>
          ))}
        </div>

        <nav className="pager">
          <Link className="pager-btn" href={href(Math.max(0, page - 1))} aria-disabled={page === 0}>‹ 이전</Link>
          {win.map((p, i) => {
            const prev = win[i - 1];
            const gap = prev !== undefined && p - prev > 1;
            return (
              <span key={p} style={{ display: 'contents' }}>
                {gap && <span className="pager-gap">…</span>}
                <Link className={`pager-btn${p === page ? ' active' : ''}`} href={href(p)}>{p + 1}</Link>
              </span>
            );
          })}
          <Link className="pager-btn" href={href(Math.min(totalPages - 1, page + 1))} aria-disabled={page >= totalPages - 1}>다음 ›</Link>
        </nav>
      </main>
      <Footer />
    </>
  );
}
