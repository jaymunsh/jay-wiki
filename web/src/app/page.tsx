import { permanentRedirect } from 'next/navigation';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { WikiShell } from '@/components/WikiShell';
import { getArticle, getTabs } from '@/lib/api';
import { deployedAt } from '@/lib/deployedAt';
import { visitorSignals } from '@/lib/visitorIp';

export const dynamic = 'force-dynamic'; // 본문 SoT=DB. 항상 최신 트리

type SearchParams = {
  readonly article?: string | readonly string[];
  readonly slug?: string | readonly string[];
};

function firstParam(value: string | readonly string[] | undefined): string | undefined {
  if (typeof value === 'string') return value;
  return value?.[0];
}

export default async function HomePage({ searchParams }: { readonly searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  // 문서 정본 URL은 /wiki/[slug]다. 과거 공유 링크(/?article=)는 영구 리다이렉트로 흡수한다.
  const requestedSlug = firstParam(params.article) ?? firstParam(params.slug);
  if (requestedSlug) permanentRedirect(`/wiki/${encodeURIComponent(requestedSlug)}`);

  const tabs = await getTabs();
  const fallbackSlug = tabs.find((tab) => tab.articles.length > 0)?.articles[0]?.slug;
  // 첫 화면의 기본 글도 결국 사람이 읽는 글이라 조회수를 센다. 같은 IP 는 24시간에 한 번만 오른다.
  const initialArticle = fallbackSlug ? await getArticle(fallbackSlug, true, ...(await visitorSignals())) : null;

  return (
    <>
      <Header />
      <main id="main-content">
        <WikiShell tabs={tabs} initialArticle={initialArticle} deployedAt={deployedAt()} />
      </main>
      <Footer />
    </>
  );
}
