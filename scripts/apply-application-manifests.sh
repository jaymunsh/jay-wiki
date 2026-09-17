#!/usr/bin/env bash
# Render the final immutable image before apply: never start a :local intermediate pod.
set -euo pipefail
apply_args=()
if [[ "${1:-}" == --dry-run ]]; then apply_args+=(--dry-run=server); fi
: "${BACKEND_IMAGE:?}" "${WEB_IMAGE:?}" "${PAYMENT_IMAGE:?}" "${SHIPPING_IMAGE:?}" "${PARTNER_IMAGE:?}"
for file in infra/k8s/backend/jaywiki{,-payment-api,-shipping-api,-partner-simulator,-hpa}.yaml infra/k8s/frontend/jaywiki-web.yaml; do
  kubectl create --dry-run=client -f "$file" -o json |
    python3 -c 'import json,os,sys
text=sys.stdin.read().strip(); decoder=json.JSONDecoder(); items=[]
while text:
 value,offset=decoder.raw_decode(text)
 items.extend(value.get("items",[value])); text=text[offset:].lstrip()
obj={"apiVersion":"v1","kind":"List","items":items}
images=dict(zip(("jaywiki","jaywiki-web","jaywiki-payment-api","jaywiki-shipping-api","jaywiki-partner-simulator"),(os.environ[k] for k in ("BACKEND_IMAGE","WEB_IMAGE","PAYMENT_IMAGE","SHIPPING_IMAGE","PARTNER_IMAGE"))))
for item in obj.get("items",[obj]):
 if item["kind"]=="Deployment":
  for container in item["spec"]["template"]["spec"]["containers"]:
   container["image"]=images[container["name"]]
json.dump(obj,sys.stdout)' | kubectl apply "${apply_args[@]}" -f -
done
