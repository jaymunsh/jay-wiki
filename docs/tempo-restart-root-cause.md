# Tempo 535회 재시작 원인 분석

> 조사일: 2026-07-20
> 대상: miniPC k3s `obs/tempo-0`, Grafana Tempo 2.9.0 single-binary
> 상태: 원인 확인, 설정 변경 전
## 한 줄 결론

노드 재부팅이 535회를 만든 것이 아니다. Tempo single-binary 안에서 trace 저장과 metrics-generator를 함께 실행하면서
512MiB 메모리·500m CPU 한계를 반복해서 소진했고, 같은 `/ready` 엔드포인트를 사용하는 공격적인 liveness probe가
일시적인 응답 지연까지 장애로 판단해 약 30분마다 컨테이너를 재시작시켰다.

## 발견 계기

miniPC 재부팅 후 전체 Pod를 확인하는 과정에서 `tempo-0`만 누적 재시작 `535`회를 기록하고 있었다. 재부팅 직후의
마지막 종료는 `exit 255`, `reason=Unknown`이었으므로 처음에는 단순히 노드 재부팅 이력이 누적된 것인지 확인할 필요가 있었다.

## 배포 구성

| 항목 | 운영값 |
|---|---:|
| 이미지 | `grafana/tempo:2.9.0` |
| 실행 형태 | single-binary StatefulSet 1개 |
| trace 보존 | local PVC, 24시간 |
| metrics-generator | service-graphs + span-metrics |
| 메모리 request / limit | 192MiB / 512MiB |
| CPU request / limit | 50m / 500m |
| readiness | `/ready`, 5초 timeout, 10초 주기, 3회 실패 |
| liveness | `/ready`, 5초 timeout, 10초 주기, 3회 실패 |
| startup probe | 없음 |

metrics-generator는 trace를 읽어 RED metric과 service graph를 만들고 Prometheus로 remote-write하는 선택 기능이다.
현재 구성에서는 trace 수집·검색·compaction과 metric 생성이 한 프로세스와 같은 cgroup 한도를 공유한다.

## 확인한 증거

### 1. 재시작은 일정하게 누적됐다

Prometheus에 보존된 9일 시계열에서 restart count가 `172 → 535`로 증가했다. 증가 구간의 중앙 간격은 30분이며,
최소 2분, 최대 62분이었다. 재부팅 한 번으로 만들어진 숫자가 아니라 실행 중에도 반복된 재시작이다.

### 2. 메모리는 제한선까지 도달했다

| 지표 | 관측값 |
|---|---:|
| 설정된 limit | 536,870,912 bytes, 512MiB |
| 관측 peak | 536,551,424 bytes |
| limit 대비 | 99.94% |
| 500MiB를 넘은 과거 container series | 352개 |

대표 구간인 2026-07-19 22:25~22:32 KST에는 working set이 `127.1MiB → 511.7MiB`로 올라간 뒤
컨테이너가 교체되고 새 프로세스가 약 117MiB에서 다시 시작했다. 과거 종료 reason에는 `OOMKilled`도 남아 있었다.

### 3. CPU 한계와 probe 실패도 동시에 나타났다

CPU peak는 `0.500378 core`로 500m limit에 닿았고, CFS throttling ratio는 최대 `95.6%`였다. 같은 시간대의
Kubernetes event에는 `/ready`가 5초 안에 응답하지 못했다는 readiness·liveness timeout이 함께 기록됐다.

종료 코드 `137`은 SIGKILL을 뜻한다. 일부 주기는 cgroup OOM으로 직접 종료됐고, 일부 주기는 메모리·CPU 포화로
응답하지 못한 `/ready`를 liveness가 실패로 판단해 종료한 것으로 해석된다. 둘은 별개의 우연이 아니라 동일한 자원 포화에서
갈라진 종료 경로다.

### 4. miniPC 전체 자원 부족은 아니었다

