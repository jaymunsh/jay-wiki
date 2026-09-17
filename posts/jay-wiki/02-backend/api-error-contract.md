---
title: "장애를 HTTP 응답으로 숨기지 않는 기준"
slug: api-error-contract
tab: "백엔드"
parentId: backend
sortOrder: 4
kind: wiki
tags: api,error,rfc7807,bff,resilience
source: scripts/seed-portfolio-wiki.mjs
---
- 입력 오류, 상태 충돌, 의존 서비스 장애, 예상 못 한 예외를 각각 어떤 HTTP 응답으로 구분하나?
- Spring은 전역 handler의 ProblemDetail로 응답 형식을 통일하고, BFF는 Spring의 응답을 그대로 전달하되 연결 자체가 실패하면 502 problem response를 직접 만들기로 판단했다.
- Spring 전역 handler가 type·title·detail을 가진 problem response를 만들고 BFF가 upstream 연결 실패를 502로 감싸는 코드 구성으로 확인 — 상태별 실측 기록은 아직 이 글에 없다.

API 오류는 모두 같은 실패가 아니다. 사용자가 고칠 수 있는 입력 오류, 현재 상태와 충돌한 요청,
의존 서비스의 장애, 예상하지 못한 서버 오류를 서로 다른 상태 코드로 전달하게 했다.

## 실패의 성격이 상태 코드를 정한다

| 상황 | 상태 | 응답 의도 |
|---|---:|---|
| 요청 검증 실패 | 400 | 어떤 입력이 잘못됐는지 알려준다 |
| 리소스 없음 | 404 | 찾는 대상이 없다는 사실을 알려준다 |
| 상태 충돌 | 409 | 비즈니스 규칙과 현재 상태가 맞지 않음을 알린다 |
| payment-api·shipping-api 또는 k8s 제어 장애 | 503 | 의존 서비스가 현재 사용할 수 없음을 알린다 |
| BFF가 Spring에 연결하지 못함 | 502 | 공개 경계 뒤 upstream 연결이 실패했음을 알린다 |
| 예상하지 못한 예외 | 500 | 내부 상세를 숨기고 공통 오류 형식만 돌려준다 |

Spring은 ProblemDetail을 사용해 type, title, detail이 있는 problem response를 만든다. controller마다
서로 다른 JSON을 만들지 않고 전역 handler에서 응답 형식을 맞춘다.

## BFF도 오류 경계다

브라우저는 Spring 내부 주소를 직접 알지 않는다. 따라서 Spring이 내려갔을 때 BFF가 아무 처리 없이
예외를 던지면, 내부 장애가 Next.js의 처리되지 않은 500으로 바뀐다.

지금 BFF는 두 경우를 나눈다.

| upstream 결과 | BFF 처리 |
|---|---|
| Spring이 HTTP 응답을 보냄 | status와 problem response를 그대로 전달 |
| Spring에 연결하지 못함 | BFF가 502 problem response 생성 |

## 왜 범용 예외 처리도 필요한가

예상하지 못한 예외를 프레임워크 기본 HTML 또는 스택 정보로 내보내면, API 소비자는 오류 형식을 신뢰할 수 없다.
전역 handler는 내부 메시지를 숨긴 500 problem response를 만들되, Spring Security와 MVC가 이미 처리해야 하는
인증, 인가, 404, 405 흐름은 기본 경로로 되돌린다.

## 관측에서도 같은 분류로 보이는지는 아직 안 봤다

각 오류가 UI의 문구뿐 아니라 metric, log, trace에서도 같은 분류로 보이는지는 아직 확인하지 않았다. 특히 503과 502는
재시도나 운영자 알림이 필요한 장애이고, 400과 409는 사용자의 요청을 고쳐야 하는 경우다.
