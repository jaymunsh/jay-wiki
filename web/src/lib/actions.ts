'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { BACKEND_BASE as BASE } from './backend';
import { readAdminCookie } from './adminSession';

/**
 * 위키 본문/탭 변경 Server Action — Spring API 로 위임(서버사이드 fetch).
 * 본문 SoT = PG. 저장/삭제/되돌리기/탭관리 전부 API 경유.
 */

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export type WikiAssetUpload = {
  readonly id: string;
  readonly url: string;
  readonly originalName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
};

export type WikiAssetResult =
  | { readonly ok: true; readonly asset: WikiAssetUpload }
  | { readonly ok: false; readonly error: string };

type AdminSession = {
  readonly authenticated: true;
  readonly role: 'ADMIN';
};

class AdminAuthorizationError extends Error {
  constructor() {
    super('관리자 로그인이 필요합니다.');
    this.name = 'AdminAuthorizationError';
  }
}

class AdminMutationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminMutationError';
  }
}

function isAdminSession(value: unknown): value is AdminSession {
  return (
    typeof value === 'object' &&
    value !== null &&
    'authenticated' in value &&
    value.authenticated === true &&
    'role' in value &&
    value.role === 'ADMIN'
  );
}

async function requireAdminCookie(): Promise<string> {
  let cookieHeader: string;
  try {
    cookieHeader = await readAdminCookie();
  } catch {
    throw new AdminAuthorizationError();
  }

  const response = await fetch(`${BASE}/api/auth/me`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
  if (!response.ok || !isAdminSession(await response.json())) {
    throw new AdminAuthorizationError();
  }
  return cookieHeader;
}

async function adminFetch(path: string, init: RequestInit): Promise<Response> {
  const cookie = await requireAdminCookie();
  const headers = new Headers(init.headers);
  headers.set('cookie', cookie);
  headers.set('x-jaywiki-request', 'server');
  return fetch(`${BASE}${path}`, { ...init, headers, cache: 'no-store' });
}

async function readError(r: Response): Promise<string> {
  try {
    const payload: unknown = await r.json();
    if (typeof payload === 'object' && payload !== null) {
      if ('detail' in payload && typeof payload.detail === 'string') return payload.detail;
      if ('title' in payload && typeof payload.title === 'string') return payload.title;
    }
    return `오류 ${r.status}`;
  } catch {
    return `오류 ${r.status}`;
  }
}

function parseWikiAsset(value: unknown): WikiAssetUpload | null {
  if (typeof value !== 'object' || value === null) return null;
  if (!('id' in value) || typeof value.id !== 'string') return null;
  if (!('url' in value) || typeof value.url !== 'string') return null;
  if (!('originalName' in value) || typeof value.originalName !== 'string') return null;
  if (!('contentType' in value) || typeof value.contentType !== 'string') return null;
  if (!('sizeBytes' in value) || typeof value.sizeBytes !== 'number') return null;
  return {
    id: value.id,
    url: value.url,
    originalName: value.originalName,
    contentType: value.contentType,
    sizeBytes: value.sizeBytes,
  };
}

export async function uploadWikiAssetAction(formData: FormData): Promise<WikiAssetResult> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: '업로드할 이미지를 선택하세요.' };
  }

  const upstream = new FormData();
  upstream.set('file', file, file.name);
  let response: Response;
  try {
    response = await adminFetch('/api/wiki-assets', { method: 'POST', body: upstream });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return { ok: false, error: error.message };
    throw error;
  }
  if (!response.ok) return { ok: false, error: await readError(response) };

  const asset = parseWikiAsset(await response.json());
  return asset ? { ok: true, asset } : { ok: false, error: '이미지 업로드 응답이 올바르지 않습니다.' };
}

