'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 익명 글 본인 삭제 — 작성 시 정한 비밀번호를 확인.
 * BFF(/api/bff/board/posts/{id}/delete) 로 POST. 성공 시 목록으로.
 */
export function DeletePostButton({ postId }: { postId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function del() {
    setBusy(true);
    setErr('');
    try {
      const r = await fetch(`/api/bff/board/posts/${postId}/delete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (r.status === 204) {
        router.push('/board');
        router.refresh();
        return;
      }
      setErr(r.status === 409 ? '비밀번호가 일치하지 않습니다.' : '삭제에 실패했습니다.');
    } catch {
      setErr('삭제에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <button type="button" className="btn" onClick={() => setOpen(true)}>삭제</button>;
  }

  return (
    <span className="del-inline">
      <input
        type="password"
        placeholder="비밀번호"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        autoFocus
      />
      <button type="button" className="btn btn-danger" disabled={busy} onClick={del}>
        {busy ? '삭제 중…' : '확인'}
      </button>
      <button type="button" className="btn" onClick={() => { setOpen(false); setErr(''); }}>취소</button>
      {err && <span className="cf-err">{err}</span>}
    </span>
  );
}
