import { beforeEach, describe, expect, it, vi } from 'vitest';

const cookieGetMock = vi.hoisted(() =>
  vi.fn<(name: string) => { readonly value: string } | undefined>(),
);
const hostHeaderMock = vi.hoisted(() => vi.fn(() => 'admin.localhost:3000'));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: cookieGetMock })),
  headers: vi.fn(async () => new Headers({ host: hostHeaderMock() })),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import { saveArticleAction } from './actions';

function articleForm(): FormData {
  const form = new FormData();
  form.set('slug', 'auth-forwarding-test');
  form.set('parentId', 'start');
  form.set('title', '관리자 인증 전달 테스트');
  form.set('body', '본문');
  return form;
}

describe('saveArticleAction', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    cookieGetMock.mockReset();
    cookieGetMock.mockReturnValue({ value: 'test-admin-token' });
    hostHeaderMock.mockReset();
    hostHeaderMock.mockReturnValue('admin.localhost:3000');
  });

  it('checks the ADMIN session and forwards its cookie before saving', async () => {
    // Given
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ authenticated: true, role: 'ADMIN' }))
      .mockResolvedValueOnce(Response.json({ slug: 'auth-forwarding-test' }));
    vi.stubGlobal('fetch', fetchMock);

    // When
    await saveArticleAction(null, articleForm());

    // Then
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:8080/api/auth/me');
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('cookie')).toBe('jw_token=test-admin-token');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://localhost:8080/api/articles');
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('cookie')).toBe('jw_token=test-admin-token');
  });

  it('does not send a mutation when the session is not ADMIN', async () => {
    // Given
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ authenticated: true, role: 'USER' }));
    vi.stubGlobal('fetch', fetchMock);

    // When
    const result = await saveArticleAction(null, articleForm());

    // Then
    expect(result).toEqual({ ok: false, error: '관리자 로그인이 필요합니다.' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:8080/api/auth/me');
  });

  it('does not send a mutation from a public host even with an ADMIN cookie', async () => {
    hostHeaderMock.mockReturnValue('portfolio.leneu.cloud');
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    const result = await saveArticleAction(null, articleForm());

    expect(result).toEqual({ ok: false, error: '관리자 로그인이 필요합니다.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
