# URL·SEO 규칙과 사이트 개선 적용 내역

> 2026-07-18 사이트 전반 리뷰 후 적용. 아래 "규칙" 절은 앞으로 작업할 때 계속 지켜야 하는 내용이다.

## 규칙 1 — 위키 문서의 정본 URL은 `/wiki/[slug]` (가장 중요)

- 위키 문서는 `web/src/app/wiki/[slug]/page.tsx`에서 렌더링하며, 문서마다 `generateMetadata`로 **제목·설명·OG·canonical**이 붙는다.
- **새로 만드는 모든 내부 링크·공유 링크·문서 안 상호 참조는 `/wiki/<slug>` 형식만 쓴다.**
- 과거 방식 `/?article=<slug>`는 홈에서 `/wiki/<slug>`로 **308 영구 리다이렉트**된다. 새 코드에 다시 쓰지 말 것 (리다이렉트는 하위 호환용).
- 이렇게 하는 이유: 이전에는 전체 위키 글이 검색엔진·링크 미리보기 관점에서 `/` 한 페이지였다. 글별 URL이 있어야 검색 유입과 OG 미리보기가 글 단위로 동작한다.

## 규칙 2 — sitemap·robots는 자동 생성

- `web/src/app/sitemap.ts`: 정적 화면 + 시나리오 상세(`SCENARIOS`) + **published 상태의 위키 글**을 DB 트리에서 읽어 자동 포함한다. 새 글은 발행만 하면 사이트맵에 들어가므로 손댈 필요 없다.
- 새 **정적 화면**을 추가하면 `sitemap.ts`의 `STATIC_PATHS`에 경로를 한 줄 추가한다.
- `web/src/app/robots.ts`: `/admin`, `/api`, `/login` 크롤링 차단.

## 규칙 3 — 전역 CSS는 `styles/` 아래 섹션 파일로

- `globals.css`는 이제 `@import` 목록만 가진다. **import 순서 = 캐스케이드 순서이므로 순서를 바꾸지 말 것.**
- 새 화면 스타일은 `web/src/app/styles/`에 파일을 추가하고 globals.css 마지막에 import 한다. globals.css에 인라인 금지.
- 분리는 원본과 바이트 단위 동일(diff 검증)하게 수행했으므로 시각 변화 없음.

## 규칙 4 — lint 경고는 8개가 상한 (ratchet)

- `lint` 스크립트를 `--max-warnings 20 → 8`로 조였다. 현재 경고 8개는 전부 `react-hooks/set-state-in-effect`·`exhaustive-deps`로, 채팅·Kafka·Saga·게시판 검색·WikiShell의 **동작 리팩터링이 필요한 것들**이라 별도 작업으로 남겼다.
- 경고를 고치면 상한도 같이 내린다(최종 목표 0). 새 경고 추가 금지.

## 2026-07-18 적용 내역 요약

| 항목 | 내용 |
|---|---|
| 위키 글별 URL | `/wiki/[slug]` 신설, 글별 title/description/OG/canonical, 미존재 slug는 404 |
| 레거시 링크 | `/?article=` → 308 리다이렉트, 내부 링크(검색·시나리오·가이드) 전부 `/wiki/`로 교체 |
| `/wiki`, `/domain-scenarios` | 인덱스 없던 경로에 각각 `/`, `/scenarios` 리다이렉트 추가 (404 제거) |
| sitemap/robots | `sitemap.ts`(글 40건 자동 포함)·`robots.ts` 신설 |
| 루트 메타데이터 | title을 설명형으로 변경 + `%s · jay-wiki` 템플릿, description 구체화 |
| 접근성 | skip-link(본문으로 건너뛰기) + 모든 `<main>`에 `id="main-content"` |
| CSS | globals.css 2,545줄 → `styles/` 12개 파일로 분리 (순서 보존) |
| lint | `--max-warnings 8`로 ratchet |

## 남은 개선 과제 (이번에 하지 않은 것)

- lint 경고 8개의 실제 리팩터링 (브라우저에서 채팅/Kafka/Saga 동작 확인하면서 진행할 것)
- 반응형 브레이크포인트 정규화: 현재 480/560/640/720/760/900/980/1024/1040/1100px 10종 → 3~4종으로 통일 (시각 회귀 확인 필요해서 보류)
- 페이지별 CSS Module 전환 (지금은 파일 분리까지만)
