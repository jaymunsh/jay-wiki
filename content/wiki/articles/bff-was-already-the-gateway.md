
- MSA 확장에서 Spring Cloud Gateway 를 어디에 넣을 것인가에 대한 결정 기록이다.
- 기존 BFF 프록시가 게이트웨이의 횡단 관심사를 이미 들고 있어 gateway 는 추가가 아니라 대체로만 정당하고, 전환은 브라우저가 Spring 말고 다른 서비스를 직접 불러야 하는 시점으로 미루기로 판단했다.
- web/src/app/api/bff/[...path]/route.ts 를 줄 단위로 읽고 게이트웨이 기능 목록과 행 번호로 대조했으며, 쿠키 전달·IP 보존·502 래핑이 붙은 순서는 커밋 이력으로 확인했다.

## 맥락 — 요청 경로를 따라가다 BFF 프록시에서 멈췄다

포트폴리오 프로젝트를 MSA 쪽으로 넓히면서 Spring Cloud Gateway 를 넣을 자리를 찾기 위해
지금의 요청 경로를 처음부터 끝까지 따라갔다.

~~~
브라우저 → traefik(ingress) → Next.js → BFF 라우트 → Spring
~~~

멈춘 곳은 web/src/app/api/bff/[...path]/route.ts 다. 77줄짜리 catch-all 프록시로,
사이트를 처음 만들 때 브라우저가 백엔드 주소를 몰라야 한다는 이유로 만들어 둔 파일이다.
줄마다 읽어 보니 이 파일은 이미 게이트웨이의 일을 하고 있었다.

### BFF 는 화면을 위해 백엔드 앞에 둔 얇은 층이다

BFF 는 Backend For Frontend 다. 브라우저가 진짜 백엔드를 직접 부르지 않고 항상 이 층을 거친다.
이 프로젝트에서 호출 경로는 둘로 갈린다.

