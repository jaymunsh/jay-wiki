import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlogRail } from '@/components/blog/BlogRail';
import { BlogShell } from '@/components/blog/BlogShell';
import { getBlogPosts } from '@/lib/blog';
import {
  WORK_CATEGORIES,
  isWorkCategory,
  worksByCategory,
} from '@/lib/worksCatalog';
import { WorkCard } from '../WorkCard';
import styles from '../page.module.css';

type Params = { readonly category: string };

export function generateStaticParams(): Params[] {
  return WORK_CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!isWorkCategory(category)) return {};
  const label = WORK_CATEGORIES.find((c) => c.slug === category)!.label;
  return {
    title: `작업물 · ${label}`,
    alternates: { canonical: `/works/${category}` },
  };
}

export default async function WorkCategoryPage({
  params,
}: {
  readonly params: Promise<Params>;
}) {
  const { category } = await params;
  if (!isWorkCategory(category)) notFound();
  const cat = WORK_CATEGORIES.find((c) => c.slug === category)!;
  const works = worksByCategory(category, await getBlogPosts());

  return (
    <BlogShell rail={<BlogRail />} title={`작업물 · ${cat.label}`}>
      <div className={styles.page}>
        <div className={styles.intro}>
          <p className={styles.crumb}>
            <Link href="/works">← 전체 작업물</Link>
          </p>
          <h1>{cat.label}</h1>
          <p>{works.length}개 · 최근 소개 글 순</p>
        </div>
        <div className={styles.list}>
          {works.map((work) => (
            <WorkCard key={work.slug} work={work} />
          ))}
        </div>
      </div>
    </BlogShell>
  );
}
