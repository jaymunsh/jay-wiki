import Link from 'next/link';
import { getAdminBlogComments } from '@/lib/blogAdmin';
import { deleteCommentAction, restoreCommentAction } from '@/lib/blogAdminActions';
import { formatIpPrefix } from '@/lib/blogAdminForm';
import { blogAbsoluteUrl, blogPostHref, formatBlogDate } from '@/lib/blogLinks';

export const dynamic = 'force-dynamic';

export default async function AdminBlogCommentsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly deleted?: string }>;
}) {
  const { deleted } = await searchParams;
  const inTrash = deleted === 'true';
  const items = await getAdminBlogComments(inTrash);

  return (
    <>
      <div className="admin-head">
        <div>
          <div className="eyebrow">Admin · Blog</div>
          <h1>{inTrash ? '댓글 휴지통' : '댓글'} — {items.length}개</h1>
          <p className="admin-desc">
            IP 는 앞 두 자리까지만 남습니다. 원본 주소는 DB 에도 없습니다.
          </p>
        </div>
        <Link className="btn" href={inTrash ? '/blog/comments' : '/blog/comments?deleted=true'}>
          {inTrash ? '← 댓글 목록' : '휴지통 →'}
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="placeholder" style={{ marginTop: 18 }}>
          {inTrash ? '휴지통이 비어 있습니다.' : '아직 댓글이 없습니다.'}
        </div>
      ) : (
        <ul className="badm-comments">
          {items.map((c) => (
            <li key={c.id}>
              <div className="badm-cmt-who">
                <b>{c.authorName}</b>
                <span className="ip">({formatIpPrefix(c.ipPrefix)})</span>
                <time dateTime={c.createdAt}>{formatBlogDate(c.createdAt)}</time>
                <form action={inTrash ? restoreCommentAction : deleteCommentAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className={inTrash ? 'btn' : 'btn btn-danger'}>
                    {inTrash ? '복구' : '삭제'}
                  </button>
                </form>
              </div>
              <p className="badm-cmt-body">{c.body}</p>
              {/* 글은 블로그 host 에 있고 관리 화면은 portfolio host 에 있다. 절대 주소로 나간다. */}
              <a className="badm-cmt-post" href={blogAbsoluteUrl(blogPostHref(c.postId, ''))}>
                {c.postTitle}
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
