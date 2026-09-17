#!/usr/bin/env bash
# 관측 스택 Helm 릴리스를 저장소의 values 로 올린다. 배포 잡이 부른다.
#
# 왜 파이프라인에 넣었나: 사람이 기억해야 하는 절차는 언젠가 반드시 빠진다.
# 실제로 alertmanager values 를 빠뜨린 채 prom 을 올려 알림이 35일 죽었다
# (silent-500-alert-gap). prom 은 values 두 장을 항상 같이 넘겨야 하는데,
# 그 규칙을 여기 박아 두면 사람이 틀릴 자리가 없어진다.
#
# 왜 안전한가: 올리기 전에 helm get values 로 운영 값을 받아 저장소 파일과 대조했다.
# graf/loki/tempo/promtail/otel 다섯은 완전히 같아 올려도 아무것도 안 바뀌고,
# prom 만 아직 안 올린 우리 변경 네 곳이 다르다 (2026-08-15 실측).
#
# 왜 이미지 캡처보다 앞에서 부르나: 뒤에 두면 여기서 난 실패가 배포 잡의 실패 조건
# 롤백을 깨워 멀쩡한 앱 이미지까지 되돌린다. 앞에 두면 앱은 아직 안 건드린 상태다.
#
# 차트 버전을 못 박는 이유: -i 는 릴리스가 없으면 설치한다. 버전을 안 주면 최신을
# 끌어와 loki 7 이 다음 메이저로 튄다. 운영에 깔린 버전을 그대로 적는다.
set -euo pipefail

HELM_TIMEOUT="${HELM_TIMEOUT:-10m}"

# 릴리스:차트:버전:values 파일들(쉼표로 겹친다. 뒤엣것이 앞을 덮는다)
RELEASES=(
  "prom:prometheus-community/prometheus:29.13.0:prometheus-values.yaml,alertmanager-telegram-values.yaml"
  "graf:grafana/grafana:10.5.15:grafana-values.yaml"
  "loki:grafana/loki:7.0.0:loki-values.yaml"
  "tempo:grafana/tempo:1.24.4:tempo-values.yaml"
  "promtail:grafana/promtail:6.17.1:promtail-values.yaml"
  "otel:open-telemetry/opentelemetry-collector:0.164.1:otel-collector-values.yaml"
)

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null 2>&1 || true
helm repo add grafana https://grafana.github.io/helm-charts >/dev/null 2>&1 || true
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts >/dev/null 2>&1 || true
helm repo update prometheus-community grafana open-telemetry >/dev/null

for entry in "${RELEASES[@]}"; do
  IFS=':' read -r release chart version files <<<"$entry"

  args=()
  IFS=',' read -ra file_list <<<"$files"
  for f in "${file_list[@]}"; do
    path="infra/k8s/observability/${f}"
    [ -f "$path" ] || { echo "values 파일이 없다: ${path}" >&2; exit 1; }
    args+=(-f "$path")
  done

  # 올리기 전에 렌더만 해 보는 길. 위키 런북(helm-releases-and-boundary)이 절차로 못 박은
  # 단계다. --dry-run 은 --atomic/--wait 과 같이 못 쓴다(기다릴 배포가 없다).
  if [ -n "${HELM_DRY_RUN:-}" ]; then
    args+=(--dry-run)
  else
    args+=(--atomic --wait --timeout "$HELM_TIMEOUT")
  fi

  echo "=== ${release} (${chart} ${version}) <- ${files}"
  helm upgrade -i "$release" "$chart" --version "$version" -n obs "${args[@]}" >/dev/null
done

# Helm 이 아니라 그냥 매니페스트라 kubectl 로 올린다. 지금 클러스터에 이미 같은 내용이
# 올라가 있다(2026-08-15 server dry-run 이 unchanged 를 냈다). 사람이 손으로 올린 것이라
# 다음에 바뀌면 또 조용히 낡는다 -- 그래서 여기로 들여온다.
kubectl apply ${HELM_DRY_RUN:+--dry-run=server} -f infra/k8s/observability/loki-rules.yaml

# 재부팅 예약 알림 CronJob. 여기 안 적으면 파일만 저장소에 있고 클러스터에는 안 간다.
kubectl apply ${HELM_DRY_RUN:+--dry-run=server} -f infra/k8s/observability/reboot-pending-notify.yaml
