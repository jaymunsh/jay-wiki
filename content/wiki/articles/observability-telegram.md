
- Alertmanager에서 Telegram으로 알림이 실제로 오가는지 어떻게 검증했나?
- 설정과 API 응답만으로는 부족하고, 실제 장애를 만들어 firing과 resolved를 모두 받아야 끝난다고 판단했다.
- backend replica를 1에서 0으로 내렸다가 되돌리며 Telegram 그룹에서 firing과 resolved 메시지를 직접 확인했다.

## 결론 — 최종 검증 지점은 Telegram 앱이었다

관측의 목표는 Grafana 화면을 띄우는 것이 아니라, 실제 장애를 만들었을 때 알림이 도착하고 복구되었을
때 resolved가 도착하는지까지 확인하는 것이었다. 최종 검증 지점은 코드나 API 응답이 아니라 Telegram
앱이었다.

## 왜 그렇게 했나

Prometheus가 Spring의 /actuator/prometheus를 scrape하고, Grafana에 Jaywiki RED dashboard를 붙이고,
Alertmanager에 warning severity route와 Telegram bot token/chat ID를 Secret으로 넣는 것까지는
설정만으로 끝났다. 하지만 이 설정이 실제로 알림을 배달하는지는 설정 파일을 읽는 것만으로 알 수 없었다.

Alertmanager는 전송 성공 여부를 응답이나 로그에 자세히 남기지 않는다. 그래서 최종 검증 지점을
처음부터 수신 채널인 Telegram으로 잡았다.

## 실제 구성 — replica 를 0으로 내려 실제 장애를 만들었다

먼저 Alertmanager API에 직접 테스트 알림을 넣었다(alertname: JaywikiTelegramTest, severity: warning,
source: manual). 결과는 Telegram 그룹에서 직접 확인했다.

그다음 실제 장애 리허설을 했다. backend Deployment의 replica를 1에서 0으로 잠깐 낮췄다.

~~~text
backend/jaywiki replicas: 1 -> 0
Prometheus: JaywikiBackendDown pending -> firing
Telegram: firing 수신
backend/jaywiki replicas: 0 -> 1
Telegram: resolved 수신
~~~

- 이 리허설 시점 서술 ~~복구되었을 때 resolved가 도착하는지까지 확인해야 검증이 끝난다~~
  - 2026-08-13 정정: 지금은 send_resolved가 false다. 규칙 식이 10분 창이라 마지막 오류에서 10분 지나면 자동으로 풀리는데, 그건 고쳤다는 뜻이 아니라 새 발생이 없다는 뜻일 뿐이라고 판단해 해제 알림을 껐다. 지금 오는 것과 오지 않는 것의 전체 목록은 alerting-inventory-and-gaps에 있다.

복구 후에는 공개 사이트와 게시판 BFF도 다시 확인했다.

~~~text
https://portfolio.leneu.cloud HTTP 200
/api/bff/board/posts?page=0&size=1 HTTP 200
totalElements=100000
~~~

bot token과 chat ID 값은 Kubernetes Secret에만 두고 문서나 로그에는 남기지 않았다.

## 한계 — 만든 장애는 backend 전체 다운 하나다

이 리허설은 backend 전체를 0으로 내리는 한 가지 시나리오만 만들었다. 개별 컴포넌트(예: Redis,
OpenSearch)가 죽었을 때도 같은 경로로 알림이 오는지는 아직 따로 확인하지 않았다.
