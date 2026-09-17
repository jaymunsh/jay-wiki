
- 브라우저가 Spring을 직접 보지 않게 만든 BFF 경계가 인증과 장애 전달을 어떻게 책임지나?
- 일반 HTTP API는 전부 Next.js BFF 뒤에 두고 /ws/chat WebSocket만 예외로 직접 연결하며, 운영에서 ADMIN 토큰은 비밀번호만으로는 발급하지 않고 TOTP 검증을 통과했을 때만 발급하기로 판단했다.
- BFF 프록시가 fetch를 감싸지 않던 시절 Spring이 내려가면 같은 장애에서 화면 절반은 비고 절반은 처리되지 않은 500이었던 것을 겪었고, 지금은 upstream 연결 실패가 502 problem+json으로 감싸지는 것을 확인했다.

jay-wiki에서 브라우저는 Spring의 내부 Service 주소를 직접 알지 않는다.

페이지와 일반 HTTP API는 Next.js로 들어오고, Next.js가 BFF 경로로 Spring을 호출한다.
실시간 채팅의 /ws/chat WebSocket만 같은 공개 hostname의 별도 Ingress로 Spring에 직접 연결한다.

## 일반 HTTP 는 BFF 를 거치고 WebSocket 만 직결한다

~~~mermaid
flowchart TB
    Browser --> Next[Next.js]
    Next --> BFF["/api/bff/*"]
    BFF --> Spring[Spring Boot]
    Browser -->|/ws/chat| Spring
    Spring --> DB[(PostgreSQL)]
~~~

## BFF 뒤에 둔 이유는 넷이다

| 이유 | 설명 |
|---|---|
| 외부 노출 최소화 | 일반 HTTP API는 web BFF 뒤에 두고, WebSocket 경로만 예외로 공개 |
| 쿠키 처리 단순화 | httpOnly JWT 쿠키를 한 경로에서 다룸 |
| 운영 제어 | Spring은 클러스터 내부 DNS와 Secret 기준으로 운영 |
| 확장성 | FastAPI, Saga, Kafka 같은 내부 서비스가 늘어도 브라우저 경계는 그대로 |

## ADMIN 토큰은 TOTP 검증을 통과해야 발급된다

로그인 수단은 로컬 계정 하나다. Spring이 jw_token httpOnly 쿠키를 발급하고,
/api/bff/auth/me가 USER 또는 ADMIN 상태를 내려준다.

한때 구글 OAuth도 같은 자리로 들어왔다. callback을 BFF 경계에서 받아 Spring 쿠키로 바꾸는 방식이라
브라우저가 보는 것은 어느 쪽이든 jw_token 하나였다. 그 로그인은 2026년 8월 6일에 제거했지만,
바깥에서 무엇이 들어오든 쿠키 발급은 한 곳에서만 한다는 경계는 그대로 남았다.

진입점은 하나다. 관리자 전용 로그인 주소를 따로 두지 않고, 인증이 없는 /admin 요청을 미들웨어가 /login으로 보낸다.
로그인 화면을 둘로 나누면 같은 아이디·비밀번호 처리와 오류 UI를 중복해서 관리해야 하기 때문이다.

운영 설정에서는 **비밀번호만으로 ADMIN 토큰을 받을 수 없다.** 계정 role이 ADMIN이면 Spring이 로그인 요청에서
Google Authenticator 기반 TOTP를 추가로 검증한다.

| 단계 | 서버 처리 |
|---|---|
| OTP 없이 ADMIN 로그인 시도 | 401과 OTP_REQUIRED 코드를 돌려주고 쿠키를 발급하지 않는다 |
| OTP 값이 틀림 | 401과 OTP_INVALID |
| OTP 시도가 과도함 | 429와 OTP_BLOCKED로 추측 시도를 제한한다 |
| OTP 검증 통과 | 이때만 ADMIN role의 jw_token을 발급한다 |

화면은 이 상태를 그대로 따라간다. OTP 입력란은 처음부터 보이지 않고, 관리자 계정을 입력했거나
서버가 OTP_REQUIRED를 돌려준 뒤에만 나타난다. 일반 회원 가입과 로그인은 OTP를 거치지 않는다.

역할 경계를 어떻게 잡았고 왜 USER 쪽이 비어 있었는지는
[USER 역할이 지키는 경로가 하나도 없다는 것을 나중에 알았다](/wiki/admin-user-role-boundary)에 정리했다.
UI에서 관리자 메뉴를 숨기는 것은 편의일 뿐이고, 실제 차단은 Spring의 권한 검사에서 이뤄진다.
로그아웃 시에는 홈으로 강제 리로드해 모든 클라이언트 컴포넌트가 새 권한 상태를 다시 읽게 했다.

## 경계는 실패도 옮긴다

경계를 세우면서 그 경계가 장애를 어떻게 전달할지는 뒤늦게 정했다.

/api/bff 프록시는 한동안 fetch 를 감싸지 않았다.
Spring 이 내려가면 fetch 가 예외를 던졌고, Next.js 는 그것을 처리되지 않은 500 으로 브라우저에 그대로 내보냈다.
반면 서버 컴포넌트 쪽(lib/api.ts)은 이미 try/catch 로 빈 목록을 돌려주고 있었다.
결과적으로 **같은 장애에서 화면 절반은 우아하게 비어 있고, 절반은 스택 트레이스로 끝났다**.

지금은 프록시가 upstream 연결 실패를 502 application/problem+json 으로 감싼다.
어떤 실패를 어떤 status로 내보내는지는 [장애를 HTTP 응답으로 숨기지 않는 기준](/wiki/api-error-contract)에서 다룬다.

**교훈**: 프록시를 세울 때 upstream 이 아예 없는 경우의 응답을 정하지 않았다가, 나중에 502 problem+json 으로 채웠다.
경계를 만든다는 것은 요청 경로만 정하는 것이 아니라, 그 경계 뒤가 사라졌을 때의 응답까지 정하는 일이다.
