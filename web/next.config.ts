import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Start with directives compatible with Next.js inline hydration and Mermaid.
          { key: 'Content-Security-Policy', value: "base-uri 'self'; object-src 'none'; frame-ancestors 'self'" },
          ...(process.env.NODE_ENV === 'production'
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]
            : []),
        ],
      },
      {
        // 벤치마크 산출물은 AI가 만든 실행 가능한 HTML이다. 같은 blog origin에서
        // 열리더라도 부모 문서·쿠키·API 권한을 얻지 못하는 고유 origin으로 가둔다.
        source: '/benchmark/runs/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: blob:; font-src data:; media-src 'self' data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'; sandbox allow-scripts allow-forms allow-modals allow-pointer-lock",
          },
        ],
      },
    ];
  },
  /**
   * 발행된 블로그 글의 본문은 운영 PostgreSQL에 있다. 저장소의 이미지를 webp로 바꿔도
   * 이미 발행된 본문은 옛 .png/.jpg 경로를 그대로 들고 있어 그림이 깨진다.
   * 그 글들을 다시 발행할 때까지 옛 경로를 새 파일로 넘긴다.
   * ponytail: 재발행이 끝나면 이 규칙을 지운다. 남아 있어도 손해는 없다.
   */
  async rewrites() {
    return {
      // public/benchmark 디렉터리 자체가 파일 시스템 경로로 먼저 잡히므로 beforeFiles에서
      // index.html로 보낸다. afterFiles에 두면 디렉터리 매치가 이 규칙보다 앞서 404가 난다.
      beforeFiles: [
        { source: '/benchmark', destination: '/benchmark/index.html' },
        // 게임은 public/game/*.html 한 장짜리 파일이라 확장자 없는 주소를 여기서 연결한다.
        { source: '/game/forest-jump', destination: '/game/forest-jump.html' },
      ],
      afterFiles: [{ source: '/assets/:path*.:ext(png|jpg|jpeg)', destination: '/assets/:path*.webp' }],
      fallback: [],
    };
  },
};

export default nextConfig;