export async function deleteWikiAssetAction(id: string): Promise<SaveResult> {
  let response: Response;
  try {
    response = await adminFetch(`/api/wiki-assets/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return { ok: false, error: error.message };
    throw error;
  }
  return response.ok ? { ok: true } : { ok: false, error: await readError(response) };
}

// ---------- 본문 ----------
export async function saveArticleAction(_prev: SaveResult | null, formData: FormData): Promise<SaveResult> {
  const payload = {
    slug: String(formData.get('slug') ?? '').trim(),
    parentId: String(formData.get('parentId') ?? '').trim(),
    title: String(formData.get('title') ?? '').trim(),
    summary: String(formData.get('desc') ?? '').trim() || null,
    body: String(formData.get('body') ?? ''),
    kind: String(formData.get('kind') ?? 'wiki'),
    status: String(formData.get('status') ?? 'draft'),
    lastReview: String(formData.get('lastReview') ?? '').trim() || null,
    sortOrder: Number(formData.get('sortOrder') ?? 0),
    // checkbox 는 켜졌을 때만 폼에 실린다
    tocEnabled: formData.get('tocEnabled') === 'on',
    editor: 'admin',
  };
  if (!payload.title) return { ok: false, error: '제목은 필수입니다.' };
  if (!payload.slug) return { ok: false, error: 'slug 는 필수입니다.' };

  let r: Response;
  try {
    r = await adminFetch('/api/articles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return { ok: false, error: error.message };
    throw error;
  }
  if (!r.ok) return { ok: false, error: await readError(r) };

  revalidatePath('/');
  revalidatePath('/admin/articles');
  redirect('/wiki/articles');
}

export async function deleteArticleAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const response = await adminFetch(`/api/articles/${encodeURIComponent(slug)}`, { method: 'DELETE' });
  if (!response.ok) throw new AdminMutationError(await readError(response));
  revalidatePath('/');
  revalidatePath('/admin/articles');
  redirect('/wiki/articles');
}

export async function revertAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const version = String(formData.get('version') ?? '');
  const response = await adminFetch(`/api/articles/${encodeURIComponent(slug)}/revert/${version}`, { method: 'POST' });
  if (!response.ok) throw new AdminMutationError(await readError(response));
  revalidatePath('/');
  redirect(`/wiki/articles/${slug}/revisions`);
}

// ---------- 탭 ----------
// <form action={...}> 에서 바로 쓰는 단순 시그니처(저장 후 목록으로).
export async function saveTabAction(formData: FormData): Promise<void> {
  const payload = {
    tabId: String(formData.get('tabId') ?? '').trim(),
    title: String(formData.get('title') ?? '').trim(),
    sortOrder: Number(formData.get('sortOrder') ?? 0),
  };
  if (payload.tabId && payload.title) {
    const response = await adminFetch('/api/tabs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new AdminMutationError(await readError(response));
  }
  revalidatePath('/');
  revalidatePath('/admin/tabs');
  redirect('/wiki/tabs');
}

export async function deleteTabAction(formData: FormData): Promise<void> {
  const tabId = String(formData.get('tabId') ?? '');
  const response = await adminFetch(`/api/tabs/${encodeURIComponent(tabId)}`, { method: 'DELETE' });
  if (!response.ok) throw new AdminMutationError(await readError(response));
  revalidatePath('/');
  revalidatePath('/admin/tabs');
  redirect('/wiki/tabs');
}

// ---------- 대표 문서 (V22) ----------
/**
 * 전시 목록을 통째로 저장한다. 칸을 하나씩 고치지 않는 이유는 서버 쪽과 같다 —
 * 순서를 옮길 때 중간 충돌 상태가 생기지 않게 한 번에 바꾼다.
 * 빈 칸은 버린다. 다섯 칸을 다 비우면 전시가 꺼진다.
 */
export async function saveFeaturedAction(formData: FormData): Promise<void> {
  const slugs = formData
    .getAll('slug')
    .map((v) => String(v).trim())
    .filter(Boolean);
  const response = await adminFetch('/api/wiki/featured', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slugs }),
  });
  if (!response.ok) throw new AdminMutationError(await readError(response));
  revalidatePath('/');
  revalidatePath('/admin/featured');
  redirect('/wiki/featured');
}
