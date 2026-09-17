import { CategoryTreeEditor } from '@/components/blog/admin/CategoryTreeEditor';
import { getAdminBlogCategories } from '@/lib/blogAdmin';
import { saveCategoryAction } from '@/lib/blogAdminActions';

export const dynamic = 'force-dynamic';

export default async function AdminBlogCategoriesPage() {
  const categories = await getAdminBlogCategories();

  return (
    <>
      <div className="admin-head">
        <div>
          <div className="eyebrow">Admin · Blog</div>
          <h1>카테고리 — {categories.length}개</h1>
          <p className="admin-desc">
            드래그하거나 ↑↓ 로 순서를 바꿉니다. 최대 2단이고, 글이 있는 카테고리는 지울 수 없습니다.
          </p>
        </div>
      </div>

      {/* key 는 카테고리 집합이 바뀔 때만 바뀐다. 트리 편집기가 initial 을 useState 초기값으로
          들고 있어서, 추가·삭제 뒤 서버가 새 목록을 줘도 다시 마운트하지 않으면 화면이 낡는다.
          id 를 정렬해 만들므로 순서만 바뀌는 정렬 저장으로는 다시 마운트되지 않는다. */}
      <CategoryTreeEditor
        key={categories.map((c) => c.id).sort((a, b) => a - b).join(',')}
        initial={categories}
      />

      <form action={saveCategoryAction} className="badm-new">
        <input name="slug" placeholder="slug (영문)" required pattern="[a-z0-9][a-z0-9-]*" />
        <input name="name" placeholder="표시 이름" required />
        <input name="description" placeholder="설명 (선택)" />
        <button type="submit" className="btn btn-primary">＋ 추가</button>
      </form>
    </>
  );
}
