#!/usr/bin/env bash
set -euo pipefail

collection="${1:?usage: upload-publication-local.sh COLLECTION RELEASE_ID DIRECTORY}"
release_id="${2:?usage: upload-publication-local.sh COLLECTION RELEASE_ID DIRECTORY}"
source_dir="$(cd "${3:?usage: upload-publication-local.sh COLLECTION RELEASE_ID DIRECTORY}" && pwd)"

if [[ ! "${collection}" =~ ^[a-z0-9][a-z0-9-]*$ || ! "${release_id}" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "collection and release id must contain lowercase letters, digits, and hyphens" >&2
  exit 1
fi

(
  cd "${source_dir}"
  shasum -a 256 --check SHA256SUMS
)

minio_container="${MINIO_CONTAINER:-pf-minio}"
minio_network="${MINIO_DOCKER_NETWORK:-$(docker inspect "${minio_container}" --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{end}}')}"
minio_user="${MINIO_ROOT_USER:-minioadmin}"
minio_password="${MINIO_ROOT_PASSWORD:-changeme}"
object_prefix="publications/${collection}/${release_id}"

docker run --rm --entrypoint /bin/sh \
  --network "${minio_network}" \
  -e MINIO_USER="${minio_user}" \
  -e MINIO_PASSWORD="${minio_password}" \
  -e OBJECT_PREFIX="${object_prefix}" \
  -v "${source_dir}:/publication:ro" \
  minio/mc:RELEASE.2025-04-08T15-39-49Z \
  -ec '
    mc alias set local http://'"${minio_container}"':9000 "$MINIO_USER" "$MINIO_PASSWORD" >/dev/null
    target="local/wiki-assets/${OBJECT_PREFIX}"
    if mc stat "${target}/SHA256SUMS" >/dev/null 2>&1; then
      mc cp "${target}/SHA256SUMS" /tmp/existing-SHA256SUMS >/dev/null
      test "$(sha256sum /publication/SHA256SUMS | cut -d" " -f1)" = \
        "$(sha256sum /tmp/existing-SHA256SUMS | cut -d" " -f1)"
      echo "Existing immutable publication matches ${OBJECT_PREFIX}."
    else
      mc cp --recursive /publication/ "${target}/" >/dev/null
      echo "Uploaded immutable publication ${OBJECT_PREFIX}."
    fi
    mkdir -p /verify
    mc cp --recursive "${target}/" /verify/ >/dev/null
    cd /verify
    sha256sum --check SHA256SUMS
  '
