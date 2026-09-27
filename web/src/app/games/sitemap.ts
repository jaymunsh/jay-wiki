import type { MetadataRoute } from 'next';
import { GAME_ORIGIN, GAMES } from '@/lib/gameCatalog';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: GAME_ORIGIN },
    ...GAMES.map((game) => ({ url: `${GAME_ORIGIN}/${game.slug}` })),
  ];
}