조사 시점 노드는 CPU 6%, 메모리 39%였고 `MemoryPressure`, `DiskPressure`, `PIDPressure`가 모두 false였다.
15GiB RAM 중 약 10GiB가 사용 가능했고 swap 사용량도 0이었다. 따라서 물리 메모리 부족보다는 Tempo 컨테이너에 설정한
개별 cgroup limit가 직접 경계였다.

## 원인 판정

### 직접 원인

1. 512MiB와 500m로 제한한 single-binary에 trace 처리와 metrics-generator를 함께 배치했다.
2. 처리 순간 메모리와 CPU가 제한에 닿아 `/ready` 응답이 지연됐다.
3. readiness와 liveness가 같은 `/ready`를 같은 수준으로 검사했다.
4. 5초 timeout을 10초 간격으로 3번 실패하면 일시적인 과부하도 복구 불가능한 장애로 간주됐다.
5. 결과적으로 OOMKilled 또는 liveness SIGKILL이 발생하고, 재기동 후 같은 과정이 반복됐다.

### 아직 증명하지 않은 것

- 특정 Tempo 2.9.0 코드 결함이나 memory leak라고 단정하지 않는다.
- 400여 개 active series 자체가 과도한 cardinality라고 단정하지 않는다.
- compaction 한 번이 항상 spike를 유발한다고 단정하지 않는다.

현재 데이터가 증명하는 범위는 **운영 부하에 비해 컨테이너 한도가 작고, probe가 자원 포화에 민감해 재시작을 증폭했다**는
것까지다. Grafana 문서도 metrics-generator가 active series를 메모리에서 관리하며 limiter와 cardinality 관찰이 필요하다고
설명한다.

## 개선 순서

### P0. 불필요한 재시작부터 막는다

- liveness와 readiness의 역할을 분리한다.
- startup probe를 추가해 WAL 복구와 초기화를 기다린다.
- readiness는 트래픽 제외 판단에 사용하되 liveness는 더 긴 실패 허용 시간을 둔다.
- 권장 시작값: timeout 10초, period 15초, liveness failure threshold 6회.

### P1. 작은 홈서버에 맞게 headroom을 확보한다

- memory limit를 우선 768MiB로 올리고 peak와 재시작을 24시간 관찰한다.
- CPU limit를 750m~1 core로 올려 probe와 compaction이 throttling에 갇히지 않게 한다.
- limit만 무제한으로 키우지 않고 restart count, working set, throttling을 함께 본다.

### P2. metrics-generator 비용을 측정한다

- Tempo 자체 `/metrics`를 Prometheus scrape 대상에 추가한다.
- active series, limited series, received spans, remote-write 실패를 대시보드와 alert에 넣는다.
- 필요하면 span name과 dimension cardinality를 줄이고 `max_active_series`를 명시한다.

### P3. 변경 효과를 증명한다

| 검증 항목 | 합격 기준 |
|---|---|
| 안정성 | 24시간 restart 증가 0 |
| 메모리 | peak가 limit의 80% 이하 또는 증가 추세가 수렴 |
| CPU | sustained throttling 감소 |
| probe | liveness failure 0, readiness 일시 실패는 원인과 함께 기록 |
| 기능 | trace 조회, service graph, span metrics 유지 |

## 글로 옮길 때의 핵심 메시지

이 사례의 핵심은 단순히 메모리를 늘렸다는 데 있지 않다. `restartCount` 하나에서 출발해 종료 reason, cgroup limit,
Prometheus 과거 시계열과 probe event를 대조했고, **애플리케이션 장애와 일시적인 과부하를 같은 health endpoint로 판정하면
복구 장치가 오히려 장애를 반복할 수 있다**는 운영 판단을 얻었다.

## 참고 자료

- [Grafana Tempo metrics-generator](https://grafana.com/docs/tempo/latest/metrics-from-traces/metrics-generator/)
- [Grafana Tempo metrics-generator troubleshooting](https://grafana.com/docs/tempo/latest/troubleshooting/metrics-generator/)
- [Grafana Tempo configuration](https://grafana.com/docs/tempo/latest/configuration/)
- [Grafana Tempo issue #2908: High memory usage and occasional OOM kills](https://github.com/grafana/tempo/issues/2908)
