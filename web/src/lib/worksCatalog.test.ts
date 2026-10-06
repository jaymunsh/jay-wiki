import { describe, expect, it } from 'vitest';
import { WORKS, worksByCategory } from './worksCatalog';

describe('worksByCategory', () => {
  it('소개 글의 발행일을 시간대까지 비교해 최근 글부터 나열한다', () => {
    const posts = [
      { slug: 'ntfs-manager-macos-ntfs-rw', publishedAt: '2026-10-01T00:00:00Z' },
      {
        slug: 'hold-img-floating-screenshot',
        publishedAt: '2026-10-01T10:00:00+09:00',
        updatedAt: '2026-11-01T00:00:00Z',
      },
      { slug: 'port-manager-macos-network-and-storage', publishedAt: '2026-10-01T03:00:00Z' },
    ];

    expect(worksByCategory('tools', posts).slice(0, 3).map((work) => work.slug)).toEqual([
      'port-manager', 'hold-img', 'ntfs-manager',
    ]);
  });

  it('소개 글이 없는 작업물은 발행한 소개 글 뒤에 둔다', () => {
    expect(worksByCategory('games', [
      { slug: 'spellcrown-web-boardgame', publishedAt: '2026-08-08T00:38:56Z' },
    ]).map((work) => work.slug)).toEqual(['spellcrown', 'forest-jump', 'omok']);
  });

  it('날짜가 없거나 잘못된 항목을 숨기지 않고 나머지 항목의 기존 순서를 유지한다', () => {
    const original = WORKS.filter((work) => work.category === 'tools');
    const posts = [
      { slug: 'fold-menu-macos-menubar-folder', publishedAt: '2026-09-28T10:15:00Z' },
      { slug: 'hold-img-floating-screenshot', publishedAt: 'invalid' },
      { slug: 'ntfs-manager-macos-ntfs-rw' },
    ];
    const sorted = worksByCategory('tools', posts);

    expect(sorted[0].slug).toBe('fold-menu');
    expect(sorted.slice(1)).toEqual(original.filter((work) => work.slug !== 'fold-menu'));
    expect(worksByCategory('tools', [])).toEqual(original);
  });

  it('동일 발행일의 기존 순서와 원본 목록을 보존한다', () => {
    const original = WORKS.filter((work) => work.category === 'tools');
    const posts = original.map((work) => ({
      slug: work.articleHref!.split('/').at(-1)!,
      publishedAt: '2026-10-01T00:00:00Z',
    }));

    expect(worksByCategory('tools', posts)).toEqual(original);
    expect(worksByCategory('tools')).toEqual(original);
  });
});
