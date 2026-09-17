import type { MetadataRoute } from 'next';
import { PUBLIC_SITE_ORIGIN } from '@/lib/siteConfig';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // /blog 는 blog.leneu.cloud 로도 열린다. 두 주소가 같은 글을 내면 색인이
        // 갈라지므로 위키 host 에서는 색인하지 않는다.
        // /search 는 질의마다 주소가 생긴다. 색인시킬 이유가 없다.
        // /preview-error 는 오류 화면을 눈으로 보려고 둔 라우트다. 색인시킬 글이 아니다.
        disallow: ['/admin', '/api', '/login', '/blog', '/search', '/preview-error'],
      },
    ],
    sitemap: `${PUBLIC_SITE_ORIGIN}/sitemap.xml`,
  };
}
