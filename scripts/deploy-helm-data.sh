#!/usr/bin/env bash
# 데이터 계층 Helm 릴리스(pg·redis·minio)를 저장소의 values 로 올린다.
#
#   scripts/deploy-helm-data.sh            # 셋 다
#   scripts/deploy-helm-data.sh pg minio   # 고른 것만
#   HELM_DRY_RUN=1 scripts/deploy-helm-data.sh   # 렌더만
#
# 관측 스택(deploy-helm-observability.sh)과 같은 꼴이지만 셋이 다르다.
#
# 1. **스테이트풀이다.** 되돌리기가 관측 스택과 다르다 -- 파드가 아니라 데이터가 걸려 있다.
#    그래서 배포마다 안 돌리고, values 가 그 커밋에서 바뀐 경우에만 부른다(deploy.yml).
#
# 2. **비밀번호를 클러스터에서 읽는다.** GitHub Secrets 에 따로 두면 그 값이 실제와 어긋난
#    순간 upgrade 가 비밀번호를 갈아 버리고, 디스크의 데이터는 옛 비밀번호 그대로라
#    앱이 통째로 끊긴다. 지금 릴리스가 쓰는 Secret 을 그대로 다시 넘기면 그 사고가 안 난다.
#    (환경변수로 덮을 수는 있다 -- 정말 바꿀 때만 쓴다.)
#
# 3. **차트 버전이 지금 깔린 것과 다르면 멈춘다.** 셋 다 REVISION 1 이고 설치 후 올린 적이
#    없다. 값만 바꾸려다 차트가 메이저로 튀면 그건 다른 종류의 작업이다.
set -euo pipefail

HELM_TIMEOUT="${HELM_TIMEOUT:-15m}"
NS="${DATA_NAMESPACE:-data}"

# 릴리스:차트:버전:values 파일
RELEASES=(
  "pg:bitnami/postgresql:18.7.8:postgres-values.yaml"
  "redis:bitnami/redis:27.0.12:redis-values.yaml"
  "minio:minio/minio:5.4.0:minio-values.yaml"
)

wanted=("$@")
selected() {
  [ ${#wanted[@]} -eq 0 ] && return 0
  for w in "${wanted[@]}"; do [ "$w" = "$1" ] && return 0; done
  return 1
}

# 릴리스가 지금 쓰는 비밀번호를 그 릴리스의 Secret 에서 꺼낸다. 화면에 찍지 않는다.
secret_value() {
  local secret="$1" key="$2"
  kubectl -n "$NS" get secret "$secret" -o "jsonpath={.data.${key}}" 2>/dev/null | base64 -d
}

helm repo add bitnami https://charts.bitnami.com/bitnami >/dev/null 2>&1 || true
helm repo add minio https://charts.min.io/ >/dev/null 2>&1 || true
helm repo update bitnami minio >/dev/null

for entry in "${RELEASES[@]}"; do
  IFS=':' read -r release chart version file <<<"$entry"
  selected "$release" || continue

  path="infra/k8s/data/${file}"
  [ -f "$path" ] || { echo "values 파일이 없다: ${path}" >&2; exit 1; }

  # 지금 깔린 차트를 본다. 없으면 여기서 새로 설치하지 않는다 -- 데이터 계층을 무인으로
  # 처음 설치하는 것은 이 스크립트가 할 일이 아니다.
  installed="$(helm list -n "$NS" -f "^${release}\$" -o json | sed -n 's/.*"chart":"\([^"]*\)".*/\1/p')"
  if [ -z "$installed" ]; then
    echo "  건너뜀  ${release} — ${NS} 에 그 릴리스가 없다. 첫 설치는 사람이 한다" >&2
    exit 1
  fi
  if [ "$installed" != "${chart#*/}-${version}" ]; then
    echo "  거부    ${release} — 깔린 것은 ${installed}, 이 스크립트가 아는 것은 ${chart#*/}-${version}" >&2
    echo "          차트를 올리는 것은 값을 바꾸는 것과 다른 작업이다. 스크립트를 먼저 고친다" >&2
    exit 1
  fi

  args=(-f "$path")
  case "$release" in
    pg)
      password="${POSTGRES_PASSWORD:-$(secret_value pg-postgresql password)}"
      admin="${POSTGRES_POSTGRES_PASSWORD:-$(secret_value pg-postgresql postgres-password)}"
      [ -n "$password" ] || { echo "pg 비밀번호를 찾지 못했다(secret pg-postgresql/password)" >&2; exit 1; }
      args+=(--set "auth.password=${password}")
      [ -n "$admin" ] && args+=(--set "auth.postgresPassword=${admin}")
      ;;
    minio)
      password="${MINIO_ROOT_PASSWORD:-$(secret_value minio rootPassword)}"
      [ -n "$password" ] || { echo "minio 비밀번호를 찾지 못했다(secret minio/rootPassword)" >&2; exit 1; }
      args+=(--set "rootPassword=${password}")
      ;;
    redis)
      : # auth.enabled=false 라 넘길 비밀이 없다
      ;;
  esac

  if [ -n "${HELM_DRY_RUN:-}" ]; then
    args+=(--dry-run)
  else
    args+=(--atomic --wait --timeout "$HELM_TIMEOUT")
  fi

  echo "=== ${release} (${installed}) <- ${file}"
  helm upgrade "$release" "$chart" --version "$version" -n "$NS" "${args[@]}" >/dev/null
  helm history "$release" -n "$NS" --max 3
done
