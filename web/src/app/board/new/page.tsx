'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

/**
 * 글쓰기 — /board/new
 * 익명 작성. 비밀번호를 넣으면 나중에 본인이 삭제할 수 있음.
 * BFF(/api/bff/board/posts) 로 POST → 성공 시 생성된 글 상세로 이동.
 */
export default function NewPostPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setErr('제목과 내용을 입력하세요.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/bff/board/posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, content, authorName, password }),
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const post = await r.json();
      router.push(`/board/${post.id}`);
    } catch {
      setErr('글 등록에 실패했습니다.');
      setBusy(false);
    }
  }

  return (
    <>
      <Header />
      <main id="main-content">
        <div className="crumb" style={{ marginBottom: 12 }}>
          <Link href="/board" style={{ color: 'var(--accent)' }}>← 자유게시판</Link>
        </div>

        <h1 style={{ margin: '0 0 16px' }}>자유게시판 글쓰기</h1>

        <form className="post-form" onSubmit={submit}>
          <div className="pf-row">
            <input
              className="pf-name"
              placeholder="닉네임(선택, 기본: 익명)"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              maxLength={30}
            />
            <input
              className="pf-pw"
              type="password"
              placeholder="비밀번호(선택, 본인 삭제용)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={60}
            />
          </div>
          <input
            className="pf-title"
            placeholder="제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
          <textarea
            className="pf-content"
            placeholder="내용을 입력하세요"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
          />
          <div className="pf-actions">
            <Link href="/board" className="btn">취소</Link>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? '등록 중…' : '등록'}
            </button>
          </div>
          {err && <p className="cf-err">{err}</p>}
        </form>
      </main>
      <Footer />
    </>
  );
}
