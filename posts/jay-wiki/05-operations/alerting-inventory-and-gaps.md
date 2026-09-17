---
title: "알림으로 오는 열다섯 개와 아직 오지 않는 둘"
slug: alerting-inventory-and-gaps
tab: "운영·관측"
parentId: operations
sortOrder: 8
kind: wiki
tags: alerting,alertmanager,prometheus,loki,telegram,observability,operations
source: scripts/seed-portfolio-wiki.mjs
---
- 운영에서 Alertmanager 를 거쳐 텔레그램으로 오는 알림은 지표 규칙 열넷과 로그 규칙 하나, 합쳐 열다섯이다. 그 밖에 Alertmanager 를 거치지 않는 배포 계열 알림 둘과, 텔레그램이 아니라 클러스터 밖으로 나가는 Watchdog 이 있다.
- 지표에는 숫자만 흐르고 trace_id 는 로그에만 있어서 두 갈래를 다 두었고, 같은 사고를 둘 다 잡으면 억제 규칙이 상세한 쪽 한 통만 보낸다.
- 구멍 다섯 중 셋을 메웠다 — 알림 자체의 죽음은 클러스터 밖 dead man's switch 로, 백업 실패는 규칙 둘로 막았고, 콘텐츠 동기화는 다시 보니 구멍이 아니었다. 429 와 인증서 만료 둘이 남았다.

## 텔레그램에 닿는 길은 둘이고 자격증명은 하나다

경로가 둘이다. 하나는 Alertmanager 경유로, obs 네임스페이스의 Secret alertmanager-telegram(bot-token, chat-id)을 파일 마운트로 읽는다. 값은 문서에도 로그에도 남기지 않는다.

다른 하나는 배포 알림인데 Alertmanager 를 거치지 않는다. scripts/notify-deploy-telegram.sh 가 deploy.yml 의 마지막 스텝에서 kubectl 로 같은 Secret 을 읽어 텔레그램 API 를 직접 친다. 자격증명이 하나라 새로 만든 것이 없다.

## 지표와 로그는 중복이 아니라 덮는 범위가 다르다

지표에는 숫자만 흐른다. trace_id 와 pod 이름은 로그에만 있고, 그 둘이 있어야 알림에서 사고 하나로 바로 넘어갈 수 있다. 그래서 지표 규칙과 로그 규칙을 둘 다 둔다 — 같은 5xx 를 두 번 세는 것이 아니라 덮는 범위가 다르다. 겹칠 때의 처리는 억제 규칙이 한다. 아래에서 다시 쓴다.

두 갈래 규칙이 왜 생겼는지의 사건 기록은 silent-500-alert-gap 에 따로 있다.

## 지표 규칙 열넷이 이렇게 걸려 있다

infra/k8s/observability/prometheus-values.yaml 의 group jaywiki.rules 에 열다섯이 있다. 백업 둘은 2026-08-13 에, 사가 둘은 2026-08-19 에, 긁기 하나는 2026-08-20 에 넣었다.

- 예전 서술 ~~지표 규칙은 열둘이다~~
  - 2026-08-19 갱신: 미결 결제와 고아 사가 둘을 더해 열넷이 됐다. 근거는 participant-down-compensation 의 한계 절에 적어 둔 빈칸 둘이다.

| 규칙 | 조건 | for | severity |
|---|---|---|---|
| JaywikiBackendDown | 가용 레플리카 < 2 | 2m | warning |
| JaywikiBackendScrapeDown | up == 0 | 5m | warning |
| JaywikiApiP95High | p95 > 0.5초 | 2m | warning |
| JaywikiApi5xxHigh | 5xx 비율 > 1% | 2m | warning |
| JaywikiApi5xxObserved | 5xx 건수 증가 | 0m | warning |
| JaywikiApi400Observed | 400 건수 증가 | 0m | warning |
| JaywikiAdminForbiddenSustained | 관리자 403 지속 | 5m | warning |
| JaywikiPodRestartHigh | 15분 3회 초과 재시작 | 5m | warning |
| JaywikiKafkaDlqObserved | 10분 안에 DLQ 이벤트 증가 | 0m | info |
| JaywikiPaymentCancelFailed | 보상 중 결제 취소 실패 > 0 | 0m | warning |
| JaywikiSagaOrphaned | STARTED 로 10분 넘게 남은 사가 | 5m | warning |
| NodeMemoryHigh | 노드 메모리 80% 초과 | 5m | warning |
| DiskAlmostFull | 파일시스템 85% 초과 | 10m | warning |
| JaywikiBackupJobFailed | 백업 Job 실패 (1시간 안쪽) | 0m | warning |
| JaywikiBackupNotRunning | 백업이 25시간 넘게 안 돎 | 10m | warning |

