/**
 * 블로그 host 판정과 rewrite 경로. middleware(edge)에서 쓰므로 순수 함수만 둔다.
 *
 * host 를 'blog.leneu.cloud' 하나로 고정하지 않는 이유: 로컬에는 그 이름이 없어서
 * rewrite 를 확인할 방법이 사라진다. 'blog.' 접두사로 보면 blog.localhost:3000 으로
 * 바로 확인할 수 있다(대부분의 브라우저가 *.localhost 를 루프백으로 해석한다).
 */

import { isBlogHost } from './siteHost';

export { isBlogHost };

/** rewrite 하지 않고 원래 라우트로 보내는 경로. */
const PASSTHROUGH_PREFIXES = ['/blog', '/api', '/admin', '/_next'] as const;

/**
 * public/ 의 정적 파일. 이것들은 /blog 아래에 없으므로 rewrite 하면 404 가 된다.
 * 확장자로 일괄 제외하지 않는 이유: /robots.txt 와 /sitemap.xml 은 블로그 전용
 * 라우트라 오히려 rewrite 되어야 한다.
 */
const PUBLIC_FILE_PREFIXES = ['/assets', '/benchmark'] as const;
const PUBLIC_FILE_NAMES = new Set([
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/favicon-48x48.png',
  '/apple-touch-icon.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/icon-master-transparent.png',
  '/og-image-1200x630.png',
]);

/** 블로그 host 에서 요청된 경로를 /blog/* 로 옮긴다. 옮길 필요가 없으면 null. */
export function blogRewritePath(pathname: string): string | null {
  if (PASSTHROUGH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }
  if (PUBLIC_FILE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }
  if (PUBLIC_FILE_NAMES.has(pathname)) return null;
  return pathname === '/' ? '/blog' : `/blog${pathname}`;
}
