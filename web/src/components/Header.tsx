'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ThemeToggle } from './ThemeToggle';

type MeState = {
  readonly authenticated: boolean;
  readonly username?: string;
  readonly displayName?: string;
  readonly role?: string;
  readonly provider?: string;
  readonly adminTotpEnabled?: boolean;
};

/**
 * 헤더 — 로고 / 검색 / 테마 / 로그인 상태.
 * 로그인 여부는 /api/bff/auth/me 로 확인(client).
 * 검색창은 사이트에 하나뿐이다. /search 는 지금 질의를 searchQuery 로 채워 넣는다.
 */
export function Header({ searchQuery = '' }: { readonly searchQuery?: string } = {}) {
  const [me, setMe] = useState<MeState>({ authenticated: false });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  useEffect(() => {
    fetch('/api/bff/auth/me')
      .then((r) => (r.ok ? r.json() : { authenticated: false }))
      .then(setMe)
      .catch(() => setMe({ authenticated: false }));
  }, []);

  async function logout() {
    await fetch('/api/bff/auth/logout', { method: 'POST' });
    setMe({ authenticated: false });
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
    window.location.assign('/');
  }

  const profileLabel = me.displayName ?? me.username ?? '사용자';
  const profileRole = me.role === 'ADMIN' ? '관리자' : '사용자';
  const menuId = 'mobile-header-menu';
  const menuClassName = mobileMenuOpen ? 'mobile-menu open' : 'mobile-menu';
  const profileMenuId = 'profile-menu';
  const profileMenuClassName = profileMenuOpen ? 'profile-popover open' : 'profile-popover';

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="logo">
          <span className="logo-mark" aria-hidden="true">
            <Image src="/icon-master-transparent.png" alt="" width={32} height={32} priority />
          </span>
          <span>jay-wiki</span>
        </Link>

        {/* 블로그 레일 검색창과 같은 평범한 GET form 이다. 자바스크립트 없이 동작하고
            결과 주소가 /search?q=... 로 남는다. */}
        <form className="search" action="/search" method="get" role="search">
          <input type="search" name="q" defaultValue={searchQuery} placeholder="위키 검색…" aria-label="위키 검색" />
          <button className="search-key" type="submit">검색</button>
        </form>

        <button
          className="icon-btn menu-toggle"
          type="button"
          aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={mobileMenuOpen}
          aria-controls={menuId}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {mobileMenuOpen ? (
              <>
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </>
            ) : (
              <>
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </>
            )}
          </svg>
        </button>

        <nav className="nav-actions primary-actions" aria-label="주요 메뉴">
          <Link className="btn" href="/portfolio">5분 요약</Link>
          <Link className="btn" href="/scenarios">시나리오</Link>
          <Link className="btn" href="/monitoring">모니터링</Link>
        </nav>

        <div className="session-actions">
          {me.authenticated ? (
            <div className="profile-menu-wrap">
              <button
                className="profile-trigger authenticated"
                type="button"
                aria-label={`${profileLabel} 메뉴`}
                aria-expanded={profileMenuOpen}
                aria-controls={profileMenuId}
                onClick={() => setProfileMenuOpen((open) => !open)}
              >
                <span className="profile-avatar" aria-hidden="true">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21a8 8 0 0 0-16 0" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <span className="profile-status-dot" aria-hidden="true" />
              </button>
              <div id={profileMenuId} className={profileMenuClassName}>
                <ProfileCard
                  me={me}
                  profileLabel={profileLabel}
                  profileRole={profileRole}
                  onLogout={logout}
                  onNavigate={() => setProfileMenuOpen(false)}
                  showThemeToggle
                />
              </div>
            </div>
          ) : (
            <div className="profile-menu-wrap">
              <button
                className="profile-trigger"
                type="button"
                aria-label="계정 메뉴"
                aria-expanded={profileMenuOpen}
                aria-controls={profileMenuId}
                onClick={() => setProfileMenuOpen((open) => !open)}
              >
                <span className="profile-avatar" aria-hidden="true">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21a8 8 0 0 0-16 0" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
              </button>
              <div id={profileMenuId} className={profileMenuClassName}>
                <GuestCard onNavigate={() => setProfileMenuOpen(false)} />
              </div>
            </div>
          )}
        </div>

        <nav id={menuId} className={menuClassName} aria-label="모바일 메뉴">
          <Link className="btn" href="/portfolio" onClick={() => setMobileMenuOpen(false)}>5분 요약</Link>
          <Link className="btn" href="/scenarios" onClick={() => setMobileMenuOpen(false)}>시나리오</Link>
          <Link className="btn" href="/monitoring" onClick={() => setMobileMenuOpen(false)}>모니터링</Link>
          <Link className="btn" href="/board" onClick={() => setMobileMenuOpen(false)}>자유게시판</Link>
          <ThemeToggle />
          {me.authenticated ? (
            <ProfileCard me={me} profileLabel={profileLabel} profileRole={profileRole} onLogout={logout} onNavigate={() => setMobileMenuOpen(false)} />
          ) : (
            <Link className="btn btn-primary mobile-login" href="/login" onClick={() => setMobileMenuOpen(false)}>로그인</Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function GuestCard({ onNavigate }: { readonly onNavigate: () => void }) {
  return (
    <div className="profile-card">
      <div className="profile-card-head">
        <span className="profile-avatar large" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21a8 8 0 0 0-16 0" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </span>
        <div>
          <strong>비로그인 상태</strong>
          <span>계정 메뉴</span>
        </div>
      </div>
      <div className="profile-card-theme">
        <span>화면 테마</span>
        <ThemeToggle />
      </div>
      <div className="profile-card-actions">
        <Link href="/login" onClick={onNavigate}>로그인 또는 가입</Link>
      </div>
    </div>
  );
}

function ProfileCard({
  me,
  profileLabel,
  profileRole,
  onLogout,
  onNavigate,
  showThemeToggle = false,
}: {
  readonly me: MeState;
  readonly profileLabel: string;
  readonly profileRole: string;
  readonly onLogout: () => void;
  readonly onNavigate: () => void;
  readonly showThemeToggle?: boolean;
}) {
  return (
    <div className="profile-card">
      <div className="profile-card-head">
        <span className="profile-avatar large" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21a8 8 0 0 0-16 0" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </span>
        <div>
          <strong>이름: {profileLabel}</strong>
          <span>권한: {profileRole}</span>
        </div>
      </div>
      {showThemeToggle && (
        <div className="profile-card-theme">
          <span>화면 테마</span>
          <ThemeToggle />
        </div>
      )}
      <div className="profile-card-actions">
        {me.role === 'ADMIN' && <Link href="/admin/articles" onClick={onNavigate}>관리자 메뉴 가기</Link>}
        {me.role === 'ADMIN' && <Link href="/admin/articles/new" onClick={onNavigate}>글 쓰러 가기</Link>}
        <button type="button" onClick={onLogout}>로그아웃</button>
      </div>
    </div>
  );
}
