'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { MarkdownBodyEditor } from '@/components/MarkdownBodyEditor';
import type { BlogCategory } from '@/lib/blog';
import type { AdminBlogPost } from '@/lib/blogAdmin';
import { saveBlogPostAction, type BlogSaveResult } from '@/lib/blogAdminActions';
import { formatTags, toDateTimeLocalValue } from '@/lib/blogAdminForm';

/** 제목에서 slug 후보를 만든다. 사용자가 직접 고치면 더 이상 따라가지 않는다. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

/** 평탄한 카테고리 목록. 자식은 '부모/자식' 으로 보여준다(관리자 설계 6.1). */
function flatten(categories: readonly BlogCategory[]) {
  return categories.flatMap((parent) => [
    { id: parent.id, label: parent.name },
    ...parent.children.map((child) => ({ id: child.id, label: `${parent.name}/${child.name}` })),
  ]);
}

/**
 * 시리즈로 이을 수 있는 글. 자기 자신은 뺀다 -- 자기를 고르면 서버가 400 을 준다.
 * 라벨에 id 를 앞세우는 것은 제목이 비슷한 연작이 많아서다("OX-Alpha: ..." 가 여러 편이다).
 */
function linkOptions(posts: readonly AdminBlogPost[], selfId: number | undefined) {
  return posts
    .filter((post) => post.id !== selfId)
    .map((post) => ({ id: post.id, label: `${post.id} - ${post.title}` }));
}

export function BlogPostForm({
  initial,
  categories,
  posts = [],
}: {
  readonly initial: AdminBlogPost | null;
  readonly categories: readonly BlogCategory[];
  readonly posts?: readonly AdminBlogPost[];
}) {
  const [state, formAction, pending] = useActionState<BlogSaveResult | null, FormData>(
    saveBlogPostAction,
    null,
  );
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [body, setBody] = useState(initial?.body ?? '');
  const options = flatten(categories);
  const links = linkOptions(posts, initial?.id);

  return (
    <form action={formAction} className="editor">
      <div className="editor-head">
        <div>
          <div className="eyebrow">{initial ? 'Admin · Blog · Edit' : 'Admin · Blog · New'}</div>
          <h1>{initial ? `편집 — ${initial.title}` : '새 글 작성'}</h1>
        </div>
        <div className="editor-actions">
          <Link href="/blog/posts" className="btn">취소</Link>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>

      {state?.error && <div className="editor-error" role="alert">⚠ {state.error}</div>}

      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="editor-meta">
        <label className="field">
          <span className="field-label">제목<em>*</em></span>
          <input
            name="title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">slug</span>
          {/* 블로그 slug 는 unique 가 아니다(설계 5절). 중복 검사를 하지 않는다. */}
          <input
            name="slug"
            value={slug}
            onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }}
          />
        </label>
        <label className="field">
          <span className="field-label">카테고리<em>*</em></span>
          <select name="categoryId" defaultValue={initial?.categoryId ?? options[0]?.id} required>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">상태</span>
          <select name="status" defaultValue={initial?.status ?? 'draft'}>
            <option value="draft">draft — 공개 안 함</option>
            <option value="published">published — 공개</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">
            발행일
            <small>비우고 published 로 저장하면 지금 시각이 들어갑니다.</small>
          </span>
          <input
            name="publishedAt"
            type="datetime-local"
            defaultValue={toDateTimeLocalValue(initial?.publishedAt)}
          />
        </label>
        <label className="field">
          <span className="field-label">
            대표 이미지 자산 id
            <small>본문에 올린 이미지 URL 의 마지막 조각입니다.</small>
          </span>
          <input name="coverAssetId" defaultValue={initial?.coverAssetId ?? ''} />
        </label>
        <label className="field">
          <span className="field-label">
            목차
            <small>##/### 을 모아 글 상단에 그립니다.</small>
          </span>
          <label className="editor-check">
            <input name="tocEnabled" type="checkbox" defaultChecked={initial?.tocEnabled ?? true} />
            <span>목차 노출</span>
          </label>
        </label>
        <label className="field">
          <span className="field-label">
            먼저 읽기
            <small>이 글 앞에 읽을 편입니다.</small>
          </span>
          <select name="prevPostId" defaultValue={initial?.prevPostId ?? ''}>
            <option value="">연결 없음</option>
            {links.map((post) => (
              <option key={post.id} value={post.id}>
                {post.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">
            이어 읽기
            <small>이 글 뒤에 읽을 편입니다. 상대 글도 함께 맞춥니다.</small>
          </span>
          <select name="nextPostId" defaultValue={initial?.nextPostId ?? ''}>
            <option value="">연결 없음</option>
            {links.map((post) => (
              <option key={post.id} value={post.id}>
                {post.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field field-full">
          <span className="field-label">요약 (한 줄)</span>
          <input name="summary" defaultValue={initial?.summary ?? ''} />
        </label>
        <label className="field field-full">
          <span className="field-label">
            태그
            <small>쉼표로 구분합니다.</small>
          </span>
          <input name="tags" defaultValue={formatTags(initial?.tags ?? [])} placeholder="react, spring" />
        </label>
      </div>

      <MarkdownBodyEditor name="body" value={body} onChange={setBody} />
    </form>
  );
}
