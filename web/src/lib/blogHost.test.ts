import { describe, expect, it } from 'vitest';

import { blogRewritePath, isBlogHost } from './blogHost';

describe('isBlogHost', () => {
  it('blog. 로 시작하면 블로그다', () => {
    expect(isBlogHost('blog.leneu.cloud')).toBe(true);
    expect(isBlogHost('blog.localhost:3000')).toBe(true);
  });

  it('그 밖의 host 는 아니다', () => {
    expect(isBlogHost('portfolio.leneu.cloud')).toBe(false);
    expect(isBlogHost('localhost:3000')).toBe(false);
    expect(isBlogHost('myblog.leneu.cloud')).toBe(false);
    expect(isBlogHost(null)).toBe(false);
  });

  it('대문자 host 도 같게 본다', () => {
    expect(isBlogHost('BLOG.leneu.cloud')).toBe(true);
  });
});

describe('blogRewritePath', () => {
  it('루트는 /blog 로 간다', () => {
    expect(blogRewritePath('/')).toBe('/blog');
  });

  it('나머지 경로는 앞에 /blog 를 붙인다', () => {
    expect(blogRewritePath('/category/tech-lab')).toBe('/blog/category/tech-lab');
    expect(blogRewritePath('/6/donts3p')).toBe('/blog/6/donts3p');
    expect(blogRewritePath('/sitemap.xml')).toBe('/blog/sitemap.xml');
  });

  it('이미 /blog 로 시작하면 다시 붙이지 않는다', () => {
    expect(blogRewritePath('/blog')).toBeNull();
    expect(blogRewritePath('/blog/6/x')).toBeNull();
  });

  it('관리자와 API 는 블로그 host 에서도 그대로 둔다', () => {
    expect(blogRewritePath('/api/bff/blog/posts')).toBeNull();
    expect(blogRewritePath('/admin/login')).toBeNull();
  });

  it('public/ 정적 파일은 rewrite 하지 않는다', () => {
    // 본문 이미지가 /assets/... 라 rewrite 하면 글마다 이미지가 깨진다.
    expect(blogRewritePath('/assets/projects/donts3p-icon.webp')).toBeNull();
    expect(blogRewritePath('/benchmark')).toBeNull();
    expect(blogRewritePath('/benchmark/js/app.js')).toBeNull();
    expect(blogRewritePath('/game/forest-jump')).toBeNull();
    expect(blogRewritePath('/game/forest-field-bgm.mp3')).toBeNull();
    expect(blogRewritePath('/favicon.ico')).toBeNull();
    expect(blogRewritePath('/og-image-1200x630.png')).toBeNull();
  });

  it('robots·sitemap 은 블로그 전용 라우트라 rewrite 한다', () => {
    expect(blogRewritePath('/robots.txt')).toBe('/blog/robots.txt');
    expect(blogRewritePath('/sitemap.xml')).toBe('/blog/sitemap.xml');
  });
});
