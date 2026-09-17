'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

type Hit = {
  readonly slug: string;
  readonly parentId: string;
  readonly title: string;
  readonly summary?: string;
  readonly kind: string;
};

type SearchEngine = 'OPENSEARCH_NORI' | 'POSTGRESQL_LIKE' | '';

type Result = {
  readonly hits: readonly Hit[];
  readonly cache: string;
  readonly engine: SearchEngine;
};

/** 추천 키워드 = 문서에 실제로 많이 붙은 태그. 손으로 고른 예시가 아니라 눌러서 결과가 빈 적이 없다. */
const TOP_TAG_COUNT = 5;

/** useSearchParams 를 쓰므로 Suspense 경계가 필요하다. */
export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchRoute />
    </Suspense>
  );
}

/** 질의가 바뀌면 아래를 통째로 다시 만든다. 그래야 effect 가 상태를 되돌릴 일이 없다. */
function SearchRoute() {
  const q = (useSearchParams().get('q') ?? '').trim();
  return <Search key={q} q={q} />;
}

/**
 * 검색 페이지 — /search?q=...
 * 질의는 주소에만 산다. 헤더 검색창도 평범한 GET 으로 여기에 오므로 결과를 공유·북마크할 수 있다.
 * BFF(/api/bff/search) 를 호출해 Spring 검색 결과를 카드로 표시하고,
 * 응답 헤더 X-Cache(HIT/MISS) 를 같이 보여줘 Redis 캐시 동작을 시연한다.
 */
function Search({ q }: { readonly q: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const tags = useTopTags();
  const loading = q !== '' && result === null;

  useEffect(() => {
    if (!q) return;
    let live = true;
    void (async () => {
      const r = await fetch(`/api/bff/search?q=${encodeURIComponent(q)}`).catch(() => null);
      if (!live) return;
      setResult({
        hits: r?.ok ? ((await r.json()) as Hit[]) : [],
        cache: r?.headers.get('x-cache') ?? '',
        engine: parseSearchEngine(r?.headers.get('x-search-engine') ?? null),
      });
    })();
    return () => {
      live = false;
    };
  }, [q]);

  return (
    <>
      {/* 검색창은 헤더 것 하나뿐이다. 여기서 또 그리면 같은 화면에 검색창이 둘이 된다. */}
      <Header searchQuery={q} />
      <main id="main-content">
        {/* 위에서부터 어떤 엔진이 답했는지 / 추천 키워드 / 제목 순이다.
            제목은 맨 아래에 둬야 결과 목록과 붙는다. 설명 문장은 아직 아무것도 안 찾은 화면에만 있다. */}
        <section className="hero" style={{ marginBottom: 24 }}>
          {result && (result.cache || result.engine) && <div className="wiki-search-evidence">
            {result.engine && <span>ENGINE <strong>{result.engine === 'OPENSEARCH_NORI' ? 'OpenSearch · nori' : 'PostgreSQL · fallback'}</strong></span>}
            {result.cache && <span>CACHE <strong data-cache={result.cache}>{result.cache}</strong></span>}
          </div>}
          {tags.length > 0 && (
            <div className="wiki-search-samples" aria-label="추천 키워드">
              <span>추천 키워드:</span>
              {tags.map((tag) => (
                <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`}>{tag}</Link>
              ))}
            </div>
          )}
          {q ? (
            <h1>
              &apos;{q}&apos; 검색 결과
              {loading
                ? <small className="wiki-search-hits">검색 중…</small>
                : result && <small className="wiki-search-hits">{result.hits.length}편</small>}
            </h1>
          ) : (
            <>
              <h1>위키 검색</h1>
              <p>OpenSearch+nori로 제목·요약·태그·본문을 검색하고, 검색엔진을 사용할 수 없으면 PostgreSQL로 전환합니다.</p>
            </>
          )}
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!q && <div className="placeholder">위 검색창에 찾을 말을 넣으세요. 제목·요약·태그·본문에서 찾습니다.</div>}
          {result?.hits.length === 0 && (
            <div className="placeholder">결과가 없습니다. (published 상태의 문서만 검색됩니다)</div>
          )}
          {result?.hits.map((h) => (
            <Link key={h.slug} href={`/wiki/${encodeURIComponent(h.slug)}`} className="al-row" style={{ display: 'block' }}>
              <div className="al-meta">
                <span className="badge kind">kind: {h.kind}</span>
                <span className="badge">{h.parentId}</span>
              </div>
              <div className="al-title">{h.title}</div>
              {h.summary && <div className="al-desc">{h.summary}</div>}
              <div className="al-foot"><code>{h.parentId}/{h.slug}</code></div>
            </Link>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}

/** 많이 쓰인 태그 상위 몇 개. 실패하면 빈 배열이고 그 줄은 통째로 사라진다. */
function useTopTags(): readonly string[] {
  const [tags, setTags] = useState<readonly string[]>([]);
  useEffect(() => {
    let live = true;
    void (async () => {
      const r = await fetch(`/api/bff/articles/tags/top?limit=${TOP_TAG_COUNT}`).catch(() => null);
      if (!live || !r?.ok) return;
      const rows = (await r.json()) as { readonly name: string }[];
      setTags(rows.map((row) => row.name));
    })();
    return () => {
      live = false;
    };
  }, []);
  return tags;
}

function parseSearchEngine(value: string | null): SearchEngine {
  if (value === 'OPENSEARCH_NORI' || value === 'POSTGRESQL_LIKE') return value;
  return '';
}
