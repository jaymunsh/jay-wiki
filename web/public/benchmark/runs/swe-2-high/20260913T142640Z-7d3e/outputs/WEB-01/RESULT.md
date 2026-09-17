# WEB-01 RESULT

- 상태: submitted
- 시작(UTC, agent-observed): 2026-09-13T14:29:27Z
- 종료(UTC, agent-observed): 2026-09-13T14:33:21Z
- 경과: 약 3분 54초 (측정 출처: macOS `date -u`; 검증 도구 설치 시간 포함)

## 산출물

- `index.html` — 외부 이미지·글꼴·CDN 없이 CSS와 인라인 SVG만 사용한 단일 파일. 첫 화면·기능·사용 흐름·가격·FAQ·신청 폼 구현. CTA는 `#signup`으로 이동. 폼은 실제 전송하지 않음.
- `shot-1440.png`, `shot-768.png`, `shot-390.png` — headless Chrome 렌더 캡처.
- `verify-output.txt` — headless Chrome(puppeteer-core) 상호작용 검증 로그 14건 전부 PASS.

## 확인한 동작 (Chrome headless, 실제 DOM 조작)

- 1440/768/390px에서 가로 스크롤 없음(scrollWidth=clientWidth).
- 390px에서 모바일 메뉴 열기·닫기(`aria-expanded` 갱신).
- 가격 전환 스위치: 9,000원/월 ↔ 90,000원/년, 금액과 결제 단위 동시 변경.
- FAQ 클릭·키보드 Enter로 열기/닫기(`aria-expanded`, `.open` 클래스).
- CTA 클릭 시 신청 폼 섹션으로 스크롤.
- 잘못된 이메일 제출 시 오류 표시·폼 유지, 올바른 이메일은 완료 상태(신청 완료 + 입력 메일 표시).
- 검증 스크립트는 `tool-workspace/web01-verify/verify.mjs`(응시 폴더 내부, Chrome 실행 파일로 시스템 Chrome 사용, 페이지 소스 미수정).

## 확인하지 못한 부분

- 실제 창 브라우저에서의 시각 확인은 캡처 이미지로 대체(사람이 직접 조작한 것은 아님).

## 미측정

- 토큰·비용·첫 토큰 시간: 플랫폼 미제공(not_exposed).
