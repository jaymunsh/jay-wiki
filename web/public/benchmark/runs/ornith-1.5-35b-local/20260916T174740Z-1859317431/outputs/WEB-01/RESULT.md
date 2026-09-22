# WEB-01 — 결과 기록 (RESULT)

- 상태: submitted
- case_version: v0.1-public-draft-2
- 시작/종료: 추정 (실시간 측정 아님)
- 산출물: outputs/WEB-01/index.html, outputs/WEB-01/logic_test.js(검증용), RESULT.md
- 도구: write_file(html), bash(node --check, node pure-logic test)

## 요구사항 준수

- **단일 파일**: `index.html` 하나에 HTML/CSS/JS 통합. 외부 에셋(CDN·이미지·폰트·라이브러리) 없음. `grep` 확인 결과 `https?://`·`src=`·`@import`·`<link>` 없음.
- **반응형**: 뷰포트 메타 `width=device-width, initial-scale=1.0` 포함. 브레이크포인트 820px(태블릿), 600px(모바일)으로 1440/768/390 기준점 커버.
  - 1440px: 전체 레이아웃 3열/2열.
  - 768px 부근(820px 이하): 기능 3열→2열, 단계 1열, hero 제목 축소.
  - 390px 부근(600px 이하): 햄버거 메뉴 열기, 기능·가격 1열, 카드 세로 쌓기.
- **모바일 메뉴**: 햄버거 버튼(`#menuToggle`, `aria-controls="navLinks"`)로 `#navLinks`를 토글, `aria-expanded` 동기화. 메뉴 항목 클릭 시 모바일 메뉴 자동 닫기.
- **FAQ 아코디언**: 각 `.faq-q`가 `aria-expanded` 토글, `.faq-a`를 `max-height`로 열고 닫기.
- **이메일 검증**: `submit` 시 `novalidate` 폼 + JS 정규식 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` 검증. 결과는 `#emailMsg`(aria-live)에 표시, 클래스 `ok`/`err`.
- **폼 완성 상태**: 유효한 이메일로 제출하면 폼 숨기고 `#formDone`에 확인 메시지와 체크 SVG 표시. 실제 전송 없음(`e.preventDefault()`).
- **CTA→폼**: 히어로 CTA(`#apply` 링크)와 가격 카드 버튼이 모두 신청 섹션(`#apply`)으로 연결.
- **가격 토글**: `#tabMonthly`/`#tabYearly` 클릭 시 **금액과 단위(원 / 월 ↔ 원 / 년)가 동시에** 변경, 플랜 셀렉트(`#plan`)도 동기화. 화살표 키로 탭 전환 가능.

## 검증 내용

- **JS 문법**: `<script>`를 추출해 `node --check` 실행 → `SYNTAX_OK`(116줄). jsdom 미제공으로 브라우저 실행 검증은 미수행(규칙대로).
- **순수 로직 테스트**(`node logic_test.js`, 12건全部 통과):
  - 가격 토글: 월 결제 Free 0 / Plus 9,000, 연 결제 Plus 90,000. 단위 레이블 동시 변경 확인.
  - `formatNumber(9000)`→`9,000`, `90000`→`90,000`(한국 천 단위 구분).
  - 이메일 정규식: `user@example.com`·`a.b@c.co.kr` 통과, `""`·`no-at-sign`·`no-dot@com`·공백 포함 거부, 양쪽 공백 트림 후 통과.
  - 폼 제출: 유효하면 `submitted:true`/클래스 `ok`, 무효하면 `submitted:false`/클래스 `err`.
- **참조 ID 존재 확인**: `navLinks`, `menuToggle`, `tabMonthly`, `tabYearly`, `plan`, `applyForm`, `email`, `emailMsg`, `formDone`, `doneMsg`, `faqList` 모두 HTML에 존재.

## 미확인 사항

- 실제 브라우저(크롬 등)에서 페이지를 열어 반응형·메뉴·아코디언·폼 동작을 실행으로 확인하지 않았다. 규칙상 브라우저가 없으면 실행 검증을 미수행으로 표시한다.
- 도구 호출 수는 이 공개 초안이 고정 도구 집합을 제공하지 않아 미측정.
- 호출·토큰·비용: 미측정(null).
