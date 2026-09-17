'use client';

import { Gauge, KeyRound, LockKeyhole, UserRound } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';

type ErrorPayload = { error?: string; code?: string; detail?: string };

export function AdminLoginForm({ next, otpRequiredInitially = false }: {
  next: string;
  otpRequiredInitially?: boolean;
}) {
  const [error, setError] = useState('');
  const [otpRequired, setOtpRequired] = useState(otpRequiredInitially);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const response = await fetch('/api/bff/auth/admin-login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: String(data.get('username') ?? ''),
        password: String(data.get('password') ?? ''),
        otp: String(data.get('otp') ?? ''),
      }),
    });
    const payload = await response.json().catch(() => ({})) as ErrorPayload & { role?: string };
    if (response.ok && payload.role === 'ADMIN') {
      window.location.assign(next);
      return;
    }
    if (payload.code === 'OTP_REQUIRED') setOtpRequired(true);
    setError(payload.error ?? payload.detail ?? '관리자 인증에 실패했습니다.');
    setBusy(false);
  }

  return (
    <main id="main-content" className="admin-login-page">
      <div className="admin-login-theme"><ThemeToggle /></div>
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <div className="admin-login-brand"><Gauge /><span>jay admin</span></div>
        <p className="eyebrow">SECURE OPERATION CONSOLE</p>
        <h1 id="admin-login-title">관리자 로그인</h1>
        <p className="admin-login-copy">콘텐츠 발행과 운영 기능은 관리자 전용 호스트에서만 사용할 수 있습니다.</p>
        <form onSubmit={submit}>
          <label><span>아이디</span><span className="admin-login-input"><UserRound /><input name="username" autoComplete="username" required autoFocus /></span></label>
          <label><span>비밀번호</span><span className="admin-login-input"><LockKeyhole /><input name="password" type="password" autoComplete="current-password" required /></span></label>
          {otpRequired && <label><span>OTP</span><span className="admin-login-input"><KeyRound /><input name="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={8} required /></span></label>}
          {error && <p className="admin-login-error" role="alert">{error}</p>}
          <button className="btn btn-primary admin-login-submit" disabled={busy}>{busy ? '확인 중…' : '관리자 콘솔 열기'}</button>
        </form>
        <p className="admin-login-foot">일반 회원 로그인은 공개 위키에서 계속 사용할 수 있습니다.</p>
      </section>
    </main>
  );
}
