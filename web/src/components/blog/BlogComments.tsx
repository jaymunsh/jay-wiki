'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { BlogComment } from '@/lib/blog';
import { formatBlogDate } from '@/lib/blogLinks';

/**
 * 로그인 없이 쓰는 댓글. 이름·암호를 함께 받고 암호는 본인 삭제용이다.
 * 이름 옆의 (121.135) 는 서버가 준 앞 2옥텟이다 — 원본 IP 는 DB 에도 없다.
 * 브라우저에서 쓰므로 BFF 를 거친다(백엔드 주소 비노출 + CF-Connecting-IP 전달).
 */
export function BlogComments({
  postId,
  comments,
}: {
  readonly postId: number;
  readonly comments: readonly BlogComment[];
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !authorName.trim() || !password) return;
    setBusy(true);
    setErr('');
    try {
      const r = await fetch(`/api/bff/blog/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ authorName, password, body }),
      });
      if (r.status === 429) throw new Error('너무 자주 쓰셨습니다. 잠시 뒤 다시 시도해 주세요.');
      if (!r.ok) throw new Error('댓글 등록에 실패했습니다.');
      setBody('');
      setPassword('');
      router.refresh();
    } catch (cause) {
      setErr(cause instanceof Error ? cause.message : '댓글 등록에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    const input = window.prompt('댓글 작성 시 입력한 암호를 넣어 주세요.');
    if (!input) return;
    const r = await fetch(`/api/bff/blog/comments/${id}/delete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: input }),
    });
    if (!r.ok) {
      window.alert('암호가 맞지 않습니다.');
      return;
    }
    router.refresh();
  }

  return (
    <section className="blog-cmt">
      <h2>
        댓글<span>{comments.length}</span>
      </h2>

      {comments.length > 0 && (
        <ul className="blog-cmt-list">
          {comments.map((comment) => (
            <li key={comment.id}>
              <div className="blog-cmt-who">
                <b>{comment.authorName}</b>
                <span className="ip">({comment.ipPrefix})</span>
                <time dateTime={comment.createdAt}>{formatBlogDate(comment.createdAt)}</time>
                <button type="button" className="del" onClick={() => remove(comment.id)}>
                  삭제
                </button>
              </div>
              <p className="blog-cmt-body">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form className="blog-cmt-form" onSubmit={submit}>
        <textarea
          placeholder="댓글을 남겨 주세요"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          aria-label="댓글 내용"
        />
        <input
          placeholder="이름"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          maxLength={30}
          aria-label="이름"
        />
        <input
          type="password"
          placeholder="암호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          maxLength={60}
          aria-label="삭제용 암호"
        />
        <button
          className="submit"
          disabled={busy || !body.trim() || !authorName.trim() || !password}
        >
          {busy ? '등록 중…' : '등록'}
        </button>
      </form>
      {err && <p className="blog-cmt-err">{err}</p>}
    </section>
  );
}
