import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

afterEach(() => vi.restoreAllMocks());

describe('spreadsheet export host boundary', () => {
  it('rejects the export on a public host before contacting Spring', async () => {
    const upstream = vi.spyOn(globalThis, 'fetch');
    const response = await POST(new Request('http://localhost:3000/api/spreadsheet-export', {
      method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
    }));
    expect(response.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('forwards an authenticated same-origin request from the admin host', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    }));
    const response = await POST(new Request('http://admin.localhost:3000/api/spreadsheet-export', {
      method: 'POST',
      headers: { host: 'admin.localhost:3000', origin: 'http://admin.localhost:3000', cookie: 'jw_token=test' },
    }));
    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBe(3);
  });
});
