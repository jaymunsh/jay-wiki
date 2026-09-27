import { GAME_ORIGIN } from '@/lib/gameCatalog';

export function GET() {
  return new Response(`User-agent: *\nAllow: /\nSitemap: ${GAME_ORIGIN}/sitemap.xml\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
