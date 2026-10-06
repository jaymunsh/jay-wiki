import type { Metadata } from 'next';
import Link from 'next/link';
import { BlogRail } from '@/components/blog/BlogRail';
import { BlogShell } from '@/components/blog/BlogShell';
import { getBlogPosts } from '@/lib/blog';
import { WORK_CATEGORIES, WORKS, worksByCategory } from '@/lib/worksCatalog';
import { WorkCard } from './WorkCard';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: '작업물',
  description: '만든 것들의 목록 — 유틸리티, 서비스, 콘텐츠, 게임을 카테고리별로 묶어 둔 색인.',
  alternates: { canonical: '/works' },
};

/**
 * 작업물 색인. 앱·저장소와 소개 글을 각자의 주소로 연결한다.
 */
export default async function WorksPage() {
  const posts = await getBlogPosts();
  return (
    <BlogShell rail={<BlogRail />} title="작업물">
      <div className={styles.page}>
        <div className={styles.intro}>
          <h1>작업물</h1>
          <p>
            만들어 둔 작업물 {WORKS.length}개를 카테고리별로 모았습니다. 최근 소개 글 순입니다.
          </p>
        </div>
        <div className={styles.catalog}>
          {WORK_CATEGORIES.map((cat) => {
            const works = worksByCategory(cat.slug, posts);
            if (works.length === 0) return null;
            return (
              <section key={cat.slug} id={cat.slug}>
                <div className={styles.sectionHead}>
                  <h2>
                    {cat.label} <span className={styles.count}>({works.length})</span>
                  </h2>
                  <span>
                    <Link href={`/works/${cat.slug}`}>이 카테고리만 보기 →</Link>
                  </span>
                </div>
                <div className={styles.list}>
                  {works.map((work) => (
                    <WorkCard key={work.slug} work={work} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </BlogShell>
  );
}
