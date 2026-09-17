#!/usr/bin/env bash
set -euo pipefail

asset_dir=$(mktemp -d)
trap 'rm -rf "$asset_dir"' EXIT

minio_container=${MINIO_CONTAINER:-pf-minio}
minio_network=${MINIO_DOCKER_NETWORK:-$(docker inspect "$minio_container" --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{end}}')}
minio_user=${MINIO_ROOT_USER:-minioadmin}
minio_password=${MINIO_ROOT_PASSWORD:-changeme}

assets=(
  cloudflare:cloudflare
  google:google
  googlechrome:googlechrome
  opentelemetry:opentelemetry
  githubactions:githubactions
  github:github
  nextjs:nextdotjs
  spring:Spring
  fastapi:fastapi
  postgresql:postgresql
  redis:redis
  kafka:apachekafka
  kubernetes:kubernetes
  opensearch:opensearch
  minio:minio
  prometheus:prometheus
  grafana:grafana
)

for asset in "${assets[@]}"; do
  key=${asset%%:*}
  icon=${asset##*:}
  curl --fail --location --silent --show-error "https://cdn.simpleicons.org/${icon}" --output "$asset_dir/${key}.svg"
done

docker run --rm --entrypoint /bin/sh --network "$minio_network" -v "$asset_dir:/assets:ro" minio/mc:RELEASE.2025-04-08T15-39-49Z \
  -c "set -e; mc alias set local http://${minio_container}:9000 '${minio_user}' '${minio_password}' >/dev/null; mc rm --force --recursive local/wiki-assets/portfolio/stack/ >/dev/null 2>&1 || true; mc rm --force local/wiki-assets/portfolio/stack >/dev/null 2>&1 || true; for file in /assets/*.svg; do [ -f \"\$file\" ] || continue; mc cp \"\$file\" local/wiki-assets/portfolio/stack/; done"

echo "Uploaded ${#assets[@]} stack assets to wiki-assets/portfolio/stack"
