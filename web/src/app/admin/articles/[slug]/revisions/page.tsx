import Link from 'next/link';
import { getArticle, getRevisions } from '@/lib/api';
import { revertAction } from '@/lib/actions';
import { formatKoreanDateTime } from '@/lib/dateTime';

export const dynamic = 'force-dynamic';

export default async function RevisionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [article, revisions] = await Promise.all([getArticle(slug), getRevisions(slug)]);

  return (
    <>
      <div className="admin-head">
        <div>
          <div className="eyebrow">Admin · Revisions</div>
          <h1>{article?.title ?? slug} — 버전 이력</h1>
          <p className="admin-desc">
            현재 버전 <strong>v{article?.version ?? '?'}</strong>. 수정할 때마다 직전 본문이 아래에 스냅샷으로 쌓입니다.
            (git 없이 DB 로 구현한 버전관리)
          </p>
        </div>
        <Link className="btn" href="/wiki/articles">← 목록</Link>
      </div>

      {revisions.length === 0 ? (
        <div className="placeholder" style={{ marginTop: 18 }}>
          아직 이력이 없습니다. 이 글을 한 번 수정하면 직전 버전이 여기 남습니다.
        </div>
      ) : (
        <ul className="article-list">
          {revisions.map((r) => (
            <li key={r.version} className="al-item">
              <div className="al-row">
                <div className="al-meta">
                  <span className="badge kind">v{r.version}</span>
                  <span className="badge">{r.editor ?? 'admin'}</span>
                  <span className="badge">{formatKoreanDateTime(r.createdAt)}</span>
                </div>
                <div className="al-title">{r.title}</div>
              </div>
              <form action={revertAction} className="al-delete">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="version" value={r.version} />
                <button type="submit" className="btn" title={`v${r.version} 로 되돌리기`}>↩ 되돌리기</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
