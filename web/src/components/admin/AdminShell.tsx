'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3, BookOpenText, ChevronLeft, FileClock, FileText, FolderTree,
  Layers, LogOut, Menu, MessageSquare, PanelsTopLeft,
  ServerCog, Sheet, Star, X,
} from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';

import { ThemeToggle } from '@/components/ThemeToggle';
import type { AdminSession } from '@/lib/adminSession';

const groups = [
  { label: 'jay-wiki', items: [
    { href: '/wiki/articles', label: '위키 문서', icon: FileText },
    { href: '/wiki/tabs', label: '위키 탭', icon: PanelsTopLeft },
    { href: '/wiki/featured', label: '대표 문서', icon: Star },
  ] },
  { label: 'jay-blog', items: [
    { href: '/blog/posts', label: '블로그 글', icon: FileClock },
    { href: '/blog/categories', label: '카테고리', icon: FolderTree },
    { href: '/blog/comments', label: '댓글', icon: MessageSquare },
  ] },
  { label: '운영', items: [
    { href: '/stats', label: '통계', icon: BarChart3 },
    { href: '/services', label: '서비스', icon: ServerCog },
    { href: '/tools/spreadsheet-export', label: 'Excel 내보내기', icon: Sheet },
    { href: '/guide', label: '편집 가이드', icon: BookOpenText },
  ] },
] as const;

function selected(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  if (href.endsWith('/new')) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children, session, local }: {
  children: React.ReactNode;
  session: AdminSession;
  local: boolean;
}) {
  const pathname = usePathname();
  // admin.* 의 공개 경로는 middleware 에서 /admin/* 으로 rewrite 된다. 서버가 본
  // 내부 경로와 브라우저가 본 공개 경로를 첫 렌더에서 비교하면 hydration 결과가
  // 달라지므로, 활성 메뉴 표시는 브라우저가 마운트된 뒤 공개 경로로 맞춘다.
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const visiblePathname = mounted ? pathname : '';
  const [open, setOpen] = useState(false);
  const currentItem = groups.map((group) => group.items.find((item) => selected(visiblePathname, item.href))).find(Boolean);
  const pageLabel = visiblePathname.endsWith('/revisions') ? '편집 이력'
    : visiblePathname.endsWith('/new') ? '글 편집' : currentItem?.label ?? '작업 공간';
  const publicWiki = local ? 'http://localhost:3000' : 'https://portfolio.leneu.cloud';
  const publicBlog = local ? 'http://blog.localhost:3000' : 'https://blog.leneu.cloud';

  async function logout() {
    await fetch('/api/bff/auth/logout', { method: 'POST' });
    window.location.assign('/login');
  }

  return (
    <div className="admin-site">
      <aside className={`admin-sidebar ${open ? 'is-open' : ''}`} aria-label="관리자 메뉴">
        <div className="admin-brand">
          <span className="admin-brand-mark"><Layers aria-hidden="true" /></span>
          <span><strong>jay <span>/ admin</span></strong></span>
          <button className="admin-mobile-close" onClick={() => setOpen(false)} aria-label="메뉴 닫기"><X /></button>
        </div>
        <div className="admin-workspace-label"><span className="admin-avatar">{session.displayName.slice(0, 1)}</span><div><b>개인 작업 공간</b><small>위키와 블로그를 한곳에서</small></div></div>
        <nav id="admin-navigation">
          {groups.map((group) => (
            <div className="admin-menu-group" key={group.label}>
              <span>{group.label}</span>
              {group.items.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} aria-current={selected(visiblePathname, href) ? 'page' : undefined} className={selected(visiblePathname, href) ? 'active' : ''} onClick={() => setOpen(false)}>
                  <Icon /><span>{label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-public-links">
          <a href={publicWiki} target="_blank" rel="noreferrer"><ChevronLeft /> 위키 열기</a>
          <a href={publicBlog} target="_blank" rel="noreferrer"><ChevronLeft /> 블로그 열기</a>
        </div>
      </aside>
      {open && <button className="admin-scrim" aria-label="메뉴 닫기" onClick={() => setOpen(false)} />}
      <div className="admin-workspace">
        <header className="admin-topbar">
          <button className="admin-menu-button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="admin-navigation" aria-label="관리자 메뉴 열기"><Menu /></button>
          <div className="admin-breadcrumb"><span>작업 공간</span><span aria-hidden="true">/</span><b>{pageLabel}</b></div>
          <div className="admin-top-actions">
            <span className={`admin-environment ${local ? 'local' : 'production'}`}>{local ? 'LOCAL' : 'PRODUCTION'}</span>
            <ThemeToggle />
            <span className="admin-account"><b>{session.displayName}</b><small>{session.username}</small></span>
            <button className="icon-btn" onClick={logout} aria-label="로그아웃" title="로그아웃"><LogOut /></button>
          </div>
        </header>
        <main id="main-content" className="admin-main"><section className="admin-content">{children}</section></main>
      </div>
    </div>
  );
}
