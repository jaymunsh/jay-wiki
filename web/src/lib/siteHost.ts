const ADMIN_HOSTS = new Set(['admin.localhost', 'admin.leneu.cloud']);
const BLOG_HOSTS = new Set(['blog.localhost', 'blog.leneu.cloud']);
const WIKI_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'portfolio.leneu.cloud']);

export function hostnameOf(host: string | null | undefined): string {
  if (!host) return '';
  const value = host.trim().toLowerCase();
  if (value.startsWith('[')) return value.slice(1, value.indexOf(']'));
  return value.split(':')[0];
}

export const isAdminHost = (host: string | null | undefined) => ADMIN_HOSTS.has(hostnameOf(host));
export const isProductionAdminHost = (host: string | null | undefined) => hostnameOf(host) === 'admin.leneu.cloud';
export const isBlogHost = (host: string | null | undefined) => BLOG_HOSTS.has(hostnameOf(host));
export const isWikiHost = (host: string | null | undefined) => WIKI_HOSTS.has(hostnameOf(host));

const SHARED_PUBLIC_FILES = new Set([
  '/favicon.ico', '/favicon-16x16.png', '/favicon-32x32.png', '/favicon-48x48.png',
  '/apple-touch-icon.png', '/android-chrome-192x192.png', '/android-chrome-512x512.png',
  '/icon-master-transparent.png',
]);

export function isSharedPublicAsset(pathname: string): boolean {
  return pathname === '/assets' || pathname.startsWith('/assets/') || SHARED_PUBLIC_FILES.has(pathname);
}

const ADMIN_EXTERNAL_TO_INTERNAL: ReadonlyArray<readonly [string, string]> = [
  ['/wiki/articles', '/admin/articles'],
  ['/wiki/tabs', '/admin/tabs'],
  ['/wiki/featured', '/admin/featured'],
  ['/blog/posts', '/admin/blog/posts'],
  ['/blog/categories', '/admin/blog/categories'],
  ['/blog/comments', '/admin/blog/comments'],
  ['/stats', '/admin/stats'],
  ['/services', '/admin/services'],
  ['/tools/spreadsheet-export', '/admin/tools/spreadsheet-export'],
  ['/guide', '/admin/guide'],
];

function replacePrefix(pathname: string, from: string, to: string): string | null {
  if (pathname === from) return to;
  return pathname.startsWith(`${from}/`) ? `${to}${pathname.slice(from.length)}` : null;
}

export function adminRewritePath(pathname: string): string | null {
  if (pathname === '/') return '/admin';
  if (pathname === '/login') return '/admin-login';
  for (const [external, internal] of ADMIN_EXTERNAL_TO_INTERNAL) {
    const replaced = replacePrefix(pathname, external, internal);
    if (replaced) return replaced;
  }
  return null;
}

export function adminExternalPath(pathname: string): string | null {
  if (pathname === '/admin' || pathname === '/admin/') return '/';
  for (const [external, internal] of ADMIN_EXTERNAL_TO_INTERNAL) {
    const replaced = replacePrefix(pathname, internal, external);
    if (replaced) return replaced;
  }
  return null;
}

export function adminOriginFor(host: string | null | undefined, protocol = 'https:'): string {
  const raw = (host ?? '').toLowerCase();
  const port = raw.match(/:(\d+)$/)?.[1];
  const hostname = hostnameOf(raw);
  if (['localhost', 'blog.localhost', 'admin.localhost', '127.0.0.1', '::1'].includes(hostname)) {
    return `${protocol}//admin.localhost${port ? `:${port}` : ''}`;
  }
  return 'https://admin.leneu.cloud';
}

export function safeAdminNext(value: string | null | undefined): string {
  if (!value) return '/';
  try {
    const base = new URL('http://admin.localhost');
    const target = new URL(value, base);
    if (target.origin !== base.origin || adminRewritePath(target.pathname) === null) return '/';
    return `${target.pathname}${target.search}`;
  } catch {
    return '/';
  }
}

export function isManagementApi(method: string, path: readonly string[]): boolean {
  const verb = method.toUpperCase();
  const joined = path.join('/');
  if (joined.startsWith('admin/')) return true;
  if (/^articles\/[^/]+\/revisions(?:\/[^/]+)?$/.test(joined)) return true;
  if (verb === 'GET' || verb === 'HEAD' || verb === 'OPTIONS') return false;
  return joined === 'articles'
    || /^articles\/[^/]+(?:\/revert\/[^/]+)?$/.test(joined)
    || joined === 'tabs'
    || joined === 'tabs/reorder'
    || /^tabs\/[^/]+$/.test(joined)
    || joined === 'wiki/featured'
    || joined === 'wiki-assets'
    || /^wiki-assets\/[^/]+$/.test(joined)
    || joined === 'domain-scenarios/spreadsheet-operations/exports';
}
