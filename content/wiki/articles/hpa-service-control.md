
- HPA 스케일 아웃과 서비스 제어판이 실제로 동작하는지, 임계값은 적절한지 어떻게 확인했나?
- CPU 60% 기준은 평시 과민 확장 우려가 있어 실측 후 80%로 올렸고, 제어판은 OpenSearch 하나로 범위를 좁혔다.
- infra/k8s/backend/jaywiki-hpa.yaml의 averageUtilization 80과 최근 6시간 CPU 평균 26m/p95 73m/최대 518m을 확인했다.

## 결론 — 기준을 80%로 올리고 제어판 대상은 좁혔다

backend HPA는 CPU 60%가 아니라 80%를 기준으로 스케일 아웃한다. 서비스 제어판은 OpenSearch
StatefulSet 하나만 0/1 replica로 켜고 끄고, HPA 스케일 아웃 자체는 시나리오 화면의 리허설
패널이 부하 Job을 만들어 앱 안에서 재현한다(패널은 공개, 시작·취소는 관리자만).

## 왜 그렇게 했나

운영 하이라이트의 목표는 두 가지였다. 부하가 올라가면 backend가 1개에서 2개로 자동으로 늘어나는 것,
그리고 관리자 페이지에서 안전한 대상만 0/1 replica로 켜고 끌 수 있는 것.

backend Deployment에 HPA를 처음 붙였을 때 기준은 CPU 60%였다. 배포 rollout 부하로 실제 확장은
확인됐다.

~~~text
Deployment/jaywiki cpu: 129%/60%
backend replicas: 1 -> 2
ready: 2/2
~~~

동작 자체는 문제가 없었다. 다만 rollout 같은 순간 부하와 평시 트래픽은 다르다. 평시에도 60%가
안전한 기준인지 확인이 필요했다.

최근 6시간 CPU 사용량을 실측하니 평균 26m, p95 73m, 최대 518m(millicores)였다. 평시 사용량이
이렇게 낮은 상태에서 target이 60%면, request 대비 백분율이 작은 변동에도 쉽게 흔들려 평시에도
과민하게 확장될 여지가 있었다. rollout 같은 진짜 부하(129%)를 잡아내는 데는 60%든 80%든 차이가
없었고, 오히려 평시 노이즈를 걸러내는 쪽이 더 중요했다.

그래서 기준을 80%로 올렸다.

## 실제 구성 — scaleUp 즉시, scaleDown 5분 안정화다

~~~text
infra/k8s/backend/jaywiki-hpa.yaml
minReplicas: 2   (2026-08-19 이전에는 1)
maxReplicas: 3   (2026-08-19 이전에는 2)
metric: CPU 80%
scaleUp stabilizationWindowSeconds: 0
scaleDown stabilizationWindowSeconds: 300
~~~

scaleUp은 안정화 없이 즉시 반응하게 두고, scaleDown만 5분 안정화 창을 둬서 부하가 줄자마자 바로
줄어들지 않게 했다.

### 서비스 제어판 — OpenSearch 하나로 범위를 좁혔다

제어판은 위험한 기능이므로 범위를 좁혔다. 앱 본체를 끄면 다시 켤 API도 사라질 수 있으므로,
0/1 토글 대상은 OpenSearch StatefulSet 하나로 제한했다.

~~~text
key: opensearch
namespace: data
kind: StatefulSet
name: portfolio-search-master
allowed replicas: 0..1
~~~

이 대상의 RBAC는 Role jaywiki-scale-opensearch로, statefulsets/scale의 get·patch·update만
허용한다(infra/k8s/backend/jaywiki-control-rbac.yaml). create·delete·list 같은 넓은 권한은
OpenSearch 대상에는 주지 않았다.

관리자 로그인 쿠키로 실제 운영 URL에서 요청한 결과다.

~~~text
/admin/services HTTP 200
OpenSearch: 0 -> 1 -> 0
최종 상태: opensearch=0/0
~~~

### HPA 스케일 아웃 리허설 — 부하 Job과 CPU 그래프를 앱 안에 만들었다

OpenSearch 토글과 별개로, HPA 스케일 아웃 자체를 시연하려면 부하를 걸고 결과를 보여줄 화면이
필요했다. 같은 ServiceAccount jaywiki-control-panel에 backend 네임스페이스 Role
jaywiki-hpa-rehearsal을 추가로 붙였다. 이 Role은 batch/jobs의 create·get·list·delete와
horizontalpodautoscalers·deployments·pods·pods/log·metrics.k8s.io/pods의 조회를 허용한다
(infra/k8s/backend/jaywiki-control-rbac.yaml).

백엔드는 HpaRehearsalController·HpaRehearsalService·KubernetesHpaRehearsalGateway로 이어진다.
시작 요청이 오면 부하 Job을 생성하고, Redis에 실행 상태를 기록하며, 이후 조회 요청마다 HPA와
Pod 상태를 다시 읽어 상태를 갱신한다.

