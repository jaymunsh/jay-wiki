# 백업 완성도 — 되살릴 수 있는 것과, 알고도 안 한 것

백업 Phase A 는 끝나 있다. `jaywiki-postgres-backup` CronJob 이 매일 03:17 에 dump 를 만들고,
sha256 을 붙이고, `scripts/rehearse-postgres-restore.sh` 로 임시 DB 복원까지 해봤다.
남은 문장은 위키 `postgres-backup-restore` 의 마지막 줄 그대로다 —
**「복원은 해봤고, 박스 밖으로 내보내는 일이 남았다.」**

이 문서는 그 "밖으로" 를 어디까지 할지, 그리고 **알고도 안 할 것**을 무엇으로 정할지의 설계다.
계획 원본은 위키 `backup-r2-phase-b-plan` 이고, 그 글이 정한 목적지(Cloudflare R2)를
이 문서에서 **바꾼다.** 바꾸는 이유도 아래에 적는다.

## 실측 — 지금 무엇이 있고 얼마나 되나

숫자는 전부 2026-08-16 에 운영에서 직접 잰 값이다. 추정이 아니다.

| 데이터 | 크기 | 지금 백업 | 잃으면 |
|---|---|---|---|
| PostgreSQL `portfolio` | DB 88MB, **dump 2.4MB** | **한다** (매일 03:17, PVC 7일) | 위키 71편·revision·게시판·댓글·계정. **원본** |
| PostgreSQL `postgres` | 7.6MB | 안 한다 | 없다. 시스템 DB |
| MinIO `wiki-assets` | **564K** (tar 812K) | 안 한다 | 지금은 없다. 아래 주석 참고 |
| MinIO `backups`·`batch-output` | 각 4K, 비어 있음 | 안 한다 | 없다 |
| OpenSearch | PVC 15Gi | 안 한다 | PostgreSQL 에서 재색인하면 돌아온다 |
| Redis | PVC 2Gi | 안 한다 | 캐시. 재생성된다 |
| Kafka | PVC 5Gi | 안 한다 | 데모 이벤트. 원본이 아니다 |
| Grafana 대시보드 | PVC 2Gi | 안 한다 | 정본이 `infra/k8s/observability/grafana-values.yaml:88` 에 있다. 재배포로 복구 |
| Prometheus·Loki·Tempo | PVC 8+5+4Gi | 안 한다 | 과거 지표·로그. **되살릴 수 없다.** 관측 데이터라 허용한다 |
| k8s Secret | — | 안 한다 | 이 문서의 범위 밖. 아래 「알고도 하지 않은 것」 |

`wiki-assets` 안을 실제로 열어 보니 `portfolio/stack/*.svg`(저장소에서 업로드)와
`publications/`(스크립트가 생성) 둘뿐이었다. **`articles/{assetId}/original.*` 은 0개다** —
사람이 업로드한 이미지가 아직 없다. 즉 지금 이 버킷은 전부 재생성 가능하다.

그런데도 받기로 했다. 이미지 업로드 기능은 이미 켜져 있어서(`docs/wiki-image-upload-implementation.md`)
글 하나만 쓰면 재생성 불가능한 파일이 생긴다. **"지금 비어 있으니 빼자" 는 판단은 그때 조용히
틀린다.** 812K 를 그냥 같이 받는 쪽이 조건 분기보다 싸다.

## 결정 1 — 반영할 때 로컬로 당긴다. 스케줄러를 만들지 않는다

### 목적지를 R2 에서 맥북으로 바꾼다

`backup-r2-phase-b-plan` 은 Cloudflare R2 를 목적지로 정했다. 용량은 문제가 아니다 —
30일치가 72MB 라 무료 한도 10GB 의 0.7% 다. 걸린 것은 **R2 활성화에 결제 수단 등록이 필요하다**는
점 하나고, 지금 그것을 하지 않기로 했다.

