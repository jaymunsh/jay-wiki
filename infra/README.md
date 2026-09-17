# infra

miniPC 한 대의 k3s에 jay-wiki를 올리는 데 필요한 매니페스트와 Helm values.

## 무엇이 어디에 있나

| 경로 | 설치 방법 | 내용 |
|---|---|---|
| `k8s/00-namespaces.yaml` | `kubectl apply` | `backend`, `frontend`, `data`, `obs` |
| `k8s/backend/` | `kubectl apply` | Spring `jaywiki`, FastAPI `jaywiki-payment-api`·`jaywiki-shipping-api`, HPA, 서비스 제어 RBAC |
| `k8s/frontend/` | `kubectl apply` | Next.js `jaywiki-web` |
| `k8s/data/kafka.yaml` | `kubectl apply` | Kafka KRaft StatefulSet |
| `k8s/data/*-values.yaml` | `helm upgrade -i` | PostgreSQL, Redis, MinIO, OpenSearch |
| `k8s/observability/*-values.yaml` | `helm upgrade -i` | Prometheus, Grafana, Alertmanager, Loki, Tempo, OTel Collector, Promtail |
| `k8s/observability/alertmanager-telegram-values.yaml` | **위 파일과 함께** `-f` 두 번 | 텔레그램 알림. 혼자 올리면 안 된다 (아래 참고) |
| `k8s/backup/postgres-backup.yaml` | `kubectl apply` | 일 1회 `pg_dump` + sha256 CronJob |
| `opensearch/Dockerfile` | GitHub Actions | nori 형태소 분석기를 넣은 커스텀 이미지 |
| `local/postgres-init.sql` | docker-compose | 로컬 개발용 초기화 |

## 설치 순서

```bash
kubectl apply -f infra/k8s/00-namespaces.yaml

# 데이터 계층 — 비밀번호는 파일이 아니라 --set 으로 주입한다
helm upgrade -i pg bitnami/postgresql -n data \
  -f infra/k8s/data/postgres-values.yaml --set auth.password="${POSTGRES_PASSWORD}"
helm upgrade -i redis bitnami/redis -n data -f infra/k8s/data/redis-values.yaml
helm upgrade -i minio minio/minio -n data \
  -f infra/k8s/data/minio-values.yaml --set rootPassword="${MINIO_ROOT_PASSWORD}"
helm upgrade -i osearch opensearch/opensearch -n data -f infra/k8s/data/opensearch-values.yaml
kubectl apply -f infra/k8s/data/kafka.yaml

# Secret — 실제 값은 git 에 없다
GHCR_USERNAME=... GHCR_TOKEN=... scripts/create-ghcr-pull-secret.sh
scripts/create-postgres-backup-secret.sh
# 세 값이 다 필요하다. HEALTHCHECKS_PING_URL 은 아래 「알림이 죽으면」 참고
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... HEALTHCHECKS_PING_URL=https://hc-ping.com/... \
  scripts/create-telegram-alert-secret.sh

# 애플리케이션 — 이미지는 CI 가 SHA 태그로 교체한다
kubectl apply -f infra/k8s/backend/
kubectl apply -f infra/k8s/frontend/
kubectl apply -f infra/k8s/backup/postgres-backup.yaml
```

## 규칙

- **Secret 값은 커밋하지 않는다.** `k8s/secret.example.yaml`은 자리표시자만 담은 템플릿이고,
  실제 `secret.yaml`은 `.gitignore`로 막혀 있다. Helm values의 비밀번호도 `--set`으로 주입한다.
- **워크로드 매니페스트의 `image: ...:local`은 자리표시자다.** 실제 배포는
  `scripts/deploy-ghcr-images.sh`가 GHCR의 SHA 고정 이미지로 `kubectl set image` 한다.
  이 파일들만 `kubectl apply` 하면 존재하지 않는 `:local` 태그로 되돌아간다.
- **backend는 HPA가 평시 2, 최대 3 replicas를 유지하고 나머지 application workload는 기본 1 replica다.**
  모두 같은 miniPC 한 대에서 돌기 때문에 replica 증가는 노드 장애 고가용성을 뜻하지 않는다. PVC도 k3s
  `local-path`(단일 디스크)다. PostgreSQL 백업은 개발 머신으로 내보내 복원까지 검증했지만 두 장비가 같은
  장소에 있어 화재·도난 같은 동시 손실은 막지 못한다.

## 알아둘 것

