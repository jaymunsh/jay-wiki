---
title: "오류는 났는데 알림이 울리지 않았다"
slug: silent-500-alert-gap
tab: "운영·관측"
parentId: operations
sortOrder: 1
kind: postmortem
tags: prometheus,alerting,loki,observability,incident
source: scripts/seed-portfolio-wiki.mjs
---
- 운영에서 500이 한 건 났는데 왜 아무도 몰랐고, 다음에는 어떻게 알게 만들었나?
- 다섯 번 잘못 짚으며 지표와 로그 두 갈래 알림을 세웠는데, 마지막에 읽을 수 없는 본문을 500에서 400으로 바로잡자 그렇게 세운 5xx 체계가 정작 이 글의 사고를 못 잡게 됐다. 그래서 400을 곁가지가 아니라 본체로 다뤄 같은 로그 갈래에 넣었다.
- 깨진 JSON 재현 손잡이로 억제가 걸려 trace_id가 실린 한 통만 오는 것까지 실측했고, 400 전환 뒤에는 같은 손잡이가 400 규칙만 울리는 것을 확인했다. 로그 형식 변경이 배포되면 400 알림에 trace_id가 실리는 것까지 봐야 끝난다.

2026-08-12 01:51:12 KST, 운영에서 블로그 글을 수정하려다 실패했다. 화면에는 unexpected server error
한 줄만 떴고, 텔레그램에는 아무것도 오지 않았다. 오류가 난 것보다 **아무도 모를 뻔한 것**이 이 글의 사건이다.

## 증상 — 화면은 원인을 감췄고 알림은 울리지 않았다

PUT /api/admin/blog/posts/{id} 가 500을 돌려줬다. GlobalExceptionHandler의 마지막 핸들러
handleUnexpected가 처리하지 못한 예외를 500으로 바꾸면서 내부 메시지를 감추기 때문에, 화면에는
원인이 한 글자도 안 남았다. 관리자가 직접 겪지 않았다면 이 500은 존재조차 몰랐을 것이다.

## 원인은 Loki 한 곳에서 끝났다

관측 세 층의 역할이 이번 건에서 뚜렷하게 갈렸다.

| 층 | 이번 건에서 한 일 |
|---|---|
| Loki | 원인을 말했다. Grafana Explore에서 아래 쿼리로 예외 줄이 그대로 나왔다 |
| Tempo | 위치를 보여준다. 로그 줄의 trace_id에 derivedFields(matcherRegex가 trace_id=([0-9a-f]{32}))가 걸려 있어 로그에서 trace로 바로 넘어간다 |
| Prometheus | 횟수를 센다. http_server_requests_seconds_count{job="jaywiki-backend", status=~"5.."} 가 method=PUT, uri=/api/admin/blog/posts/{id}, status=500 으로 값 1이었다 |

~~~
{namespace="backend"} |= "unhandled exception"
~~~

예외 메시지에 원인이 다 들어 있어서 Loki 한 곳에서 끝났다. HttpMessageNotReadableException 안의
InvalidFormatException이었고, 메시지는 Cannot deserialize value of type java.time.OffsetDateTime
from String "2026-08-11T16:45", 파싱은 index 16에서 끊겼다.

## 500 자체는 오프셋 없는 발행일 문자열이 만들었다

web/src/components/blog/admin/BlogPostForm.tsx:108 이 발행일 입력칸을 input type=datetime-local로
두고 defaultValue를 publishedAt.slice(0, 16)으로 채운다. 그 값은 2026-08-11T16:45 처럼 초도
오프셋도 없다. web/src/lib/blogAdminActions.ts:57 이 그 문자열을 그대로 payload에 실었고, 서버의
BlogPostSaveRequest.publishedAt은 java.time.OffsetDateTime이라 오프셋이 없으면 못 읽는다.

새 글 작성이 멀쩡했던 이유도 여기 있다. 새 글은 발행일 칸이 비어 있어 null로 가고, 서버가
published일 때 지금 시각을 채운다. 그래서 작성은 되고 수정만 깨졌다. 다만 발행일을 직접 입력하면
새 글도 같은 곳에서 깨지므로 수정 전용 버그가 아니다.

