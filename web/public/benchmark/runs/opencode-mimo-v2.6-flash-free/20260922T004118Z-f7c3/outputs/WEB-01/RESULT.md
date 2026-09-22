# WEB-01 RESULT

- 과제 ID: WEB-01 / 문제 버전: v0.1-public-draft-2
- 상태: submitted (제출 상태이며 채점 통과가 아님)
- 시작(UTC): 2026-09-22T00:43:52Z (WEB-01 착수 확인 직후)
- 종료(UTC): 2026-09-22T00:45:15Z
- 소요: 83초 (agent-observed, 터미널 `date -u`)
- 산출물: `outputs/WEB-01/index.html` (외부 의존성 없는 단일 파일), `verify.mjs`, `screenshots/landing-{1440,768,390}.png`

## 구현한 요구

- 첫 화면(H1·소개·CTA), 기능 3종(작업 기록·결과 비교·Markdown 내보내기), 사용 흐름 4단계, 가격(무료 프로젝트 3개 / Plus 무제한), FAQ 5문항, 신청 폼.
- CTA는 `#apply` 신청 폼으로 이동.
- 가격 전환: 월간 9,000원/월 ↔ 연간 90,000원/년 — 금액과 결제 단위를 함께 변경(연간 시 무료 요금제 단위도 `/ 년`로 표기).
- 모바일 메뉴(≤860px 햄버거, aria-expanded), FAQ 열기·닫기, 이메일 정규식 검증·신청 완료 상태(전송 없음).

## 실제 검증 (Playwright 1.63 + Chromium, 로컬 file:// 로드)

실행 명령: `node outputs/WEB-01/verify.mjs` (브라우저 프로필은 실행 폴더에 두고 검증 후 삭제)

결과: **21/21 PASS**, 외부 네트워크 요청 0건(file://만 사용).

| 확인 항목 | 결과 |
|---|---|
| 1440px 가로 오버플로 | 0px |
| 1440px 히어로·CTA→#apply | PASS |
| 가격 월간 기본값 9,000원/월 → 연간 90,000원/ 년(단위 포함 문구까지) → 되돌림 | PASS |
| FAQ 닫힘→열림→닫힘, aria-expanded 동기화 | PASS |
| 잘못된 이메일 제출 → 오류 표시·완료 화면 미표시 | PASS |
| 올바른 이메일(jay@example.test) 제출 → 완료 상태 + 입력값 표시 → 다시 쓰기 | PASS |
| 768px: 햄버거 표시·메뉴 열림·링크 클릭 후 닫힘·오버플로 0 | PASS |
| 390px: 메뉴 기본 닫힘·열림·오버플로 0 | PASS |
| 키보드: FAQ를 Tab 포커스 후 Enter로 열림/닫힘, `:focus-visible` 아웃라인 정의 | PASS |
| 외부 이미지·글꼴·CDN 요청 0건 | PASS |

- 3개 폭 스크린샷: `screenshots/landing-1440.png`, `landing-768.png`, `landing-390.png`.

## 미확인 사항

- 실제 마우스·터치 하드웨어 입력이 아닌 브라우저 자동 조작(Playwright)으로만 검증했다. 실제 디바이스 스크린리더 동작은 미확인.
- 합성 제품 설정(가격·기능)은 실제 회사 사실이 아니다.

## 토큰·속도·비용

- null / not_exposed (하네스 미노출).
