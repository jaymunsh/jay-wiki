#!/usr/bin/env bash
# Run locally. Read-only by default; --write refuses while any jaywiki app pod exists.
# The current cache Redis is unauthenticated (verified 2026-09-10); update its
# password Secret reference here when cache authentication is enabled.
set -euo pipefail
REMOTE_HOST="${REMOTE_HOST:-miniPC}"
mode="${1:---inventory}"
direction="${2:-forward}"
kind="${3:-security}"
[[ "$kind" == security || "$kind" == cache ]] || exit 2
[[ "$kind" != cache || "$direction" == forward ]] || exit 2
[[ "$mode" == --inventory || "$mode" == --write ]] || exit 2
[[ "$direction" == forward || "$direction" == reverse ]] || exit 2
pod="security-redis-transfer-$(date -u +%Y%m%d%H%M%S)-$$"
cleanup() { ssh -T -o BatchMode=yes "$REMOTE_HOST" "kubectl -n backend delete pod $pod --ignore-not-found --wait=true --timeout=60s" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cat <<YAML | ssh -T -o BatchMode=yes "$REMOTE_HOST" 'kubectl create -f -'
apiVersion: v1
kind: Pod
metadata:
  name: $pod
  namespace: backend
  labels: {app: jaywiki}
spec:
  # Share only the NetworkPolicy identity, never enter the app Service endpoints.
  readinessGates:
    - conditionType: security.jaywiki/never-serve-traffic
  terminationGracePeriodSeconds: 1
  restartPolicy: Never
  activeDeadlineSeconds: 600
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    runAsUser: 10001
    runAsGroup: 10001
    fsGroup: 10001
    seccompProfile: {type: RuntimeDefault}
  containers:
    - name: transfer
      image: python:3.13-alpine
      command: [sleep, '600']
      securityContext: {readOnlyRootFilesystem: true, allowPrivilegeEscalation: false, capabilities: {drop: [ALL]}}
      resources:
        requests: {cpu: 25m, memory: 32Mi}
        limits: {cpu: 200m, memory: 256Mi}
      volumeMounts:
        - {name: scripts, mountPath: /scripts}
        - {name: credentials, mountPath: /credentials, readOnly: true}
  volumes:
    - name: scripts
      emptyDir: {}
    - name: credentials
      secret: {secretName: $kind-redis-auth, defaultMode: 0440}
YAML
ssh -T -o BatchMode=yes "$REMOTE_HOST" "kubectl -n backend wait --for=jsonpath='{.status.phase}'=Running pod/$pod --timeout=120s"
if [[ "$mode" == --write ]]; then
  # Existing app pods must be gone, not merely unready. Recheck immediately before copying.
  ssh -T -o BatchMode=yes "$REMOTE_HOST" "kubectl -n backend get deployment jaywiki -o json" |
    python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["spec"].get("replicas",1)==0, "Scale app writers to zero before migration"'
  ssh -T -o BatchMode=yes "$REMOTE_HOST" "kubectl -n backend get pods -l app=jaywiki -o json" |
    python3 -c 'import json,sys; d=json.load(sys.stdin); assert all(p["metadata"]["name"]==sys.argv[1] for p in d["items"]), "App pods still exist"' "$pod"
fi
if [[ "$direction" == forward ]]; then
  source=redis-master.data.svc.cluster.local
  target=$kind-redis.data.svc.cluster.local
  credential=TARGET_PASSWORD_FILE
else
  source=security-redis.data.svc.cluster.local
  target=redis-master.data.svc.cluster.local
  credential=SOURCE_PASSWORD_FILE
fi
flags=""
[[ "$mode" == --write ]] && flags="--write --writers-stopped"
if [[ "$kind" == cache ]]; then
  [[ "$mode" == --write ]] || { echo 'Cache transfer requires --write and stopped writers' >&2; exit 2; }
  for file in migrate-security-redis.py migrate-cache-redis.py; do
    ssh -T -o BatchMode=yes "$REMOTE_HOST" "kubectl -n backend exec -i $pod -- sh -c 'cat > /scripts/$file'" < "$(dirname "$0")/$file"
  done
  ssh -T -o BatchMode=yes "$REMOTE_HOST" "kubectl -n backend exec $pod -- env TARGET_PASSWORD_FILE=/credentials/password python /scripts/migrate-cache-redis.py --source-host $source --target-host $target --writers-stopped"
  exit
fi
ssh -T -o BatchMode=yes "$REMOTE_HOST" "kubectl -n backend exec -i $pod -- env $credential=/credentials/password python - --source-host $source --target-host $target $flags" < "$(dirname "$0")/migrate-security-redis.py"