## 잘못 짚은 원인 하나 — 기존 규칙이 잡아줄 것이라는 가정부터 틀렸다

기존 알림 규칙 JaywikiApi5xxHigh가 이런 걸 잡으라고 있는 줄 알았다. ALERTS를 조회하니 비어 있었다.
그 규칙은 5xx 비율이 1%를 넘은 상태로 2분 지속돼야 울린다. 트래픽이 0.5 req/s쯤이라 500 한 건은
5분 창에서 약 0.7%에 그치고, 한 번짜리라 2분을 못 버틴다. 규칙 7개가 전부 지속되는 장애를 잡게
설계돼 있었고, **관리자가 저장 한 번 못 한 사고는 설계상 안 잡히는 종류**였다.

## 잘못 짚은 원인 둘 — increase로 세는 새 규칙도 틀렸다

그래서 건수로 세는 규칙을 넣었는데 처음 쓴 식이 또 틀렸다.
increase(http_server_requests_seconds_count{...5xx}[10m]) > 0 이었다. 같은 데이터로 재보니
increase(...[6h])가 0을 뱉었다. 원본 카운터는 1인데도 그랬다.

increase는 시간 창 안의 첫 샘플을 기준선으로 잡아 마지막 값에서 뺀다. 그런데 이 시계열은 그 500
때문에 **처음 생겼다.** 값 1로 태어났으니 첫 샘플도 1, 마지막도 1이라 증가량이 0이다. 즉 어떤
API에서 처음 나는 5xx는 통째로 못 잡는다. pod가 재시작하면 시계열도 새로 태어나므로 배포할 때마다
같은 구멍이 다시 생긴다. 새 기능에서 처음 터지는 오류가 제일 알고 싶은 것인데 바로 그게 안 잡히는
규칙이었다.

## 잘못 짚은 원인 셋 — 규칙이 울리면 알림이 가는 줄 알았다

규칙을 고쳐 실제로 firing 시키는 데까지 성공했는데도 텔레그램은 오지 않았다.
Alertmanager가 받은 알림을 열어 보니 receivers가 telegram이 아니라 default-receiver였다.
실행 중인 설정에는 receiver가 그 하나뿐이었고, 그것은 아무 데도 보내지 않는 빈 receiver다.

infra/k8s/observability/alertmanager-telegram-values.yaml은 저장소에 35일째 있었지만
클러스터에 한 번도 올라간 적이 없었다. Secret obs/alertmanager-telegram도 35일째 있었고
bot-token과 chat-id 둘 다 들어 있었다. **재료는 전부 갖춰져 있었고 배선만 안 꽂혀 있었다.**

두 파일은 같은 prom 릴리스다. helm upgrade에 prometheus-values.yaml 하나만 주면
Alertmanager의 receiver가 default-receiver로 되돌아간다. 규칙은 정상적으로 firing하고
Alertmanager도 알림을 받으므로 어느 화면에도 이상이 보이지 않는다. 그래서 35일 동안 몰랐다.

여기서 **알림 체계는 규칙과 전달 두 층이고, 규칙이 울리는 것을 봤다고 전달까지 확인한 것이
아니라는 것**을 배웠다. 이 글 앞부분에서 관측을 세 층으로 갈랐던 것과 같은 종류의 착각이다.

## 알림을 지표와 로그 두 갈래로 갈랐다

지표(Prometheus) 경로에는 숫자만 흐른다. 예외 본문과 trace_id는 로그에만 있어서, 지표 규칙이
아무리 정확해도 알림에는 실을 수 없다. 그래서 Loki ruler를 켜 로그 본문으로 알림을 만드는 갈래를
하나 더 놓았다. Spring의 GlobalExceptionHandler가 처리하지 못한 예외를 로그 한 줄로 찍고 그 줄에
trace_id가 있어서, 한 통에 사고 전체가 들어간다.

두 갈래는 중복이 아니라 덮는 범위가 다르다.

