import { notFound, permanentRedirect } from 'next/navigation';
import { getBlogPost } from '@/lib/blog';
import { blogPostHref } from '@/lib/blogLinks';

export const dynamic = 'force-dynamic';

/**
 * /6 → /6/donts3p-... 로 301. 숫자 id 가 정본이고 slug 는 읽기용이다.
 * category·tag·privacy 는 정적 세그먼트라 Next 가 이 동적 라우트보다 먼저 매칭한다.
 */
export default async function BlogPostIdPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const post = await getBlogPost(Number(id));
  if (!post) notFound();

  permanentRedirect(blogPostHref(post.id, post.slug));
}
