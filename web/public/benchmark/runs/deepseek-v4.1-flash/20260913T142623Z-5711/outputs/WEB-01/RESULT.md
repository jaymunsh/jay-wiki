# WEB-01 RESULT

## 제출물

- `outputs/WEB-01/index.html` — 단일 파일, 외부 의존성 0건 (37,664 bytes)
- 검증 기록: `browser-check.json`, `screenshots/*.png` (10장)
- 검증 스크립트: `tool-workspace/browser/cdp.mjs`, `tool-workspace/browser/web01-check.mjs`

## 구현 내용

합성 제품 `Leneu Desk`(개인 AI 작업 기록 도구, 대상: 여러 모델을 비교하는 개인 개발자)의 랜딩페이지.

| 요구 | 구현 |
|---|---|
| 첫 화면 | eyebrow + H1 + 리드 문단 + CTA 2개 + 인라인 SVG 목업 |
| 기능 | 작업 기록 / 결과 비교 / Markdown 내보내기 3카드 (인라인 SVG 아이콘) |
| 사용 흐름 | 3단계 스텝 (CSS counter로 번호 표시) |
| 가격 | Free(프로젝트 3개) / Plus(무제한, 월 9,000원, 연 90,000원) / Team |
| FAQ | 4문항 아코디언, `aria-expanded` + `aria-controls`, 열기·닫기 |
| 신청 폼 | 이름·이메일·요금제·용도·확인 체크박스, 검증 + 완료 상태 |
| CTA → 폼 | 헤더 CTA 및 각 요금제 버튼이 `#signup`으로 이동 |
| 가격 전환 | 월/연 토글 시 **금액과 결제 단위를 함께** 변경 (9,000원 `/ 월` ↔ 90,000원 `/ 년`) |
| 모바일 메뉴 | 768px 이하 햄버거, 열기·닫기, ESC 닫기 + 포커스 복귀, 링크 클릭 시 닫힘 |
| 이메일 검증 | 정규식 검증, `aria-invalid`, 오류 메시지, 유효 시 완료 상태 |
| 폼 전송 | 실제 전송 안 함. `<form id="signupForm" novalidate>`에 `action`·`method` 속성이 없고, submit 핸들러가 `e.preventDefault()` 호출 (index.html 558, 688, 731행) |
| 외부 자산 | 이미지·글꼴·라이브러리 CDN 미사용. CSS + 인라인 SVG만 사용 |

## 실제 검증 방법 (headless Chrome)

- 브라우저: 로컬에 설치된 `/Applications/Google Chrome.app`을 `--headless=new` + CDP(Chrome DevTools Protocol)로 직접 구동. 전역 설치·외부 패키지 설치 없음.
- 드라이버: Node 22 내장 `WebSocket`·`fetch`만 사용한 자체 스크립트(`cdp.mjs`). `npm install` 없음.
- 페이지 로드: `file://` URL로 직접 열어 로컬 개방 조건 확인.
- 뷰포트: 1440×950, 768×1000, 390×844(모바일 에뮬레이션) 3종.

### 검증 결과: 28개 항목 전부 통과 (`browser-check.json`)

```json
{"total": 28, "passed": 28, "failed": 0}
console errors: []
```

주요 실측값:

| 항목 | 1440 | 768 | 390 |
|---|---|---|---|
| 가로 스크롤 | 없음 (scrollWidth 1440 = clientWidth 1440) | 없음 (768=768) | 없음 (390=390) |
| 요금제 열 수 | 3 | 2 | 1 |
| 햄버거 버튼 | 숨김 | 노출 | 노출 |
| 내비게이션 | 노출 | 기본 숨김 | 기본 숨김 |

동작 검증(실제 클릭·키 입력):

- 가격 전환: 월 → 연 클릭 시 `9,000원 / 월` → `90,000원 / 년` (금액·단위 동시 변경), 왕복 복귀 정상, `aria-pressed` 동기화.
- FAQ: 열기 시 `aria-expanded="true"` + 패널 높이 68.16px, 닫기 시 `aria-expanded="false"` + `hidden`.
- 폼: 빈 제출 → 이름·이메일·확인 오류 표시 + 이름 필드 포커스, 완료 상태 아님. `not-an-email` → 이메일 오류 + `aria-invalid="true"`. 유효 입력 → 완료 패널 표시(입력값 반영).
- 키보드: Tab 12회로 건너뛰기 링크 → 브랜드 → 내비 → CTA → 가격 토글 순 포커스 이동. 포커스 링 `outline: 3px solid`. 가격 토글에서 ArrowRight로 전환 + 포커스 이동.
- 콘솔 오류: 0건.

### 외부 자원 확인

`performance.getEntriesByType('resource')` 결과 0건 → CDN·이미지·폰트·스크립트 외부 로드가 없다.

## 확인하지 못한 부분

- 실제 스크린 리더(NVDA/VoiceOver)로 접근성 트리를 확인하지 않았다. ARIA 속성값과 포커스 이동만 확인했다.
- Safari·Firefox 등 다른 엔진에서의 렌더링은 확인하지 않았다(Chrome만 사용).
- 실제 청구·결제·이메일 발송은 하지 않았다(데모이며 문제에서 금지).
- 스크린샷은 headless 렌더링 결과이며 실제 사용자 표시와 미세하게 다를 수 있다.
- 폼의 “네트워크 요청 없음”은 소스 수준 근거(`action` 없음 + `preventDefault`)와 리소스 엔트리 부재로 확인했다. 네트워크 프록시 수준 계측은 하지 않았다.

## 시간 기록

- 시작(UTC): 2026-09-13T14:28:51Z, 종료(UTC): 2026-09-13T14:36:35Z (agent-observed, `date -u`)
- 관측 소요: 465,000 ms (7분 45초). 한도 20분 이내.
- 토큰·속도·비용: 과제 단위 제공 없음 → 미측정(`not_exposed`).

## 용량

- `outputs/WEB-01/`: 684 KB (index.html 37,664 bytes + 캡처 10장)
- 브라우저 프로필 캐시(`tool-workspace/browser/chrome-profile-web01`, 약 3.1 MB)는 공개 폴더에 넣지 않는다.

## 검증

- 검증 방식: 브라우저 실제 조작(headless Chrome + CDP) + 스크린샷 + 소스 점검. 자기 채점 없음. 상태: submitted.
