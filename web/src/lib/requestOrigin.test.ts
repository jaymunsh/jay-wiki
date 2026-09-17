import { expect, it } from 'vitest';
import { hasAllowedOrigin, isLocalManagementRequest } from './requestOrigin';

it('rejects sibling domains, protocol changes, opaque origins and cross-site fetches', () => {
  for (const origin of ['https://blog.example.test', 'http://example.test', 'null']) {
    expect(hasAllowedOrigin(new Request('https://example.test/api', { headers: { origin } }))).toBe(false);
  }
  expect(hasAllowedOrigin(new Request('https://example.test/api', {
    headers: { 'sec-fetch-site': 'cross-site' },
  }))).toBe(false);
});

it('recognizes an HTTPS browser behind the trusted HTTP reverse proxy', () => {
  expect(hasAllowedOrigin(new Request('http://web:3000/api', {
    headers: { host: 'blog.example.test', origin: 'https://blog.example.test', 'x-forwarded-proto': 'https' },
  }))).toBe(true);
});

it('requires a matching local origin for development management', () => {
  for (const host of ['localhost:3000', 'blog.localhost:3000', 'admin.localhost:3000', '127.0.0.1:3000', '[::1]:3000']) {
    expect(isLocalManagementRequest(new Request(`http://${host}/api/sync`, {
      headers: { origin: `http://${host}` },
    }))).toBe(true);
  }
  expect(isLocalManagementRequest(new Request('http://localhost:3000/api/sync'))).toBe(false);
  expect(isLocalManagementRequest(new Request('http://example.test/api/sync', {
    headers: { origin: 'http://example.test' },
  }))).toBe(false);
});
