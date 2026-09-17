import { BrowserAnalytics } from '@/components/BrowserAnalytics';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { PUBLIC_SITE_ORIGIN } from '@/lib/siteConfig';

const pretendard = localFont({
  src: './fonts/PretendardVariable.woff2',
  variable: '--font-pretendard',
  display: 'swap',
  weight: '45 920',
  style: 'normal',
});

/**
 * 고정폭도 직접 서빙한다. 시스템 대체에 맡기면 macOS 는 SF Mono 로 떨어지고
 * Windows 는 ui-monospace 지원이 약해 Courier New 까지 내려가 인상이 완전히 달라진다.
 * 코드 블록·slug·배지·숫자가 전부 이 폰트를 쓴다.
 */
const jetbrainsMono = localFont({
  src: './fonts/JetBrainsMono.woff2',
  variable: '--font-jetbrains-mono',
  display: 'swap',
  weight: '100 800',
  style: 'normal',
});

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_ORIGIN),
  title: {
    default: 'jay-wiki — k3s 홈랩 구축·운영 기록과 실행형 포트폴리오',
    template: '%s · jay-wiki',
  },
  description:
    'Kubernetes(k3s) 홈랩을 직접 구축·운영하며 남기는 기술 위키. Saga, Kafka, Redis, 검색 비교와 장애 대응 리허설을 직접 실행해 볼 수 있는 포트폴리오.',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    siteName: 'jay-wiki',
    title: 'jay-wiki — k3s 홈랩 구축·운영 기록과 실행형 포트폴리오',
    description:
      'Kubernetes(k3s) 홈랩을 직접 구축·운영하며 남기는 기술 위키. 분산 실패, 이벤트 처리, 실시간 상태와 장애 대응을 직접 실행해 볼 수 있다.',
    images: ['/og-image-1200x630.png'],
  },
};

/**
 * 하이드레이션 전에 테마를 결정해 "플래시" 없이 다크/라이트를 적용한다.
 * localStorage 키: theme = 'dark' | 'light', 기본값은 light다.
 */
const themeBootstrap = `
try {
  var saved = localStorage.getItem('theme');
  document.documentElement.dataset.theme = saved === 'light' || saved === 'dark' ? saved : 'light';
} catch (e) {
  document.documentElement.dataset.theme = 'light';
}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${jetbrainsMono.variable}`} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          본문으로 건너뛰기
        </a>
        <BrowserAnalytics />
        {children}
      </body>
    </html>
  );
}
