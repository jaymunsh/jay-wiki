import assert from 'node:assert/strict';
import test from 'node:test';
import { accessHeadersFor } from './cloudflare-access.mjs';

test('adds a token only to the exact admin production host', () => {
  assert.deepEqual(accessHeadersFor('https://admin.leneu.cloud/api/bff', ' token '), { 'cf-access-token': 'token' });
  assert.deepEqual(accessHeadersFor('http://admin.localhost:3000/api/bff', ''), {});
  assert.deepEqual(accessHeadersFor('https://admin.leneu.cloud.evil/api', ''), {});
});

test('rejects a production admin request without an Access token', () => {
  assert.throws(() => accessHeadersFor('https://admin.leneu.cloud/api/bff', ''), /Access 토큰/);
});
