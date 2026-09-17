
- 이 저장소에서 Helm 은 무엇을 맡고 있고, 그중 어디까지가 배포 파이프라인 밖인가?
- 릴리스 열둘 가운데 아홉을 파이프라인이 올린다 — 관측 여섯은 매 배포마다, 데이터 셋은 values 가 바뀐 판에만. 사람 몫으로 남은 것은 kube-system 둘과 첫 설치뿐이다.
- helm list -A 로 릴리스 열둘과 리비전(prom 22, osearch 67)을 셌고, 2026-08-13 밤에 두 번 올린 것(리비전 21, 22)이 그 절차를 그대로 밟은 실례다.

## 이 저장소에는 나가는 길이 둘이다

배포는 develop 을 main 에 머지하는 행동 하나로 좁혀 두었다. 그 규칙은 deploy-rules-and-harness 에 있다. 처음 이 글을 쓸 때는 **머지로 나가지 않는 것이 따로** 있었다 — 관측 스택과 데이터 계층은 Helm 이고 파이프라인이 Helm 을 부르지 않았다.

**그 경계가 2026-08-15 와 08-16 에 옮겨졌다.** 지금은 배포 잡이 관측 스택 여섯을 매 배포마다 올리고, 데이터 계층 셋은 values 가 그 커밋에서 바뀐 판에만 올린다. 알림 규칙이나 대시보드를 고쳐 main 에 머지하면 그대로 반영된다.

경계가 사라진 것은 아니다. **자리가 바뀌었을 뿐이다.** 어디까지가 자동이고 어디부터가 사람 몫인지는 여전히 알아야 하고, 그 최신 판은 deploy-automation-boundary 에 있다.

## Helm 은 남이 만든 매니페스트를 값으로 덮어쓰는 도구다

Prometheus 하나를 띄우는 데도 Deployment·Service·ConfigMap·RBAC 이 줄줄이 따라온다. 그것을 직접 쓰는 대신 남이 만들어 둔 묶음을 가져와 필요한 값만 바꿔 쓴다. 말이 넷 나온다.

| 말 | 뜻 |
|---|---|
| 차트 | 매니페스트 묶음의 원본. prometheus-community/prometheus 같은 것 |
| 릴리스 | 그 차트를 클러스터에 설치한 한 벌. 이름을 붙인다(prom, graf) |
| 리비전 | 릴리스를 올릴 때마다 하나씩 느는 번호 |
| values | 차트 기본값을 덮어쓰는 설정 파일 |

이 저장소에서 values 는 전부 저장소 안에 있다. infra/k8s/observability 에 여덟 장, infra/k8s/data 에 네 장이다. **차트는 남의 것이고 values 만 우리 것**이라고 보면 맞다.

## 차트 버전은 그 안에 든 소프트웨어 버전이 아니다

둘을 섞으면 근거로 못 쓴다. 실제로 이렇게 갈린다.

| 차트 | 실제로 깔리는 것 |
|---|---|
| prometheus-29.13.0 | Prometheus v3.12.0 |
| postgresql-18.7.8 | PostgreSQL 18.4.0 |
| grafana-10.5.15 | Grafana 12.3.1 |

숫자가 비슷해 보이는 postgresql 쪽이 특히 헷갈린다. 18.7.8 은 차트 버전이고 데이터베이스는 18.4.0 이다.

## 릴리스 열둘 중 둘은 사람이 만든 것이 아니다

helm list -A 로 세면 열둘이다. obs 에 여섯(graf, loki, otel, prom, promtail, tempo), data 에 넷(pg, redis, minio, osearch), kube-system 에 둘(traefik, traefik-crd)이다. 마지막 둘은 k3s 가 설치한 것이라 사람이 손댈 일이 없다.

리비전은 릴리스마다 따로 는다. 지금 prom 이 22, osearch 가 67 이고 minio·pg·redis·promtail·traefik 은 1 이다. **리비전이 크다는 것은 그만큼 자주 올렸다는 뜻**이고, osearch 의 67 과 pg 의 1 이 그 차이를 그대로 보여준다.

