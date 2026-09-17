# jay-wiki web

Next.js 15 App Router로 만든 jay-wiki의 공개 화면과 BFF다. 위키·블로그·게시판·검색·시연 화면을 제공하고,
브라우저가 Kubernetes 내부 Spring API나 MinIO에 직접 접근하지 않도록 서버 라우트가 경계를 맡는다.

대표 공개 진입점은 `/portfolio`의 5분 요약과 `/operations/history`의 배포·장애·복구 타임라인이다.

## 실행

먼저 저장소 루트의 `docker-compose.dev.yml`과 Spring backend를 실행한다.

```bash
npm ci
npm run dev
# http://localhost:3000
```

기본 내부 API는 `http://localhost:8080`, MinIO asset은 `http://localhost:9000/wiki-assets`를 사용한다.
필요하면 `API_INTERNAL_BASE`, `MINIO_ASSET_INTERNAL_BASE`, `NEXT_PUBLIC_SITE_ORIGIN`,
`NEXT_PUBLIC_BLOG_ORIGIN`, `NEXT_PUBLIC_GRAFANA_ORIGIN`, `NEXT_PUBLIC_WS_BASE`로 바꾼다.

## 검증

```bash
npm run lint
npm run type-check
npm test
npm run build
npm run test:browser
```

`test:browser`는 production build를 별도 포트에 띄우고 mock backend를 붙여 공개 위키 딥링크, 본문,
CSS·JavaScript 자산 응답과 desktop/mobile 가로 overflow를 확인한다. Playwright Chromium을 처음 설치할
때는 `npx playwright install chromium`을 먼저 실행한다.

## 구조

| 경로 | 역할 |
|---|---|
| `src/app/` | App Router 페이지, BFF route handler, 전역·영역별 스타일 |
| `src/components/` | 위키 탐색, Markdown·Mermaid, 관리자 편집 등 공통 UI |
| `src/lib/` | Spring BFF 호출, 공개 URL과 공통 유틸리티 |
| `src/middleware.ts` | `portfolio.leneu.cloud`와 `blog.leneu.cloud` host 분기 |
| `tests/browser/` | Playwright 공개 화면 회귀 검사 |
| `playwright.config.ts` | desktop Chrome·Pixel 5 프로젝트와 테스트 서버 설정 |

운영 배포와 글 동기화 순서는 루트의 [배포 런북](../docs/deploy-runbook.md)을 따른다.
