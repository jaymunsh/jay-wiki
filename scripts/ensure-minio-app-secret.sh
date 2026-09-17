#!/usr/bin/env bash
# wiki-assets 전용 MinIO 사용자를 만들고 앱 Secret에 자격증명을 보관한다.
set -euo pipefail

APP_SECRET_NAME="${APP_SECRET_NAME:-jaywiki-secrets}"
APP_ACCESS_KEY="${APP_ACCESS_KEY:-jaywiki-wiki-assets}"
APP_POLICY_NAME="${APP_POLICY_NAME:-jaywiki-wiki-assets}"
TEMP_SECRET="jaywiki-minio-bootstrap"
TEMP_CONFIG="jaywiki-minio-policy"
TEMP_JOB="jaywiki-minio-user-bootstrap"

cleanup() {
  kubectl -n data delete job "${TEMP_JOB}" --ignore-not-found >/dev/null
  kubectl -n data delete secret "${TEMP_SECRET}" --ignore-not-found >/dev/null
  kubectl -n data delete configmap "${TEMP_CONFIG}" --ignore-not-found >/dev/null
}
trap cleanup EXIT

current_access="$(kubectl -n backend get secret "${APP_SECRET_NAME}" -o jsonpath='{.data.APP_MINIO_ACCESS_KEY}' 2>/dev/null || true)"
current_secret="$(kubectl -n backend get secret "${APP_SECRET_NAME}" -o jsonpath='{.data.APP_MINIO_SECRET_KEY}' 2>/dev/null || true)"

if [[ -z "${current_access}" || -z "${current_secret}" ]]; then
  app_secret="$(openssl rand -hex 24)"
  access_b64="$(printf '%s' "${APP_ACCESS_KEY}" | base64 | tr -d '\n')"
  secret_b64="$(printf '%s' "${app_secret}" | base64 | tr -d '\n')"
  kubectl -n backend patch secret "${APP_SECRET_NAME}" --type merge \
    -p "{\"data\":{\"APP_MINIO_ACCESS_KEY\":\"${access_b64}\",\"APP_MINIO_SECRET_KEY\":\"${secret_b64}\"}}" \
    >/dev/null
fi

app_access="$(kubectl -n backend get secret "${APP_SECRET_NAME}" -o jsonpath='{.data.APP_MINIO_ACCESS_KEY}' | base64 --decode)"
app_secret="$(kubectl -n backend get secret "${APP_SECRET_NAME}" -o jsonpath='{.data.APP_MINIO_SECRET_KEY}' | base64 --decode)"

cleanup
kubectl -n data create secret generic "${TEMP_SECRET}" \
  --from-literal=accessKey="${app_access}" \
  --from-literal=secretKey="${app_secret}" >/dev/null
# GetBucketLocation 이 없으면 업로드가 통째로 막힌다. minio-java 가 putObject 앞에서
# 버킷 위치를 먼저 묻기 때문에, PutObject 권한이 있어도 그 조회에서 AccessDenied 로 죽는다.
# 2026-09-01 에 운영 이미지 업로드가 처음부터 안 되고 있던 것을 발견하고 추가했다.
# 로컬은 root 계정을 써서 정책을 안 타므로 로컬 검증만으로는 안 잡힌다.
kubectl -n data create configmap "${TEMP_CONFIG}" --from-file=policy.json=/dev/stdin >/dev/null <<'POLICY'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
      "Resource": ["arn:aws:s3:::wiki-assets"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": ["arn:aws:s3:::wiki-assets/*"]
    }
  ]
}
POLICY

cat <<EOF | kubectl apply -f - >/dev/null
apiVersion: batch/v1
kind: Job
metadata:
  name: ${TEMP_JOB}
  namespace: data
spec:
  backoffLimit: 1
  activeDeadlineSeconds: 120
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: configure-user
          image: minio/mc:RELEASE.2025-04-08T15-39-49Z
          command: ["sh", "-ec"]
          args:
            - |
              mc alias set local http://minio.data.svc.cluster.local:9000 "\$MINIO_ROOT_USER" "\$MINIO_ROOT_PASSWORD" >/dev/null
              mc admin user add local "\$APP_ACCESS_KEY" "\$APP_SECRET_KEY" >/dev/null
              mc admin policy create local "${APP_POLICY_NAME}" /policy/policy.json >/dev/null
              mc admin policy attach local "${APP_POLICY_NAME}" --user "\$APP_ACCESS_KEY" >/dev/null
          env:
            - name: MINIO_ROOT_USER
              valueFrom:
                secretKeyRef:
                  name: minio
                  key: rootUser
            - name: MINIO_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: minio
                  key: rootPassword
            - name: APP_ACCESS_KEY
              valueFrom:
                secretKeyRef:
                  name: ${TEMP_SECRET}
                  key: accessKey
            - name: APP_SECRET_KEY
              valueFrom:
                secretKeyRef:
                  name: ${TEMP_SECRET}
                  key: secretKey
          volumeMounts:
            - name: policy
              mountPath: /policy
      volumes:
        - name: policy
          configMap:
            name: ${TEMP_CONFIG}
EOF

if ! kubectl -n data wait "job/${TEMP_JOB}" --for=condition=complete --timeout=150s; then
  kubectl -n data logs "job/${TEMP_JOB}" || true
  exit 1
fi

echo "MinIO wiki-assets application credentials are configured."
