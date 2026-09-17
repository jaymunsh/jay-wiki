'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { compareNullableIsoDateDesc } from '@/lib/dateTime';

/**
 * 위키 전체 글 목록 — /wiki
 *
 * 첫 화면의 DOCS 카드는 다섯 줄만 보여준다. 그 옆 화살표가 여기로 온다.
 * 정렬은 최근 발행과 최근 수정 둘뿐이다. 탭별 보기는 이미 첫 화면이 하는 일이라 겹치지 않게 뒀다.
 *
 * 서버 페이징을 두지 않는다. 목록 API 가 트리 한 번에 전부를 주고 지금 71편이라,
 * 페이지를 나누는 쪽이 더 많은 코드를 부른다. 화면에서만 30편씩 늘린다.
 */
type Article = {
  readonly slug: string;
  readonly parentId: string;
  readonly title: string;
  readonly summary?: string;
  readonly kind: string;
  readonly viewCount: number;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
};

type Tab = { readonly tabId: string; readonly title: string; readonly articles?: readonly Article[] };

type Mode = 'published' | 'edited';

const PAGE = 30;

function formatDate(value: string | null): string {
  if (!value) return '--';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function WikiIndexPage() {
  const [tabs, setTabs] = useState<readonly Tab[] | null>(null);
  const [mode, setMode] = useState<Mode>('published');
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    let live = true;
    void (async () => {
      const res = await fetch('/api/bff/tabs', { cache: 'no-store' }).catch(() => null);
      if (!live) return;
      setTabs(res?.ok ? ((await res.json()) as Tab[]) : []);
    })();
    return () => {
      live = false;
    };
  }, []);

  const titleByTab = useMemo(
    () => new Map((tabs ?? []).map((t) => [t.tabId, t.title])),
    [tabs],
  );

  const sorted = useMemo(() => {
    const all = (tabs ?? []).flatMap((t) => t.articles ?? []);
    const stamp = (a: Article) => (mode === 'edited' ? a.updatedAt : a.createdAt);
    // 같은 날 쓴 글이 여럿이라 시각이 같으면 순서가 흔들린다. slug 로 한 번 더 갈라 고정한다.
    return [...all].sort(
      (a, b) => compareNullableIsoDateDesc(stamp(a), stamp(b)) || a.slug.localeCompare(b.slug),
    );
  }, [tabs, mode]);

  function pick(next: Mode) {
    setMode(next);
    setShown(PAGE);
  }

  return (
    <>
      <Header />
      <main id="main-content">
        <section className="hero" style={{ marginBottom: 24 }}>
          <h1>
            위키 전체 글
            {tabs && <small className="wiki-search-hits">{sorted.length}편</small>}
          </h1>
          <p>첫 화면의 DOCS 카드가 보여주는 목록 전체다. 탭별로 보려면 첫 화면에서 탭을 누른다.</p>
          <div className="al-sort" role="group" aria-label="정렬">
            <button aria-pressed={mode === 'published'} onClick={() => pick('published')} type="button">
              최근 발행
            </button>
            <button aria-pressed={mode === 'edited'} onClick={() => pick('edited')} type="button">
              최근 수정
            </button>
          </div>
        </section>

        {/* 상자를 벗긴 목록이라 카드끼리 붙으면 어디까지가 한 글인지 흐려진다. 줄 간격을 넓힌다. */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tabs === null && <div className="placeholder">불러오는 중…</div>}
          {tabs !== null && sorted.length === 0 && <div className="placeholder">글이 없습니다.</div>}
          {sorted.slice(0, shown).map((a) => (
            <Link
              key={a.slug}
              href={`/wiki/${encodeURIComponent(a.slug)}`}
              className="al-row"
              style={{ display: 'block' }}
            >
              <div className="al-meta-plain">
                {/* 지금 무엇으로 정렬했는지가 줄마다 먼저 보여야 한다. 그래서 날짜가 맨 앞이다. */}
                <span>
                  {mode === 'edited' ? '수정' : '발행'} {formatDate(mode === 'edited' ? a.updatedAt : a.createdAt)}
                </span>
                <span className="kind">{a.kind}</span>
                <span>{titleByTab.get(a.parentId) ?? a.parentId}</span>
                {a.viewCount > 0 && <span>조회 {a.viewCount.toLocaleString('ko-KR')}</span>}
              </div>
              <div className="al-title">{a.title}</div>
              {a.summary && <div className="al-desc">{a.summary}</div>}
              <div className="al-foot">
                <code>
                  {a.parentId}/{a.slug}
                </code>
              </div>
            </Link>
          ))}
          {shown < sorted.length && (
            <button className="btn-primary" type="button" onClick={() => setShown((n) => n + PAGE)}>
              더 보기 ({sorted.length - shown}편 남음)
            </button>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
