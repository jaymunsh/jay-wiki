#!/usr/bin/env node
// Produce the single-file deployment artifact from the same validated source as local seeding.
import { readFileSync, writeFileSync } from 'node:fs';
import { loadWikiSource } from './lib/wiki-source.mjs';
const output = process.argv[2];
if (!output) throw new Error('Usage: node scripts/build-wiki-seed.mjs <output.mjs>');
const source = readFileSync(new URL('./seed-portfolio-wiki.mjs', import.meta.url), 'utf8');
const wikiSourceMarker = "import { loadWikiSource } from './lib/wiki-source.mjs';";
const accessMarker = "import { cloudflareAccessHeaders } from './lib/cloudflare-access.mjs';";
if (!source.includes(wikiSourceMarker)) throw new Error('Seed loader marker missing');
if (!source.includes(accessMarker)) throw new Error('Cloudflare Access helper marker missing');

// The k3s sync Job receives this generated file by itself. Keep the Access helper inline as
// well as the wiki source so adding a local import cannot make an otherwise valid deploy fail.
const accessSource = readFileSync(new URL('./lib/cloudflare-access.mjs', import.meta.url), 'utf8')
  .replace('export function accessHeadersFor', 'function accessHeadersFor')
  .replace('export function cloudflareAccessHeaders', 'function cloudflareAccessHeaders');
const bundled = source
  .replace(wikiSourceMarker,
    `const loadWikiSource = () => JSON.parse(${JSON.stringify(JSON.stringify(loadWikiSource()))});`)
  .replace(accessMarker, accessSource);

const remainingRelativeImports = [...bundled.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)]
  .map((match) => match[1]);
if (remainingRelativeImports.length > 0) {
  throw new Error(`Deployment seed still has relative imports: ${remainingRelativeImports.join(', ')}`);
}
writeFileSync(output, bundled);