- 예전 서술 ~~릴리스 열둘 가운데 파이프라인이 건드리는 것은 하나도 없다~~ / ~~리비전이 크다는 것은 그만큼 자주 만졌다는 뜻~~
  - 2026-08-15 정정: osearch 는 사람이 올리는 릴리스가 아니다. 배포 잡이 scripts/deploy-opensearch-image.sh 로 helm upgrade -i osearch 를 매 배포마다 친다. 리비전 67 은 사람의 손자국이 아니라 배포 횟수다. 나머지 열하나가 파이프라인 밖이라는 서술은 그대로 맞다. 경계를 다시 그은 기록은 deploy-automation-boundary 에 있다.

## values 를 겹칠 때 빠뜨린 장은 조용히 기본값으로 되돌아간다

-f 는 여러 번 줄 수 있고 뒤에 온 것이 앞을 덮는다. prom 릴리스는 두 장을 겹쳐 올린다.

~~~bash
helm upgrade -i prom prometheus-community/prometheus --version 29.13.0 -n obs \
  -f infra/k8s/observability/prometheus-values.yaml \
  -f infra/k8s/observability/alertmanager-telegram-values.yaml
~~~

여기서 이 저장소가 가장 크게 데었다. **한 장만 주고 올리면 나머지가 차트 기본값으로 되돌아간다.** 실제로 텔레그램 values 를 빠뜨려 Alertmanager 의 receiver 가 아무 데도 보내지 않는 default-receiver 가 됐고, 규칙은 정상 firing 하는데 전달만 죽은 채 35일이 지났다. 어느 화면에도 티가 나지 않았다. 그 사고는 silent-500-alert-gap 에 있다.

-i 는 릴리스가 없으면 설치하고 있으면 갱신한다. 그리고 비밀번호는 values 에 적지 않고 --set 으로 준다.

## 올리기 전에 실제 바이너리로 검사하고 한 번 렌더해 본다

2026-08-13 밤에 알림 규칙 셋을 추가해 리비전 21 이 됐고, 그중 한 값을 고쳐 리비전 22 가 됐다. 두 번 다 같은 순서를 밟았다.

1. 도커로 실제 바이너리를 받아 검사한다. promtool check rules 가 그 파일의 규칙 전부 SUCCESS(2026-08-19 기준 15개), amtool check-config 가 SUCCESS 여야 한다
2. helm 을 --dry-run 으로 한 번 렌더해 새 설정이 실제로 들어갔는지 눈으로 본다
3. 올린다
4. 돌고 있는 것에서 확인한다. 저장소의 파일이 아니라 클러스터가 들고 있는 설정을 본다

**설정 파일은 문법이 맞아도 뜻이 틀릴 수 있다.** 1번은 문법만 보고, 뜻이 맞는지는 4번에서야 드러난다. 실제로 리비전 22 는 21 에서 뜻이 틀린 값 하나를 고친 것이다.

되돌릴 때는 helm history 로 리비전 목록을 보고 helm rollback 을 쓴다. 애플리케이션 배포의 롤백이 이미지 캡처 기반인 것과 달리, 이쪽은 Helm 이 리비전을 들고 있어서 그대로 쓸 수 있다.

## miniPC 사본이 저장소보다 낡을 수 있다

한계가 하나 있고, 이번에 새로 생겼다. **miniPC 에는 이 저장소의 체크아웃이 없다.** 그래서 values 파일을 miniPC 의 ~/infra/helm-values 로 복사해서 올렸다. 그 디렉터리에는 2026-06-27 자 opensearch.yaml 과 postgres.yaml 도 있다.

정본은 저장소인데 그 사본은 저절로 갱신되지 않는다. 다음에 규칙을 고치면서 복사를 잊으면 옛 파일로 올라가고, 그때도 helm 은 성공했다고 말한다. 위의 35일 침묵과 같은 종류의 실패다 — 명령이 성공하는데 결과만 틀리는 것.
