'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PUBLIC_SITE_ORIGIN } from '@/lib/siteConfig';

/**
 * 데스크톱: 250px 레일 + 본문. 본문을 스크롤하면 상단 바가 서서히 나타난다.
 * 820px 아래: 상단 바(햄버거·이름·테마)가 생기고, 햄버거를 누르면 화면의 3/4 을
 * 덮는 드로어가 왼쪽에서 나온다. 남은 1/4 은 blur(6px) 로 뒤가 비친다.
 * 닫기는 햄버거 재클릭 / 바깥 클릭 / Esc.
 * 상단 바의 이름은 블로그 홈으로 가는 링크다. 위키로 가는 길은 드로어 안에 둔다 --
 * 좁은 화면에서 상단 바에 넷을 세우면 이름이 가운데를 못 잡는다.
 */
export function BlogShell({
  rail,
  title,
  category,
  children,
}: {
  readonly rail: React.ReactNode;
  readonly title: string;
  readonly category?: string;
  readonly children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={open ? 'blog-shell open' : 'blog-shell'}>
      <div className="blog-mtop">
        <button
          type="button"
          className="blog-burger"
          aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
        </button>
        <Link className="blog-mtitle" href="/">
          <Image src="/icon-master-transparent.png" alt="" width={18} height={18} />
          jay-blog
        </Link>
        <ThemeToggle />
      </div>

      {/* 레일 안의 링크를 누르면 드로어를 닫는다. 경로 변화를 effect 로 보면
          렌더 중 setState 가 되고, 이동이 끝난 뒤에야 닫혀 한 박자 늦는다.
          레일 내용은 서버 컴포넌트라 각 링크에 핸들러를 달 수 없어 위임으로 받는다. */}
      <aside
        className="blog-rail blog-hush"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a')) setOpen(false);
        }}
      >
        <div className="blog-rail-brand">
          <div className="row">
            <div>
              {/* 위키 헤더와 같은 로고 파일을 쓴다. 두 사이트가 한 짝으로 읽힌다.
                  이름을 누르면 전체 글로 간다 - 모바일 상단바의 이름과 같은 동작이다. */}
              <Link className="brand-home" href="/">
                <b>
                  <Image src="/icon-master-transparent.png" alt="" width={22} height={22} priority />
                  jay-blog
                </b>
              </Link>
              <span className="host">blog.leneu.cloud</span>
            </div>
            {/* 위키와 같은 토글이다. localStorage 의 theme 한 키를 공유하므로
                한쪽에서 바꾸면 다른 쪽도 그 값으로 뜬다. */}
            <ThemeToggle />
          </div>
          <a className="back" href={PUBLIC_SITE_ORIGIN}>
            ← jay-wiki로 돌아가기
          </a>
        </div>
        {rail}
      </aside>

      <button
        type="button"
        className="blog-scrim"
        aria-label="메뉴 닫기"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />

      <main id="main-content" className="blog-main">
        <div className={scrolled ? 'blog-stickybar on' : 'blog-stickybar'}>
          {category && <span className="sb-cat">{category}</span>}
          <b>{title}</b>
          <button
            type="button"
            className="sb-top"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            ↑ 위로
          </button>
        </div>
        <div className="blog-main-inner">{children}</div>
      </main>
    </div>
  );
}
