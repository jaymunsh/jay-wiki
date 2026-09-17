'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 댓글 작성 폼 — BFF(/api/bff/board/posts/{id}/comments) 로 POST.
 * 성공 시 router.refresh() 로 서버 컴포넌트를 다시 렌더 → 댓글 목록/카운트 갱신.
 */
export function CommentForm({ postId }: { postId: number }) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    setErr('');
    try {
      const r = await fetch(`/api/bff/board/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content, authorName }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      setContent('');
      router.refresh();
    } catch {
      setErr('댓글 등록에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="comment-form" onSubmit={submit}>
      <input
        className="cf-name"
        placeholder="닉네임(선택)"
        value={authorName}
        onChange={(e) => setAuthorName(e.target.value)}
        maxLength={30}
      />
      <textarea
        className="cf-content"
        placeholder="댓글을 입력하세요"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
      />
      <button className="btn btn-primary" disabled={busy || !content.trim()}>
        {busy ? '등록 중…' : '댓글 등록'}
      </button>
      {err && <p className="cf-err">{err}</p>}
    </form>
  );
}
