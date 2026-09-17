#!/usr/bin/env python3
"""Administrator operation: install scoped runner credentials without local plaintext."""
import base64
import json
import subprocess
import time

REMOTE = ['ssh', '-T', '-o', 'BatchMode=yes', 'miniPC']
secret = {'apiVersion':'v1','kind':'Secret','metadata':{'name':'application-deployer-token','namespace':'delivery','annotations':{'kubernetes.io/service-account.name':'application-deployer'}},'type':'kubernetes.io/service-account-token'}
subprocess.run([*REMOTE,'kubectl apply -f -'],input=json.dumps(secret).encode(),check=True,stdout=subprocess.DEVNULL)
for attempt in range(20):
    obj = json.loads(subprocess.check_output([*REMOTE,'kubectl -n delivery get secret application-deployer-token -o json']))
    if obj.get('data',{}).get('token'):
        break
    time.sleep(1)
else:
    raise RuntimeError('Service account token controller did not populate credentials')
config = {'apiVersion':'v1','kind':'Config','clusters':[{'name':'jaywiki','cluster':{'server':'https://127.0.0.1:6443','certificate-authority-data':obj['data']['ca.crt']}}], 'users':[{'name':'application-deployer','user':{'token':base64.b64decode(obj['data']['token']).decode()}}], 'contexts':[{'name':'deployment','context':{'cluster':'jaywiki','user':'application-deployer','namespace':'backend'}}], 'current-context':'deployment'}
program = "import os,pwd,sys; p='/opt/jaywiki-runner/.kube/config'; u=pwd.getpwnam('jaywiki-runner'); fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_TRUNC|os.O_NOFOLLOW,0o600); os.fchmod(fd,0o600); os.fchown(fd,u.pw_uid,u.pw_gid); f=os.fdopen(fd,'wb'); f.write(sys.stdin.buffer.read()); f.close()"
import shlex
command = 'kubectl -n kube-system exec -i jaywiki-host-operations-20260910 -- chroot /host /usr/bin/python3 -c ' + shlex.quote(program)
subprocess.run([*REMOTE,command],input=json.dumps(config).encode(),check=True)
print('Scoped kubeconfig installed only in the separate runner home (0600).')