| 후보 | 판단 |
|---|---|
| 맥북 로컬 | **채택.** 계정 0개, 토큰 0개, 새 인프라 0개. miniPC 디스크 사망을 막는다 |
| Cloudflare R2 | 보류. 카드 등록. **스크립트가 목적지만 바꾸면 되게 짜 둔다** |
| Google Drive (rclone) | 기각. OAuth refresh token 을 Secret 에 넣어야 하고, 미검증 앱 토큰이 만료되면 **조용히 멈춘다.** 2.4MB 옮기자고 질 짐이 아니다 |
| iCloud/Drive 동기 폴더 | 보류. 목적지 경로만 바꾸면 되므로 언제든 켤 수 있다 |

맥북 로컬이 R2 보다 약한 지점은 정확히 둘이고, 숨기지 않고 문서에 적는다 —
**같은 집이라 화재·도난은 못 막는다**, 그리고 **사본이 반영할 때만 늘어난다**(바로 아래).

### 스케줄러를 만들지 않는다

launchd 야간 잡을 검토했다가 뺐다. 새 장치가 하나 늘고, 그 장치가 실패하는 것을 알아챌
두 번째 장치가 또 필요해진다. 대신 **이미 코드에 있는 "반영" 시점**에 붙인다.

운영에 글이 써지는 길은 둘뿐이다.

| 반영 | 어디서 도나 | 로컬 백업을 붙이는 법 |
|---|---|---|
| `/sync` 의 publish (위키·블로그) | 맥북(dev 서버) | `snapshotProduction` 안에서 같이 받는다 — **자동** |
| 배포(`develop` → `main`) | miniPC 러너 | 러너가 맥북에 못 쓴다. `deploying` 체크리스트에 명령 한 줄 — **사람** |

`snapshotProduction`(`scripts/content-ops.mjs:83`)은 `publish-wiki`·`publish-blog`·`publish-all`
셋이 전부 부르는 자리다. **여기 한 곳만 고치면 쓰기 경로 전부가 덮인다.**

### 이 선택의 한계 — RPO 가 시간이 아니라 행동이다

사본은 **반영할 때만** 늘어난다. 위키·블로그는 반영이 곧 변경이라 잘 맞는다.
문제는 **사용자가 만드는 데이터**다 — 게시판 글, 댓글, 조회수는 반영과 무관하게 늘어나므로
로컬 사본은 그만큼 낡는다. 그쪽은 miniPC CronJob(하루 1회)이 잡지만 밖으로는 안 나간다.

| 데이터 | miniPC 안 RPO | 맥북 사본 RPO |
|---|---|---|
| 위키·블로그 본문 | 24시간 | 마지막 반영 시점 (사실상 동일) |
| 게시판·댓글·계정 | 24시간 | **마지막 반영 시점. 며칠일 수 있다** |

이 표를 위키 글에 그대로 싣는다. 감추면 약점이 되고, 적으면 판단이 된다.

### `scripts/pull-prod-backup.sh`

```
scripts/pull-prod-backup.sh <출력 디렉터리>
```

`.local-backups/<시각>/` 에 세 파일을 남긴다.

| 파일 | 내용 |
|---|---|
| `portfolio.dump` | `pg_dump --format=custom` (2.4MB) |
| `portfolio.dump.sha256` | 맥북에서 계산 |
| `wiki-assets.tar` | MinIO `wiki-assets` 버킷 디렉터리 (812K) |

**2026-08-17 이후로 dump 가 둘이다.** 결제 데이터가 `pg-services` 로 갈리면서
`payment.dump` + `payment.dump.sha256` 이 늘었다 (`docs/2026-08-17-msa-data-ownership-design.md` 결정 2).
운영 CronJob 도 같이 둘을 뜬다 — 한쪽만 뜨면 나머지는 조용히 안 남는다.

환경변수 둘로 목적지·경로를 뺀다. R2 로 갈아탈 때 고칠 곳이 한 곳이 되도록 **받는 것과 두는 곳을
분리**한다 — 스크립트는 파일 셋을 디렉터리에 만들 뿐이고, 그 디렉터리를 어디에 두는지는 부르는 쪽이 정한다.

```bash
MINIPC_SSH="-i ~/.ssh/id_ed25519_minipc jaymunsh@192.168.0.82"   # 기본값
```

### 실측으로 정해진 두 가지

