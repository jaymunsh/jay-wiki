import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { CommentForm } from '@/components/board/CommentForm';
import { DeletePostButton } from '@/components/board/DeletePostButton';
import { getPost, getComments } from '@/lib/api';
import { formatKoreanDateTime } from '@/lib/dateTime';

/**
 * 게시글 상세 — /board/[id]
 * 서버 컴포넌트로 본문/댓글을 SSR. 조회수는 getPost() 호출 시 백엔드가 Redis INCR.
 * 댓글 작성/삭제 같은 상호작용만 클라이언트 컴포넌트(BFF 호출 → router.refresh).
 */
export const dynamic = 'force-dynamic';

export default async function PostPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const post = await getPost(id);
  if (!post) notFound();
  const comments = await getComments(id);

  return (
    <>
      <Header />
      <main id="main-content">
        <div className="crumb" style={{ marginBottom: 12 }}>
          <Link href="/board" style={{ color: 'var(--accent)' }}>← 자유게시판</Link>
        </div>

        <article className="post">
          <h1 className="post-title">{post.title}</h1>
          <div className="post-meta">
            <span className="badge">{post.authorName}</span>
            <span>조회 {post.views.toLocaleString()}</span>
            <span>댓글 {post.commentCount}</span>
            <span>{formatKoreanDateTime(post.createdAt)}</span>
          </div>

          <div className="post-body">{post.content}</div>

          <div className="post-actions">
            <Link href="/board" className="btn">목록</Link>
            {post.hasPassword && <DeletePostButton postId={post.id} />}
          </div>
        </article>

        <section className="comments">
          <h3 className="comments-head">댓글 <span>{comments.length}</span></h3>

          {comments.length === 0 && (
            <div className="placeholder" style={{ margin: '10px 0' }}>첫 댓글을 남겨보세요.</div>
          )}

          <ul className="comment-list">
            {comments.map((c) => (
              <li key={c.id} className="comment">
                <div className="comment-meta">
                  <strong>{c.authorName}</strong>
                  <span>{formatKoreanDateTime(c.createdAt)}</span>
                </div>
                <div className="comment-body">{c.content}</div>
              </li>
            ))}
          </ul>

          <CommentForm postId={post.id} />
        </section>
      </main>
      <Footer />
    </>
  );
}
