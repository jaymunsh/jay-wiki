import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadWikiSource } from './wiki-source.mjs';

test('Markdown preserves backticks and interpolation text; invalid source fails closed', () => {
  const root = mkdtempSync(join(tmpdir(), 'wiki-source-'));
  const url = pathToFileURL(root + '/');
  const article = { slug: 'one', parentId: 'start' };
  const manifest = { tabs: [{ tabId: 'start' }], featured: ['one'], articles: [article] };
  const save = value => writeFileSync(join(root, 'manifest.json'), JSON.stringify(value));
  try {
    mkdirSync(join(root, 'articles'));
    const body = '\n`inline`\n```js\n${notExecuted()}\n```\n';
    writeFileSync(join(root, 'articles/one.md'), body);
    save(manifest);
    assert.equal(loadWikiSource(url).articles[0].body, body);
    save({ ...manifest, articles: [article, article] });
    assert.throws(() => loadWikiSource(url), /duplicate/);
    save({ ...manifest, articles: [{ ...article, slug: '../one' }] });
    assert.throws(() => loadWikiSource(url), /Invalid/);
    save({ ...manifest, featured: ['missing'] });
    assert.throws(() => loadWikiSource(url), /featured/);
    save(manifest);
    rmSync(join(root, 'articles/one.md'));
    symlinkSync(join(root, 'manifest.json'), join(root, 'articles/one.md'));
    assert.throws(() => loadWikiSource(url), /regular file/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