**하나. PVC 파일을 복사하지 않고 새 dump 를 뜬다.**
백업 PVC 는 백업 Job 파드만 마운트한다. 꺼내려면 임시 파드 + `kubectl cp` 가 필요하고,
k3s 호스트 경로(`/var/lib/rancher/k3s/storage/...`)는 root 소유인데 **miniPC 는 `sudo` 가
비밀번호를 물어 못 쓴다.** 그래서 스트림으로 새로 뜬다.

```bash
ssh -T $MINIPC_SSH 'kubectl -n data exec -i pg-postgresql-0 -- \
  env PGPASSWORD="$(kubectl -n data get secret jaywiki-db-backup -o jsonpath={.data.PGPASSWORD} | base64 -d)" \
  pg_dump -U portfolio --format=custom portfolio' > "$OUT/portfolio.dump"
```

TTY 를 붙이면 바이너리가 깨진다. `ssh -T`, `kubectl exec` 에 `-t` 금지.

**둘. MinIO 는 파드에서 못 뽑는다. 임시 파드를 띄운다.**
MinIO 이미지에는 `tar` 도 `find` 도 `grep` 도 없다(실제로 셋 다 `executable file not found`).
그래서 같은 PVC 를 **읽기 전용**으로 마운트하는 임시 파드를 띄워 tar 를 stdout 으로 흘린다.
이미지는 이미 노드에 캐시된 `postgres:18-alpine` 을 쓴다 — 새로 당기지 않는다.

```bash
ssh -T $MINIPC_SSH 'kubectl -n data run assets-pull-$$ --rm -i --restart=Never \
  --image=postgres:18-alpine --overrides='"'"'{...volumeMounts: /export ← pvc/minio (readOnly)...}'"'"' \
  -- tar cf - -C /export wiki-assets' > "$OUT/wiki-assets.tar"
```

이 방식은 2026-08-16 에 실제로 돌려 812K tar 를 받고 목록까지 확인했다. RWO PVC 지만 단일 노드라
MinIO 파드와 동시에 마운트된다. **읽기 전용이라 MinIO 쪽에 영향이 없다.**

받은 tar 는 파일 그대로가 아니라 **MinIO 내부 레이아웃(`xl.meta`)** 이다. 즉 이 tar 는
같은 MinIO 에 되돌리는 용도지, 이미지 파일을 꺼내 보는 용도가 아니다. 이 제약도 문서에 적는다.

### 리허설이 잡아낸 것 — `CREATE ROLE portfolio` 가 먼저다

받은 사본을 docker 임시 DB 에 처음 부었더니 **오류 43건**이 났다. 전부
`ALTER ... OWNER TO portfolio` 였고, 원인은 임시 DB 에 `portfolio` 역할이 없는 것이었다.
데이터는 다 들어갔지만 **되살아난 것과 깨끗하게 되살아난 것은 다르다** — 진짜 사고 때
이 43줄을 보면서 "이게 정상인가" 를 판단해야 했을 것이다.

역할을 먼저 만들고 다시 부으니 오류 0. 그 순서를 `scripts/rehearse-local-restore.sh` 에 굳혔다.
리허설은 이런 것을 잡으려고 한다.

### 무결성 확인 — 맥북에는 `pg_restore` 가 없다

`which pg_restore` → 없다. Postgres 클라이언트를 새로 깔지 않고, **이미 돌고 있는 docker** 를 쓴다.

```bash
docker run --rm -v "$OUT":/b postgres:18-alpine pg_restore -l /b/portfolio.dump > /dev/null
```

잘린 파일이면 여기서 죽는다. 목록이 읽히면 아카이브 구조가 온전하다는 뜻이다.
sha256 은 같은 파일을 두 번 읽어 비교하는 용도라 **전송 중 손상**만 잡는다 —
둘은 잡는 것이 다르므로 **둘 다 한다.**

### 실패했을 때 — 반영을 막지 않는다

집 밖에서는 LAN ssh 가 안 붙는다. 그때 글 반영이 막히면 안 된다.
`snapshotProduction` 은 이미 운영 글 JSON 사본을 받고 있고 그것만으로도 되돌릴 자리는 있다.

- 실패하면 **경고 한 줄을 화면에 남기고 계속한다.**
- 실패해도 그 반영에서 만들어진 `.local-backups/<시각>/` 디렉터리는 그대로 둔다.
  파일이 없다는 것 자체가 "그때 못 받았다" 는 기록이다.

