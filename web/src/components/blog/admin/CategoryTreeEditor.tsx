'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { BlogCategory } from '@/lib/blog';
import { deleteCategoryAction, reorderCategoriesAction } from '@/lib/blogAdminActions';
import { moveItem } from '@/lib/reorder';

/**
 * 2단 카테고리 트리. 같은 부모 안에서만 순서를 바꾼다(설계 6.3).
 * 드래그는 HTML5 drag and drop 으로 한다 — 카테고리가 열 개 안팎이라 라이브러리가 필요없다.
 * 드래그만 두면 키보드로는 순서를 못 바꾸므로 위/아래 버튼을 함께 둔다.
 *
 * 자식 정렬 UI 는 이번 범위 밖이다. 자식이 생기면 같은 방식으로 붙인다.
 */
export function CategoryTreeEditor({ initial }: { readonly initial: readonly BlogCategory[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<readonly BlogCategory[]>(initial);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function move(from: number, to: number) {
    // moveItem 은 언제나 새 배열을 준다. 제자리 이동까지 저장하지 않도록 여기서 먼저 막는다.
    if (from === to || to < 0 || to >= rows.length) return;
    const next = moveItem(rows, from, to);
    setRows(next);
    setBusy(true);
    setError(null);
    try {
      await reorderCategoriesAction(next.map((c) => c.id));
    } finally {
      setBusy(false);
    }
  }

  async function remove(category: BlogCategory) {
    setBusy(true);
    setError(null);
    const formData = new FormData();
    formData.set('id', String(category.id));
    try {
      // 글이나 하위 카테고리가 있으면 400 과 안내 문구가 온다.
      const result = await deleteCategoryAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setRows((current) => current.filter((c) => c.id !== category.id));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error && <div className="editor-error" role="alert">⚠ {error}</div>}
      <ul className="badm-tree">
        {rows.map((category, index) => (
          <li
            key={category.id}
            draggable
            onDragStart={() => setDragFrom(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragFrom !== null) void move(dragFrom, index);
              setDragFrom(null);
            }}
          >
            <div className="badm-row">
              <span className="badm-handle" aria-hidden="true">≡</span>
              <span className="badm-name">{category.name}</span>
              <code className="badm-slug">{category.slug}</code>
              <span className="badm-count">({category.postCount})</span>
              <span className="badm-actions">
                <button type="button" disabled={index === 0 || busy}
                        onClick={() => void move(index, index - 1)} aria-label={`${category.name} 위로`}>↑</button>
                <button type="button" disabled={index === rows.length - 1 || busy}
                        onClick={() => void move(index, index + 1)} aria-label={`${category.name} 아래로`}>↓</button>
                <button type="button" disabled={busy} className="badm-remove"
                        onClick={() => void remove(category)} aria-label={`${category.name} 삭제`}>🗑</button>
              </span>
            </div>
            {category.children.length > 0 && (
              <ul className="badm-children">
                {category.children.map((child) => (
                  <li key={child.id}>
                    <div className="badm-row">
                      <span className="badm-name">{child.name}</span>
                      <code className="badm-slug">{child.slug}</code>
                      <span className="badm-count">({child.postCount})</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
