import { expect, it } from 'vitest';
import { hasAllowedOrigin } from './requestOrigin';

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

