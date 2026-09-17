#!/usr/bin/env bash
set -euo pipefail

collection="${1:?usage: upload-publication-k8s.sh COLLECTION RELEASE_ID DIRECTORY}"
release_id="${2:?usage: upload-publication-k8s.sh COLLECTION RELEASE_ID DIRECTORY}"
source_dir="${3:?usage: upload-publication-k8s.sh COLLECTION RELEASE_ID DIRECTORY}"

if [[ ! "${collection}" =~ ^[a-z0-9][a-z0-9-]*$ || ! "${release_id}" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "collection and release id must contain lowercase letters, digits, and hyphens" >&2
  exit 1
fi
if [[ ! -f "${source_dir}/SHA256SUMS" ]]; then
  echo "${source_dir}/SHA256SUMS is required" >&2
  exit 1
fi

(
  cd "${source_dir}"
  shasum -a 256 --check SHA256SUMS
)

run_id="$(date +%s)-$$"
config_name="publication-${run_id}"
job_name="publication-upload-${run_id}"
object_prefix="publications/${collection}/${release_id}"

cleanup() {
  kubectl -n backend delete "job/${job_name}" --ignore-not-found >/dev/null
  kubectl -n backend delete "configmap/${config_name}" --ignore-not-found >/dev/null
}
trap cleanup EXIT

kubectl -n backend create configmap "${config_name}" \
  --from-file="${source_dir}" >/dev/null

cat <<EOF | kubectl apply -f - >/dev/null
apiVersion: batch/v1
kind: Job
metadata:
  name: ${job_name}
  namespace: backend
spec:
  backoffLimit: 1
  activeDeadlineSeconds: 180
  template:
    spec:
      restartPolicy: Never
      automountServiceAccountToken: false
      containers:
        - name: upload
          image: minio/mc:RELEASE.2025-04-08T15-39-49Z
          command: ["sh", "-ec"]
          args:
            - |
              mc alias set local http://minio.data.svc.cluster.local:9000 "\$MINIO_ACCESS_KEY" "\$MINIO_SECRET_KEY" >/dev/null
              target="local/wiki-assets/${object_prefix}"
              if mc stat "\${target}/SHA256SUMS" >/dev/null 2>&1; then
                mc cp "\${target}/SHA256SUMS" /tmp/existing-SHA256SUMS >/dev/null
                test "\$(sha256sum /publication/SHA256SUMS | cut -d" " -f1)" = \
                  "\$(sha256sum /tmp/existing-SHA256SUMS | cut -d" " -f1)"
                echo "Existing immutable publication matches ${object_prefix}."
              else
                mc cp --recursive /publication/ "\${target}/" >/dev/null
                echo "Uploaded immutable publication ${object_prefix}."
              fi
              mkdir -p /verify
              mc cp --recursive "\${target}/" /verify/ >/dev/null
              cd /verify
              sha256sum --check SHA256SUMS
          env:
            - name: MINIO_ACCESS_KEY
              valueFrom:
                secretKeyRef:
                  name: jaywiki-secrets
                  key: APP_MINIO_ACCESS_KEY
            - name: MINIO_SECRET_KEY
              valueFrom:
                secretKeyRef:
                  name: jaywiki-secrets
                  key: APP_MINIO_SECRET_KEY
          volumeMounts:
            - name: publication
              mountPath: /publication
              readOnly: true
      volumes:
        - name: publication
          configMap:
            name: ${config_name}
EOF

if ! kubectl -n backend wait "job/${job_name}" --for=condition=complete --timeout=4m; then
  kubectl -n backend logs "job/${job_name}" || true
  exit 1
fi

kubectl -n backend logs "job/${job_name}"
echo "Verified MinIO publication ${object_prefix}."
