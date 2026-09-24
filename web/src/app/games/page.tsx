import type { Metadata } from 'next';
import Image from 'next/image';
import { headers } from 'next/headers';
import { GAME_INDEX_DESCRIPTION, GAME_ORIGIN, GAMES } from '@/lib/gameCatalog';
import { isGameHost } from '@/lib/gameHost';
import styles from './page.module.css';

export const metadata: Metadata = {
  metadataBase: new URL(GAME_ORIGIN),
  title: { absolute: 'Leneu Games | 브라우저 게임 모음' },
  description: GAME_INDEX_DESCRIPTION,
  alternates: { canonical: '/' },
  icons: { icon: '/game/icon.svg' },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: 'Leneu Games',
    title: 'Leneu Games | 브라우저 게임 모음',
    description: GAME_INDEX_DESCRIPTION,
    url: GAME_ORIGIN,
    images: [{ url: '/game/games-og.png', width: 1200, height: 630, alt: 'Leneu Games의 게임 목록' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Leneu Games | 브라우저 게임 모음',
    description: GAME_INDEX_DESCRIPTION,
    images: ['/game/games-og.png'],
  },
};

export default async function GamesPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-game-site-host') ?? requestHeaders.get('host');
  const localGameHost = isGameHost(host);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Leneu Games',
    description: GAME_INDEX_DESCRIPTION,
    url: GAME_ORIGIN,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: GAMES.map((game, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: game.title,
        url: `${GAME_ORIGIN}/${game.slug}`,
      })),
    },
  };

  return (
    <main id="main-content" className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <a className={styles.brand} href={localGameHost ? '/' : GAME_ORIGIN} aria-label="Leneu Games 홈">
            <svg className={styles.brandMark} viewBox="0 0 36 36" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="13" height="13" rx="2" fill="currentColor" />
              <rect x="20" y="3" width="13" height="13" rx="2" fill="currentColor" />
              <rect x="3" y="20" width="13" height="13" rx="2" fill="currentColor" />
              <path d="M22 20v13l11-6.5L22 20Z" fill="currentColor" />
            </svg>
            <span>Leneu Games</span>
          </a>
          <span className={styles.headerNote}>설치 없이, 한 판</span>
        </header>

        <div className={styles.intro}>
          <h1>오늘은 어떤 게임을<br />해볼까요?</h1>
          <p>가볍게 시작해서 오래 기억에 남는 게임들.<br className={styles.desktopBreak} /> 마음 가는 게임을 골라 바로 플레이하세요.</p>
        </div>

        <section className={styles.catalog} aria-labelledby="games-heading">
          <div className={styles.sectionHead}>
            <h2 id="games-heading">지금 플레이할 수 있어요</h2>
            <span>{GAMES.length}개의 게임</span>
          </div>
          <div className={styles.list}>
            {GAMES.map((game, index) => {
              const href = localGameHost ? `/${game.slug}` : `${GAME_ORIGIN}/${game.slug}`;
              return (
                <article className={styles.card} key={game.slug}>
                  <a href={href} className={styles.cardLink} aria-label={`${game.title} 게임 플레이하기`}>
                    <div className={styles.visual}>
                      <Image
                        src={game.image}
                        alt={game.imageAlt}
                        width={1200}
                        height={675}
                        priority={index === 0}
                        unoptimized
                        className={styles.image}
                      />
                    </div>
                    <div className={styles.cardContent}>
                      <div>
                        <div className={styles.cardLabels}>
                          <span className={styles.genre}>{game.genre}</span>
                          {game.feature && <span className={styles.feature}>{game.feature}</span>}
                        </div>
                        <h3>{game.title}</h3>
                        <p className={styles.englishTitle}>{game.englishTitle}</p>
                        <p className={styles.description}>{game.description}</p>
                      </div>
                      <div className={styles.cardBottom}>
                        <span className={styles.controls}>{game.controls}</span>
                        <span className={styles.play}>지금 플레이 <span aria-hidden="true">↗</span></span>
                      </div>
                    </div>
                  </a>
                </article>
              );
            })}
          </div>
        </section>

        <footer className={styles.footer}>
          <span>새 게임이 준비되면 이 목록에 추가됩니다.</span>
          <span>© Leneu Games</span>
        </footer>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
    </main>
  );
}