~~~
서버 컴포넌트(SSR)   : Next 서버 --BACKEND_BASE--> Spring   (BFF 를 안 지난다)
클라이언트 컴포넌트  : 브라우저 --/api/bff/*--> Next 서버 --> Spring
~~~

백엔드 주소인 BACKEND_BASE 는 web/src/lib/backend.ts 에 있고, 그 파일의 첫 줄이 server-only
import 다. 이 한 줄 때문에 값이 브라우저 번들에 섞일 수 없다 — 클라이언트 컴포넌트에서 불러 쓰면
빌드가 깨진다. 그래서 브라우저는 백엔드 주소를 알 방법이 없고, 대신 자기 오리진의 경로를 부른다.

~~~ts
// web/src/app/saga/order/page.tsx
const response = await fetch('/api/bff/saga/orders?size=8', { cache: 'no-store' });
~~~

이 배치로 얻는 것이 셋이다. Spring 이 클러스터 안에서 ClusterIP 로만 떠 있어도 브라우저가 쓸 수
있고, 같은 오리진이라 CORS preflight 자체가 없고, 인증 쿠키가 HttpOnly 인 채로 자동으로 실린다.

### 이 파일이 실제로 하는 일

파일 이름의 대괄호 catch-all 세그먼트가 경로를 통째로 받는다. /api/bff/board/search 로 오면
path 가 배열 board, search 가 된다. 라우팅 테이블이 없기 때문에 Spring 에 API 를 하나 더 만들어도
이 파일은 안 건드린다.

첫 일은 목적지 조립이고, 여기가 주소 은폐 지점이다.

~~~ts
async function proxy(req: Request, path: string[]) {
  const url = new URL(req.url);
  const target = BACKEND_BASE + '/api/' + path.map(encodeURIComponent).join('/') + url.search;
~~~

encodeURIComponent 를 조각마다 거는 것이 이 줄의 핵심이다. 안 걸면 경로 조각에 점 둘이나
물음표를 실어 보내 의도하지 않은 엔드포인트로 튀게 만들 수 있다.

다음은 헤더인데, 받은 것을 전부 넘기지 않고 셋만 고른다.

~~~ts
  const cookie = req.headers.get('cookie');
  if (cookie) headers['cookie'] = cookie;
  const clientIp = req.headers.get('cf-connecting-ip');
  if (clientIp) headers['cf-connecting-ip'] = clientIp;
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;
~~~

cookie 는 TOTP 로그인이 심은 jw_token 이다. 이것이 안 넘어가면 글 작성·수정이 전부 401 이 된다.
cf-connecting-ip 와 x-forwarded-for 는 원래 방문자의 IP 다. 프록시를 한 번 더 거치는 순간
Spring 이 보는 주소는 Next 파드의 IP 가 되므로, 여기서 살려 넘기지 않으면 접속 기록이 전부
같은 주소로 남는다.

백엔드가 죽어 있으면 fetch 가 예외를 던진다. 안 잡으면 미가공 500 과 스택트레이스가 브라우저로
샌다. 그래서 RFC 7807 problem+json 으로 감싼 502 를 대신 내보낸다.

~~~ts
  try {
    r = await fetch(target, init);
  } catch (e) {
    return Response.json(
      { type: 'https://jaywiki/errors/upstream-unavailable',
        title: 'Upstream Unavailable', status: 502,
        detail: '백엔드 API에 연결하지 못했습니다.' },
      { status: 502, headers: { 'content-type': 'application/problem+json' } },
    );
  }
~~~

마지막이 응답 헤더고, 여기가 가장 조심스러운 자리다.

~~~ts
  const resHeaders = new Headers({
    'content-type': r.headers.get('content-type') ?? 'application/json',
    'x-cache': r.headers.get('x-cache') ?? 'NONE',
  });
  const searchEngine = r.headers.get('x-search-engine');
  if (searchEngine) resHeaders.set('x-search-engine', searchEngine);
  for (const setCookie of r.headers.getSetCookie()) {
    resHeaders.append('set-cookie', setCookie);
  }
~~~

Set-Cookie 는 응답에 여러 개가 올 수 있는 사실상 유일한 헤더다. get 으로 읽으면 콤마로 이어붙인
한 줄이 나와서 쿠키가 깨지고, getSetCookie 만 배열로 준다. append 를 쓴 것도 같은 이유다 —
set 이었으면 마지막 하나만 남는다. 로그인과 로그아웃이 이 세 줄에 걸려 있고, 아래에 적을
전환 리스크의 첫 줄이 바로 여기다.

x-cache 와 x-search-engine 은 Spring 이 캐시 적중 여부와 어떤 검색 엔진을 썼는지(OpenSearch 인지
DB 폴백인지)를 알려주는 헤더다. 통과시켜야 화면에서 보인다.

### 이 목록이 곧 게이트웨이의 기능 목록이다

게이트웨이가 하는 일을 교과서식으로 늘어놓으면 라우팅, 인증 정보 전달, 클라이언트 정보 보존,
장애 시 오류 변환쯤 된다. 이 파일을 그 목록에 대면 이렇게 겹친다.

| route.ts 위치 | 하는 일 | gateway 라면 |
|---|---|---|
| 12행 | 경로를 그대로 Spring 으로 넘기며 백엔드 주소 은폐 | 라우팅 정의 |
| 18–19행 | 인증 쿠키(jw_token) 전달 | 기본 동작 |
| 20–23행 | cf-connecting-ip·x-forwarded-for 보존 | 헤더 필터 |
| 35–46행 | 백엔드가 죽으면 problem+json 502 로 감싸기 | CircuitBreaker + fallbackUri |
| 52–55행 | x-cache·x-search-engine 응답 헤더 통과 | 기본 동작 |
| 57–59행 | 로그인·로그아웃의 Set-Cookie 를 브라우저로 되돌리기 | 기본 동작 |

만들 때는 이것을 게이트웨이라고 부른 적이 없다. BFF 프록시라고 부르며 필요할 때마다 한 가지씩
붙였고, 커밋 이력이 그 순서를 보여 준다. 첫 커밋에 쿠키 전달과 Set-Cookie 되돌리기가 있었고,
사흘 뒤 운영 배포를 준비하며 클라이언트 IP 보존이 붙었고, 다시 나흘 뒤 백엔드 장애 때 미가공
500 이 브라우저로 새는 것을 막는 502 래핑이 붙었다. 하나씩 쌓인 결과가 게이트웨이 기능 목록의 한 묶음과 겹쳤다.

### 겹치지 않는 칸이 넷 있다

표만 보면 대체가 이미 끝난 것처럼 읽히는데 아니다. 게이트웨이가 하고 BFF 가 못 하는 일이 넷이다.

| 못 하는 것 | 왜 | 지금은 |
|---|---|---|
| 경로별 라우팅 | catch-all 이라 목적지가 BACKEND_BASE 하나로 고정이다 | 브라우저 요청이 전부 Spring 행이라 아직 안 아프다 |
| WebSocket·스트리밍 | 응답을 text 로 전부 버퍼링한 뒤 되돌린다. 업그레이드가 지날 수 없다 | 랜덤 채팅의 /ws/chat 은 BFF 를 안 지나고 ingress 에 자기 경로가 따로 있다 |
| 타임아웃·재시도·서킷브레이커 | try/catch 로 502 를 만들 뿐이다 | 죽은 백엔드에 매 요청 그대로 달려든다 |
| 레이트리밋 | 없다 | traefik 과 Spring 쪽 제한에 기댄다 |

첫 칸이 이 결정의 핵심이다. 게이트웨이의 본업은 라우팅인데 BFF 는 그것만 구조적으로 못 한다.
그래서 이 글의 결론은 BFF 가 게이트웨이를 대신한다가 아니라, 백엔드가 하나인 동안의 횡단 관심사를
BFF 가 이미 다 들고 있다는 쪽이다.

둘째 칸은 이미 우회로 값을 치르고 있다. WebSocket 을 BFF 로 못 보내서 ingress 규칙이 하나 늘었고
그 경로만 Spring 에 직접 닿는다. gateway 로 대체하면 이 우회가 사라진다 — 지금 확인된 것 중
대체 편에 설 수 있는 유일한 실익이다.

## 기각한 후보 — 지금 경로에 gateway 를 추가하는 것

지금 경로에 Spring Cloud Gateway 를 추가하면 다섯 홉이 된다.

~~~
브라우저 → traefik → Next.js → BFF → gateway → Spring
~~~

같은 일을 하는 층이 연달아 둘이다. 상자는 하나 늘지만 요청은 매번 한 층을 더 지나고, 쿠키와
헤더를 전달하는 코드는 두 군데로 늘어난다. 다이어그램을 위해 런타임을 희생하는 구조라서 기각했다.

## 결정 — 대체만 정당하고, 전환은 서비스 분리 이후로 미룬다

대체는 다르다.

~~~
브라우저 → traefik → Spring Cloud Gateway → Spring / payment-api / shipping-api
~~~

홉 수는 지금과 같고 77줄은 실제로 사라진다. 새 계층을 얹는 것이 아니라 Next.js 가 대신하고 있던
역할을 제자리로 옮기는 것이다. 다만 이 대체는 라우팅할 대상이 모놀리스 하나일 때는 의미가 없고,
결제·배송 서비스가 분리되어 목적지가 여럿이 된 뒤에야 정당해진다.

그 조건은 아직 안 채워졌다. 결제와 배송이 각자 DB 를 든 서비스로 떨어져 나갔지만, 브라우저는
지금도 Spring 하고만 이야기한다. payment-api 와 shipping-api 를 부르는 것은 모놀리스의
OrderSagaService 이고 서버 대 서버 호출이라 게이트웨이가 지나는 경로가 아니다. 오늘 gateway 를
세워도 라우팅 테이블에 적힐 목적지는 여전히 하나다 — 서비스 개수와 라우팅 대상 수는 다르다.

다만 근거가 하나 남아 있다. WebSocket 은 Next 의 라우트 핸들러를 지나지 못해서, /ws/chat 은
BFF 를 우회해 traefik 에서 Spring 으로 곧장 간다 — infra/k8s/backend/jaywiki.yaml 의
jaywiki-chat Ingress 가 그 경로다. 입구를 하나로 모으는 물건이 있는데 이 경로만 예외인 셈이고,
gateway 가 서면 그 예외가 사라진다. 그래도 이 한 줄을 없애려고 컴포넌트를 세우는 것은
아직 남는 장사가 아니라고 봤다. 예외는 ingress 규칙 한 줄로 유지되고 있다.

그래서 BFF 는 오늘도 그 파일 그대로 돌고 있다. 대체가 정당해지는 조건은 서비스 개수가 아니라
브라우저가 Spring 말고 다른 서비스를 직접 불러야 하는 날이다. 이 대체가 왜 워크로드를 늘리는 것보다 뒤로 밀렸는지는
[Eureka·Config Server·메시를 각각 기각하고 워크로드 다섯에서 멈췄다](/wiki/why-only-five-services)에 있다.

TOTP 를 포함한 인증 검증도 Spring 에 그대로 남긴다. gateway 는 쿠키를 전달만 한다. 인증 필터를
gateway 로 올리는 쪽이 더 MSA 답게 보이지만, 로그인이 깨질 위험이 가장 큰 곳에서 얻는 것이 가장
적다. BFF 와 인증 경계가 지금 어떻게 갈라져 있는지는
[Spring HTTP API를 BFF 뒤에 둔 이유](/wiki/spring-bff-auth-boundary)에 따로 적었다.

## 전환 시의 리스크 — 되돌리는 법까지 여기서 정해 둔다

설계 문서에 적어 둔 전환 시의 리스크는 이렇다.

- **Set-Cookie 되돌리기가 가장 위험하다.** 지금은 57–59행이 명시적으로 하는 일을 gateway 의
  기본 동작에 맡기게 되는데, 여기가 어긋나면 로그인이 조용히 깨진다.
- **공격면이 는다.** 지금 외부에 노출된 것은 Next.js 하나고 Spring 은 완전히 내부다. 대체하면
  gateway 가 밖으로 나온다.
- **CORS 가 생길 수 있다.** 지금은 같은 오리진이라 preflight 자체가 없다. traefik 에서 같은
  호스트의 /api/* 만 gateway 로 보내는 식으로 피해야 하고, ingress 규칙이 는다.
- **SSR 은 대체 대상이 아니다.** Next.js 서버 컴포넌트는 지금도 BACKEND_BASE 로 백엔드를 직접
  부르고, 서버 대 서버 호출이라 gateway 를 지나지 않는 것이 맞다. gateway 가 Next.js 를
  대체하는 것이 아니다.

되돌리는 법은 단순하다. 전환 전까지는 되돌릴 것이 없고, 전환 후 문제가 나면 traefik 라우팅을
Next.js 로 돌리고 BFF 라우트를 살리면 지금 구조로 돌아온다. 그 파일이 커밋 이력에 그대로 있다.

## 결과 — 상자를 늘린 기록보다 늘리지 않은 근거가 더 읽힌다

아키텍처 다이어그램에 상자를 하나 추가하는 일은 언제든 할 수 있고 한 줄로 요약된다. 반면
추가하지 않았다는 판단은 요청 경로를 끝까지 따라가 보고, 기존 코드가 실제로 무슨 일을 하는지
줄 단위로 확인해야만 나온다. 그 파일을 읽지 않았다면 다섯 홉짜리 경로를 만들어 놓고 다이어그램이
그럴듯해졌다고 만족했을 것이다.

남은 한계도 그대로 적는다. 대체 판단은 아직 문서 위의 결론이고, 실제 전환에서 Set-Cookie 나
CORS 가 예상대로 조용히 넘어갈지는 해 보기 전까지 모른다. 앞의 겹치지 않는 칸 넷 가운데 회복탄력성
쪽이 가장 먼저 아플 자리다. try/catch 로 502
를 만들 뿐, 죽은 백엔드를 향해 매 요청 그대로 달려든다. 서비스가 늘어 그 부재가 아프기 시작하는
순간이, 미뤄 둔 전환을 실행할 시점이다.
