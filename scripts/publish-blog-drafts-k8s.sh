#!/usr/bin/env bash
# Send explicitly reviewed drafts over Kubernetes exec; no ConfigMap payload.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAMESPACE="${NAMESPACE:-backend}"
MANIFEST="${BLOG_PUBLISH_MANIFEST:-${ROOT_DIR}/posts/jay-blog/publish-manifest.txt}"
JOB_NAME="jaywiki-blog-publish-$(date +%s)-$$"
STAGE_DIR="$(mktemp -d)"
created=false
cleanup() {
  if [[ "$created" == true ]]; then
    kubectl -n "$NAMESPACE" delete job "$JOB_NAME" --ignore-not-found --wait=false >/dev/null || true
  fi
  rm -rf "$STAGE_DIR"
}
trap cleanup EXIT
python3 "$ROOT_DIR/scripts/build-blog-bundle.py" --manifest "$MANIFEST" \
  --draft-dir "${BLOG_DRAFT_DIR:-${ROOT_DIR}/posts/jay-blog/drafts}" --output "$STAGE_DIR/bundle.tgz"
[[ -f "$STAGE_DIR/bundle.tgz" ]] || exit 0
checksum="$(shasum -a 256 "$STAGE_DIR/bundle.tgz" | cut -d ' ' -f 1)"
kubectl -n "$NAMESPACE" create -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: ${JOB_NAME}
spec:
  backoffLimit: 0
  activeDeadlineSeconds: 300
  template:
    metadata:
      labels:
        app.kubernetes.io/name: jaywiki-blog-publish
    spec:
      restartPolicy: Never
      automountServiceAccountToken: false
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        runAsGroup: 10001
        fsGroup: 10001
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: publish
          image: node:24-alpine
          command:
            - sh
            - -ec
            - |
              while [ ! -f /work/ready ]; do sleep 1; done
              echo '${checksum}  /work/bundle.tgz' | sha256sum -c -
              tar xzf /work/bundle.tgz -C /work
              node /work/publish-blog-drafts.mjs --write
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: [ALL]
          env:
            - name: JAYWIKI_API_BASE
              value: http://jaywiki.backend.svc.cluster.local:8080
            - name: BLOG_DRAFT_DIR
              value: /work/drafts
            - name: JAYWIKI_INTERNAL_SYNC_TOKEN
              valueFrom:
                secretKeyRef:
                  name: jaywiki-secrets
                  key: APP_CONTENT_SYNC_TOKEN
          volumeMounts:
            - name: work
              mountPath: /work
          resources:
            requests:
              cpu: 25m
              memory: 64Mi
              ephemeral-storage: 64Mi
            limits:
              cpu: 250m
              memory: 192Mi
              ephemeral-storage: 128Mi
      volumes:
        - name: work
          emptyDir:
            sizeLimit: 64Mi
EOF
created=true
pod=""
deadline=$((SECONDS + 60))
while (( SECONDS < deadline )); do
  pod="$(kubectl -n "$NAMESPACE" get pods -l "job-name=$JOB_NAME" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
  [[ -n "$pod" ]] && break
  sleep 1
done
[[ -n "$pod" ]] || { echo 'Publish pod was not created' >&2; exit 1; }
kubectl -n "$NAMESPACE" wait --for=condition=Ready "pod/$pod" --timeout=60s
kubectl -n "$NAMESPACE" exec -i "$pod" -- sh -ec 'umask 077; cat > /work/bundle.tgz' < "$STAGE_DIR/bundle.tgz"
kubectl -n "$NAMESPACE" exec "$pod" -- touch /work/ready
if ! kubectl -n "$NAMESPACE" wait --for=condition=complete "job/$JOB_NAME" --timeout=300s; then
  kubectl -n "$NAMESPACE" logs "job/$JOB_NAME" || true
  exit 1
fi
kubectl -n "$NAMESPACE" logs "job/$JOB_NAME"
