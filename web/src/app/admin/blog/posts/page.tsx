import Link from 'next/link';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { getAdminBlogPosts } from '@/lib/blogAdmin';
import { deleteBlogPostAction } from '@/lib/blogAdminActions';
import { AdminStatusTabs } from '@/components/admin/AdminStatusTabs';

export const dynamic = 'force-dynamic';

export default async function AdminBlogPostsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const items = await getAdminBlogPosts();
  const { q = '', status = 'all', page: rawPage = '1' } = await searchParams;
  const query = q.trim().toLocaleLowerCase('ko');
  const matches = items.filter((item) => (status === 'all' || item.status === status)
    && (!query || `${item.title} ${item.slug} ${item.summary ?? ''}`.toLocaleLowerCase('ko').includes(query)));
  const pageSize = 20;
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.min(pages, Math.max(1, Number.parseInt(rawPage, 10) || 1));
  const filtered = matches.slice((page - 1) * pageSize, page * pageSize);
  const pageHref = (next: number) => `/blog/posts?${new URLSearchParams({ ...(q ? { q } : {}), ...(status !== 'all' ? { status } : {}), page: String(next) })}`;
  const published = items.filter((item) => item.status === 'published').length;
  const views = items.reduce((sum, item) => sum + item.viewCount, 0);

  return <>
    <header className="admin-head"><div><div className="eyebrow">CONTENT · BLOG</div><h1>블로그 글</h1><p className="admin-desc">초안과 발행 글을 한 목록에서 관리합니다.</p></div><Link className="btn btn-primary" href="/blog/posts/new"><Plus /> 새 글</Link></header>
    <div className="admin-summary-grid" aria-label="블로그 현황"><div><span>전체</span><strong>{items.length}</strong></div><div><span>발행</span><strong>{published}</strong></div><div><span>초안</span><strong>{items.length - published}</strong></div><div><span>누적 조회</span><strong>{views.toLocaleString('ko-KR')}</strong></div></div>
    <section className="admin-table-panel">
      <AdminStatusTabs pathname="/blog/posts" query={q} selected={status} items={[
        { value: 'all', label: '전체', count: items.length },
        { value: 'draft', label: '초안', count: items.filter((item) => item.status === 'draft').length },
        { value: 'published', label: '발행', count: published },
      ]} />
      <form className="admin-list-tools" method="get"><label><Search /><span className="sr-only">글 검색</span><input name="q" defaultValue={q} placeholder="제목, slug, 요약 검색" /></label><select name="status" defaultValue={status} aria-label="발행 상태"><option value="all">모든 상태</option><option value="published">발행</option><option value="draft">초안</option></select><button className="btn" type="submit">적용</button><span>{matches.length}편</span></form>
      {filtered.length === 0 ? <div className="admin-empty">조건에 맞는 글이 없습니다.</div> : <div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>글</th><th>상태</th><th>카테고리</th><th>수정일</th><th>조회</th><th><span className="sr-only">동작</span></th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><Link className="admin-table-title" href={`/blog/posts/${item.id}`}>{item.title}</Link><code>{item.categorySlug}/{item.slug}</code></td><td><span className={`admin-status ${item.status}`}>{item.status === 'published' ? '발행' : '초안'}</span></td><td>{item.categoryName ?? '—'}</td><td>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('ko-KR') : '—'}</td><td>{item.viewCount.toLocaleString('ko-KR')}</td><td><div className="admin-row-actions"><Link href={`/blog/posts/${item.id}`} aria-label={`${item.title} 편집`}><Pencil /></Link><form action={deleteBlogPostAction}><input type="hidden" name="id" value={item.id} /><button type="submit" aria-label={`${item.title} 삭제`}><Trash2 /></button></form></div></td></tr>)}</tbody></table></div>}
      {matches.length > 0 && <nav className="admin-pagination" aria-label="블로그 글 페이지"><Link aria-disabled={page === 1} href={pageHref(Math.max(1, page - 1))}>이전</Link><span>{page} / {pages}</span><Link aria-disabled={page === pages} href={pageHref(Math.min(pages, page + 1))}>다음</Link></nav>}
    </section>
  </>;
}