- 지표 규칙은 백엔드의 모든 5xx를 잡는다. 대신 trace_id와 pod를 못 싣는다. Prometheus 스크랩만 성하면 돈다.
- 로그 규칙은 trace_id와 pod까지 싣는다. 대신 그 핸들러를 타고 그 형식으로 찍힌 예외만 잡고, promtail·Loki·로그 형식까지 성해야 돈다. 더 상세하지만 더 좁고 더 잘 깨진다.

그래서 지표 규칙을 지우지 않고 남겼다. 대신 둘이 같은 사고를 잡았을 때는 Alertmanager 억제
규칙으로 상세한 쪽만 보내게 했다. 그런데 이 갈래를 붙이면서 두 번 더 틀렸다.

## 잘못 짚은 원인 넷 — 같은 요청을 둘이 다른 이름으로 불렀다

억제 규칙을 equal: [method, uri]로 걸었는데 실제로 두 통이 그대로 왔다. 라벨을 열어 보니 이랬다.

~~~
지표: uri = /api/blog/posts/{id}/comments
로그: uri = /api/blog/posts/24/comments
~~~

지표 쪽은 Spring이 지표에서 쓰는 라우트 패턴이고 로그 쪽은 실제 요청 경로다. 같은 요청인데
문자열이 달라 억제가 통과하지 못했다. 그래서 로그에 path(실제 경로)와 route(라우트 패턴)를 둘 다
찍게 하고, Loki 규칙이 route를 uri라는 이름으로 뽑아 지표 라벨과 맞췄다. 사람에게 보여줄 때는
재현에 그대로 쓸 수 있는 path를 쓴다.

## 잘못 짚은 원인 다섯 — 정규식이 어긋났는데도 알림은 떴다

새 Loki 규칙은 path=와 route=가 있는 로그를 기대한다. 그것을 Spring 배포보다 먼저 올렸더니
옛 형식 로그와 정규식이 안 맞았다. 그런데도 알림은 떴다. 텔레그램에 "오류 ·"만 있고 값이 전부
빈 메시지가 실제로 왔다.

LogQL의 regexp는 안 맞아도 줄을 버리지 않고 라벨만 비운 채 통과시키기 때문이다. 그래서
status =~ "5.." 라는 라벨 필터를 정규식 뒤에 문지기로 세웠다. 5xx를 고르려는 게 아니라 정규식이
실제로 맞았는지 보는 장치다. status가 비어 있으면 여기서 걸러진다. 붙인 뒤 같은 구간에 다시
쿼리하니 0건이 나왔다.

## 남긴 방어 — 웹은 오프셋을 붙이고 알림은 뺄셈으로 바꿨다

웹은 toOffsetDateTime()을 web/src/lib/blogAdminForm.ts에 두고 blogAdminActions.ts가 쓰게 했다.
순수 함수만 자동 테스트가 되는 자리다(vitest가 node 환경이라 DOM이 없다). 테스트 4개를 먼저
실패시키고 만들었고, 웹 테스트는 102개에서 106개가 됐다. 오프셋 없는 값은 실행 환경 시간대로
해석하는데, 웹·백엔드 pod 모두 TZ=Asia/Seoul이다(infra/k8s/backend/jaywiki.yaml,
infra/k8s/frontend/jaywiki-web.yaml). 두 pod에서 date를 찍어 KST인 것을 확인했다.

알림은 JaywikiApi5xxObserved를 infra/k8s/observability/prometheus-values.yaml에 넣었다.
increase를 걷어내고, 지금 값에서 10분 전 값을 빼되 그때 없던 시계열은 0을 기준으로 두는 식으로
바꿨다. 같은 데이터로 이 식은 1을 뱉는다. for는 0m, severity는 warning이라 텔레그램으로 간다.
method와 uri를 라벨로 실어 어느 API인지 알림 본문에서 바로 읽히게 하고, 설명에 Loki 쿼리를 적어
다음 사람이 로그로 바로 넘어가게 했다.

