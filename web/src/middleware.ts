import { NextRequest, NextResponse } from 'next/server';

import { blogRewritePath, isBlogHost } from '@/lib/blogHost';
import { ENTRY_SOURCE_COOKIE, entryHost } from '@/lib/entrySource';
import { adminExternalPath, adminOriginFor, adminRewritePath, isAdminHost, isSharedPublicAsset } from '@/lib/siteHost';

/**
 * 1) host 가 blog.* 이면 /blog/* 라우트로 rewrite 한다 (설계 3절).
 * 2) 방문 첫 순간의 유입 호스트를 세션 쿠키에 담는다. 댓글 POST 의 Referer 는 그 글
 *    자신이라, 그때는 애초 어디서 들어왔는지가 이미 사라져 있기 때문이다.
 *    분류는 하지 않는다 -- 분류 규칙을 여기 한 벌 더 두면 Java 쪽과 반드시 갈라진다.
 * 3) /admin/* 보호. jw_token 쿠키가 없으면 /login 으로.
 *    (쿠키 '존재'만 체크 — 실제 유효성은 Spring 이 검증. 이 미들웨어는 UX용 가드)
 *    로컬 개발용 가벼운 가드. prod 에선 Cloudflare Access 가 앞단에서 한 번 더.
 *
 * matcher 를 전 경로로 넓혔으므로 정적 자산은 matcher 에서 제외한다.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get('host') ?? req.nextUrl.host;

  if (isAdminHost(host)) {
    if (isSharedPublicAsset(pathname)) return NextResponse.next();
    if (pathname === '/admin-login') return NextResponse.next();
    const cleanPath = adminExternalPath(pathname);
    if (cleanPath) {
      // A clean admin URL is rewritten to the existing /admin tree. Next may pass
      // that internal target through middleware again; authenticated requests must
      // reach the page instead of bouncing back to the clean URL forever.
      if (req.cookies.has('jw_token')) return NextResponse.next();
      const url = new URL('/login', adminOriginFor(host, req.nextUrl.protocol));
      url.searchParams.set('next', `${cleanPath}${req.nextUrl.search}`);
      return NextResponse.redirect(url);
    }
    const rewritten = adminRewritePath(pathname);
    if (rewritten) {
      if (pathname !== '/login' && !req.cookies.has('jw_token')) {
        const url = new URL('/login', adminOriginFor(host, req.nextUrl.protocol));
        url.searchParams.set('next', `${pathname}${req.nextUrl.search}`);
        return NextResponse.redirect(url);
      }
      // Keep the verified external admin host on the internal request. If the
      // proxy's localhost URL leaks through here, server-side host checks reject
      // the valid admin session and the login flow loops.
      const url = new URL(rewritten, adminOriginFor(host, req.nextUrl.protocol));
      url.search = req.nextUrl.search;
      return NextResponse.rewrite(url);
    }
    return new NextResponse('Not Found', { status: 404 });
  }

  if (isBlogHost(host)) {
    const rewritten = blogRewritePath(pathname);
    if (rewritten) {
      const url = req.nextUrl.clone();
      url.pathname = rewritten;
      return withEntrySource(req, NextResponse.rewrite(url));
    }
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!['GET', 'HEAD'].includes(req.method)) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    const target = new URL(adminOriginFor(host, req.nextUrl.protocol));
    target.pathname = adminExternalPath(pathname) ?? '/';
    target.search = req.nextUrl.search;
    return NextResponse.redirect(target);
  }
  return withEntrySource(req, NextResponse.next());
}

/**
 * 유입 호스트 쿠키를 아직 없을 때만 굽는다. 이미 있으면 덮지 않는다 --
 * 덮으면 두 번째 화면부터 자기 호스트로 바뀌어 애초 유입 경로가 지워진다.
 *
 * maxAge 를 주지 않아 브라우저를 닫으면 사라지고, 담기는 것은 호스트 문자열 하나뿐이라
 * 사람을 다시 알아보는 데 쓸 수 없다.
 */
function withEntrySource(req: NextRequest, res: NextResponse): NextResponse {
  if (req.cookies.has(ENTRY_SOURCE_COOKIE)) return res;
  res.cookies.set(ENTRY_SOURCE_COOKIE, entryHost(req.headers.get('referer')), {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.nextUrl.protocol === 'https:',
    path: '/',
  });
  return res;
}

export const config = {
  // 정적 자산·이미지 최적화·파비콘·API 는 host 를 볼 필요가 없다.
  // 이것들까지 middleware 를 타면 모든 자산 요청마다 함수가 한 번씩 더 돈다.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
