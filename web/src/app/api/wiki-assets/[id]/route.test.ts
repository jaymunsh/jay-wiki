import { afterEach, expect, it, vi } from 'vitest';

import { GET } from './route';

const id = '346b59ca-d96b-49f9-8456-36432aaf15a1';
const context = { params: Promise.resolve({ id }) };

afterEach(() => vi.unstubAllGlobals());

it('borrows a public production asset for a production-built local preview', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'content-type': 'image/png' },
    }));
  vi.stubGlobal('fetch', fetch);

  const response = await GET(new Request(`http://blog.localhost:3000/api/wiki-assets/${id}`), context);

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('image/png');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1][0]).toBe(`https://portfolio.leneu.cloud/api/wiki-assets/${id}`);
});

it('does not borrow assets for an operating public host', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
  vi.stubGlobal('fetch', fetch);

  const response = await GET(new Request(`https://blog.leneu.cloud/api/wiki-assets/${id}`), context);

  expect(response.status).toBe(404);
  expect(fetch).toHaveBeenCalledOnce();
});
