/** Add published browser games here to place them on the game index and sitemap. */
export const GAME_ORIGIN = 'https://game.leneu.cloud';

export const GAME_INDEX_DESCRIPTION =
  '설치 없이 브라우저에서 바로 즐기는 게임 목록. 지금은 50층 점프 타임어택 게임 숲의 계단을 플레이할 수 있습니다.';

export type GameEntry = {
  slug: string;
  title: string;
  englishTitle: string;
  description: string;
  genre: string;
  feature?: string;
  controls: string;
  image: string;
  imageAlt: string;
};

export const GAMES: readonly GameEntry[] = [
  {
    slug: 'forest-jump',
    title: '숲의 계단',
    englishTitle: 'Forest Jump',
    description: '발판을 밟고 50층 정상까지 점프하세요. 완주 기록을 등록해 TOP 5 랭킹에 도전할 수 있습니다.',
    genre: '점프 · 타임어택',
    feature: 'TOP 5 랭킹',
    controls: '키보드 · 터치',
    image: '/game/forest-jump-preview.webp',
    imageAlt: '숲의 계단 게임 속 캐릭터가 숲의 발판 사이를 점프하는 장면',
  },
];