프런트는 web/src/app/scenarios/HpaRehearsalPanel.tsx다. 상태는 IDLE → STARTING → LOADING →
SCALED_OUT → STABILIZING → COMPLETED 순서로 바뀌고, 진행 중에는 2초 간격으로 폴링하며 CPU
사용률 표본을 그래프로 쌓아 보여준다.

### 부하가 무엇인지 — 셸 워커가 검색 API를 180초 때린다

LIVE 배지는 "실제 인프라가 동작한다"고 말한다. 그 부하가 무엇인지는 코드에만 있었다.
정의는 KubernetesHpaRehearsalGateway가 만드는 Job 매니페스트 안에 있다.

| 값 | 무엇 |
|---|---|
| 이미지 | curlimages/curl:8.11.1 |
| 동시 워커 | 셸 백그라운드 프로세스. 화면에서 2·4·8·12·16 중 고른다(기본 8) |
| 지속 | 180초. Job은 activeDeadlineSeconds 210으로 따로 막는다 |
| 대상 | http://jaywiki:8080/api/board/search?q=샘플 |
| 부하 파드 자원 | requests cpu 20m / limits cpu 500m, memory 64Mi |

각 워커는 대기 없이 while 루프로 요청을 던진다. 끝나면 Job은 ttlSecondsAfterFinished 300으로
스스로 사라지고, backoffLimit 0이라 실패해도 재시도가 몰리지 않는다.

**대상을 게시판 검색으로 고른 것은 의도적이다.** 정적 응답을 때리면 CPU가 안 올라 스케일 아웃
조건에 닿지 않는다. 이 API는 OpenSearch를 거치므로 요청마다 실제 계산이 붙는다.

**부하를 주는 쪽도 한도를 걸었다.** limits cpu 500m이 없으면 부하 파드가 노드 자원을 먹고,
그러면 backend의 CPU 사용률이 부하 때문인지 이웃 때문인지 갈리지 않는다. 재는 쪽이 재는 대상을
오염시키지 않게 하는 장치다.

**클러스터 안에서 서비스 이름으로 직접 부른다.** Cloudflare와 Traefik을 안 거치므로 앞단
구간이 결과에 섞이지 않는다. 대신 그 앞단이 병목일 가능성은 이 리허설로 알 수 없다.

## 한계 — 리허설 부하는 실제 트래픽이 아니다

80% 기준은 지금 트래픽 규모에서의 판단이라, 사용자가 늘어나면 다시 재는 것으로 남겨 뒀다. 리허설
패널이 만드는 부하는 Job 하나가 주는 인위적인 부하이지, 실제 사용자 트래픽 패턴을 재현하지는
않는다. 그래도 스케일 아웃이 실제로 일어나는지, CPU가 어떻게 움직이는지를 화면에서 직접
확인할 수 있게 됐다.

**이 하네스가 못 재던 것이 셋이었다.** 스케일 아웃이 일어나는 것은 보여주면서, 보낸 건수를
안 셌고 응답 시간을 안 쟀고 부하량을 조절할 수 없었다. 그래서 "얼마나 버티나"에 답을 못 했다.

## 재는 일을 부하 Job 자신에게 맡겼다

셋을 채우면서 **재는 자리를 클러스터가 아니라 요청을 보내는 쪽에 뒀다.** 워커는 요청마다 HTTP
코드와 소요 시간을 한 줄씩 파일에 적고, awk가 그것을 합쳐 JAYWIKI_LOAD 한 줄로 찍는다. 백엔드는
그 파드의 로그에서 마지막 한 줄만 읽는다.

| 값 | 무엇 |
|---|---|
| workers | 이번 실행의 동시 워커 수 |
| requests | 보낸 요청 수 |
| failed | 200이 아닌 응답과 연결 실패의 합 |
| avgMs | 성공한 요청의 평균 응답 시간 |
| maxMs | 가장 느렸던 요청 |

**집계는 파드가 하고 백엔드는 한 줄만 읽는다.** 요청 하나에 한 줄씩 그대로 올리면 3분에 수만 줄이
쌓이고, 2초마다 폴링하는 화면이 그것을 매번 내려받게 된다.

**10초마다 한 번씩 찍는다.** 끝날 때 한 번만 찍으면 180초 동안 화면이 빈 채로 있게 된다.

**Job은 끝나고 300초면 스스로 사라진다.** 그래서 백엔드는 읽히는 동안 집계를 Redis로 옮겨 두고,
파드가 사라진 뒤에는 옮겨 둔 값을 돌려준다. 안 옮기면 기준선이 5분만 살아 있다.

**부하량은 화면에서 고르지만 상한은 서버가 정한다.** 화면은 2·4·8·12·16을 내놓고, 백엔드가
1~16으로 다시 가둔다. 화면이 보내는 값을 그대로 믿으면 관리자 계정 하나가 노드를 밀어붙일 수 있다.

이제 트래픽 폭주 시나리오의 모형 값들이 실측 기준선을 갖는다.
