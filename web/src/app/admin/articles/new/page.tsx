import { ArticleEditor } from '@/components/ArticleEditor';
import { getArticle, getTabs } from '@/lib/api';
import type { ArticleKind } from '@/types/wiki';

export const dynamic = 'force-dynamic';

interface SearchParams {
  parentId?: string;
  slug?: string;
  kind?: string;
}

export default async function NewArticlePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tabs = await getTabs();
  const parentId = params.parentId ?? tabs[0]?.tabId ?? 'start';
  const slug = params.slug ?? '';
  const kindParam = (params.kind ?? 'wiki') as ArticleKind;

  // 기존 글이 있으면 편집 모드(본문은 DB에서)
  const existing = slug ? await getArticle(slug) : null;

  const initial = existing
    ? {
        parentId: existing.parentId,
        slug: existing.slug,
        title: existing.title,
        desc: existing.summary ?? '',
        kind: (existing.kind as ArticleKind) ?? kindParam,
        status: (existing.status as 'published' | 'draft' | 'archived') ?? 'draft',
        lastReview: existing.lastReview ?? '',
        sortOrder: existing.sortOrder,
        tocEnabled: existing.tocEnabled ?? false,
        body: existing.body,
      }
    : {
        parentId,
        slug,
        title: '',
        desc: '',
        kind: kindParam,
        status: 'draft' as const,
        lastReview: '',
        sortOrder: 0,
        tocEnabled: false,
        body: '',
      };

  return (
    <ArticleEditor
      initial={initial}
      mode={existing ? 'edit' : 'new'}
      parents={tabs.map((t) => ({ id: t.tabId, title: t.title }))}
    />
  );
}