- **Prometheus 를 올릴 때 텔레그램 values 를 같이 넣지 않으면 알림이 조용히 사라진다.**
  둘은 같은 `prom` 릴리스다. `prometheus-values.yaml` 하나만 주면 Alertmanager 의 receiver 가
  아무 데도 보내지 않는 `default-receiver` 로 되돌아간다. 규칙은 정상적으로 firing 하는데
  전달만 안 되므로 화면 어디에도 티가 나지 않는다. 실제로 35일간 그 상태였다.

  ~~~bash
  helm upgrade -i prom prometheus-community/prometheus --version 29.13.0 -n obs \
    -f infra/k8s/observability/prometheus-values.yaml \
    -f infra/k8s/observability/alertmanager-telegram-values.yaml
  ~~~

  올린 뒤에는 라우팅까지 확인한다. `receivers` 가 `telegram` 이어야 한다.

  ~~~bash
  kubectl -n obs exec prom-alertmanager-0 -c alertmanager -- \
    wget -qO- http://localhost:9093/api/v2/alerts
  ~~~

- **문구를 고쳤으면 올리기 전에 도착하는 글자를 본다.** 규칙 파일에 한글로 써 둔
  summary·description 넷이 템플릿의 다른 갈래를 타는 바람에 한 글자도 안 실린 적이 있다.
  운영과 같은 Alertmanager 이미지를 로컬에 띄우고 텔레그램 API 만 스텁으로 돌려 확인한다 —
  클러스터에 접속하지 않고 폰도 울리지 않는다.

  ~~~bash
  scripts/preview-alert-telegram.py                        # 규칙 열셋 전부
  scripts/preview-alert-telegram.py JaywikiApi5xxObserved  # 한 건만
  ~~~

- **알림이 죽으면 알림으로 알 수 없다.** 그래서 판정자가 클러스터 밖에 있다.
  조건 없이 항상 firing 하는 `Watchdog` 규칙이 5분마다 healthchecks.io 를 치고,
  그 신호가 끊기면 healthchecks 가 자기 채널로 알린다(dead man's switch).
  위 35일 사고처럼 receiver 가 통째로 되돌아가면 Watchdog 라우트도 같이 사라지므로 잡힌다.

  처음 붙일 때 사람이 하는 것은 셋이다.

  1. healthchecks.io 에서 check 를 하나 만든다. **Period 5분, Grace 20분** —
     Alertmanager 의 `repeat_interval`(5분)보다 grace 가 길어야 한 번 놓친 것으로 안 울린다
  2. 그 check 의 알림 채널을 텔레그램이 아닌 다른 것(이메일 등)으로 둔다.
     같은 채널에 걸면 텔레그램이 죽었을 때 통보도 같이 죽는다
  3. ping URL 을 Secret 에 넣는다 — 위 `create-telegram-alert-secret.sh` 에 세 값을 다 준다

  올린 뒤 실제로 도착하는지 본다. healthchecks 화면의 마지막 ping 이 5분 안쪽이어야 한다.

  ~~~bash
  kubectl -n obs logs prom-alertmanager-0 -c alertmanager | grep -i webhook
  ~~~

- **백업 알림 두 개는 kube-state-metrics 지표에 걸려 있다.** helm 을 올린 뒤 그 시계열이
  실제로 있는지 한 번 본다. 없으면 규칙이 조용히 아무것도 안 잡는다.

  ~~~bash
  kubectl -n obs exec deploy/prom-prometheus-server -c prometheus-server -- \
    wget -qO- 'http://localhost:9090/api/v1/query?query=kube_cronjob_status_last_schedule_time{namespace="data"}'
  ~~~

- 배포 파이프라인(`.github/workflows/deploy.yml`)은 `k8s/observability/**` 를 건드리지 않는다.
  정해진 매니페스트만 `kubectl apply` 하므로 Helm values 는 사람이 올린다.
- `k8s/backup/postgres-backup.yaml`의 백업 PVC는 **같은 miniPC 디스크**에 있다.
  실수 복구에는 쓸 수 있지만 디스크 장애에는 대응하지 못한다.
- 복원은 `scripts/rehearse-postgres-restore.sh`로 리허설한다. 원본 DB는 읽기만 하고,
  임시 DB에 복원해 row count를 비교한 뒤 지운다.
- 백업 CronJob의 `pg_dump` 클라이언트와 운영 PostgreSQL 서버는 모두 18 계열이다.
  client/server major version을 맞춰 복원 리허설의 재현성을 유지한다.
