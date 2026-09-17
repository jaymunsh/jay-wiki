import { BlogPostForm } from '@/components/blog/admin/BlogPostForm';
import { getAdminBlogCategories, getAdminBlogPosts } from '@/lib/blogAdmin';

export const dynamic = 'force-dynamic';

export default async function NewBlogPostPage() {
  const [categories, posts] = await Promise.all([getAdminBlogCategories(), getAdminBlogPosts()]);
  return <BlogPostForm initial={null} categories={categories} posts={posts} />;
}