- 2026-08-19 저녁 정정: 이 목록의 「있다」가 「본다」는 뜻은 아니었다. JaywikiBackendDown 의 up 은
  파드 둘을 시계열 하나로 덮고 있었다 — 스크레이프 대상이 파드가 아니라 Service DNS 라서 한 파드가
  죽어도 안 울고, 둘 다 죽어야 울었다. 백엔드를 상시 둘로 바꾼 날 같이 생긴 구멍이다. 같은 날
  JaywikiKafkaDlqObserved 와 JaywikiPaymentCancelFailed 가 increase 라 **첫 사건을 통째로 놓친다**는
  것도 실측으로 드러났다. 셋 다 고쳤고 기록은 [DLQ 를 다시 낸 절](/wiki/kafka-dlq-rehearsal)에 있다.

몇 개는 조건에 결이 있다.

HTTP 오류 셋은 무엇을 빼느냐가 규칙의 절반이다. JaywikiApi5xxObserved 는 지금 값에서 10분 전 값을 빼는 방식이고, method·uri·status 를 라벨로 실어 알림에 경로가 바로 뜬다. JaywikiApi400Observed 는 400 만 본다 — 401·403·404 는 뺐고, uri 가 /** · NOT_FOUND · UNKNOWN · REDIRECTION 인 것도 뺐다. 봇 스캔이다.

JaywikiAdminForbiddenSustained 는 /api/admin.* 의 403 이 5분 창에 10건 이상인 상태가 5분간 이어질 때 울린다. 2026-08-13 에 추가했다. DiskAlmostFull 은 tmpfs·overlay·squashfs 를 제외한 파일시스템만 본다.

사가 둘은 평시에 0 인 값을 본다. JaywikiPaymentCancelFailed 는 이미 있던 카운터(jaywiki_payment_client_requests_total 의 operation=cancel, result=error)의 10분 증가분이라 코드를 한 줄도 안 고쳤다. JaywikiSagaOrphaned 는 새로 만든 게이지 jaywiki_saga_orphaned 가 STARTED 로 10분 지난 사가를 세는 값이다.

백업 둘은 갈라서 본다 — 돌았는데 실패한 것과 아예 안 돈 것은 다른 사고다.

JaywikiBackupJobFailed 에 "1시간 안쪽" 이라는 조건이 붙은 이유가 있다. 실패한 Job 객체는 failedJobsHistoryLimit 만큼(셋) 남아 있어서 조건만 보면 며칠씩 firing 이 유지된다. 시작한 지 1시간 안쪽인 것만 보게 해서 방금 난 실패만 알리고 그 뒤에는 조용해진다. JaywikiBackupNotRunning 은 CronJob 이 통째로 멈춘 경우다 — Job 이 안 만들어지면 앞 규칙은 볼 것이 없다.

둘 다 kube-state-metrics 지표(2.19.1)라 시계열이 실제로 있는지 올린 뒤 확인했다. kube_cronjob_status_last_schedule_time 은 cronjob=jaywiki-postgres-backup 으로 있었다. 그런데 kube_job_failed 는 조회하면 비어 있다. 지표 이름이 틀린 것은 아니고(메타데이터 API 에는 있다) kube-state-metrics 가 Failed 조건이 달린 Job 에만 그 시계열을 만들기 때문이다. 성공한 Job 에는 Complete 조건만 있어서 kube_job_complete 는 다섯 개가 보이는데 kube_job_failed 는 하나도 없다.

**그래서 이 규칙은 실제로 한 번 실패하기 전까지는 검증되지 않은 상태다.**

검증되지 않은 규칙이 어떻게 틀려 있는지의 실례가 하나 나왔다.

- 예전 서식 ~~JaywikiKafkaDlqObserved 의 식은 sum(jaywiki_kafka_consumer_events_total{status="DLQ"}) > 0 이다~~
  - 2026-08-19 정정: 카운터는 줄지 않으므로 이 식은 한 번 참이 되면 파드 재시작 전까지 안 풀리고,
    3시간마다 같은 통이 온다. [DLQ 리허설](/wiki/kafka-dlq-rehearsal)에서 실제로 울려 보고 찾았다.
    식을 increase(...[10m]) > 0 으로 바꿔 description 이 원래 말하던 「지난 10분」에 맞췄다.

## 로그 규칙 하나가 trace_id 를 실어 보낸다

infra/k8s/observability/loki-rules.yaml 의 Loki ruler 에 JaywikiApiErrorLogged 하나가 있다. 10분 창에서 unhandled exception status= 와 unreadable request body status= 두 로그 줄을 정규식으로 훑어 trace_id·pod·status·method·path·route 를 뽑는다. for 0m, warning, source=loki.

식에 있는 status =~ "[45].." 는 5xx 만 고르려는 게 아니다. 정규식이 실제로 맞았는지 보는 문지기다. LogQL 의 regexp 는 안 맞아도 줄을 버리지 않고 라벨만 비운 채 통과시킨다. 이 조건을 빼면 로그 형식이 바뀌는 순간 값이 텅 빈 알림이 온다. 실제로 한 번 왔다.

이 규칙은 GlobalExceptionHandler 가 찍는 로그 형식에 묶여 있다. 그래서 GlobalExceptionHandlerTest 가 같은 정규식을 들고 있고, 형식이 어긋나면 배포 전에 테스트가 깨진다.

## 같은 사고에는 상세한 쪽 한 통만 보낸다

라우팅은 infra/k8s/observability/alertmanager-telegram-values.yaml 에 있다. group_wait 10s, group_interval 5m, repeat_interval 3h. 컨테이너에 TZ 를 Asia/Seoul 로 줘서 알림 시간이 KST 로 찍힌다 — 없으면 UTC 로 온다.

억제 규칙은 하나다. JaywikiApiErrorLogged 가 떠 있으면 JaywikiApi5xxObserved 와 JaywikiApi400Observed 를 누른다. equal 은 method·uri·status 세 라벨인데, status 까지 맞추는 이유는 같은 경로에서 400 과 500 이 함께 나면 서로 다른 사고이기 때문이다. 그래서 두 갈래가 같은 사고를 잡아도 trace_id 가 실린 로그 알림 한 통만 간다. 다만 억제가 성립하려면 두 규칙의 창 길이가 같아야 한다. 로그 쪽이 먼저 풀리면 억제가 풀려 같은 사고로 뒤늦게 한 통이 더 간다.

send_resolved 는 false 다. 해제 알림을 보내지 않는다. 규칙 식이 10분 창이라 마지막 오류에서 10분 지나면 자동으로 풀리는데, 그건 "고침"이 아니라 "새 발생 없음"일 뿐이다. 해결 여부는 사람이 판단할 일이다.

메시지 서식은 두 갈래다. uri 라벨이 있는 HTTP 오류는 서비스·pod·에러코드·경로·trace 를 구조화해 싣고, 그 밖(NodeMemoryHigh 등)은 summary·description 문장으로 낸다. 끝에 Grafana Explore 링크가 붙는다. 라우트는 receiver telegram 이 기본이고 severity=warning 하위 라우트도 같은 receiver 다. severity info 인 JaywikiKafkaDlqObserved 도 기본 receiver 로 떨어져 결국 같은 방에 온다. 알림이 실제 배달되는지 어떻게 검증했는지는 observability-telegram 에 있다.

## 서식 둘을 하나로 합쳤다

**2026-08-14 에 고친 자리다.** 그전에는 uri 라벨 유무로 갈래가 둘이었는데, 구조화 갈래가
.Annotations 를 한 글자도 안 읽었다. 규칙 파일에 한글로 써 둔 summary·description 넷
(5xx·400·403·로그)이 그래서 알림에 실린 적이 없다. **문구를 쓴 것과 그 문구가 도착하는 것은
다른 일이다.**

지금은 서식이 하나다. 제목은 [jay-wiki] 뒤에 alertname 이 붙고, 그 아래는 **라벨이 있는 줄만
그린다.** 없는 값을 빈 칸으로 내보내지 않는다 — 403 규칙은 status 라벨이 없어 「에러코드: 」
뒤가 비어 있었다.

아래 예시는 텔레그램 화면에 보이는 결과다. parse_mode 가 HTML 이라 첫 줄과 문장형의 첫 문장은 굵게 오고, 값들은 등폭 배경으로, 마지막 줄은 누르는 링크로 온다.

## 지표 갈래는 Pod 도 Trace 도 없이 온다

silent-500-alert-gap 의 그 사고가 500 이던 시절 JaywikiApi5xxObserved 로 오면 이렇다.

~~~
🚨 [오류발생] jay-wiki

• 시간: 2026-08-12 01:51:12 KST
• 서비스: jaywiki (backend)
• 에러코드: 500
• 에러경로: PUT /api/admin/blog/posts/{id}
🔗 로그 상세 확인
~~~

Pod 줄과 Trace 줄이 통째로 빠진다. 지표 규칙이 pod 로 묶지 않아 라벨이 아예 없고, trace_id 는 지표 경로에 없다. 에러경로도 실제 경로가 아니라 Spring 라우트 패턴이라 {id} 가 그대로 보인다. 즉 이 한 통으로는 **어느 글에서 났는지 모른다.**

JaywikiApi400Observed 도 글자 하나 다르지 않다. 에러코드에 400 이 찍히는 것뿐이고, 규칙 이름은 알림 어디에도 안 나오므로 받은 사람은 두 규칙 중 어느 쪽이 울렸는지 구분할 수 없다.

## 로그 갈래는 같은 사고를 값이 다 찬 채로 보낸다

같은 사고를 지금 형태(400)로 JaywikiApiErrorLogged 가 잡으면 이렇다.

~~~
🚨 [오류발생] jay-wiki

• 시간: 2026-08-12 01:51:12 KST
• 서비스: jaywiki (backend)
• Pod: jaywiki-backend-7d9c8f5b64-x2k9p
• 에러코드: 400
• 에러경로: PUT /api/admin/blog/posts/24
• Trace: 4bf92f3577b34da6a3ce929d0e0e4736
🔗 로그 상세 확인
~~~

Pod 와 Trace 가 붙고 경로가 24 처럼 실제 값이라 그대로 재현에 쓴다. 억제 규칙이 있는 이유가 이 두 예시의 차이다 — 같은 사고면 아래쪽 한 통만 간다.

## 관리자 403 알림은 에러코드 칸이 빈 채로 온다

JaywikiAdminForbiddenSustained 는 method·uri·service·namespace 로만 묶는다. status 라벨이 없는데 서식은 uri 갈래를 타므로 에러코드 줄이 빈 등폭 칸으로 온다.

~~~
🚨 [오류발생] jay-wiki

• 시간: 2026-08-13 14:02:33 KST
• 서비스: jaywiki (backend)
• 에러코드:
• 에러경로: GET /api/admin/blog/posts
🔗 로그 상세 확인
~~~

로그 규칙에 status 문지기를 세웠던 것과 같은 종류의 빈칸인데, 이쪽은 규칙이 아니라 서식과 라벨이 어긋난 것이다. 이 알림은 2026-08-13 기준 아직 한 통도 오지 않았다 — helm 을 사람이 올려야 켜지기 때문이다. 그래서 이 예시는 템플릿과 라벨을 읽어 만든 것이고 실물로 확인한 것이 아니다.

## 문장형 열하나는 [오류발생] 을 달고 오고, 굵은 줄은 아홉이 영문이다

~~~
🚨 [오류발생] jay-wiki

• 시간: 2026-08-13 09:12:04 KST
node memory usage is high
Node memory usage has been above 80% for more than 5 minutes.
🔗 로그 상세 확인
~~~

여기서 셋이 어긋난다. 메모리·디스크·재시작·DLQ 는 오류가 아닌데 제목이 [오류발생] 이고, 문장이 영문이고, 링크가 Loki Explore 인데 노드 지표에는 거기서 볼 로그가 없다. 제목과 링크는 HTTP 오류를 기준으로 만든 서식이 나머지에도 그대로 씌워진 결과다.

모양은 같고 가운데 두 줄만 갈린다. 그 두 줄이 각 규칙의 summary·description 그대로다. 백업 둘과 사가 둘, 그리고 2026-08-20 에 갈라 쓴 백엔드 둘은 한글이고, 나머지는 영문을 그대로 두고 있다. **문구가 실리는 것 자체는 서식을 합치면서 해결됐다** — 남은 것은 영문·한글이 섞여 있는 것뿐이다.

| 규칙 | 굵은 줄 / 그 아래 문장 |
|---|---|
| JaywikiBackendDown | jaywiki 백엔드 파드가 모자란다 / 가용 레플리카가 2 밑으로 2분 넘게 있었다. |
| JaywikiBackendScrapeDown | jaywiki 백엔드 지표를 못 긁는다 / 파드는 떴는데 /actuator/prometheus 스크레이프가 5분 넘게 실패했다. |
| JaywikiApiP95High | jaywiki API p95 latency is high / p95 latency has been above 500ms for more than 2 minutes. |
| JaywikiApi5xxHigh | jaywiki API 5xx ratio is high / 5xx responses are above 1% over the last 5 minutes. |
| JaywikiPodRestartHigh | jaywiki pod restart count is high / A backend or frontend container restarted more than 3 times in 15 minutes. |
| JaywikiKafkaDlqObserved | jaywiki Kafka demo sent an event to DLQ / The Kafka order demo produced at least one DLQ event in the last 10 minutes. |
| JaywikiPaymentCancelFailed | jaywiki payment cancellation failed — a payment may be left uncancelled / 보상 중 결제 취소가 실패했다. 결제가 잡힌 채 남았을 수 있다. payment-api 의 tb_payment 에서 해당 주문의 상태를 직접 확인한다. |
| JaywikiSagaOrphaned | jaywiki saga stuck in STARTED — nobody picked it up / STARTED 인 채 10분이 지난 사가가 있다. 프로세스가 호출 도중 죽은 자리다. tb_saga_instance 에서 해당 사가를 찾아 참여자 상태를 확인하고 손으로 정리한다. |
| NodeMemoryHigh | node memory usage is high / Node memory usage has been above 80% for more than 5 minutes. |
| DiskAlmostFull | node disk usage is high / A filesystem has been above 85% usage for more than 10 minutes. |
| JaywikiBackupJobFailed | 백업 Job 이 실패했다 · (Job 이름) / kubectl -n data logs job/(이름) 으로 원인을 봅니다. 다음 예정 시각은 매일 03:17 입니다. |
| JaywikiBackupNotRunning | 백업이 25시간 넘게 돌지 않았다 / CronJob data/jaywiki-postgres-backup 이 예정 시각에 Job 을 만들지 않았습니다. suspend 여부를 먼저 봅니다. |

JaywikiPodRestartHigh 는 pod 라벨을 들고 오는데도 어느 pod 인지 알림에 안 나온다. Pod 줄은 uri 갈래에만 있어서다. 문장도 "재시작이 잦다" 까지만 말하고 무엇이 재시작했는지는 안 말한다.

## 한글로 써 둔 문구 넷은 텔레그램에 실리지 않는다

JaywikiApi5xxObserved·JaywikiApi400Observed·JaywikiAdminForbiddenSustained 의 summary·description, JaywikiApiErrorLogged 의 summary 는 받은 사람이 다음에 무엇을 할지 알게 한글로 써 뒀다. 그런데 넷 다 uri 라벨이 있어 구조화 갈래를 타고, 그 갈래는 annotations 를 한 글자도 읽지 않는다.

**이것도 서식을 합치면서 닫혔다.** 예전 구조화 갈래가 .Annotations 를 안 읽어서 규칙 파일의 문구가 알림에 안 실렸다. 지금 템플릿은 summary 를 「내용」 줄로, description 을 맨 아래 줄로 싣는다.

## 규칙별로 묶어서 사고가 안 섞이게 했다

**이것도 고친 자리다.** 예전에는 route 에 group_by 가 없어 Alertmanager 기본값인 「전부 한 묶음」이
됐다. 배포 중 파드가 갈리면서 JaywikiBackendDown 과 5xx 가 같이 뜨면 한 통에 이어 붙어, 어디까지가
어느 사고인지 읽을 수 없었다.

지금은 group_by 가 [alertname, namespace] 다. 규칙별로 묶고, 같은 규칙이라도 backend 와 data 는
다른 사고이므로 네임스페이스까지 나눈다. group_interval 이 5분이라 묶음은 5분마다 갱신되고,
repeat_interval 3시간까지 안 풀리면 같은 묶음이 다시 온다.

## 열여섯째 규칙은 텔레그램이 아니라 클러스터 밖으로 나간다

Watchdog 은 조건이 없다. expr 이 vector(1) 이라 언제나 참이고 언제나 firing 이다. 2026-08-13 에 넣어 운영에 올렸다.

이것을 텔레그램으로 보내면 3시간마다 쓸모없는 통이 온다. 그래서 라벨을 severity none 으로 두고 — 텔레그램 라우트가 severity=warning 으로 걸려 있어서 warning 을 주면 그리로 샌다 — 전용 라우트를 하나 만들어 healthchecks.io 로 보낸다. Alertmanager 의 라우트는 위에서부터 먼저 맞는 하나만 타므로, 이 라우트가 severity=warning 라우트보다 앞에 있어야 한다. 순서가 뒤집히면 조용히 텔레그램으로 샌다.

| 설정 | 값 | 이유 |
|---|---|---|
| group_wait | 0s | 살아 있다는 신호는 묶어서 늦출 이유가 없다 |
| group_interval | 5m | 주기를 정하는 것은 이쪽이다 |
| repeat_interval | 1m | 5분 눈금마다 문턱을 항상 통과시키려고 낮췄다 |
| send_resolved | false | 해제될 일이 없는 알림이다 |
| url | url_file 로 읽음 | ping URL 이 그 자체로 비밀이라 values 에 못 적는다 |

repeat_interval 이 1m 인 것은 1분마다 보내겠다는 뜻이 아니다. 묶음은 group_interval 눈금에서만 깨어나고, repeat_interval 은 그 눈금에서 "보낼까"를 정하는 문턱일 뿐이다. 처음에는 둘 다 5m 으로 뒀는데 **실제 ping 이 10분마다 왔다.** 직전 통보가 눈금보다 조금 뒤에 끝나서, 다음 눈금에서 경과 시간이 5분에 간발로 못 미쳐 건너뛰고 그 다음 눈금에 보내기 때문이다. 문턱을 1m 으로 낮추자 5분 눈금마다 통과해 의도한 주기가 됐다. 이 어긋남은 healthchecks 화면의 도착 시각을 세어 보고서야 알았다.

ping URL 은 텔레그램 봇 토큰과 같은 Secret(obs/alertmanager-telegram)에 healthchecks-url 키로 넣고 /etc/alertmanager/secrets/telegram/healthchecks-url 로 읽는다. url_file 은 Alertmanager 0.26 부터 있는 기능이고 운영은 0.33 이다. 새 Secret 도 새 마운트도 만들지 않았다.

## 도착이 아니라 끊김이 신호다

healthchecks.io 쪽 check 는 Period 5분, Grace 20분이다. Grace 는 repeat_interval 보다 길어야 한다. 5분마다 오는 신호에 grace 를 5분으로 두면 한 번만 늦어도 울린다. 20분이면 두 번 연속 놓쳤을 때 울린다.

덮는 범위가 넓은 이유는 이 신호가 알림 경로를 끝까지 통과해야만 도착하기 때문이다. 규칙 평가·라우팅·receiver·바깥으로 나가는 길 중 어디가 끊겨도 ping 이 멎는다. 특히 아래 둘째 구멍의 사고 — receiver 가 아무 데도 보내지 않는 default-receiver 로 되돌아간 것 — 는 receiver 목록이 통째로 갈리는 것이라 Watchdog 라우트도 같이 사라진다. 그래서 그 사고는 이제 20분 안에 잡힌다.

판정자가 클러스터 밖에 있어야 하는 이유는 하나다. **알림 체계가 죽었다는 사실을 그 죽은 알림 체계로 알릴 수 없다.** 같은 이유로 healthchecks 쪽 알림 채널은 텔레그램이 아닌 것으로 둔다. 같은 채널에 걸면 텔레그램이 죽었을 때 그 통보도 같이 죽는다.

그래도 못 덮는 경우가 하나 남는다. webhook 은 멀쩡한데 텔레그램 자격증명만 틀어진 경우다. Watchdog 은 계속 나가므로 healthchecks 는 초록이고, 정작 사람에게 가는 통만 조용히 죽는다. 지금은 이것을 감지하지 못한다.

## 살아 있다는 것을 클러스터 안에서는 끝까지 확인할 수 없다

올리기 전에 설정 둘을 실제 바이너리로 검사했다. promtool check rules 가 규칙 13개 SUCCESS, amtool check-config 가 SUCCESS 였고, 그 다음 helm 을 dry-run 으로 한 번 렌더해 봤다. 올린 뒤에는 Prometheus 의 rules API 에 Watchdog 이 로드된 것, ALERTS 조회에서 alertstate 가 firing 이고 severity 가 none 인 것, Alertmanager 의 alerts API 에 Watchdog 이 활성인 것까지 봤다. prom 릴리스가 revision 20 에서 21 이 됐다.

**거기까지가 클러스터 안에서 볼 수 있는 전부다.** Alertmanager 는 전송 성공을 로그로 남기지 않고 오류만 찍는다. 실제로 도착했는지의 정본은 healthchecks 화면의 마지막 ping 시각이고, 그것은 바깥에 있다. 이 장치의 성격상 당연한 일이다 — 안에서 확인이 끝난다면 판정자를 밖에 둔 의미가 없다.

새 함정이 하나 생겼다. 관측 스택은 배포 파이프라인 밖이라 사람이 miniPC 에서 helm 을 올리는데, miniPC 에 저장소 체크아웃이 없어서 values 파일 둘을 miniPC 의 ~/infra/helm-values/ 로 복사해서 올렸다. 정본은 저장소인데 그 사본은 저절로 갱신되지 않는다. 다음에 규칙을 고칠 때 복사를 잊으면 옛 파일로 올라간다.

## 배포 알림은 Alertmanager 를 거치지 않는다

배포 계열 알림은 둘이다. 배포 결과가 하나, 배포가 끝난 뒤 도는 화면 검사의 실패가 하나다.

deploy.yml 마지막 스텝이 if: always() 라 성공·실패·취소가 다 온다. 롤백 스텝이 성공했으면 제목이 "배포 실패 — 이전 이미지로 되돌림" 이 된다. 본문에는 짧은 커밋 SHA 12자리, 커밋 제목 첫 줄, 실행한 사람, Actions 실행 URL 이 들어간다. 이미지 태그가 커밋 SHA 라서 SHA 하나로 지금 도는 것을 특정할 수 있다.

서식이 위 열다섯 개와 완전히 다르다. parse_mode 를 주지 않아 평문이고, 이모지도 시간 줄도 Grafana 링크도 없다.

~~~
[jay-wiki] 배포 완료
commit 47ee895d5a73 fix(guard): 훅 설정이 저장소에 안 담기던 것을 고친다
by jaymunsh
https://github.com/jaymunsh/jay-wiki/actions/runs/1234567890
~~~

첫 줄만 갈린다 — 배포 완료 / 배포 실패 / 배포 취소, 롤백이 돌았으면 "배포 실패 — 이전 이미지로 되돌림". workflow_dispatch 로 돌리면 커밋 제목이 비어 둘째 줄이 SHA 에서 끊긴다. 링크 미리보기는 꺼 두었다.

Secret 이 없으면 경고만 찍고 exit 0 으로 빠진다. 알림 실패가 배포를 실패로 만들지 않는다 — 배포는 이미 끝났고, 못 보낸 것은 못 보낸 것이다.

- 예전 서술 ~~2026-08-13 기준 이 알림은 아직 한 번도 오지 않았다. 이번에 만든 것이라 다음 배포가 첫 통이다.~~
  - 2026-08-23 갱신: 그 뒤로 배포가 마흔 번 돌았고(성공 36, 실패 4) 스텝은 매번 성공했다. 실패 넷에서도 왔다는 뜻이라 성공 경로만 검증된 것이 아니다.

## 화면 검사가 실패하면 알림만 오고 되돌리지는 않는다

배포가 끝난 뒤 GitHub 러너에서 실제 브라우저로 공개 화면을 여는 잡이 하나 더 돈다. 위키 글 본문이 그려지는지, CSS 와 JavaScript 가 하나도 실패하지 않는지, 좁은 화면에서 가로 스크롤이 생기지 않는지를 데스크톱과 모바일 두 폭에서 본다. 컨테이너가 뜨기만 하면 통과하는 readiness 로는 못 잡는 자리다.

문제는 그 잡이 deploy 잡 밖에 있다는 것이었다. 롤백 스텝도 알림 스텝도 deploy 잡 안에 있어서, 화면이 깨져도 배포 완료 알림만 가고 GitHub 을 일부러 열어 보지 않으면 몰랐다. 그래서 알림 전용 잡을 하나 더 두었다.

~~~
[jay-wiki] 배포는 끝났지만 화면 검사가 실패했다 — 되돌리지 않았다
commit 097c8e7abcde style(web): 운영 이력의 장애 항목에서 왼쪽 선을 뺀다
by jaymunsh
https://github.com/jaymunsh/jay-wiki/actions/runs/123

사람이 마저 해야 한다: 공개 화면을 직접 열어 확인하고, 깨졌으면 scripts/rollback-deployment.sh 로 되돌린다
~~~

되돌리는 것까지 기계에 맡기지 않았다. 화면 검사는 글 제목이나 문구가 바뀌어도 깨질 수 있다. 실제로 위키 제목을 다듬은 커밋 하나가 배포는 성공시키고 스모크만 깨뜨린 적이 있다. 그때 멀쩡한 배포를 기계가 되돌리는 쪽이 더 위험하다고 봤다. 되돌릴지는 알림을 받은 사람이 정한다.

이으려면 둘이 필요하다. 하나는 되돌릴 이미지 목록을 잡 밖으로 넘기는 것이다 — 롤백 스크립트는 되돌릴 대상을 스스로 알아내지 않고 배포 직전에 캡처한 파일을 읽는데, 그 파일이 deploy 잡의 RUNNER_TEMP 에 있어 잡이 끝나면 사라진다. 아티팩트로 넘기면 풀리고, 워크플로 오십 줄쯤이다.

다른 하나가 아직 없다. **이 검사가 헛울리지 않는다는 근거다.** CI 재시도 두 번은 일시적 실패만 걸러 낸다. 글 제목이 바뀌어 깨지는 종류는 세 번 다 똑같이 실패하므로 재시도로는 안 걸린다. 몇 판을 돌려 보고 헛울림이 실제로 어떤 빈도인지 본 다음에 잇는다. 한 번도 울려 보지 않은 검사에 운영을 되돌리는 권한을 먼저 주지 않는다.

알림 잡은 miniPC 러너에서 돈다. 봇 자격증명이 클러스터 Secret 이라 GitHub 러너에서는 kubectl 이 그것을 못 읽는다. self-hosted 라 실행 시간도 차감되지 않는다.

**이 경로는 아직 한 번도 울려 보지 않았다.** 기능이 깨진 이미지를 일부러 올려 검사가 잡아내는지 확인하기 전까지는, 걸려 있다는 것과 잡는다는 것이 다르다.

## 이 규칙들은 2026-08-15 부터 머지 한 번으로 나간다

**뒤집힌 문장이다.** 그 전까지는 deploy.yml 에 observability 가 한 줄도 없어 사람이 miniPC 에서
helm 을 올려야 했고, 규칙을 고쳐 머지해도 운영에서는 아무 일도 일어나지 않았다.

지금은 배포 잡이 매번 scripts/deploy-helm-observability.sh 를 돌려 관측 스택 여섯
(prom·graf·loki·tempo·promtail·otel)을 저장소 values 로 올린다. infra/k8s/** 가 배포 경로
필터에 있으므로, 알림 규칙을 고쳐 main 에 머지하는 것이 곧 반영이다.

**사람이 기억해야 하던 규칙을 스크립트가 대신 든다.** prom 은 values 두 장을 항상 같이 넘겨야
하는데 그 규칙이 RELEASES 배열에 박혀 있다. 아래 둘째 구멍이 정확히 그것을 빠뜨려 난 사고다.
예전에는 이렇게 사람이 돌렸다.

~~~bash
helm upgrade -i prom prometheus-community/prometheus --version 29.13.0 -n obs \
  -f infra/k8s/observability/prometheus-values.yaml \
  -f infra/k8s/observability/alertmanager-telegram-values.yaml
~~~

올린 뒤 라우팅까지 확인한다. receivers 가 telegram 이어야 한다.

## 다섯이던 구멍이 둘로 줄었다

첫째, 429 알림이 없다. rate limit 범위를 로그인·데모까지 넓혔는데 정상 사용자가 걸려도 아무도 모른다. 다만 NAT 뒤 다수 사용자가 정상적으로 지속 429 를 낼 수 있어, 기준선 없이는 문턱을 못 정한다. 배포 후 며칠 실측하고 정하기로 미뤘다.

- 둘째 ~~알림 자체가 죽었는지 아무도 모른다. 항상 firing 하는 watchdog 규칙이 없다.~~
  - 2026-08-13 메움: Watchdog 규칙과 healthchecks.io 로 가는 라우트를 넣고 운영에 올렸다(prom revision 21). 위 「열여섯째 규칙」 절에 있다. 사고 자체는 그대로 남는다 — Prometheus 를 텔레그램 values 없이 올려 Alertmanager receiver 가 아무 데도 보내지 않는 default-receiver 로 되돌아갔고, 규칙은 정상 firing 하는데 전달만 안 돼 화면 어디에도 티가 안 난 채 35일이었다. infra/README.md 에 기록해 두었다.

- 셋째 ~~백업 실패 알림이 없다. PostgreSQL 백업 CronJob 이 실패해도 지표 규칙에 없다.~~
  - 2026-08-13 메움: JaywikiBackupJobFailed 와 JaywikiBackupNotRunning 둘을 넣고 같은 배포로 올렸다. kube-state-metrics 가 이미 떠 있어서(JaywikiPodRestartHigh 가 그 지표를 쓴다) 새로 붙인 것은 없다. 다만 실패 쪽 규칙은 실제로 한 번 실패하기 전까지 검증되지 않는다 — 위 「지표 규칙 열넷」 절에 이유를 적었다.

- 넷째 ~~콘텐츠 동기화 Job 실패 알림이 없다. 배포 알림이 배포 전체 실패로는 잡지만 Job 단위로는 아니다.~~
  - 2026-08-13 정정: 애초에 구멍이 아니었다. sync-wiki-content-k8s.sh 가 Job 을 만들고 실패하면 exit 1 을 내므로 배포가 실패하고, 롤백이 돌고, 텔레그램이 온다. 그 Job 은 배포 중에만 도니까 배포 밖에서 실패할 자리가 없다. 세면서 잘못 넣었다.

다섯째, 인증서·도메인 만료 계열이 없다. 이건 알림으로 풀 문제가 아니라고 판단했다. Cloudflare edge 인증서는 자동 갱신이라 실제 위험이 아니고, 진짜 위험한 도메인 등록 만료는 지표에 안 나온다. 결제수단과 자동갱신 설정 쪽 문제라 blackbox exporter 를 붙여도 반쪽만 덮는다.

404 는 이 다섯과 다르다. 크롤러와 오타로 상시 발생해 소음이 되기 때문에 일부러 뺐다. 구멍이 아니라 결정이다.

## 알림 피로도는 아직 판단하지 않았다

JaywikiApi5xxObserved 와 JaywikiApi400Observed 가 for 0m 이라 한 건만 나도 온다. 이게 맞는지는 실제 수신량을 보고 정한다. 배포 알림은 마흔 번 와 봤지만 화면 검사 실패 알림은 아직 한 통도 안 와 봤다. 열다섯 개가 걸려 있다는 것과 그 열다섯 개가 적당한 양으로 온다는 것은 다른 문제고, 뒤쪽은 아직 검증 전이다.