### 보관

`.local-backups/` 는 `.gitignore:54` 로 이미 제외돼 있다. 30일 지난 디렉터리를 지운다.
30일이면 약 72MB + tar 24MB 다.

## 결정 2 — 백업 실패 알림을 일부러 실패시켜 확인한다

`JaywikiBackupJobFailed`(`infra/k8s/observability/prometheus-values.yaml:231`)는 한 번도
불린 적이 없다. **울린 적 없는 알림은 있는 것이 아니다.**

```yaml
# 이름을 진짜 백업과 섞지 않는다. jaywiki-postgres-backup-* 접두어를 쓰지 않는다.
kubectl -n data create job jaywiki-backup-failtest-<stamp> --image=postgres:18-alpine -- sh -c 'exit 1'
```

- 규칙은 `kube_job_failed{namespace="data"}` 와 「시작 1시간 안쪽」만 본다.
  이름을 안 보므로 이 Job 도 그대로 걸린다.
- 확인할 것: **텔레그램에 실제로 도착하는 문구**. 규칙에 쓴 한글 summary/description 이
  Alertmanager 템플릿을 타고 그대로 실리는지까지 본다(`scripts/preview-alert-telegram.py` 가
  같은 것을 로컬에서 보는 도구다 — 이번엔 진짜 경로로 확인한다).
- `send_resolved: false` 라 해제 통은 안 온다. **1시간 뒤 조용해지는 것**까지 확인하고 Job 을 지운다.
- 운영 데이터는 건드리지 않는다. `backoffLimit: 0` 으로 한 번만 실패시킨다

### 결과 — 2026-08-16 19:51, 처음으로 실제로 울렸다

| 시각 | |
|---|---|
| 19:51:16 | 실패 Job 생성 |
| 19:51:21 | Job `Failed` (4초) |
| 19:52:02 | Prometheus 규칙 firing — **실패로부터 41초** |
| 19:52:01 | Alertmanager `active`, receiver `telegram`, 에러 로그 없음 |
| 19:52 | **텔레그램 도착 — 실패로부터 45초** |
| 19:57:03 | Job 삭제 후 규칙 해제. **해제 통은 오지 않았다**(`send_resolved: false` 대로) |

도착한 문구에 시각·내용·네임스페이스·로그 링크가 전부 실렸다. 규칙 파일에 쓴 한글이
Alertmanager 템플릿을 타고 그대로 도착하는 것을 이번에 처음 확인했다 —
`scripts/preview-alert-telegram.py` 가 로컬에서 보던 것과 같은 문구가 진짜 경로로 왔다.

측정된 것은 **"백업이 실패하면 1분 안에 안다"** 이다. 그 전까지는 규칙이 있다는 것만 알았다..

## 결정 3 — 롤백 리허설은 새로 설계하지 않는다

`docs/rollback-rehearsal-plan.md` 에 후보 셋과 잴 것이 이미 다 있다. 이 문서가 더할 것은 순서뿐이다.

- **후보 2번(뜨지 않는 이미지)부터 한다.** 1번은 워크플로 경로만 재고, 3번은 진짜 다운타임이 난다.
- 배포 직후가 아니라 **조용한 시간**에 한다. 리허설이 실패해도 방금 나간 변경과 섞이지 않게.
- 잰 시간(감지 → 롤백 시작 → rollout 완료 → verified)을 그대로 기록한다. 지금은 아무도 모른다.

## 순서

1번은 파이프라인 밖(맥북)이라 **배포 없이 지금 만들 수 있다.**

1. `scripts/pull-prod-backup.sh` 를 만들고 손으로 한 번 돌려 세 파일을 받는다
2. docker `pg_restore -l` 로 검증하고, 임시 DB 복원까지 해서 **초를 잰다**
3. `snapshotProduction` 에 붙인다. `deploying` 체크리스트에 배포 후 한 줄을 더한다
4. **미배포 22커밋 배포** (0번 — 이 셋과 독립이다)
5. 알림 실증(결정 2)
6. 롤백 리허설(결정 3)
7. 위키 두 글 갱신 — `postgres-backup-restore`, `backup-r2-phase-b-plan`

