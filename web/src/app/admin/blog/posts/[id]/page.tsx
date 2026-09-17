import { notFound } from 'next/navigation';
import { BlogPostForm } from '@/components/blog/admin/BlogPostForm';
import { getAdminBlogCategories, getAdminBlogPost, getAdminBlogPosts } from '@/lib/blogAdmin';

export const dynamic = 'force-dynamic';

export default async function EditBlogPostPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [post, categories, posts] = await Promise.all([
    getAdminBlogPost(Number(id)),
    getAdminBlogCategories(),
    getAdminBlogPosts(),
  ]);
  return <BlogPostForm initial={post} categories={categories} posts={posts} />;
}
