import { afterEach, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

const context = { params: Promise.resolve({ path: ['auth', 'login'] }) };
afterEach(() => vi.unstubAllGlobals());

it('requires an origin for cookie writes even when a caller forges the server marker', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const request = new Request('https://example.test/api/bff/auth/logout', {
    method: 'POST', headers: { cookie: 'jw_token=test', 'x-jaywiki-request': 'server' },
  });
  expect((await POST(request, context)).status).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});

it('forwards same-origin cookie writes with the trusted target and server marker', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetch);
  const request = new Request('https://example.test/api/bff/auth/logout', {
    method: 'POST', headers: { origin: 'https://example.test', cookie: 'jw_token=test',
      'x-forwarded-host': 'attacker.invalid', 'x-jaywiki-request': 'forged', 'sec-fetch-site': 'same-origin' },
  });
  expect((await POST(request, context)).status).toBe(200);
  expect(fetch.mock.calls[0][1].headers).toMatchObject({
    'x-forwarded-host': 'example.test', 'x-jaywiki-request': 'server', origin: 'https://example.test',
  });
});

it('rejects oversized requests before contacting the backend', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const request = new Request('https://example.test/api/bff/auth/login', {
    method: 'POST', headers: { 'content-length': String(12 * 1024 * 1024) }, body: '{}',
  });
  expect((await POST(request, context)).status).toBe(413);
  expect(fetch).not.toHaveBeenCalled();
});

it('rejects cross-origin writes including sibling subdomains', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const request = new Request('https://example.test/api/bff/auth/login', {
    method: 'POST', headers: { origin: 'https://evil.example.test' }, body: '{}',
  });
  expect((await POST(request, context)).status).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});

it('rejects admin login and management mutations on public hosts', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const login = new Request('https://portfolio.leneu.cloud/api/bff/auth/admin-login', {
    method: 'POST', headers: { origin: 'https://portfolio.leneu.cloud' }, body: '{}',
  });
  expect((await POST(login, { params: Promise.resolve({ path: ['auth', 'admin-login'] }) })).status).toBe(403);
  const mutation = new Request('https://portfolio.leneu.cloud/api/bff/articles', {
    method: 'POST', headers: { origin: 'https://portfolio.leneu.cloud' }, body: '{}',
  });
  expect((await POST(mutation, { params: Promise.resolve({ path: ['articles'] }) })).status).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});

it('forwards admin login from the exact admin host', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetch);
  const request = new Request('http://admin.localhost:3000/api/bff/auth/admin-login', {
    method: 'POST', headers: { host: 'admin.localhost:3000', origin: 'http://admin.localhost:3000' }, body: '{}',
  });
  expect((await POST(request, { params: Promise.resolve({ path: ['auth', 'admin-login'] }) })).status).toBe(200);
  expect(fetch).toHaveBeenCalledOnce();
});

it('preserves login cookies and marks private responses as non-cacheable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', {
    headers: { 'set-cookie': 'jw_token=test; HttpOnly; Secure; SameSite=Lax' },
  })));
  const response = await POST(new Request('https://example.test/api/bff/auth/login', {
    method: 'POST', headers: { origin: 'https://example.test' }, body: '{}',
  }), context);
  expect(response.status).toBe(200);
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  expect(response.headers.get('cache-control')).toBe('no-store');
});

it('returns a controlled gateway error when the upstream body fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({
    start(c) { c.error(new Error('connection closed')); },
  }))));
  expect((await GET(new Request('https://example.test/api/bff/auth/me'), context)).status).toBe(502);
});