## 검증

```bash
scripts/pull-prod-backup.sh .local-backups/manual-$(date -u +%Y%m%dT%H%M%SZ)
# → portfolio.dump 2.4MB / .sha256 / wiki-assets.tar 812K

docker run --rm -v "$PWD/.local-backups/<시각>":/b postgres:18-alpine pg_restore -l /b/portfolio.dump | head
shasum -a 256 -c .local-backups/<시각>/portfolio.dump.sha256
tar tf .local-backups/<시각>/wiki-assets.tar | head

# 반영 경로에 붙었는지 — /sync 에서 publish 를 눌렀을 때 세 파일이 같이 생기는가
```

## 되돌리는 법

**miniPC 쪽은 한 줄도 안 바뀐다.** 결정 1 은 전부 맥북에서 도는 읽기 동작이고,
결정 2 의 Job 은 확인 후 지운다. 되돌리려면 스크립트를 지우고 `snapshotProduction` 의
호출 한 줄을 빼면 그만이다. 남는 것은 `.local-backups/` 안의 파일뿐이다.

## 알고도 하지 않은 것

몰라서 빠진 것과 알고 뺀 것은 읽는 사람에게 완전히 다르다. 아래는 후자다.

| 안 한 것 | 왜 |
|---|---|
| 오브젝트 스토리지 외부 복제(R2) | 결제 수단 등록을 지금 하지 않는다. **스크립트가 목적지만 바꾸면 되게 짜 뒀다** |
| 자동 스케줄 복제 | 장치를 늘리면 그 장치의 실패를 감시할 장치가 또 필요하다. 반영 시점으로 갈음하고 **RPO 한계를 명시**한다 |
| WAL 기반 PITR | 하루 단위 dump 로 충분한 규모다. 운영 복잡도가 이득을 넘는다 |
| Redis·OpenSearch·Kafka | 재생성된다. 백업하면 복구 시간만 늘어난다 |
| Prometheus·Loki·Tempo | 되살릴 수 없지만 관측 데이터다. 잃어도 서비스가 안 깨진다 |
| Grafana 대시보드 | 정본이 저장소 values 에 있다. 재배포가 곧 복구다 |
| k8s Secret 백업 | 성격이 다르다(암호화·보관 장소). 지금은 맥북 `~/.jaywiki/prod-secrets.env` 한 부뿐이라는 것을 **한계로만 적는다** |
| 월 1회 자동 복원 검증 | 사람이 부르는 리허설 스크립트로 갈음한다 |

## 남은 위험

- **화재·도난**: 맥북과 miniPC 가 같은 장소에 있다. 이건 R2 를 켜야 풀린다
- **사용자 데이터 RPO**: 게시판·댓글의 맥북 사본은 마지막 반영 시점만큼 낡는다
- **Secret**: 맥북이 죽으면 `prod-secrets.env` 도 같이 간다
- **wiki-assets tar 는 MinIO 레이아웃**이다. 같은 MinIO 로만 되돌릴 수 있다

## 위키 글로 옮길 때 남길 숫자

글은 실무 문서처럼 쓰되, 위 「알고도 하지 않은 것」을 **절로 분리**한다. 인지했으나 구현하지
않았다는 것을 명시하는 편이, 넓게 덮고 못 되살리는 것보다 강하다.

- DB 88MB → dump **2.4MB**, `wiki-assets` **564K**(tar 812K)
- 30일 보관 시 로컬 **약 96MB**
- 사본 받는 데 **5.2초** (dump + sha256 + 아카이브 검증 + MinIO tar, 2026-08-16 실측)
- **밖으로 나온 사본만으로 복원 2.1~2.3초, 오류 0** — miniPC 없이 되살아난다
  (`tb_article` 70 · `tb_revision` 174 · `tb_blog_post` 18 · `tb_post` 100007 · `tb_user` 1)
- 첫 리허설에서 오류 **43건** → `CREATE ROLE portfolio` 선행으로 0
- 블로그 글 하나 복구 실측: **9305자, 2.4초** (2026-08-16)
- 알림 실증: 실패 Job → 텔레그램 도착까지 걸린 시간 (5번 단계에서 잰다)
