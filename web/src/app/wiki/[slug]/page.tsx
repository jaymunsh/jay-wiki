import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { WikiShell } from '@/components/WikiShell';
import { getArticle, getTabs } from '@/lib/api';
import { getBlogPosts } from '@/lib/blog';
import { deployedAt } from '@/lib/deployedAt';
import { blogAbsoluteUrl, blogPostHref } from '@/lib/blogLinks';
import { visitorSignals } from '@/lib/visitorIp';

export const dynamic = 'force-dynamic'; // 본문 SoT=DB. 항상 최신 트리

// generateMetadata 와 페이지 본문이 같은 요청 안에서 문서를 두 번 조회하지 않도록 memoize.
// 인자가 전부 원시값이라 generateMetadata 와 본문이 같은 인자로 부르면 한 번만 조회된다
// = 조회수도 한 번만 오른다.
const getArticleCached = cache(getArticle);
const getBlogPostsCached = cache(getBlogPosts);

type Params = { readonly slug: string };

/**
 * 경로 조각이 퍼센트 인코딩된 채로 올 때가 있다. 그대로 다시 인코딩하면 이중 인코딩이 되어
 * 백엔드가 형식 위반으로 거절하고, 주소를 잘못 친 방문자가 404 대신 오류 화면을 본다.
 * 한 번 풀어 준다. 못 푸는 값이면 원본을 그대로 쓴다.
 */
function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * 위키에 없는 slug 면 블로그로 옮겨진 글인지 본다. LAB 8편이 그렇다.
 * 이관이 slug 를 유지했으므로 목록에서 찾는다 — 매핑을 코드에 박으면 글이 늘 때마다 손대야 한다.
 * 글이 수백 편이 되면 slug 조회 API 로 바꾼다.
 */
async function migratedBlogUrl(slug: string): Promise<string | null> {
  const posts = await getBlogPostsCached();
  const found = posts.find((p) => p.slug === slug);
  return found ? blogAbsoluteUrl(blogPostHref(found.id, found.slug)) : null;
}

export async function generateMetadata({ params }: { readonly params: Promise<Params> }): Promise<Metadata> {
  const slug = decodeSlug((await params).slug);
  const article = await getArticleCached(slug, true, ...(await visitorSignals()));
  if (!article) {
    // 옮겨진 글이면 색인을 블로그 쪽으로 넘긴다. 여기서 제목은 알 수 없다.
    const moved = await migratedBlogUrl(slug);
    if (moved) return { title: '블로그로 옮긴 글', alternates: { canonical: moved } };
    return { title: '문서를 찾을 수 없습니다', robots: { index: false } };
  }
  const description = article.summary ?? `${article.title} — jay-wiki 운영 기록`;
  const canonicalPath = `/wiki/${encodeURIComponent(article.slug)}`;
  return {
    title: article.title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: article.title,
      description,
      url: canonicalPath,
      images: ['/og-image-1200x630.png'],
    },
  };
}

export default async function WikiArticlePage({ params }: { readonly params: Promise<Params> }) {
  const slug = decodeSlug((await params).slug);
  const [tabs, article] = await Promise.all([getTabs(), getArticleCached(slug, true, ...(await visitorSignals()))]);
  if (!article) {
    const moved = await migratedBlogUrl(slug);
    if (moved) permanentRedirect(moved);
    notFound();
  }

  return (
    <>
      <Header />
      <main id="main-content">
        <WikiShell tabs={tabs} initialArticle={article} deployedAt={deployedAt()} />
      </main>
      <Footer />
    </>
  );
}