반영은 helm upgrade로 했다. 그때는 배포 파이프라인(.github/workflows/deploy.yml)이
infra/k8s/observability/** 를 건드리지 않아 Helm 값을 사람이 올렸다(infra/README.md).
**이 사고가 그 경계를 옮긴 이유가 됐다** — 2026-08-15 부터 배포 잡이 관측 스택 Helm 을 직접 올리고,
prom 에 values 두 장을 함께 넘기는 규칙도 scripts/deploy-helm-observability.sh 에 박아 뒀다. 규칙은 7개에서 8개가 됐고 revision은 7에서 9로 갔으며 prometheus
pod는 재시작하지 않았다(설정만 다시 읽는다). /api/v1/rules로 로드된 것을 확인했다.

전달은 두 values 파일을 같은 릴리스에 함께 올려 붙였다. helm upgrade에 -f를 두 번 준다.
receivers가 default-receiver에서 telegram으로 바뀐 것을 Alertmanager API로 확인했다.
같은 실수가 반복되지 않게 infra/README.md의 표와 알아둘 것에 이 조건을 적었다.

알림이 오기까지의 지연은 백엔드 스크랩 15초, evaluation_interval 1분, for 0m, Alertmanager
group_wait 10초를 합쳐 보통 30~50초, 최악 85초다. 로그는 그보다 빠르니 급하면 알림을 기다리지 말고
Loki를 먼저 본다.

## 고친 것을 진짜 사고로 시험했다

배포 전이라 운영에는 500 버그가 그대로 있었고 알림 규칙만 올라가 있었다. 그래서 관리자 화면에서
블로그 글 수정을 한 번 더 눌러 실제 사고를 다시 냈다. 카운터가 1에서 2로 올랐고,
ALERTS에 alertstate가 firing으로 떴고, Loki에 새 trace_id의 예외 줄이 찍혔다.
같은 자리에서 같은 오류가 났는데 이번에는 세 층 모두에 흔적이 남았다.

배포하고 나면 이 조건은 다시 만들 수 없다. 버그가 사라지기 때문이다.
**고치기 전에 시험한 것이 이번에는 맞는 순서였다.**

## 인증 없이 진짜 500을 내는 손잡이를 찾았다

배포 뒤에는 그 500을 다시 낼 수 없는데, 억제와 정규식처럼 그 뒤에 붙인 것들도 전부 실제 500이
있어야 검증된다. 알림 체계는 오류가 나야 검증되고, 오류를 기다리면 검증이 안 된다. 그래서
고치기 전에, 그리고 언제든 다시, 안전하게 사고를 만들 수 있는 손잡이가 필요했다.

운영 관리자 로그인에는 TOTP가 걸려 있어 관리자 API로 재현하기는 번거롭다. 대신 공개 POST
엔드포인트에 깨진 JSON을 보내면 같은 경로를 탄다. POST /api/blog/posts/{id}/comments 는
SecurityConfig에서 permitAll이다. 본문에 {"broken 처럼 깨진 JSON을 보내면
HttpMessageNotReadableException이 나고, 그것이 handleUnexpected로 떨어져 500이 됐다.
데이터는 바뀌지 않는다.

## 그 손잡이를 만들다가 500이 아니어야 할 것을 찾았다

읽을 수 없는 본문은 보낸 쪽 잘못이다. 400이 맞는데 처리기가 없어 마지막 handleUnexpected로
떨어져 500이 되고 있었다. 봇이 아무 JSON이나 던져도 5xx 지표가 오르고 운영 알림이 울리는
구조였다. 남 잘못에 내 폰이 울리면 알림을 곧 무시하게 되고, 그러면 여기까지 세운 것이
무의미해진다.

이 글이 다루는 사고도 같은 뿌리였다. 관리자 화면이 발행일을 오프셋 없이 보낸 것은 보낸 쪽
잘못이라 400이어야 했는데, 500으로 나가는 바람에 화면에 unexpected server error만 남아
원인을 가렸다. 400이었다면 그 자리에서 읽혔을 것이다.

다만 고치는 것은 아래 두 검증 뒤로 미뤘다. 억제와 배포 직후 사각지대는 실제 500이 있어야
시험되는데, 이 손잡이가 그때 남은 유일한 500이었기 때문이다.

## 배포 직후 지표 규칙이 눈먼 10분을 로그 규칙이 덮었다

배포로 pod가 새로 뜨면 5xx 카운터가 0부터 다시 시작하는데, 규칙이 빼는 10분 전 값은 옛 pod의
값이라 뺄셈이 0 이하가 된다. 배포 직후 10분이 지표 규칙의 눈먼 구간이다. 남은 한계로만 적어
뒀던 그 구간을 이번에 실제로 시험했다.

09:42, 그 구간 안에서 위 손잡이로 500을 냈다. 지표 규칙은 울리지 않았고 로그 규칙만 잡아
trace_id까지 실어 보냈다. 로그 규칙은 카운터가 아니라 로그 줄을 세므로 pod가 새로 떠도 눈멀지
않는다. 지표 규칙을 지우지 않고 둘을 남겨둔 판단이 실전에서 증명된 셈이다.

## 마지막 검증에서 억제가 걸려 텔레그램에는 한 통만 왔다

09:59, 사각지대가 풀린 뒤 다시 500을 냈다. 이번에는 두 규칙이 다 울렸고 Alertmanager 상태가
이랬다.

| 규칙 | 억제됨 |
|---|---|
| JaywikiApiErrorLogged (로그) | 아니오 — 텔레그램으로 나갔다 |
| JaywikiApi5xxObserved (지표) | 예 — 눌려서 안 나갔다 |

텔레그램에는 한 통만 왔고, 그 한 통에 이만큼 들어 있다.

~~~
시간 2026-08-12 09:59:21 KST
서비스 jaywiki (backend)
Pod jaywiki-58f7458b5d-kmktw
에러코드 500
에러경로 POST /api/blog/posts/24/comments
Trace 7990b8fd2c463fe93b20a7832332f86b
~~~

![텔레그램으로 온 5xx 알림. 시간과 서비스, Pod 이름, 에러코드 500, 실제 요청 경로와 trace_id 가 한 통에 들어 있다](/assets/observability/telegram-5xx-alert.webp "width=760 align=center")

## 읽을 수 없는 본문을 400으로 내리자 이 글의 사고가 알림 밖으로 나갔다

검증이 끝났으니 미뤄 둔 것을 고쳤다. HttpMessageNotReadableException을 400으로 내리고,
400만 따로 보는 규칙 JaywikiApi400Observed를 뒀다. 401과 403, 404는 뺐고 라우트가 안 맞은
요청도 뺐다. 지표의 uri 라벨에 실제로 남아 있는 /**, UNKNOWN, REDIRECTION이 그것인데 대부분
봇 스캔이다. 남이 문을 두드리는 것에는 울리지 않고 우리 화면이 잘못 보낸 것에만 울린다.

배포 뒤 같은 깨진 JSON을 다시 보내 확인했다. 응답이 400으로 바뀌었고, JaywikiApi400Observed만
울렸고, JaywikiApi5xxObserved와 로그 규칙은 조용했고, 로그에는 unhandled exception 대신
unreadable request body 한 줄만 남았다. 재현 손잡이는 그대로 살아 있다. 같은 깨진 JSON이
이제 400 규칙을 울린다.

그런데 이 결정이 이 글을 뒤집었다. 이 글이 다루는 사고, 즉 관리자 화면이 발행일을 오프셋 없이
보낸 것도 읽을 수 없는 본문이다. 400으로 바로잡은 뒤로는 그 사고가 5xx가 아니다.
**하루 종일 세운 5xx 알림 체계가 정작 이 글의 사고를 못 잡게 된 것이다.** 400을 곁가지로 두면
안 되는 이유가 이것이고, 그래서 400을 본체로 다뤘다.

- 400 로그도 500과 같은 꼬리를 찍는다. status·method·path·route다.
- Loki 규칙 하나가 둘 다 잡는다. 더는 unhandled만 보는 것이 아니라서 이름도
  JaywikiUnhandledException에서 JaywikiApiErrorLogged로 바꿨다. 위 억제 표에 적은 이름이 그것이다.
- 억제 규칙의 equal에 status를 더했다. 같은 경로에서 400과 500이 함께 나면 서로 다른 사고다.
- 파서 예외 메시지는 여러 줄이고 입력 조각을 담는다. 그대로 찍으면 로그 한 줄이 쪼개져 규칙이
  값을 못 뽑는다. 한 줄로 접고 200자로 잘랐다.

이렇게 되면 400 알림에도 500과 똑같이 trace_id와 pod가 실린다. 다만 이 로그 형식 변경은
아직 배포 전이라, 그 확인은 마지막 절에 남겨 뒀다.

실무 기준으로도 이 갈래가 맞다. 로그에는 4xx든 5xx든 trace_id를 항상 남긴다. 이미 MDC에 있어
로그 패턴이 자동으로 찍으므로 비용이 없다. 알림에 실을지는 그 4xx가 남의 잘못인지 우리 화면의
잘못인지로 가른다. 4xx를 건건이 알리면 알림 피로가 오므로 보통은 비율이나 급증만 보는데,
우리는 401·403·404와 봇 스캔을 이미 뺐으므로 남는 것이 대부분 우리 화면의 잘못이라 건건이 본다.

## 알림 문구는 폰에서 판단할 재료만 싣고 해제는 통보하지 않는다

처음 쓴 문구는 "최근 10분 안에 5xx가 났습니다"였다. 10분은 규칙이 되돌아보는 창 길이지
지연이 아닌데, 문구가 알림이 늦게 오는 것처럼 읽히게 만들었다. 실제 도달은 30~50초다.
창 길이는 문구에서 지웠다.

받는 사람은 폰에서 보고 판단한다. 그래서 시간을 맨 위에 두고 서비스·Pod·에러코드·에러경로·Trace
순으로 실었다. 규칙 이름 같은 기계 라벨은 뺐다. 예외 본문은 지표에도 로그 알림에도 싣지 않았다.
Trace만 있으면 Grafana에서 전체 예외로 바로 넘어갈 수 있고, 폰 알림에서 스택 트레이스를 읽는
사람은 없기 때문이다.

해제 알림은 껐다. 규칙 식이 10분 창이라 마지막 오류에서 10분이 지나면 알림이 자동으로 풀리는데,
그것은 고쳐졌다는 뜻이 아니라 새 발생이 없다는 뜻이다. 오류 발생은 시스템이 아는 사실이지만
해결 여부는 사람이 판단하는 것이라, 복구를 시스템이 통보하지 않게 했다.

## 아직 못 잡는 것이 남았다

- 지표 규칙은 배포 직후 10분을 여전히 못 본다. 고치지 않기로 했다. 로그 규칙이 그 구간을 덮는 것을 09:42에 실측으로 확인했고, 두 갈래를 둔 이유가 그것이다.
- 배포 직후의 일시적인 500에도 알림이 울린다. 배포는 드물고 진짜 500이면 알아야 하므로 그대로 둔다.
- 화면에서만 깨지는 문제는 여전히 안 잡힌다. 브라우저에서 난 오류를 서버로 보내는 통로를 새로 만들어야 하는데, 여기까지 붙인 것들과 달리 새 기능이라 따로 잡는다.
- 400의 로그 갈래는 아직 끝이 아니다. status가 붙은 꼬리와 한 줄로 접은 메시지, 즉 Spring 로그 형식 변경이 배포 전이다. 배포 뒤 같은 손잡이로 다시 트리거해 trace_id가 실린 400 알림이 오는 것까지 봐야 완결된다.

로그 형식이 규칙과 어긋나는 문제는 규율에서 구조로 옮겼다. loki-rules.yaml의 정규식을
GlobalExceptionHandlerTest에 그대로 두고, 400과 500 두 형식의 로그 한 줄이 같은 정규식과
맞는지 검사한다. 여러 줄 메시지가 로그를 쪼개는 것도 같은 테스트가 막는다. spring 테스트는
192개에서 194개가 됐다. 형식을 바꾸면 배포 전에 테스트가 먼저 깨진다. 이 글에서 두 번 겪은
실패 — 정규식이 어긋나 값이 빈 알림이 온 것과, 라벨 이름이 달라 억제가 통과하지 못한 것 —
이 그 자리에서 잡힌다. 알림의 계약을 주석이 아니라 테스트가 지킨다.
