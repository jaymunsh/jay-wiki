#!/usr/bin/env bash
# Encrypted IAM and bucket configuration export; complements object backups.
set -euo pipefail
umask 077
OUT="${1:?Usage: pull-minio-config.sh NEW_OUTPUT_DIRECTORY AGE_RECIPIENT}"
RECIPIENT="${2:?age public recipient is required}"
REMOTE_HOST="${REMOTE_HOST:-miniPC}"
[[ ! -e "$OUT" ]] || { echo 'Refusing to overwrite an existing backup.' >&2; exit 1; }
mkdir -p "$OUT"
pod="jaywiki-minio-config-$(date -u +%Y%m%d%H%M%S)-$$"
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
      args: ['cd /objects; mc --config-dir /config admin cluster iam export source >/dev/null && mc --config-dir /config admin cluster bucket export source >/dev/null && mc --config-dir /config admin config export source > server-config.txt && mc --config-dir /config ls --versions --recursive --json source > versions.jsonl && touch /objects/.complete; sleep 1100']
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
ssh -T -o BatchMode=yes "$REMOTE_HOST" "kubectl -n data exec $pod -c export -- sh -ec 'i=0; until test -f /objects/.complete; do i=\$((i+1)); test \$i -lt 180; sleep 2; done; tar cf - -C /objects .'" | age -r "$RECIPIENT" -o "$OUT/config.tar.age.partial"
mv "$OUT/config.tar.age.partial" "$OUT/config.tar.age"
(cd "$OUT" && shasum -a 256 config.tar.age > config.tar.age.sha256)
printf 'Completed UTC: %s\nIAM, bucket and server configuration; object bytes are backed up separately.\n' "$(date -u +%FT%TZ)" > "$OUT/backup-info.txt"
echo 'Encrypted MinIO configuration downloaded; verify ZIP integrity and isolated import.'
