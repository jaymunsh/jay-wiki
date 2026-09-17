#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="${1:?usage: prepare-local-llm-publication.sh OUTPUT_DIR}"

rm -rf "${output_dir}"
mkdir -p "${output_dir}"

cp "${root_dir}/docs/benchmarks/local-llm/2026-07-21-m1-max.json" "${output_dir}/raw.json"
cp "${root_dir}/docs/local-llm-runtime-benchmark-plan.md" "${output_dir}/plan.md"
cp "${root_dir}/docs/local-llm-runtime-benchmark-result.md" "${output_dir}/result.md"

(
  cd "${output_dir}"
  shasum -a 256 plan.md raw.json result.md > SHA256SUMS
  shasum -a 256 --check SHA256SUMS
)

echo "Prepared local-llm/2026-07-21-m1-max publication at ${output_dir}"
