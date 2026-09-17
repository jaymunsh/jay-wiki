
- 로그아웃에서 JWT 쿠키만 지우면 왜 인증이 되살아날 수 있었나?
- Spring의 세션 무효화 누락과 BFF의 단일 Set-Cookie 전달을 함께 고쳐야 끝난다고 판단했다.
- 커밋 f107670, 로그아웃 응답 헤더에서 jw_token과 JSESSIONID 삭제 쿠키가 모두 내려오는지 확인했다.

## 결론 — 발급한 쿠키 전부를 지워야 끝난다

로그아웃 처리에서 Spring은 세션을 무효화하고 SecurityContext를 초기화하며, Next BFF는 backend가
내려보내는 Set-Cookie를 하나만 전달하지 않고 모두 전달한다.

## 왜 그렇게 했나

Google OAuth 로그인은 JWT 쿠키만으로 끝나지 않았다. 인증 과정에서 Spring Security가 JSESSIONID
기반 세션을 따로 만들 수 있었고, 이 세션에 인증 컨텍스트가 남으면 jw_token만 지워도 다음 요청에서
로그인 상태처럼 보일 수 있었다.

~~~mermaid
sequenceDiagram
    participant Browser
    participant Next as Next BFF
    participant Spring
    Browser->>Spring: /oauth2/authorization/google
    Spring-->>Browser: Set-Cookie: JSESSIONID
    Browser->>Next: POST /api/bff/auth/logout
    Next->>Spring: POST /api/auth/logout
    Spring-->>Next: Set-Cookie: jw_token 삭제
    Note over Browser,Spring: JSESSIONID가 남으면 새로고침 후 세션 인증이 되살아날 수 있음
~~~

원인은 두 가지가 겹친 것이었다.

1. Spring 로그아웃은 jw_token 삭제만 처리하고 OAuth 세션 무효화와 SecurityContext 초기화를 하지 않았다.
2. Next BFF는 backend 응답의 Set-Cookie를 하나만 전달했다. 로그아웃 응답이 여러 쿠키 삭제를 내려도
   브라우저까지 일부만 도착했다.

## 실제 구성 — Set-Cookie 를 모두 전달하게 바꿨다

Spring 로그아웃에서 기존 세션을 무효화하고 SecurityContextHolder.clearContext()를 호출하도록 고쳤다.
응답 쿠키는 jw_token과 JSESSIONID를 모두 Max-Age=0으로 내려보낸다.

~~~mermaid
sequenceDiagram
    participant Browser
    participant Next as Next BFF
    participant Spring
    Browser->>Next: POST /api/bff/auth/logout
    Next->>Spring: POST /api/auth/logout
    Spring-->>Next: Set-Cookie: jw_token 삭제
    Spring-->>Next: Set-Cookie: JSESSIONID 삭제
    Next-->>Browser: 두 Set-Cookie 모두 전달
    Browser->>Browser: JWT 쿠키와 OAuth 세션 쿠키 제거
~~~

Next BFF는 headers.getSetCookie()로 모든 Set-Cookie를 순회하며 append하도록 바꿨다. Spring 회귀
테스트로 세션 무효화, SecurityContext 초기화, 두 쿠키 삭제를 고정했고, 운영 smoke로 로그아웃 응답에
두 삭제 헤더가 함께 내려오는 것을 확인했다.

## 한계 — 이 경로는 지금 쓰이지 않는다

이 경로는 지금 쓰이지 않는다. 구글 로그인은 2026-08-06에 계정 행과 OAuth 전용 컬럼(email, subject)을
DB 마이그레이션으로 통째로 제거했고, 로컬 계정 로그인만 남았다. 로컬 로그인은 세션 기반 인증을 쓰지
않으므로 이 문제 자체는 재현되지 않는다. 다만 프레임워크가 만드는 보조 쿠키를 놓칠 수 있다는 것과,
BFF가 중간에 있을 때 다중 Set-Cookie 전달이 끊길 수 있다는 것은 세션 기반 인증을
다시 붙일 경우 그대로 적용된다.
