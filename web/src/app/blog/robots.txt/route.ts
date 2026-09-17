import { blogAbsoluteUrl } from '@/lib/blogLinks';

/**
 * 블로그 host 의 robots.txt. middleware 가 /robots.txt → /blog/robots.txt 로 rewrite 한다.
 *
 * Next 의 robots.ts 규약을 쓰지 않는 이유: 그 규약은 app 루트에서만 동작해서
 * app/blog/robots.ts 는 robots.txt 를 만들지 않고, 요청이 동적 [id] 라우트로 흘러 404 가 된다.
 * 정적 세그먼트인 라우트 핸들러는 [id] 보다 먼저 매칭되므로 그 문제가 없다.
 */
export function GET() {
  const body = [
    'User-Agent: *',
    'Allow: /',
    'Disallow: /tag/', // 태그 페이지는 내용이 얇아 색인하지 않는다 (설계 9절)
    '',
    `Sitemap: ${blogAbsoluteUrl('/sitemap.xml')}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
