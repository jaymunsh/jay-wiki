'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

type AuthOptions = {
  readonly adminTotpEnabled?: boolean;
};

type LoginMode = 'login' | 'register';

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authOptions, setAuthOptions] = useState<AuthOptions>({ adminTotpEnabled: false });

  useEffect(() => {
    fetch('/api/bff/auth/me')
      .then((response) => (response.ok ? response.json() : { adminTotpEnabled: false }))
      .then((payload: AuthOptions) => setAuthOptions({ adminTotpEnabled: payload.adminTotpEnabled === true }))
      .catch(() => setAuthOptions({ adminTotpEnabled: false }));
  }, []);

  function selectMode(nextMode: LoginMode) {
    setMode(nextMode);
    setError('');
    setOtp('');
    setOtpRequired(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const endpoint = mode === 'login' ? '/api/bff/auth/login' : '/api/bff/auth/register';
      const payload = mode === 'login'
        ? { username, password, otp: otp || undefined }
        : { username, password, nickname };
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        window.location.href = '/';
      } else {
        const response = await r.json().catch(() => ({ error: '인증에 실패했습니다.', code: '' }));
        if (response.code === 'OTP_REQUIRED') setOtpRequired(true);
        setError(typeof response.error === 'string' ? response.error : '인증에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <main id="main-content" className="login-shell">
        <section className="login-card">
          <div className="eyebrow">Authentication</div>
          <h1>{mode === 'login' ? '로그인' : '회원가입'}</h1>
          <p>
            하나의 계정 화면에서 로그인과 가입을 처리합니다. 관리자 계정은 로그인하면 자동으로 운영 권한이 표시됩니다.
          </p>

          <div className="login-mode-tabs" role="tablist" aria-label="인증 방식">
            <button
              type="button"
              role="tab"
              className={mode === 'login' ? 'active' : ''}
              aria-selected={mode === 'login'}
              onClick={() => selectMode('login')}
            >
              로그인
            </button>
            <button
              type="button"
              role="tab"
              className={mode === 'register' ? 'active' : ''}
              aria-selected={mode === 'register'}
              onClick={() => selectMode('register')}
            >
              회원가입
            </button>
          </div>

          <div className="login-divider">
            <span>{mode === 'login' ? '계정 로그인' : '새 계정 만들기'}</span>
          </div>

          <form onSubmit={submit} className="login-form">
            {mode === 'register' && (
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="표시 이름"
                className="login-input" autoComplete="nickname" />
            )}
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="아이디"
              className="login-input" autoComplete="username" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" type="password"
              className="login-input" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            {mode === 'login' && (otpRequired || (authOptions.adminTotpEnabled && username.trim() === 'admin')) && (
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Google Authenticator 6자리"
                className="login-input login-otp"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                aria-label="관리자 OTP"
                autoFocus={otpRequired}
              />
            )}
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '처리 중…' : mode === 'login' ? '로그인' : '가입하고 시작'}
            </button>
          </form>
          {mode === 'register' && (
            <>
              <p className="login-help">
                아이디는 3~30자의 영문, 숫자, _, ., - 조합을 사용합니다. 일반 가입 계정은 USER 권한으로 시작합니다.
              </p>
              {/*
                V33 이 tb_user.source 를 쓰기 시작했으므로 여기 적어 둔다. 댓글의 source 와 달리
                계정에 영구히 남아 아이디·별명과 함께 한 사람을 가리키므로, 알리지 않고 쌓으면 안 된다.
              */}
              <p className="login-help">
                가입할 때 <b>이 사이트에 처음 들어오신 경로를 이름 하나로만</b>(예: google, naver, 직접
                유입) 계정에 함께 남깁니다. 주소 전체나 검색어는 남기지 않습니다.
              </p>
            </>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
