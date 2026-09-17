#!/usr/bin/env bash
# Create an authenticated parallel search service; does not switch the app.
set -euo pipefail
umask 077
BUNDLE="${1:?Usage: install-secure-opensearch.sh PRIVATE_BUNDLE_DIRECTORY}"
REMOTE_HOST="${REMOTE_HOST:-miniPC}"
ssh -T -o BatchMode=yes "$REMOTE_HOST" 'for name in opensearch-node-tls opensearch-security-config; do if kubectl -n data get secret "$name" >/dev/null 2>&1; then echo "Existing search credential: refusing replacement" >&2; exit 1; fi; done; if kubectl -n backend get secret opensearch-app-auth >/dev/null 2>&1; then echo "Existing app credential: refusing replacement" >&2; exit 1; fi'
python3 - "$BUNDLE" <<'PY' | ssh -T -o BatchMode=yes "$REMOTE_HOST" 'kubectl create -f -'
import base64,json,sys
from pathlib import Path
p=Path(sys.argv[1]); items=[]
def secret(name,ns,files):
    items.append({'apiVersion':'v1','kind':'Secret','metadata':{'name':name,'namespace':ns},'type':'Opaque','data':{name:base64.b64encode(path.read_bytes()).decode() for name,path in files.items()}})
secret('opensearch-node-tls','data',{n:p/'tls'/n for n in ('ca.pem','node.pem','node-key.pem')})
secret('opensearch-security-config','data',{f.name:f for f in (p/'security').glob('*.yml')})
secret('opensearch-app-auth','backend',{'username':p/'username','password':p/'password','ca.pem':p/'tls/ca.pem'})
items.append({'apiVersion':'v1','kind':'ConfigMap','metadata':{'name':'opensearch-secure-config','namespace':'data'},'data':{'opensearch.yml':(p/'opensearch.yml').read_text()}})
print(json.dumps({'apiVersion':'v1','kind':'List','items':items}))
PY
ssh -T -o BatchMode=yes "$REMOTE_HOST" 'kubectl apply -f -' < infra/k8s/data/secure-opensearch.yaml
ssh -T -o BatchMode=yes "$REMOTE_HOST" 'kubectl -n data rollout status statefulset/secure-search --timeout=300s'
echo 'Secure search is ready; application cutover and reindex verification remain separate.'
