import { List } from 'lucide-react';
import type { TocEntry } from '@/lib/toc';

/**
 * 글 상단 목차. `##` 과 `###` 을 모은다.
 *
 * 켜고 끄는 것은 `tb_blog_post.toc_enabled` 컬럼이다(V20). 위키의 `tb_article.toc_enabled`
 * 와 같은 이름·같은 뜻이라, 글 쓰는 사람이 두 사이트에서 같은 스위치를 찾는다.
 * 블로그는 기본 켜짐이고 위키는 기본 꺼짐이다 — 위키에는 목차가 필요 없는 짧은 글이 많다.
 *
 * 항목이 둘 이하면 그리지 않는다. 목차라기보다 제목을 한 번 더 적은 것에 가깝다.
 */
export function BlogToc({ entries }: { readonly entries: readonly TocEntry[] }) {
  if (entries.length < 3) return null;

  return (
    <nav className="blog-toc" aria-label="목차">
      <p className="blog-toc__head">
        목차
        <List aria-hidden />
      </p>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id} data-depth={entry.depth}>
            <a href={`#${entry.id}`}>
              <span>{entry.text}</span>
              {/* 화살표는 장식이다. 스크린리더에는 제목만 읽힌다 */}
              <i aria-hidden>→</i>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
