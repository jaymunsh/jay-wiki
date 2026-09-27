import { isGameHost, isSharedPublicAsset } from './siteHost';

export { isGameHost };

/** Keep the public game assets and the Next.js game index reachable on the game host. */
export function gameRewritePath(pathname: string): string | null {
  if (pathname === '/') return '/games';
  if (pathname === '/robots.txt') return '/games/robots.txt';
  if (pathname === '/sitemap.xml') return '/games/sitemap.xml';

  if (
    pathname === '/games' || pathname.startsWith('/games/') ||
    pathname === '/game' || pathname.startsWith('/game/') ||
    pathname === '/api' || pathname.startsWith('/api/') ||
    pathname === '/_next' || pathname.startsWith('/_next/') ||
    isSharedPublicAsset(pathname)
  ) return null;

  // Only a single, extensionless game slug maps to a standalone HTML game.
  return /^\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname)
    ? `/game${pathname}.html`
    : null;
}
