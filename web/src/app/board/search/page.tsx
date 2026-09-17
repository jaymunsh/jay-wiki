'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ScenarioCaseBanner } from '@/app/scenarios/ScenarioCaseBanner';

/**
 * 게시판 검색 비교 — /board/search  (워크북 03B)
 * 같은 검색어를 LIKE, tsvector, OpenSearch+nori 세 방식으로 돌려
 * 방식별 소요시간·건수를 나란히 보여준다.
 */
type Hit = {
  readonly id: number;
  readonly title: string;
  readonly authorName: string;
  readonly views: number;
  readonly commentCount: number;
  readonly snippet: string;
};
type MethodResult = {
  readonly method: string;
  readonly note: string;
  readonly elapsedMs: number;
  readonly count: number;
  readonly hits: readonly Hit[];
};
type CompareResult = { readonly query: string; readonly methods: readonly MethodResult[] };

const SUGGEST_MIN_LENGTH = 2;

function renderMarkedText(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let rest = text;
  let index = 0;

  while (rest.length > 0) {
    const start = rest.indexOf('[[');
    if (start < 0) {
      parts.push(rest);
      break;
    }
    const end = rest.indexOf(']]', start + 2);
    if (end < 0) {
      parts.push(rest);
      break;
    }
    if (start > 0) {
      parts.push(rest.slice(0, start));
    }
    parts.push(
      <mark className="cmp-mark" key={`mark-${index}`}>
        {rest.slice(start + 2, end)}
      </mark>,
    );
    rest = rest.slice(end + 2);
    index += 1;
  }

  return parts.length > 0 ? parts : text;
}

export default function BoardSearchPage() {
  const [q, setQ] = useState('게시글');
  const [res, setRes] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<readonly string[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [loadingSuggest, setLoadingSuggest] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (query.length < SUGGEST_MIN_LENGTH) {
      setSuggestions([]);
      setLoadingSuggest(false);
      return;
    }

    let ignore = false;
    setLoadingSuggest(true);
    const timer = window.setTimeout(async () => {
      try {
        const r = await fetch(`/api/bff/board/suggest?q=${encodeURIComponent(query)}`);
        const payload: unknown = r.ok ? await r.json() : [];
        const next = Array.isArray(payload)
          ? payload.filter((item): item is string => typeof item === 'string')
          : [];
        if (!ignore) {
          setSuggestions(next);
        }
      } finally {
        if (!ignore) {
          setLoadingSuggest(false);
        }
      }
    }, 160);

    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [q]);

  async function runWith(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    setQ(trimmed);
    setSuggestOpen(false);
    setLoading(true);
    try {
      const r = await fetch(`/api/bff/board/search?q=${encodeURIComponent(trimmed)}`);
      setRes(r.ok ? await r.json() : null);
    } finally {
      setLoading(false);
    }
  }

  async function run() {
    await runWith(q);
  }

  const fastest = res?.methods.length
    ? Math.min(...res.methods.map((m) => m.elapsedMs))
    : null;

  return (
    <>
      <Header />
      <main id="main-content">
        <section className="hero cmp-hero" style={{ marginBottom: 20 }}>
          <div className="eyebrow">Search compare</div>
          <h1 style={{ margin: '4px 0 6px' }}>자유게시판 검색 비교</h1>
          <p style={{ margin: '0 0 16px' }}>
            10만 건 위에서 같은 검색어를 <strong>LIKE(순차 스캔)</strong> vs{' '}
            <strong>tsvector(GIN 전문검색)</strong> vs <strong>OpenSearch+nori</strong> 로 돌려
            소요시간과 한글 검색 품질을 비교합니다.
          </p>
          <div style={{ display: 'flex', gap: 8, maxWidth: 520 }}>
            <div className="cmp-searchbox">
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSuggestOpen(true);
                }}
                onFocus={() => setSuggestOpen(true)}
                onBlur={() => window.setTimeout(() => setSuggestOpen(false), 120)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void run();
                  }
                }}
                placeholder="검색어 (예: 게시글)"
              />
              {suggestOpen && (loadingSuggest || suggestions.length > 0) && (
                <div className="cmp-suggest" onMouseDown={(e) => e.preventDefault()}>
                  {loadingSuggest && <div className="cmp-suggest-state">불러오는 중</div>}
                  {suggestions.map((title) => (
                    <button
                      type="button"
                      key={title}
                      className="cmp-suggest-item"
                      onClick={() => {
                        void runWith(title);
                      }}
                    >
                      {title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="btn btn-primary" onClick={run} disabled={loading}>
              {loading ? '검색 중…' : '비교'}
            </button>
            <Link className="btn" href="/board">목록</Link>
          </div>
        </section>

        <ScenarioCaseBanner scenarioId="search-compare" />

        {res && (
          <section className="cmp-grid">
            {res.methods.map((m) => (
              <div key={m.method} className="cmp-col">
                <div className="cmp-head">
                  <div>
                    <div className="cmp-name">{m.method}</div>
                    <div className="cmp-note">{m.note}</div>
                  </div>
                  <div className={`cmp-ms${m.elapsedMs === fastest ? ' best' : ''}`}>
                    {m.elapsedMs}<small>ms</small>
                  </div>
                </div>
                <div className="cmp-count">상위 {m.count}건</div>
                <ul className="cmp-hits">
                  {m.hits.length === 0 && <li className="cmp-empty">결과 없음</li>}
                  {m.hits.map((h) => (
                    <li key={h.id}>
                      <Link href={`/board/${h.id}`}>
                        <span className="cmp-hit-title">
                          <span className="cmp-id">#{h.id}</span> {renderMarkedText(h.title)}
                        </span>
                        {h.snippet && <span className="cmp-snippet">{renderMarkedText(h.snippet)}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {res && fastest !== null && (
          <p style={{ marginTop: 16, fontSize: 12.5, color: 'var(--text-mute)' }}>
            ※ 소요시간은 서버측 쿼리 실행 시간. PG 버퍼 캐시 영향으로 두 번째 실행부터 빨라질 수 있음.
            OpenSearch가 꺼져 있거나 nori 플러그인이 없으면 세 번째 칸은 사용 불가로 표시됩니다.
          </p>
        )}
      </main>
      <Footer />
    </>
  );
}
