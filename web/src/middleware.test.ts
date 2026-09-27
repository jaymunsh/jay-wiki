import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from './middleware';

describe('admin host middleware', () => {
  it('sends unauthenticated clean routes to the admin login with a local next path', () => {
    const response = middleware(new NextRequest('http://admin.localhost:3000/wiki/articles?status=draft', {
      headers: { host: 'admin.localhost:3000' },
    }));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://admin.localhost:3000/login?next=%2Fwiki%2Farticles%3Fstatus%3Ddraft');
  });

  it('uses the verified Host header when Next sees an internal proxy URL', () => {
    const response = middleware(new NextRequest('http://localhost:3000/blog/posts/new', {
      headers: { host: 'admin.localhost:3000' },
    }));
    expect(response.headers.get('location')).toBe(
      'http://admin.localhost:3000/login?next=%2Fblog%2Fposts%2Fnew',
    );
  });

  it('keeps the verified admin host on a rewrite behind an internal proxy URL', () => {
    const response = middleware(new NextRequest('http://localhost:3000/blog/posts/12', {
      headers: { host: 'admin.localhost:3000', cookie: 'jw_token=test' },
    }));
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'http://admin.localhost:3000/admin/blog/posts/12',
    );
  });

  it('rewrites authenticated clean routes to the existing internal page', () => {
    const request = new NextRequest('http://admin.localhost:3000/blog/posts/12', {
      headers: { host: 'admin.localhost:3000', cookie: 'jw_token=test' },
    });
    const response = middleware(request);
    expect(response.headers.get('x-middleware-rewrite')).toBe('http://admin.localhost:3000/admin/blog/posts/12');
  });

  it('lets an authenticated internal rewrite reach the admin page', () => {
    const response = middleware(new NextRequest('http://localhost:3000/admin/blog/posts/12', {
      headers: { host: 'admin.localhost:3000', cookie: 'jw_token=test' },
    }));
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('moves legacy public admin links to the clean admin origin', () => {
    const response = middleware(new NextRequest('http://localhost:3000/admin/stats?site=blog', {
      headers: { host: 'localhost:3000' },
    }));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://admin.localhost:3000/stats?site=blog');
  });

  it('rejects mutations sent to a legacy public admin path', () => {
    const response = middleware(new NextRequest('http://localhost:3000/admin/articles', {
      method: 'POST',
      headers: { host: 'localhost:3000' },
    }));
    expect(response.status).toBe(403);
    expect(response.headers.get('location')).toBeNull();
  });

  it('does not trust lookalike admin hosts', () => {
    const response = middleware(new NextRequest('https://admin.leneu.cloud.attacker.test/wiki/articles', {
      headers: { host: 'admin.leneu.cloud.attacker.test' },
    }));
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    expect(response.headers.get('location')).toBeNull();
  });
});

describe('game host middleware', () => {
  it('rewrites the lobby root to the games index', () => {
    const response = middleware(new NextRequest('http://game.localhost:3000/', {
      headers: { host: 'game.localhost:3000' },
    }));
    expect(response.headers.get('x-middleware-rewrite')).toBe('http://game.localhost:3000/games');
  });

  it('rewrites a game slug to its public html file', () => {
    const response = middleware(new NextRequest('http://game.localhost:3000/forest-jump', {
      headers: { host: 'game.localhost:3000' },
    }));
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'http://game.localhost:3000/game/forest-jump.html',
    );
  });

  it('serves game assets without rewriting them into html paths', () => {
    const response = middleware(new NextRequest('http://game.localhost:3000/game/forest-field-bgm.mp3', {
      headers: { host: 'game.localhost:3000' },
    }));
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('keeps the bff api reachable on the game host', () => {
    const response = middleware(new NextRequest('http://game.localhost:3000/api/bff/game/forest-jump/scores', {
      headers: { host: 'game.localhost:3000' },
    }));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('never exposes portfolio or blog routes on the game host', () => {
    for (const path of ['/wiki/articles', '/blog/posts/hello', '/admin/stats', '/wp-admin/setup.php']) {
      const response = middleware(new NextRequest(`http://game.localhost:3000${path}`, {
        headers: { host: 'game.localhost:3000' },
      }));
      expect(response.status).toBe(404);
    }
    // 단일 slug 는 게임 파일 후보로 rewrite 된다 — 파일이 없으면 정적 단계에서 404.
    const slug = middleware(new NextRequest('http://game.localhost:3000/blog', {
      headers: { host: 'game.localhost:3000' },
    }));
    expect(slug.headers.get('x-middleware-rewrite')).toBe('http://game.localhost:3000/game/blog.html');
  });

  it('does not trust lookalike game hosts', () => {
    const response = middleware(new NextRequest('https://game.leneu.cloud.attacker.test/forest-jump', {
      headers: { host: 'game.leneu.cloud.attacker.test' },
    }));
    expect(response.headers.get('x-middleware-rewrite')).toBeNull();
  });
});
