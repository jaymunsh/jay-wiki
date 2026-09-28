/**
 * 블로그 '작업물'의 정본 목록. /works 페이지(전체·카테고리별)와
 * 레일의 카테고리 수·꺼내둘 항목이 모두 여기서 나온다.
 *
 * href 는 작업물 주소를, articleHref 는 소개 글 주소를 둔다.
 * 같은 앱 안 경로든, 서브도메인이든, GitHub·서점 같은 외부든 이 파일은 목록일 뿐
 * 실제 프로젝트의 자리를 옮기지 않는다.
 */

export type WorkCategory = 'games' | 'tools' | 'labs' | 'content';

/**
 * 썸네일이 없는 항목의 자리표시자 표식. BlogRail 의 blog-work-mark 와
 * 같은 대상을 가리키되 여기서는 큰 크기로 쓴다.
 */
export type WorkMark =
  | 'board'
  | 'book'
  | 'camera'
  | 'chat'
  | 'crown'
  | 'flask'
  | 'frame'
  | 'gauge'
  | 'harddrive'
  | 'joystick'
  | 'music'
  | 'puzzle'
  | 'server';

export type WorkEntry = {
  slug: string;
  title: string;
  englishTitle?: string;
  description: string;
  category: WorkCategory;
  /** '점프 · 타임어택' 같은 한 줄 분류 — 카드 상단 라벨. */
  kind: string;
  /** 'TOP 5 랭킹' 같은 특징 배지. */
  feature?: string;
  /** 실제 작업물 주소. 공개할 곳이 없으면 생략한다. */
  href?: string;
  /** 작업물 링크가 이 블로그 host 밖이면 true — 새 탭으로 연다. */
  external?: boolean;
  /** 공개된 소개 글 주소. */
  articleHref?: string;
  /** 색인 썸네일. 없으면 mark 자리표시자가 그 자리를 채운다. */
  image?: string;
  imageAlt?: string;
  /** 기본 cover. 아이콘·표지처럼 잘리면 안 되는 그림은 contain. */
  imageFit?: 'cover' | 'contain';
  /** 모서리를 둥글게 보여줄 정사각형 이미지. */
  imageSquare?: boolean;
  /** 좁은 색인 썸네일에서 주제가 가운데가 아닐 때 초점을 맞춘다. */
  imagePosition?: string;
  mark: WorkMark;
  /** 작업물 링크의 목적지 이름 — 'GitHub', 'game.leneu.cloud' 등. */
  source: string;
  /** 레일에 카테고리 목록과 별도로 직접 꺼내 보일 핵심 항목. */
  featured?: boolean;
};

export const WORK_CATEGORIES: readonly { slug: WorkCategory; label: string }[] = [
  { slug: 'tools', label: '유틸리티' },
  { slug: 'labs', label: '서비스' },
  { slug: 'content', label: '콘텐츠' },
  { slug: 'games', label: '게임' },
];

