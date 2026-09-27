import { describe, expect, it } from 'vitest';
import { gameRewritePath, isGameHost } from './gameHost';

describe('game host boundary', () => {
  it('uses an exact game host allowlist', () => {
    expect(isGameHost('game.localhost:3000')).toBe(true);
    expect(isGameHost('game.leneu.cloud')).toBe(true);
    for (const host of ['game.attacker.test', 'game.leneu.cloud.evil', 'blog.localhost:3000', null]) {
      expect(isGameHost(host)).toBe(false);
    }
  });

  it('rewrites the lobby root and seo files to the games app route', () => {
    expect(gameRewritePath('/')).toBe('/games');
    expect(gameRewritePath('/robots.txt')).toBe('/games/robots.txt');
    expect(gameRewritePath('/sitemap.xml')).toBe('/games/sitemap.xml');
  });

  it('maps a single extensionless slug to its public game file', () => {
    expect(gameRewritePath('/forest-jump')).toBe('/game/forest-jump.html');
    // 없는 slug 도 같은 규칙으로 보낸다 — 파일이 없어 자연스럽게 404.
    expect(gameRewritePath('/not-a-game')).toBe('/game/not-a-game.html');
    // .html 직접 접근은 게임 host 의 정본 주소가 아니다 — 정규식 밖이라 404 가드로 간다.
    expect(gameRewritePath('/forest-jump.html')).toBeNull();
  });

  it('rejects paths that are not a single slug', () => {
    expect(gameRewritePath('/foo/bar')).toBeNull();
    expect(gameRewritePath('/UPPER')).toBeNull();
    expect(gameRewritePath('/wp-admin.php')).toBeNull();
  });

  it('passes through api, game assets, the games app and shared icons untouched', () => {
    expect(gameRewritePath('/api/bff/game/forest-jump/scores')).toBeNull();
    expect(gameRewritePath('/_next/static/chunk.js')).toBeNull();
    expect(gameRewritePath('/games')).toBeNull();
    expect(gameRewritePath('/games/sitemap.xml')).toBeNull();
    expect(gameRewritePath('/game/forest-field-bgm.mp3')).toBeNull();
    expect(gameRewritePath('/assets/projects/donts3p-icon.webp')).toBeNull();
    expect(gameRewritePath('/favicon-32x32.png')).toBeNull();
  });
});
