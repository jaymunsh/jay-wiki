import { describe, expect, it } from 'vitest';

import { resolvePublicAsset } from './assetPublications';

describe('resolvePublicAsset', () => {
  it('resolves an allowlisted publication file', () => {
    const asset = resolvePublicAsset([
      'publications',
      'local-llm',
      '2026-07-21-m1-max',
      'raw.json',
    ]);

    expect(asset).toEqual({
      cacheControl: 'public, max-age=31536000, immutable',
      contentDisposition: 'inline; filename="raw.json"',
      contentType: 'application/json; charset=utf-8',
      objectPath: 'publications/local-llm/2026-07-21-m1-max/raw.json',
    });
  });

  it('rejects traversal and unregistered files', () => {
    expect(resolvePublicAsset(['publications', '..', 'private', 'backup.sql'])).toBeNull();
    expect(resolvePublicAsset(['publications', 'local-llm', '2026-07-21-m1-max', 'secret.txt'])).toBeNull();
  });

  it('keeps the existing portfolio stack allowlist', () => {
    expect(resolvePublicAsset(['portfolio', 'stack', 'kubernetes.svg'])).toEqual({
      cacheControl: 'public, max-age=3600, stale-while-revalidate=86400',
      contentDisposition: null,
      contentType: 'image/svg+xml',
      objectPath: 'portfolio/stack/kubernetes.svg',
    });
    expect(resolvePublicAsset(['portfolio', 'stack', 'unknown.svg'])).toBeNull();
  });
});
