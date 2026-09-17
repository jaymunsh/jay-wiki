
- DB에 저장된 Markdown을 브라우저 HTML로 바꾸는 경계와 관리자 변경 요청 경계를 어떻게 따로 방어했나?
- raw HTML escape 뒤 allowlist sanitizer를 한 번 더 통과시키는 이중 처리로 렌더링을 방어하고, 화면의 버튼 숨김이 아니라 Server Action의 ADMIN 재검증을 실제 권한 경계로 삼았다.
- raw 이미지 이벤트 속성과 javascript·data 링크가 sanitizer 뒤 HTML에서 제거되고, USER 저장 시도는 변경 요청을 보내지 않고 거절되는 회귀 검증을 남겼다.

DB 위키는 본문을 서버 배포물 밖에 저장한다. 편집과 revision에는 유리하지만, 저장된 Markdown을 HTML로 렌더링하는
순간부터 입력은 신뢰할 수 없는 경계가 된다. 이번 작업은 본문 렌더링과 관리자 변경 요청을 분리해서 방어했다.

## 먼저 위협을 나눴다

| 경계 | 공격 또는 실패 | 방어 목표 |
|---|---|---|
| Markdown 본문 | script, 이벤트 속성, 위험한 링크 스킴 | 브라우저에서 임의 코드가 실행되지 않게 함 |
| Mermaid 다이어그램 | 렌더러가 본문 HTML 권한을 넓힘 | 다이어그램은 그래프로만 렌더링 |
| Server Action | USER 또는 토큰 없는 요청이 변경 API 호출 | ADMIN만 저장, 삭제, 되돌리기, 탭 변경 가능 |
| Server Action의 Spring 변경 요청 | 불필요한 쿠키가 내부 서비스로 전달 | 검증 뒤 jw_token만 전달 |

## Markdown은 두 단계로 처리한다

첫째, Markdown 렌더러가 만나는 raw HTML은 텍스트로 escape한다. 예외는 하나뿐이다 — 접는 블록을 만들기 위해
**속성이 하나도 없는 details·summary 여닫는 태그**만 통과시킨다(2026-08-09에 추가). 속성이 붙는 순간 escape 대상이다.
둘째, 렌더링이 끝난 HTML도 allowlist sanitizer를 통과시킨다. 허용한 것은 문서에 필요한 기본 태그, 코드 강조 class,
Mermaid 컨테이너, 이미지의 제한된 속성과 위의 details·summary뿐이다.

링크와 이미지 URL은 http, https, mailto만 허용하고 protocol-relative URL도 막는다. 따라서 javascript나 data 계열
URL은 최종 HTML에 남지 않는다. 이중 처리의 이유는 Markdown 라이브러리 설정 한 곳의 실수만 믿지 않기 위해서다.

Mermaid fenced block은 일반 HTML로 섞지 않고 전용 컨테이너로 넘긴다. 클라이언트 렌더러도 strict 보안 수준으로
초기화한다. 다이어그램 오류는 화면에 원문이나 버전 정보를 노출하지 않고, 본문 읽기를 막지 않게 처리한다.

## 관리자 변경은 서버에서 다시 확인한다

편집 화면을 숨기는 것만으로 권한이 생기지 않는다. 저장, 삭제, revision 되돌리기, 탭 저장과 삭제의 Server Action은
각 요청 전에 auth me 응답이 authenticated ADMIN인지 확인한다.

검증된 경우에만 jw_token 하나를 Spring API로 전달한다. USER 계정이나 토큰이 없는 요청은 변경 API에 도달하기 전에
거절된다. 화면의 역할별 버튼 숨김은 사용성이고, Server Action의 재검증이 실제 권한 경계다.

## 두 경계의 방어를 회귀 검증으로 고정했다

| 검증 | 확인한 결과 |
|---|---|
| raw 이미지 이벤트 속성 | 본문에 실행 가능한 HTML로 남지 않음 |
| javascript와 data 링크 | sanitizer 뒤 HTML에서 제거됨 |
| Mermaid block | 전용 컨테이너로 남고 strict 렌더러가 처리 |
| ADMIN 저장 | auth me 확인 뒤 필요한 쿠키만 Spring에 전달 |
| USER 저장 시도 | 변경 요청을 보내지 않고 관리자 로그인 오류 반환 |

## 이 작업을 어떻게 설명할까

이 작업에서 남는 것은 라이브러리 하나를 추가한 사실이 아니라, 어떤 경계에서 무엇을 신뢰하지 않았는가다. 이 프로젝트에서는
DB 본문을 브라우저 HTML로 바꾸는 경계와, UI 뒤의 관리자 변경 요청 경계를 별도로 검증했다.

이것은 모든 보안 과제가 끝났다는 뜻은 아니다. 운영 반영 전에는 실제 공개 도메인에서 관리자 권한 흐름, CSP 정책,
의존성 취약점 점검, 로그인 세션과 CSRF 정책이 별도 점검으로 남아 있다.
