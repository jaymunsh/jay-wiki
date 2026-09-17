import { readFileSync, lstatSync } from 'node:fs';

/** Shared source loader; importing it never contacts or mutates a database. */
export function loadWikiSource(root = new URL('../../content/wiki/', import.meta.url)) {
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
  const { articles, tabs, featured } = manifest;
  if (!Array.isArray(articles) || !articles.length || !Array.isArray(tabs) || !tabs.length
      || !Array.isArray(featured)) throw new Error('Invalid or empty wiki manifest');
  const slugs = new Set(), tabIds = new Set(tabs.map(tab => tab.tabId));
  if (tabIds.size !== tabs.length) throw new Error('Duplicate wiki tab');
  const loaded = articles.map(article => {
    if (!/^[a-z0-9-]+$/.test(article.slug) || slugs.has(article.slug)) throw new Error('Invalid or duplicate wiki slug');
    slugs.add(article.slug);
    if (!tabIds.has(article.parentId)) throw new Error(`Unknown wiki parent: ${article.slug}`);
    const file = new URL(`articles/${article.slug}.md`, root);
    if (!lstatSync(file).isFile()) throw new Error(`Wiki body must be a regular file: ${article.slug}`);
    const body = readFileSync(file, 'utf8');
    if (!body.trim()) throw new Error(`Empty wiki body: ${article.slug}`);
    return { ...article, body };
  });
  if (featured.some(slug => !slugs.has(slug))) throw new Error('Unknown featured wiki article');
  return { featured, tabs, articles: loaded };
}
