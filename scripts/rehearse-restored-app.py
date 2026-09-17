#!/usr/bin/env python3
"""Start Spring and a restored DB in an existing isolated MinIO network namespace.

Called by rehearse-minio-restore.py; no host ports or production connections.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import time


def verify(minio, configuration, jar, dump):
    names = [minio + suffix for suffix in ('-pg', '-redis', '-app')]
    pg, redis, app = names
    def run(*args, **kw):
        result = subprocess.run(args, capture_output=True, **kw)
        if result.returncode:
            errors = [line for line in result.stderr.decode(errors='replace').splitlines() if 'ERROR:' in line]
            raise RuntimeError('Isolated restore command failed: ' + ('; '.join(errors) or args[0]))
        return result
    def container(name, image, *args, extra=()):
        return run('docker','run','-d','--name',name,'--network','container:'+minio,*extra,image,*args)
    try:
        container(pg,'postgres:18-alpine',extra=('-e','POSTGRES_USER=portfolio','-e','POSTGRES_PASSWORD=restore-only','-e','POSTGRES_DB=portfolio'))
        deadline=time.monotonic()+90
        while subprocess.run(['docker','exec',pg,'pg_isready','-h','127.0.0.1','-U','portfolio'],capture_output=True).returncode:
            if time.monotonic()>deadline: raise RuntimeError('Restored DB did not start')
            time.sleep(1)
        with Path(dump).open('rb') as source:
            run('docker','exec','-i',pg,'pg_restore','-U','portfolio','-d','portfolio','--no-owner','--no-acl','--exit-on-error',stdin=source)
        container(redis,'redis:7.4-alpine')
        credentials=json.loads((configuration/'config.json').read_text())['aliases']['app']
        settings={
            'spring.datasource.url':'jdbc:postgresql://127.0.0.1:5432/portfolio',
            'spring.datasource.username':'portfolio','spring.datasource.password':'restore-only',
            'spring.data.redis.host':'127.0.0.1','spring.data.redis.port':6379,
            'app.minio.endpoint':'http://127.0.0.1:9000','app.minio.access-key':credentials['accessKey'],
            'app.minio.secret-key':credentials['secretKey'],'app.minio.bucket':'wiki-assets',
            'app.opensearch.enabled':False,'app.kafka-demo.enabled':False,
            'spring.kafka.listener.auto-startup':False,'spring.batch.job.enabled':False,
            'app.partner-simulator.callback-secret':'isolated-restore-only',
            'management.tracing.enabled':False}
        (configuration/'application.json').write_text(json.dumps(settings))
        # JSON config in a mounted file: production MinIO credentials never enter argv/env.
        properties='\n'.join(str(k)+'='+str(v).lower() if isinstance(v,bool) else str(k)+'='+str(v) for k,v in settings.items())
        (configuration/'application.properties').write_text(properties+'\n')
        container(app,'eclipse-temurin:21-jre-alpine','java','-Xmx512m','-jar','/app.jar','--spring.config.additional-location=file:/restore/application.properties',
                  extra=('-v',str(Path(jar).resolve())+':/app.jar:ro','-v',str(configuration)+':/restore:ro'))
        def fetch(path):
            return subprocess.run(['docker','exec',app,'wget','-qO-','http://127.0.0.1:8080'+path],capture_output=True)
        deadline=time.monotonic()+150
        while fetch('/actuator/health').returncode:
            if time.monotonic()>deadline: raise RuntimeError('Isolated Spring did not become healthy; inspect disposable app logs before removal')
            time.sleep(2)
        rows=run('docker','exec',pg,'psql','-U','portfolio','-d','portfolio','-At','-F','|','-c',
                 'select id,checksum_sha256 from tb_article_asset where deleted_at is null order by id').stdout.decode().splitlines()
        if not rows: raise RuntimeError('No live assets in restored DB')
        for row in rows:
            asset_id, checksum=row.split('|')
            response=fetch('/api/wiki-assets/'+asset_id)
            if response.returncode or hashlib.sha256(response.stdout).hexdigest()!=checksum:
                raise RuntimeError('Restored app asset proxy response differs from database checksum')
        return {'restoredSpringAssetResponses':len(rows),'allResponseHashesMatch':True,'hostPorts':0,'productionNetworkAccess':False}
    finally:
        for name in reversed(names):
            subprocess.run(['docker','rm','-fv',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