export const WORKS: readonly WorkEntry[] = [
  {
    slug: 'forest-jump',
    title: '숲의 계단',
    englishTitle: 'Forest Jump',
    description:
      '발판을 밟고 50층 정상까지 점프하는 타임어택. 완주하면 기록을 TOP 5 랭킹에 남길 수 있습니다.',
    category: 'games',
    kind: '점프 · 타임어택',
    feature: 'TOP 5 랭킹',
    /* game.leneu.cloud 가 아직 DNS/터널이 안 열려 있어 당분간 블로그 안 경로가 정본.
       서브도메인이 열리면 https://game.leneu.cloud/forest-jump 로 바꾼다. */
    href: '/game/forest-jump',
    external: false,
    image: '/game/forest-jump-preview.webp',
    imageAlt: '숲의 계단 게임 속 캐릭터가 숲의 발판 사이를 점프하는 장면',
    imagePosition: '78% center',
    mark: 'joystick',
    source: 'blog.leneu.cloud',
    featured: true,
  },
  {
    slug: 'spellcrown',
    title: 'SPELLCROWN',
    description: '카드로 펼치는 웹 보드게임. 전용 서브도메인에서 설치 없이 바로 플레이합니다.',
    category: 'games',
    kind: '카드 · 보드게임',
    href: 'https://spellcrown.leneu.cloud',
    external: true,
    articleHref: '/15/spellcrown-web-boardgame',
    image: '/assets/works/games/spellcrown.png',
    imageAlt: 'SPELLCROWN의 금빛 왕관 아이콘',
    imageFit: 'contain',
    imageSquare: true,
    mark: 'crown',
    source: 'spellcrown.leneu.cloud',
    featured: true,
  },
  {
    slug: 'hold-img',
    title: 'HoldImg',
    description: '스크린샷이나 이미지를 화면 위에 떠 있는 조각으로 고정하는 macOS 유틸리티.',
    category: 'tools',
    kind: 'macOS 유틸리티',
    href: 'https://github.com/jaymunsh/hold-img',
    external: true,
    articleHref: '/108/hold-img-floating-screenshot',
    image: '/assets/works/utilities/hold-img-icon.png',
    imageAlt: 'HoldImg 앱 아이콘',
    imageFit: 'contain',
    mark: 'frame',
    source: 'GitHub',
  },
  {
    slug: 'ntfs-manager',
    title: 'NTFS Manager',
    description: 'macOS에서 NTFS 디스크의 읽기·쓰기를 다루는 도구.',
    category: 'tools',
    kind: 'macOS 유틸리티',
    href: 'https://github.com/jaymunsh/ntfs-manager',
    external: true,
    articleHref: '/2330/ntfs-manager-macos-ntfs-rw',
    image: '/assets/works/utilities/ntfs-manager.png',
    imageAlt: 'NTFS Manager 앱 아이콘',
    imageFit: 'contain',
    mark: 'harddrive',
    source: 'GitHub',
    featured: true,
  },
  {
    slug: 'open-camera',
    title: 'Open Camera',
    description:
      'iPhone에 설치해 쓰는 실시간 필터 카메라 PWA. WebGL2 셰이더로 필름 LUT·디지캠 이펙트를 처리하고 .cube LUT도 가져올 수 있습니다.',
    category: 'tools',
    kind: 'PWA · 카메라',
    href: 'https://open-camera-leneu.vercel.app',
    external: true,
    articleHref: '/2332/open-camera-iphone-filter-pwa',
    image: '/assets/works/utilities/open-camera-icon.png',
    imageAlt: 'Open Camera 앱 아이콘 — oc를 닮은 카메라 마크',
    imageFit: 'contain',
    imageSquare: true,
    mark: 'camera',
    source: 'open-camera-leneu.vercel.app',
  },
  {
    slug: 'fold-menu',
    title: 'Fold Menu',
    description:
      '노치에 가려지는 메뉴바 상태 아이콘을 폴더 하나로 접는 macOS 앱. 폴더에서 항목을 고르면 원본 메뉴를 잠시 꺼내 엽니다.',
    category: 'tools',
    kind: 'macOS · 메뉴바',
    href: 'https://github.com/jaymunsh/fold-menu',
    external: true,
    articleHref: '/2334/fold-menu-macos-menubar-folder',
    image: '/assets/works/utilities/fold-menu.png',
    imageAlt: 'Fold Menu 앱 아이콘 — 폴더 윤곽 안에 점 세 개',
    imageFit: 'contain',
    imageSquare: true,
    mark: 'frame',
    source: 'GitHub',
  },
  {
    slug: 'jay-claude',
    title: 'jay-claude',
    description: 'Claude Code 사용자 설정·스킬·워크플로를 모아 둔 저장소.',
    category: 'tools',
    kind: '개발 환경',
    href: 'https://github.com/jaymunsh/jay-claude',
    external: true,
    articleHref: '/14/jay-session-claude-code-plugin',
    image: '/assets/skills/claude-skills.png',
    imageAlt: 'Claude 심볼과 SKILLS 문구가 담긴 jay-claude 대표 이미지',
    imageFit: 'contain',
    imageSquare: true,
    mark: 'puzzle',
    source: 'GitHub',
  },
  {
    slug: 'mding',
    title: 'mding',
    description: '네이티브 앱 대신 PWA로 만든 로컬 우선 Markdown 작업공간.',
    category: 'tools',
    kind: 'PWA · 에디터',
    href: 'https://github.com/jaymunsh/mding-app',
    external: true,
    articleHref: '/8/mding-local-first-markdown-pwa',
    image: '/assets/works/utilities/mding.webp',
    imageAlt: 'mding 앱 아이콘',
    imageFit: 'contain',
    mark: 'book',
    source: 'GitHub',
  },
  {
    slug: 'jaycron',
    title: 'Jaycron',
    description: '일정·칸반·메모를 한 화면에 모은 로컬 우선 PWA.',
    category: 'tools',
    kind: 'PWA · 캘린더',
    /* 저장소가 비공개라 공개 작업물 링크는 없다. */
    articleHref: '/1/jaycron-local-first-calendar-dashboard',
    image: '/assets/works/utilities/jaycron.webp',
    imageAlt: 'Jaycron 앱 아이콘',
    imageFit: 'contain',
    imageSquare: true,
    mark: 'gauge',
    source: '소개 글',
  },
  {
    slug: 'memonowz',
    title: 'Memonowz',
    description: '내가 외울 것만 넣는 로컬 우선 암기 PWA.',
    category: 'tools',
    kind: 'PWA · 학습',
    articleHref: '/40/memonowz-local-first-flashcard-pwa',
    image: '/assets/works/utilities/memonowz-icon.png',
    imageAlt: 'Memonowz 앱 아이콘',
    imageFit: 'contain',
    mark: 'book',
    source: '소개 글',
  },
  {
    slug: 'ai-trend-bot',
    title: 'ai-trend-bot',
    description: '흩어진 AI 소식을 골라 하루 세 번 텔레그램으로 보내는 개인 브리핑 봇.',
    category: 'tools',
    kind: '자동화 · 봇',
    href: 'https://github.com/jaymunsh/ai-trend-bot',
    external: true,
    articleHref: '/9/ai-trend-bot-personal-briefing-bot',
    image: '/assets/works/utilities/ai-trend-bot-icon.webp',
    imageAlt: '브리핑 카드를 전송하는 ai-trend-bot 로봇 아이콘',
    imageFit: 'contain',
    mark: 'chat',
    source: 'GitHub',
  },
  {
    slug: 'donts3p',
    title: 'donts3p',
    description: '화면은 쉬게 하고 작업은 계속 돌리는 macOS sleep assertion 앱.',
    category: 'tools',
    kind: 'macOS 유틸리티',
    href: 'https://github.com/jaymunsh/donts3p',
    external: true,
    articleHref: '/4/donts3p-macos-sleep-assertion-app',
    image: '/assets/works/utilities/donts3p.webp',
    imageAlt: 'donts3p 앱 아이콘',
    imageFit: 'contain',
    mark: 'gauge',
    source: 'GitHub',
  },
  {
    slug: 'benchmark',
    title: 'Leneu Benchmark',
    description: '모델과 도구를 같은 조건으로 견줘 본 실험 결과 모음.',
    category: 'labs',
    kind: '벤치마크',
    href: '/benchmark/',
    external: false,
    articleHref: '/82/leneu-benchmark-01-criteria',
    image: '/assets/works/services/leneu-benchmark.svg',
    imageAlt: 'Leneu Benchmark의 속도계 아이콘',
    imageFit: 'contain',
    mark: 'gauge',
    source: 'blog.leneu.cloud',
  },
  {
    slug: 'camera',
    title: '사진 촬영 입문 가이드',
    englishTitle: 'Leneu Camera',
    description: '카메라·노출·구도를 입문자 눈높이로 정리한 별도 사이트.',
    category: 'labs',
    kind: '가이드 사이트',
    href: 'https://camera.leneu.cloud',
    external: true,
    articleHref: '/69/camera-simulator-guide',
    image: '/assets/works/services/leneu-camera.svg',
    imageAlt: '사진 촬영 입문 가이드의 카메라 아이콘',
    imageFit: 'contain',
    mark: 'camera',
    source: 'camera.leneu.cloud',
  },
  {
    slug: 'jay-wiki',
    title: 'jay-wiki',
    englishTitle: 'portfolio.leneu.cloud',
    description:
      '백엔드 설계와 운영 기록을 실행 가능한 시연으로 연결한 개인 포트폴리오 — 이 사이트의 본체입니다.',
    category: 'labs',
    kind: '운영 서비스',
    href: 'https://portfolio.leneu.cloud',
    external: true,
    articleHref: '/11/jaywiki-runnable-portfolio',
    image: '/assets/works/services/jay-wiki.png',
    imageAlt: '구름 로고와 WIKI 글자가 있는 jay-wiki 아이콘',
    imageFit: 'contain',
    imageSquare: true,
    mark: 'server',
    source: 'portfolio.leneu.cloud',
  },
  {
    slug: 'jay-blog',
    title: 'jay-blog',
    description: '위키에서 이 사이트 밖의 이야기를 떼어내 만든 블로그 — 지금 보고 있는 곳.',
    category: 'labs',
    kind: '운영 서비스',
    href: '/',
    external: false,
    articleHref: '/10/jayblog-split-from-wiki',
    image: '/assets/works/services/jay-blog.png',
    imageAlt: '구름 로고와 BLOG 글자가 있는 jay-blog 아이콘',
    imageFit: 'contain',
    imageSquare: true,
    mark: 'book',
    source: 'blog.leneu.cloud',
  },
  {
    slug: 'ai-book',
    title: '비전공자를 위한 AI 지식',
    description: '개발자가 아닌 사람에게 AI를 설명하려던 시도를 묶어 펴낸 책.',
    category: 'content',
    kind: '도서',
    href: 'https://www.yes24.com/product/goods/193453753',
    external: true,
    articleHref: '/12/nondev-ai-book',
    image: '/assets/projects/nondev-ai-book/cover.webp',
    imageAlt: '비전공자를 위한 AI 지식 책 표지',
    imageFit: 'contain',
    mark: 'book',
    source: 'YES24',
  },
  {
    slug: 'neon-wave',
    title: 'Lost in the Neon Wave',
    description: '직접 만든 신스웨이브 곡.',
    category: 'content',
    kind: '음악',
    href: 'https://youtu.be/xuWCNbn3vk0',
    external: true,
    articleHref: '/25/lost-in-the-neon-wave-local-ai-music',
    image: '/assets/works/content/lost-in-the-neon-wave.png',
    imageAlt: '네온빛 도시를 걷는 인물이 담긴 Lost in the Neon Wave 앨범 이미지',
    mark: 'music',
    source: 'YouTube',
  },
];

export function isWorkCategory(value: string): value is WorkCategory {
  return WORK_CATEGORIES.some((c) => c.slug === value);
}

export function worksByCategory(category: WorkCategory): WorkEntry[] {
  return WORKS.filter((w) => w.category === category);
}

/** 레일의 '이름 (n)' 표기에 쓰는 카테고리별 수. */
export function workCounts(): { slug: WorkCategory; label: string; count: number }[] {
  return WORK_CATEGORIES.map((c) => ({ ...c, count: worksByCategory(c.slug).length }));
}
