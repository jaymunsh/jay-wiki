
- 롤백 스크립트는 만들어 두고 운영에서 한 번도 돌려 본 적이 없었다. 뜨지 않는 이미지로 일부러 깨뜨려 태워 봤다.
- 새 파드만 ImagePullBackOff 로 멈추고 옛 파드 둘은 계속 받았다. 롤백은 아홉 초에 끝났고, 공개 주소를 1초 간격으로 친 66회가 전부 200 이었다.
- 2026-08-19 11:04:50 에 없는 태그로 바꾸고 11:05:49 에 복구했다. 다섯 Deployment 가 전부 배포 전 이미지로 돌아갔다.

[배포 규칙](/wiki/deploy-rules-and-harness)에 「실패하면 캡처한 이미지로 되돌린다」고 적어 뒀지만,
그 스크립트가 운영에서 실제로 돈 적은 없었다. 워크플로의 자동 롤백 경로는 2026-08-16 배포 실패에서
한 번 탔는데, 그건 스텝 실패 경로였고 **파드가 안 뜨는 경우는 아니었다.**

## 무엇을 깨뜨렸나

존재하지 않는 태그로 이미지를 바꿨다. 지어낸 태그라 GHCR 에 없다.

~~~bash
kubectl -n backend set image deploy/jaywiki   jaywiki=ghcr.io/jaymunsh/jay-wiki-backend:does-not-exist-20260819
~~~

45초 뒤 상태다.

| 파드 | 상태 |
|---|---|
| 새로 뜬 파드 | ImagePullBackOff |
| 옛 파드 | Ready |
| 옛 파드 | Ready |

이벤트에는 not found 가 그대로 찍혔다 — failed to resolve reference, ErrImagePull, 그다음 BackOff.

## maxUnavailable 0이 옛 파드를 지켰다

RollingUpdate 의 두 값이 여기서 일한다. replicas 2 에 maxSurge 25% 는 새 파드 하나,
maxUnavailable 25% 는 **내릴 수 있는 옛 파드 0개**다. 새 파드가 Ready 가 돼야 옛 파드를
내리는데, 그 파드는 이미지를 못 받아 영원히 Ready 가 안 된다. **그래서 아무것도 안 내려간다.**

배포가 멈춘 것이 아니라 **멈춰 있는 것이 안전한 상태**다. 이 경우 클러스터는 사람이 올 때까지
옛 버전으로 서비스를 계속한다.

## 공개 화면은 한 번도 안 죽었다

깨뜨리기 전부터 복구 뒤까지 공개 API 를 1초 간격으로 쳤다.

| | |
|---|---|
| 구간 | 11:04:19 ~ 11:06:08 |
| 요청 | 66회 |
| 200 | **66회** |
| 실패 | **0회** |

[무중단 배포 글](/wiki/zero-downtime-on-one-machine)에 「공개 주소가 응답했다는 관찰이지 실패
0건이라는 측정이 아니다」라고 적어 둔 빈칸이 이걸로 채워진다. 다만 채워진 것은 **이 실패
모드 하나**다 — 아래 한계에 적는다.

## 롤백은 9초에 끝났다

배포 전 이미지는 파일로 캡처해 둔다. revision 을 못 쓰는 이유는 [배포 규칙](/wiki/deploy-rules-and-harness)에 있다.

~~~bash
scripts/capture-deployment-images.sh /tmp/rb.tsv          # 다섯 줄이 남는다
ROLLBACK_STATE_FILE=/tmp/rb.tsv scripts/rollback-deployment.sh
~~~

11:05:40 에 시작해 11:05:49 에 끝났다. 다섯 Deployment 를 전부 되돌리고, rollout 을 기다리고,
스크립트 자신이 공개 주소를 쳐서 rollback verified 를 찍는 것까지 **9초**다.

백엔드만 되돌리는 것이 아니라 **캡처 파일에 든 다섯 줄을 전부** 되돌린다. 나머지 넷은 이미
같은 이미지였으므로 rollout 이 즉시 끝났다.

## 한계 — 안 뜨는 실패 하나만 잰 실험이다

- 이건 **새 이미지가 안 뜨는** 실패다. 뜬 뒤에 잘못 도는 실패는 이 실험이 안 잡는다.
  readinessProbe 가 /actuator/health 만 보기 때문에, 기동은 되고 기능이 깨진 이미지는 통과한다
  - 2026-08-20 갱신: **프로브로 잡을 일이 아니었다.** 어떤 헬스 체크도 「떴는데 코드가 틀렸다」는
    못 본다. 그 자리를 지키는 것은 배포 잡의 공개 스모크 일곱이고, 실패하면 이미지 캡처 파일로
    자동 롤백이 돈다. 프로브에 더 시킬 것이 아니라 스모크에 더 넣을 것이다
  - 대신 프로브 쪽에서 다른 것이 나왔다. **liveness 가 집계 health 를 보고 있었다** —
    DB 나 Redis 가 잠깐 죽으면 health 가 DOWN 이 되고 쿠버네티스가 멀쩡한 백엔드 파드를
    전부 죽인다. 바깥 장애가 안쪽 재시작으로 번지는 자리다. [tempo 가 /ready 를 liveness 로
    써서 2042회 재시작한 것](/wiki/kafka-dlq-rehearsal)과 같은 병이고, 이쪽은 아직 안 터졌을
    뿐이다. /actuator/health/liveness 로 바꿨다 — Boot 의 LivenessState 만 보므로 재시작이
    실제로 답인 경우와 일치한다. **readiness 는 그대로 뒀다.** DB 가 죽으면 그 파드는 요청을
    못 받으니 Service 에서 빠지는 것이 맞다
  - payment-api·shipping-api 는 처음부터 /health/live 와 /health/ready 로 갈라져 있었고,
    partner-simulator 의 /health/ready 는 의존성을 안 보는 정적 응답이라 liveness 로 써도
    무해하다. 웹은 getTabs 가 실패를 삼켜 백엔드가 죽어도 화면이 뜬다. **전수로 확인했다**
- 실패 0건은 **파드가 둘일 때의 값**이다. 하나였다면 maxUnavailable 0 이 여전히 옛 파드를
  지켰겠지만, 그 판은 이번에 안 재봤다
- 사람이 손으로 깨뜨리고 손으로 되돌렸다. 워크플로가 이 경로를 자동으로 타는지는
  배포 중에 이미지가 사라지는 상황이라야 나온다 — 만들기 어려운 조건이라 미뤄 둔다
