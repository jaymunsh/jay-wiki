#!/usr/bin/env bash
# Logical current-object export, independent of MinIO's internal xl.meta format.
# Does not include historical versions, IAM users, or bucket policies.
set -euo pipefail
umask 077
OUT="${1:?Usage: pull-minio-objects.sh NEW_OUTPUT_DIRECTORY}"
REMOTE_HOST="${REMOTE_HOST:-miniPC}"
[[ ! -e "$OUT" ]] || { echo 'Refusing to overwrite an existing backup.' >&2; exit 1; }
mkdir -p "$OUT"
pod="jaywiki-object-backup-$(date -u +%Y%m%d%H%M%S)-$$"
cleanup() { ssh -T -o BatchMode=yes "$REMOTE_HOST" "kubectl -n data delete pod $pod --ignore-not-found --wait=false" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cat <<YAML | ssh -T -o BatchMode=yes "$REMOTE_HOST" 'kubectl create -f -'
apiVersion: v1
kind: Pod
metadata:
  name: $pod
  namespace: data
spec:
  restartPolicy: Never
  activeDeadlineSeconds: 1200
  automountServiceAccountToken: false
  securityContext:
    runAsNonRoot: true
    runAsUser: 10001
    runAsGroup: 10001
    fsGroup: 10001
    seccompProfile: {type: RuntimeDefault}
  initContainers:
    - name: config
      image: python:3.13-alpine
      command: [python, -c]
      args:
        - |
          import json, pathlib
          p=pathlib.Path('/credentials')
          pathlib.Path('/config/config.json').write_text(json.dumps({'version':'10','aliases':{'source':{'url':'http://minio.data.svc.cluster.local:9000','accessKey':(p/'rootUser').read_text(),'secretKey':(p/'rootPassword').read_text(),'api':'S3v4','path':'auto'}}}))
      securityContext: {allowPrivilegeEscalation: false, capabilities: {drop: [ALL]}}
      volumeMounts:
        - {name: credentials, mountPath: /credentials, readOnly: true}
        - {name: config, mountPath: /config}
  containers:
    - name: mirror
      image: minio/mc:RELEASE.2025-04-08T15-39-49Z
      command: [sh, -ec]
      args: ['mc --config-dir /config mirror --quiet source /objects && touch /objects/.complete; sleep 1100']
      securityContext: {allowPrivilegeEscalation: false, capabilities: {drop: [ALL]}}
      resources:
        requests: {cpu: 25m, memory: 64Mi}
        limits: {cpu: 300m, memory: 256Mi}
      volumeMounts:
        - {name: config, mountPath: /config}
        - {name: objects, mountPath: /objects}
    - name: export
      image: postgres:18-alpine
      command: [sh, -c, 'sleep 1100']
      securityContext: {readOnlyRootFilesystem: true, allowPrivilegeEscalation: false, capabilities: {drop: [ALL]}}
      resources:
        requests: {cpu: 10m, memory: 16Mi}
        limits: {cpu: 100m, memory: 64Mi}
      volumeMounts:
        - {name: objects, mountPath: /objects, readOnly: true}
  volumes:
    - name: credentials
      secret: {secretName: minio, defaultMode: 0440}
    - name: config
      emptyDir: {medium: Memory, sizeLimit: 1Mi}
    - name: objects
      emptyDir: {sizeLimit: 5Gi}
YAML
ssh -T -o BatchMode=yes "$REMOTE_HOST" "kubectl -n data wait --for=condition=Ready pod/$pod --timeout=180s"
ssh -T -o BatchMode=yes "$REMOTE_HOST" "kubectl -n data exec $pod -c export -- sh -ec 'i=0; until test -f /objects/.complete; do i=\$((i+1)); test \$i -lt 180; sleep 2; done; tar cf - -C /objects .'" > "$OUT/objects.tar.partial"
mv "$OUT/objects.tar.partial" "$OUT/objects.tar"
(cd "$OUT" && shasum -a 256 objects.tar > objects.tar.sha256)
printf 'Completed UTC: %s\nLatest objects only; historical versions, policies and IAM are separate. Live mirror is not an atomic snapshot.\n' "$(date -u +%FT%TZ)" > "$OUT/backup-info.txt"
echo 'Logical object archive downloaded; restoration must be verified separately.'
