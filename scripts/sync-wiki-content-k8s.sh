#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-backend}"
GIT_SHA="${GIT_SHA:-unknown}"
SHORT_SHA="${GIT_SHA:0:12}"
JOB_NAME="jaywiki-content-sync-${SHORT_SHA,,}"
CONFIG_MAP_NAME="${JOB_NAME}-source"
SEED_FILE="${WIKI_SEED_FILE:-}"

STAGE_DIR=""

cleanup() {
  kubectl -n "${NAMESPACE}" delete job "${JOB_NAME}" --ignore-not-found --wait=false >/dev/null
  kubectl -n "${NAMESPACE}" delete configmap "${CONFIG_MAP_NAME}" --ignore-not-found >/dev/null
  [[ -n "${STAGE_DIR}" ]] && rm -rf "${STAGE_DIR}"
  return 0
}
trap cleanup EXIT

cleanup

# 시드 한 파일이 ConfigMap 한 장에 통째로 들어간다. 1MB 한도(etcd 가 값 하나에 거는 것)가
# 있어서 압축해서 넣는다. 2026-08-31 에 블로그 초안이 같은 한도에 걸려 배포가 멈춘 뒤,
# 가드가 없던 이쪽도 같은 꼴로 맞췄다. 평문 자바스크립트라 2.9배 줄어
# 816,530 바이트가 283,364 바이트가 된다.
#
# ponytail: gzip 은 그릇을 키우는 것이지 구조를 바꾸는 것이 아니다. 압축본이 다시 한도에
# 가까워지면 ConfigMap 을 그만 쓰고 MinIO 에 올려 Job 이 받아 가게 바꾼다.
# 자격증명은 배포 잡에 이미 있다.
STAGE_DIR="$(mktemp -d)"
if [[ -z "$SEED_FILE" ]]; then
  SEED_FILE="$STAGE_DIR/seed.mjs"
  node scripts/build-wiki-seed.mjs "$SEED_FILE"
fi
gzip -c "${SEED_FILE}" > "${STAGE_DIR}/seed-portfolio-wiki.mjs.gz"
bytes="$(wc -c < "${STAGE_DIR}/seed-portfolio-wiki.mjs.gz" | tr -d ' ')"
raw="$(wc -c < "${SEED_FILE}" | tr -d ' ')"
echo "위키 시드 ${raw} 바이트를 ${bytes} 바이트로 압축했다"
# 바이너리는 API 요청에서 base64 로 실려 4/3 배가 된다. 1MB 한도를 압축본 기준으로
# 되돌리면 750KB 언저리이고, 여기서 한 번 더 낮춰 잡는다.
if (( bytes > 600000 )); then
  echo "압축본이 ${bytes} 바이트다. ConfigMap 1MB 한도에 너무 가깝다 -- MinIO 경유로 바꾼다" >&2
  exit 1
fi

kubectl -n "${NAMESPACE}" create configmap "${CONFIG_MAP_NAME}" \
  --from-file="seed-portfolio-wiki.mjs.gz=${STAGE_DIR}/seed-portfolio-wiki.mjs.gz" >/dev/null

kubectl -n "${NAMESPACE}" apply -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: ${JOB_NAME}
  labels:
    app.kubernetes.io/name: jaywiki-content-sync
    app.kubernetes.io/part-of: jaywiki
spec:
  backoffLimit: 0
  activeDeadlineSeconds: 300
  template:
    metadata:
      labels:
        app.kubernetes.io/name: jaywiki-content-sync
    spec:
      restartPolicy: Never
      automountServiceAccountToken: false
      containers:
        - name: sync
          image: node:24-alpine
          imagePullPolicy: IfNotPresent
          # ConfigMap 마운트는 읽기 전용이라 압축을 푸는 자리를 따로 둔다.
          command:
            - sh
            - -c
            - mkdir -p /work && gunzip -c /sync/seed-portfolio-wiki.mjs.gz > /work/seed-portfolio-wiki.mjs && node /work/seed-portfolio-wiki.mjs --allow-remote-write
          env:
            - name: JAYWIKI_API_BASE
              value: http://jaywiki.backend.svc.cluster.local:8080
            - name: JAYWIKI_INTERNAL_SYNC_TOKEN
              valueFrom:
                secretKeyRef:
                  name: jaywiki-secrets
                  key: APP_CONTENT_SYNC_TOKEN
            - name: JAYWIKI_SYNC_EDITOR
              value: gitops:${SHORT_SHA}
          volumeMounts:
            - name: source
              mountPath: /sync
              readOnly: true
          resources:
            requests:
              cpu: 25m
              memory: 64Mi
            limits:
              cpu: 250m
              memory: 192Mi
      volumes:
        - name: source
          configMap:
            name: ${CONFIG_MAP_NAME}
EOF

deadline=$((SECONDS + 300))
while (( SECONDS < deadline )); do
  succeeded="$(kubectl -n "${NAMESPACE}" get job "${JOB_NAME}" -o jsonpath='{.status.succeeded}' 2>/dev/null || true)"
  failed="$(kubectl -n "${NAMESPACE}" get job "${JOB_NAME}" -o jsonpath='{.status.failed}' 2>/dev/null || true)"
  if [[ "${succeeded}" == "1" ]]; then
    kubectl -n "${NAMESPACE}" logs "job/${JOB_NAME}"
    exit 0
  fi
  if [[ "${failed}" == "1" ]]; then
    kubectl -n "${NAMESPACE}" logs "job/${JOB_NAME}" || true
    exit 1
  fi
  sleep 2
done

kubectl -n "${NAMESPACE}" logs "job/${JOB_NAME}" || true
echo "content sync job timed out after 300 seconds" >&2
exit 1
