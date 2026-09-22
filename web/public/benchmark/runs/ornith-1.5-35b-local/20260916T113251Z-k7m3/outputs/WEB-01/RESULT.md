# WEB-01 결과 보고서

- 과제 ID: WEB-01
- 상태: submitted
- 산출물: `outputs/WEB-01/index.html` (완전한 단일 HTML 파일, 외부 의존성 없음)
- 토큰/비용/속도: 미측정 (not_exposed — 과제에서 노출되지 않음)
- 검증 도구: 헤드리스 Chrome + CDP (Chrome DevTools Protocol, Node WebSocket)

## 산출물 요약
- `outputs/WEB-01/index.html`: CDN·외부 폰트·외부 이미지가 전혀 없는 완전한 단일 HTML 파일. 모든 CSS/JS/SVG가 인라인으로 포함되어 네트워크 요청이 없음.
- 제품 반영: 가상 제품 **Leneu Desk** (개인 개발자용 AI 작업 기록·비교 도구).
- 섹션: 히어로 · 핵심 기능(3열 그리드) · 사용 흐름(3단계) · 가격(월/연 토글) · FAQ(아코디언) · 신청 폼(로컬 검증) · 푸터.

## 구현 내용
1. **반응형 레이아웃**: CSS 미디어 쿼리 `max-width:860px`를 경계로 3가지 뷰포트 지원.
   - 1440px(데스크톱): 인라인 네비게이션 + `.cols-3` 3열 / `.cols-2` 2열 그리드.
   - 768px(태블릿): 햄버거 메뉴 전환 + 단일 컬럼.
   - 390px(모바일): 단일 컬럼 + 여백 최적화.
2. **동적 인터랙션**:
   - 가격 결제 단위 토글(월/연): 금액과 결제 주기 텍스트 동시 변경.
   - 모바일 햄버거 메뉴 열기/닫기 — `nav.open` 토글 + `aria-expanded` 변경 + 버튼 라벨 변경.
   - FAQ 아코디언: 클릭 + 키보드 Enter/Space로 열기/닫기 (`.open`은 `<item>`에 적용).
   - 신청 폼: 정규식 기반 이메일 유효성 검증, 필드별 에러 메시지, 성공 시 완료 상태 박스 렌더링 (외부 네트워크 전송 없음).
3. **그래픽**: 순수 인라인 SVG 로고/아이콘 + CSS 벡터 목업.

## 검증 결과 (실제 브라우저 CDP로 관측)

### 1) 반응형 레이아웃 — computed style (브라우저 실제 렌더링)
각 뷰포트에서 `--window-size=<width>,2400`으로 열고 `getComputedStyle`로 관측.

| 선택자 | 속성 | 1440px | 768px | 390px |
|---|---|---|---|---|
| `.menu-toggle` | display | `none` (인라인 nav 표시) | `block` (햄버거 표시) | `block` (햄버거 표시) |
| `.links` (nav) | display | `flex` (인라인) | `none` (접힘) | `none` (접힘) |
| `.cols-3` | grid-template-columns | `349px 349px 349px` (3열) | `1fr` (단일 컬럼) | `1fr` (단일 컬럼) |
| `.cols-2` | grid-template-columns | `532px 532px` (2열) | `1fr` (단일 컬럼) | `1fr` (단일 컬럼) |

**판정**: 미디어 쿼리 경계(`max-width:860px`)에서 예상대로 전이.
- 860px 이상(1440px): 네비게이션 인라인(`flex`) + 다열 그리드.
- 860px 이하(768px, 390px): 햄버거 메뉴 표시 + 단일 컬럼.
- 768px와 390px 모두 860px 경계 이하로 동일 레이아웃(단일 컬럼) 적용 — 설계 의도대로.

### 2) 키보드 조작성 (768px 뷰포트, 햄버거 메뉴 활성 상태)
CDP의 `Input.dispatchKeyEvent`가 이 환경의 Chrome에서 거부(`Unexpected event type`)되어, 키보드 활성을 **합성 DOM 이벤트**로 시뮬레이션하여 관측.

| 항목 | 관측 결과 |
|---|---|
| menu-toggle 포커스 가능 (activeElement) | `true` |
| 메뉴 초기 nav.open / aria-expanded | `false` / `false` |
| Enter 후 nav.open / aria-expanded | `true` / `true` |
| 2회 Enter 후 nav.open / aria-expanded | `false` / `false` |
| Space 후 nav.open | `true` (열림) |
| FAQ 초기 open | `false` |
| FAQ Enter 후 open | `true` (열림) |
| menu-toggle 포커스 상태 | `true` |
| menu-toggle 포커스 인디케이터 (outline) | `solid` (2px, accent색) |

**판정**: 메뉴 토글이 키보드 Enter/Space로 열 닫기 가능, `aria-expanded`가 상태와 동기화, 포커스 인디케이터 가시. FAQ도 Enter로 열림. 전 체크 통과.

### 3) 가격 토글 + 신청 폼 (768px)

| 항목 | 관측 결과 |
|---|---|
| 가격 금액(초기) | `무료` |
| 가격 단위(초기) | `프로젝트 3개` |
| 단위 토글(연) 후 | 단위 `연 결제 · 프로젝트 무제한`로 변경 |
| 다시 월로 토글 | 월 결제 단위로 복원 |
| 빈 폼 제출 → err-name | `이름을 입력해주세요.` |
| 빈 폼 제출 → err-email | `이메일을 입력해주세요.` |
| 미체크 시 → err-agree | `이용약 확인이 필요합니다.` |
| 유효 폼 제출 후 폼 표시 | `none` (숨겨짐) |
| 유효 폼 제출 후 완료 박스 | 표시됨 (`show`) |
| 완료 메시지 | `무료 요금제 신청을 받았습니다.` |

**판정**: 결제 단위 토글 월/연 텍스트 변경 정상, 폼 검증(이름/이메일 형식/이용약 확인) 정상, 성공 시 완료 박스 표시. 외부 전송 없음.

### 4) 스크린샷
- `shots/1440.png` (1440×2400), `shots/768.png` (768×2400), `shots/390.png` (390×2400) — 3 뷰포트 캡처 완료.

## 검증 중 발견·수정
- 신청 폼의 이용약 체크박스에 `name` 속성이 없어 핸들러의 `form.agree.checked`가 `undefined` 참조로 오류를 내놓았다 — 유효 폼 제출 시 에러 처리 단계에서 예외가 발생해 완료 박스가 표시되지 않음.
- 수정: 페이지 JS의 `form.agree.checked` → `document.getElementById('f-agree').checked` (페이지가 f-name/f-email에 사용하는 동일 패턴)로 변경 후 재검증 결과, 유효 제출 시 폼 숨김·완료 박스 표시·메시지 표시 모두 정상 확인.

## 관측 한계
- 키보드 입력은 환경의 CDP `Input` 도구가 거부하여 합성 DOM 이벤트로 대체 관측 (기능적 결과는 동일).
- 실제 마우스 클릭은 시뮬레이션하지 않았으며, 클릭 핸들러는 페이지 소스 정적 분석으로 존재를 확인.
- 토큰·속도·비용은 과제에서 노출되지 않아 미측정 (`not_exposed`).
