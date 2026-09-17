---
title: "증상을 바로 고치지 않고 가설과 증거로 원인을 좁힌 방법"
slug: hypothesis-driven-debugging-loop
tab: "개발 방식·AI"
parentId: development-process
sortOrder: 3
kind: wiki
tags: development-process,debugging,hypothesis,evidence,observability,regression
source: scripts/seed-portfolio-wiki.mjs
---
- 처음 떠오른 원인에 바로 코드를 맞추지 않고, 반증 가능한 가설과 측정으로 장애 원인을 좁히는 절차다.
- 증상마다 최소 세 가지 가설을 세우고, 가설끼리 결과가 달라지는 측정을 골라 원인을 확정하거나 보류하기로 판단했다.
- Tempo restart count가 9일 동안 172에서 535로 늘어난 사례에서 working set peak과 memory limit, OOMKilled reason, node pressure를 같은 시간축에서 비교해 단순 재부팅 가설을 제외했다.

운영 문제는 같은 화면이라도 원인이 다를 수 있다. CSS가 깨져 보이는 현상은 stylesheet 자체, cache, 서로 다른 Pod의 image, hydration이나
브라우저 상태에서 생길 수 있다. Pod 재시작도 OOM, probe, 노드 압박과 수동 rollout으로 원인이 갈린다.
그래서 이 글은 해결한 문제를 나열하는 대신 **반증 가능한 가설과 측정으로 범위를 줄이는 절차**를 정리한다.
같은 절차로 재현하고 회귀 검증할 수 있어야 트러블슈팅이 개인의 감각에서 팀의 자산으로 바뀐다.

## 가설 셋을 측정 하나로 가르는 절차다

~~~mermaid
flowchart TD
  Symptom[관측된 증상] --> Facts[시간·환경·재현 조건 고정]
  Facts --> H1[가설 A]
  Facts --> H2[가설 B]
  Facts --> H3[가설 C]
  H1 --> Experiment[가설을 구분하는 측정]
  H2 --> Experiment
  H3 --> Experiment
  Experiment --> Cause[원인 확정 또는 보류]
  Cause --> Reproduce[실패 재현]
  Reproduce --> Fix[최소 수정]
  Fix --> Regression[같은 조건으로 회귀 검증]
  Regression --> Record[증거·한계·다음 관측 기록]
~~~

### 1. 증상과 해석을 분리한다

“서버가 불안정하다”는 해석이다. “Tempo restart count가 9일 동안 172에서 535로 늘었고 중앙 간격이 약 30분이다”가 사실이다.
스크린샷, HTTP status, Pod reason, metric 범위와 발생 시각을 먼저 고정한다.

### 2. 최소 세 가지 가설을 세운다

한 가설만 있으면 모든 로그가 그 가설을 지지하는 것처럼 보인다.

| 사건 | 구분한 가설 |
|---|---|
| Tempo 반복 재시작 | 노드 재부팅 누적, Memory OOM, CPU throttling과 liveness timeout |
| HPA 1→2 반복 | 실제 방문 트래픽, rollout startup CPU, 낮은 request 대비 utilization 계산 |
| 운영 CSS 간헐적 깨짐 | CDN cache, 서로 다른 image revision, stylesheet load 실패, hydration |
| Cloudflare seed timeout | 인증 실패, IPv4·IPv6 연결 경쟁, public BFF 응답 지연 |

### 3. 가설끼리 결과가 달라지는 측정을 고른다

Tempo 사례에서는 restart count만 보지 않았다. container working set peak와 memory limit, OOMKilled reason, CPU limit과 throttling,
node pressure, probe 주기와 timeout을 같은 시간축에서 비교했다. 노드 pressure가 없고 memory가 limit의 거의 100%에 도달한 기록이 있어
단순 재부팅 가설을 제외할 수 있었다.

HPA도 Pod 수만 보면 실제 트래픽처럼 보인다. 최근 CPU 분포, request 기준 utilization과 rollout 시각을 비교해 평시 workload보다 startup
부하가 확장을 자주 일으킨다는 판단 근거를 만들었다.

### 4. 고치기 전에 실패 조건을 보존한다

간헐적 문제는 수정 뒤 다시 나타나지 않았다는 이유만으로 해결됐다고 말하기 쉽다. 가능하면 자동 테스트, 고정 입력, metric query나 screenshot으로
실패 조건을 남긴다. 재현이 완전하지 않으면 원인을 확정했다고 쓰지 않고 가장 가능성 높은 가설과 미확인 범위를 구분한다.

### 5. 최소 수정 뒤 같은 관측으로 비교한다

수정 검증은 새 기능이 동작한다는 확인과 다르다. 변경 전 증상을 잡은 동일한 viewport, request, 시간 범위와 metric으로 비교한다.

- UI는 같은 1280px·390px에서 overflow와 console error를 다시 확인한다.
- backend는 실패·정상 요청과 status, service interaction을 함께 확인한다.
- 배포는 rollout만 보지 않고 public smoke와 직전 image rollback 경계를 확인한다.
- 자원 설정은 순간 정상보다 충분한 관측 기간의 restart·throttling·latency를 본다.

## 실패했던 접근도 기록한다

가설이 틀렸거나 수정이 효과가 없었던 사실은 낭비가 아니다. 무엇을 배제했는지 남기면 다음 사람이 같은 실험을 반복하지 않는다.
다만 로그 전체를 복사하지 않고 판단에 사용한 시각, query, 결과와 결론을 연결한다.

## 한계 — miniPC 하나는 production 규모가 아니다

단일 miniPC 환경은 production 규모를 대표하지 않는다. 트래픽과 장애 주입도 실제 고객 환경과 다르다. 이 글의 가치는 특정 수치의 일반화가 아니라,
제한된 환경에서도 사실·가설·측정·결론을 구분했다는 데 있다.

정답을 처음부터 알았다고 설명하기보다 어떤 후보를 세웠고, 어떤 증거가 후보를 제거했으며, 같은 문제가 돌아오지 않도록 무엇을 남겼는지
말하는 편이 실제 문제 해결 과정을 더 정확하게 보여준다.
