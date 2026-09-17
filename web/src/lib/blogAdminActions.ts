'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { BACKEND_BASE as BASE } from './backend';
import { parseTags, toOffsetDateTime, toPostId } from './blogAdminForm';
import { readAdminCookie } from './adminSession';

export type BlogSaveResult = { error?: string };

/** 관리 API 는 ADMIN 이라 쿠키를 반드시 실어야 한다. */
async function send(path: string, init: RequestInit): Promise<Response> {
  const cookie = await readAdminCookie();
  return fetch(`${BASE}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      'x-jaywiki-request': 'server',
      cookie,
      ...(init.headers ?? {}),
    },
  });
}

/** problem+json 의 detail 을 꺼낸다. 없으면 본문 앞부분을 그대로 쓴다. */
async function messageOf(r: Response, fallback: string): Promise<string> {
  const text = await r.text();
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.detail === 'string') return parsed.detail;
  } catch {
    // problem+json 이 아니면 아래로 떨어진다
  }
  return text.slice(0, 200) || fallback;
}

/**
 * 저장 뒤 목록으로 보낸다.
 * redirect 는 예외를 던져 흐름을 끊으므로 오류 처리를 모두 끝낸 뒤에 부른다.
 */
export async function saveBlogPostAction(
  _prev: BlogSaveResult | null,
  formData: FormData,
): Promise<BlogSaveResult> {
  const id = String(formData.get('id') ?? '').trim();
  const payload = {
    slug: String(formData.get('slug') ?? '').trim(),
    title: String(formData.get('title') ?? '').trim(),
    summary: String(formData.get('summary') ?? '').trim() || null,
    body: String(formData.get('body') ?? ''),
    categoryId: Number(formData.get('categoryId')),
    coverAssetId: String(formData.get('coverAssetId') ?? '').trim() || null,
    status: formData.get('status') === 'published' ? 'published' : 'draft',
    // checkbox 는 켜졌을 때만 폼에 실린다
    tocEnabled: formData.get('tocEnabled') === 'on',
    publishedAt: toOffsetDateTime(String(formData.get('publishedAt') ?? '')),
    tags: parseTags(String(formData.get('tags') ?? '')),
    // 여기서 null 은 '연결 없음'이다. 관리 화면은 항상 두 값을 다 실어 보낸다.
    prevPostId: toPostId(formData.get('prevPostId')),
    nextPostId: toPostId(formData.get('nextPostId')),
  };

  const r = id
    ? await send(`/api/admin/blog/posts/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
    : await send('/api/admin/blog/posts', { method: 'POST', body: JSON.stringify(payload) });

  if (!r.ok) {
    return { error: await messageOf(r, `저장에 실패했습니다 (${r.status}).`) };
  }
  revalidatePath('/admin/blog/posts');
  redirect('/blog/posts');
}

export async function deleteBlogPostAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  await send(`/api/admin/blog/posts/${id}`, { method: 'DELETE' });
  revalidatePath('/admin/blog/posts');
}

export async function saveCategoryAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '').trim();
  const parentId = String(formData.get('parentId') ?? '').trim();
  const body = JSON.stringify({
    slug: String(formData.get('slug') ?? '').trim(),
    name: String(formData.get('name') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim() || null,
    parentId: parentId ? Number(parentId) : null,
  });
  await (id
    ? send(`/api/admin/blog/categories/${id}`, { method: 'PUT', body })
    : send('/api/admin/blog/categories', { method: 'POST', body }));
  revalidatePath('/admin/blog/categories');
}

/** 화면이 배열을 그대로 넘긴다. FormData 가 아니라 인자를 받는 Server Action 이다. */
export async function reorderCategoriesAction(ids: number[]): Promise<void> {
  await send('/api/admin/blog/categories/reorder', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
  revalidatePath('/admin/blog/categories');
}

export async function deleteCategoryAction(formData: FormData): Promise<BlogSaveResult> {
  const id = String(formData.get('id') ?? '');
  const r = await send(`/api/admin/blog/categories/${id}`, { method: 'DELETE' });
  if (!r.ok) {
    // 글이 있으면 400 과 안내 문구가 온다. DB 오류를 그대로 내보내지 않는다.
    return { error: await messageOf(r, '삭제하지 못했습니다.') };
  }
  revalidatePath('/admin/blog/categories');
  return {};
}

export async function deleteCommentAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  await send(`/api/admin/blog/comments/${id}`, { method: 'DELETE' });
  revalidatePath('/admin/blog/comments');
}

export async function restoreCommentAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  await send(`/api/admin/blog/comments/${id}/restore`, { method: 'POST' });
  revalidatePath('/admin/blog/comments');
}
