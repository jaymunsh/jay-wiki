#!/usr/bin/env python3
"""One-time operator cutover; retains old stores and refuses existing target use."""
import argparse
import json
from pathlib import Path
import subprocess
import time

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--backend-image',required=True)
p.add_argument('--bundle',type=Path,required=True)
p.add_argument('--source-search',required=True)
p.add_argument('--target-search',required=True)
p.add_argument('--backup',type=Path,required=True)
p.add_argument('--recipient',required=True)
a=p.parse_args()
if a.backup.exists(): raise SystemExit('Refusing to overwrite rollback snapshot')
remote=['ssh','-T','-o','BatchMode=yes','miniPC']
def ssh(command, payload=None):
    return subprocess.check_output([*remote,command],input=payload)
def get(command): return json.loads(ssh(command))
d=get('kubectl -n backend get deployment jaywiki -o json')
c=next(c for c in d['spec']['template']['spec']['containers'] if c['name']=='jaywiki')
env={x['name']:x for x in c['env']}
if env.get('SPRING_DATA_REDIS_HOST',{}).get('value')!='redis-master.data.svc.cluster.local':
    raise SystemExit('Source is not the legacy Redis; this cutover must not be repeated')
replicas=d['spec'].get('replicas',1)
if replicas<1: raise SystemExit('App is already paused; investigate previous attempt first')
subprocess.run(['age','-r',a.recipient,'-o',str(a.backup)],input=json.dumps(d).encode(),check=True)
ssh('kubectl -n backend scale deployment jaywiki --replicas=0')
try:
    deadline=time.monotonic()+120
    while get('kubectl -n backend get pods -l app=jaywiki -o json')['items']:
        if time.monotonic()>deadline: raise RuntimeError('Writers did not terminate')
        time.sleep(2)
    subprocess.run(['python3','scripts/copy-opensearch-indexes.py',str(a.bundle),'--source',a.source_search,'--target',a.target_search,'--target-inactive','--checkpoint',str(a.bundle/'index-copy-checkpoint.json')],check=True)
    for kind in ('security','cache'):
        subprocess.run(['bash','scripts/security-redis-transfer.sh','--write','forward',kind],check=True)
except BaseException:
    # No target writer has been started: original data and app remain authoritative.
    ssh(f'kubectl -n backend scale deployment jaywiki --replicas={replicas}')
    raise
updates=[{'name':k,'value':v} for k,v in {
    'SPRING_DATA_REDIS_HOST':'cache-redis.data.svc.cluster.local',
    'APP_SECURITY_REDIS_HOST':'security-redis.data.svc.cluster.local',
    'APP_SECURITY_REDIS_REQUIRED':'true','APP_OPENSEARCH_URL':'https://secure-search.data.svc.cluster.local:9200',
    'APP_OPENSEARCH_SECURITY_REQUIRED':'true','APP_OPENSEARCH_CA_CERTIFICATE':'/opensearch-ca/ca.pem'}.items()]
for name,secret,key in [('SPRING_DATA_REDIS_PASSWORD','cache-redis-auth','password'),('APP_SECURITY_REDIS_PASSWORD','security-redis-auth','password'),('APP_OPENSEARCH_USERNAME','opensearch-app-auth','username'),('APP_OPENSEARCH_PASSWORD','opensearch-app-auth','password')]:
    updates.append({'name':name,'valueFrom':{'secretKeyRef':{'name':secret,'key':key}}})
patch={'spec':{'replicas':replicas,'template':{'spec':{'securityContext':{'fsGroup':10001},'containers':[{'name':'jaywiki','image':a.backend_image,'env':updates,'volumeMounts':[{'name':'opensearch-ca','mountPath':'/opensearch-ca','readOnly':True}]}],'volumes':[{'name':'opensearch-ca','secret':{'secretName':'opensearch-app-auth','defaultMode':288,'items':[{'key':'ca.pem','path':'ca.pem'}]}}]}}}}
# From this point the new security state may be authoritative. Never silently roll back
# to the legacy image/store, which could forget newly revoked sessions.
ssh('kubectl -n backend patch deployment jaywiki --type=strategic --patch-file=/dev/stdin',json.dumps(patch).encode())
print(ssh('kubectl -n backend rollout status deployment/jaywiki --timeout=300s').decode())
print('Authenticated stores connected. Verify login/logout/search before retiring old stores.')
