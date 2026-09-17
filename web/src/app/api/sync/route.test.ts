import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';

const spawn = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ spawn }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.clearAllMocks(); });

async function handler(environment = 'development') {
  vi.stubEnv('NODE_ENV', environment);
  return (await import('./route')).POST;
}
function request(body = '{"action":"check"}', origin: string | null = 'http://localhost:3000') {
  return new Request('http://localhost:3000/api/sync', {
    method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body,
  });
}

it('never starts a process in production or for untrusted/missing origins', async () => {
  expect((await (await handler('production'))(request())).status).toBe(404);
  vi.resetModules();
  const post = await handler();
  expect((await post(request(undefined, 'https://attacker.test'))).status).toBe(403);
  expect((await post(request(undefined, null))).status).toBe(403);
  expect(spawn).not.toHaveBeenCalled();
});

it('rejects malformed, oversized and invalid action/OTP requests before spawning', async () => {
  const post = await handler();
  for (const body of ['null', '{', '{"action":[]}', '{"action":"check","otp":123456}']) {
    expect((await post(request(body))).status).toBe(400);
  }
  expect((await post(request('x'.repeat(4097)))).status).toBe(413);
  expect(spawn).not.toHaveBeenCalled();
});

it('blocks overlapping operations and releases the slot only when the child closes', async () => {
  const child = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(), stderr: new EventEmitter(), exitCode: null, kill: vi.fn(),
  });
  spawn.mockReturnValue(child);
  const post = await handler();
  const first = await post(request());
  expect(first.status).toBe(200);
  expect((await post(request())).status).toBe(409);
  child.emit('close', 0);
  await first.text();
  const next = await post(request());
  expect(next.status).toBe(200);
  child.emit('error', new Error('spawn failed'));
  child.emit('close', -2);
  await next.text();
});
