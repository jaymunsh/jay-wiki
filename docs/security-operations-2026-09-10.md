# 보안 운영 후속 — 2026-09-10

9월 10일 재개 후 실제 운영에서 수행한 결과다. 초기 조사와 당시 미완료 목록은 [이력](security-operations-2026-09-10-initial.md)에 보존했다. 일상 배포와 관리자 작업의 경계는 [배포 계약](deployment-security-boundary.md)을 따른다.

## 실제 완료한 전환과 검증

| 항목 | 목적 | 실제 결과 |
| --- | --- | --- |
| 보안 Redis 분리 | 캐시 퇴출 때문에 OTP·JWT 폐기 기록이 지워지지 않게 한다 | 인증·AOF always·noeviction 인스턴스로 앱 전환. 전환 시 보안 키 0개. 별도 실제 Redis 이전 테스트 8개로 TTL·충돌·원본 보존 검증 |
| 일반 캐시 인증 | 내부망 접근만으로 캐시를 읽고 바꾸는 경로를 줄인다 | 인증된 cache-redis로 전환, AOF everysec·allkeys-lru. 기존 redis-master는 replicas 0, PVC 보존 |
| 검색 인증·TLS | 검색 데이터 접근을 제한하고 인증 정보를 암호화한다 | CA/hostname 검증, 앱 역할 두 인덱스로 제한, 100007개 게시글·89개 위키 복사 및 이력 대조. 무인증401·다른 인덱스와 보안 관리403 포함 9개 실검사 통과. 옛 검색 StatefulSet replicas 0 |
| 인증 회귀 | 설정 변경 후 로그인과 차단이 모두 작동하는지 확인한다 | 운영 OTP 로그인·관리 API·다른 출처 요청 거절·로그아웃·폐기 쿠키 재사용 거절 포함 9개 검사 통과 |
| k3s Secret 저장 암호화 | 데이터스토어 유출 시 Secret 평문 노출을 줄인다 | Enabled, reencrypt_finished, 서버 hash 일치. 확인 시 현재 Secret 101개 모두 암호화, 현재 평문 0개 |
| 러너 OS/RBAC 분리 | 배포 코드 실행이 호스트·클러스터 관리자 권한으로 번지는 경로를 줄인다 | locked 전용 사용자와 systemd 제한 실제 활성화. 관리자 kubeconfig·Docker 접근 거절, 관리 namespace 앱 작업 허용, 시스템 Secret·node·RBAC·권한 승인 수정 거절 |
| DB·MinIO·앱 복원 | 백업 파일이 실제 읽을 수 있는 서비스로 돌아오는지 확인한다 | DB3개 복원, 객체42개/9232476바이트 해시 일치, IAM·버킷 설정 복원, 복원한 Spring 이미지 API17개 응답 모두 DB 체크섬 일치 |
| k3s 격리 복원 | 암호화 키와 데이터스토어를 함께 복구할 수 있는지 확인한다 | network none의 같은 k3s 버전으로 기동. 암호화 전101/101, 후99/99 Secret 일치. 후자의2개 차이는 테스트에서 비활성화한 Traefik 값 리소스 자동 삭제로 확인 |
| Tailscale/외부 경계 | DB 사용 경로를 보존하면서 직접 서비스 노출을 줄인다 | 본인 tailnet 기기의 SSH22만 허용하는 영속 nft guard 적용. Beekeeper와 같은 SSH 터널의 PostgreSQL 응답 확인. 직접5432/6379/6443/9000/9200 차단 확인 |
| 외부 포트 검사 | 집 안 검사만으로 외부 차단을 추정하지 않는다 | GitHub-hosted 외부 지점에서22/5432/6379/6443/9000/9001/9200 모두 filtered-or-no-response. 공개 HTTP 무인증 경계도 성공 |
| 운영 글 기준 해시 | 다른 본문을 운영 기준으로 오인하거나 덮어쓰지 않는다 | 운영과 동일한64편만 syncHash 초기화. 다르거나 미공개인2편 보존. 운영 글 쓰기 없음, 발행 manifest 비어 있음 |
| 외부 자동 백업 | 미니PC 장애와 별개로 암호화 복구 사본을 유지한다 | 맥 LaunchAgent 매일04:30 등록, 최초 실행 성공. DB·객체·MinIO 설정·클러스터 API 설정 암호화 저장 |

전환 첫 시도는 이전용 Pod가 아직 종료되지 않아 중단하고 원래 앱을 복구했다. 삭제 완료를 기다리도록 수정한 두 번째 시도에서 전환했다. 기존 데이터는 삭제하지 않았다. 이미 활성화된 secure-search에 `--target-inactive` 복사 명령을 다시 실행하지 않는다.

## 배포 결과

PR130/131 첫 배포는 Node 누락 때문에 위키 쓰기 전 실패했고 자동 이미지 롤백이 성공했다. Node22 준비, 불변 이미지 사전 렌더링, 제한된 러너용 배포 흐름으로 수정했다. PR132/133 최종 배포 실행은 아래에 완료 결과를 기록한다.

- 최종 실행: https://github.com/jaymunsh/jay-wiki/actions/runs/34447545362
- 최종 main: `dbc8b495cb2f2ae0d6a5dd369185b8795845277e`
- 이 실행은 앱·검색 갱신 후 콘텐츠 쓰기 전 백업 단계에서 실패했다. 배포용 Role의 CronJob 허용 이름이 `postgres-backup`으로 잘못 작성되어 실제 `jaywiki-postgres-backup` 조회가 거절된 것이 원인이다. 자동 이미지 롤백 성공, 위키·블로그 쓰기 미실행.
- PR134에서 이름을 바로잡고, 앱 변경 전에 해당 CronJob 읽기를 검사하도록 했다. 관련 없는 CronJob은 계속 거절한다. 관리자 bootstrap에 수정된 Role을 적용·검증하고 승인 지문을 갱신했다.
- 재배포 전 같은 배포 SA로 impersonation한 사전 실행에서 허용/거절 경계, 실제 DB3개 백업 완료, 위키 동기화가 통과했다. 11개 탭·89편 모두 Already in sync로 본문 변경은 없었다. 이는 OS 계정 검증을 대체하지 않으며 최종 GitHub 러너 실행을 별도로 확인한다. 롤백 뒤 운영 인증/검색 검사9개도 통과했다. 최종 PR134/135 병합 이후 실행 결과를 아래에 기록한다.
- 최종 수정 main: `ed69cf74b387963b179af9b5f1dbb3a603f2c164`
- 재실행: https://github.com/jaymunsh/jay-wiki/actions/runs/34449626521 — 애플리케이션 검증 성공 후 이미지 빌드 중 운영 공개 Origin 문제를 발견해 취소했다. 이 실행의 운영 배포 단계는 시작되지 않았다.

PR132 검사는 Spring, Web lint/type/build, Python 서비스, 런타임 이미지5종, Java/Node/Python 의존성 및 Secret 검사를 모두 통과했다. httpx2/httpcore2 수정 후 서비스3개 테스트35개도 통과했다. 스캐너 통과는 미래 취약점 부재를 보장하지 않는다.

외부 경계 실행: https://github.com/jaymunsh/jay-wiki/actions/runs/34446289898

## 공개 Origin 경로 추가 검증과 수정

백업 실패 뒤 프런트가68c9f67로 롤백되고 백엔드는 인증 저장소 전환을 위해074e540을 사용하면서 공개 쓰기가403이었다. 프런트를 이미 검증한dbc8b49 이미지로 맞춰 일반 쓰기를 복구했다. 이후 Origin을 포함한 실제 브라우저 요청이403인 것을 별도로 확인했다. HTTPS 방문자의 연결이 내부 HTTP로 전달되는데 프록시가 이를 외부 프로토콜로 취급한 것이 원인이었다.

`infra/k8s/delivery/public-origin-proxy.yaml`은 관리자 소유 리소스다. 공개 두 도메인의 CF-Visitor HTTP 요청을 HTTPS로301 전환하고, 정상 공개 경로의 X-Forwarded-Proto를https로 정규화한다. 원본 직접 접근 차단과 현재 Cloudflare Tunnel 경로가 전제다. 기존 Origin 검사를 느슨하게 하지 않았다.

실제 결과: 두 도메인 HTTP301/HTTPS200, 경로·쿼리 유지, 위조 CF-Visitor로 HTTP 우회 불가, 정상 Origin 쓰기200/다른 Origin403. `check-production-auth.mjs --public`으로 공개 BFF 경로의 OTP 로그인부터 토큰 재사용 거절까지9개 통과. 배포 스모크에도 Origin을 포함한 쓰기와 HTTP 전환을 추가했다. 일반 러너는 관리자 proxy 리소스를 읽기만 하며, 암호화 API 백업에도 이 리소스를 포함했다.

PR136/137 병합 완료. 최종 main `b7c210db65ffed828b1acc523dc5a7449a69e31a`, 실행 https://github.com/jaymunsh/jay-wiki/actions/runs/34451516190 의 전체 테스트·이미지 빌드·제한된 러너 배포·외부 브라우저 검증이 모두 성공했다. 실제 Chromium 로그인 폼·Secure/HttpOnly/SameSite=Lax 쿠키·세션·로그아웃도 운영에서 통과했다.

## 증거와 복구 사본

비밀이 포함된 원본은 git에 넣지 않는다. age identity는 저장소 밖 `~/.config/jaywiki-recovery/identity.txt`(0600)에 있다.

- `.local-backups/security-20260910-databases/`: DB3개, 전환 전 Deployment 암호화 사본, 암호화 전후 k3s datastore/token/cred/TLS/config 사본. 최초 실패한 gzip 없는 사본은 `.incomplete`로 표시했다.
- `.local-backups/security-20260910-objects/`: 논리 객체 사본과 복원 결과. 9월7일 raw MinIO 사본은 일부 객체 읽기 실패로 복구 성공 사본으로 취급하지 않는다.
- `.local-backups/minio-config-20260910/app-restore-report.json`: 격리 DB+MinIO+Spring 복원32.1초, 이미지 응답17개 검증. 장비 전체 재구축 RTO가 아니다.
- `.local-backups/minio-config-20260910-final/config.tar.age`: 최신 IAM/버킷/server 설정과 버전 목록. 목록46개 모두 versionOrdinal1, non-null version ID0개, 삭제 marker1개. 버킷3개 versioning Suspended. 과거 버전 객체 본문 복원까지 주장하지 않는다.
- `.local-backups/opensearch-production-20260910/`: 암호화 대상 인증서 묶음과 인덱스 체크포인트. CA/admin 개인키는 운영 앱에 배포하지 않았다.
- `.local-backups/security-20260910-blog-final/`: 로컬 글 변경 전 사본과 운영 기준 해시 결과64/2.
- `.local-backups/security-20260910-final/`: 최신 OpenSearch 비밀 묶음, 호스트 방화벽·러너 systemd 설정, k3s datastore/key/config를 각각 암호화해 보관하고 archive 전체 읽기 검증. `cluster-config-after-proxy.json.age`와 최신 자동 백업에는 프록시 리소스 및 수정된 승인 지문까지 포함되어 있음을 복호화 후 대조했다. 기존 복원 실험과 이 최신 사본의 무결성 검증은 구분한다.
- `~/Library/Application Support/JayWiki Backups/last-success.json`: 자동 백업 마지막 성공과 암호화 archive 위치. 최종 실행은 2026-09-10 16:48:49 KST 성공했다. 암호화 사본 전체 읽기, DB3개·객체·설정 구성요소44항목, 프록시3개 리소스와 현재 승인 지문 일치를 확인했다.

## 지속 운영과 해석의 한계

- 04:30 백업은 깨어 있는 맥과 유효한 SSH 인증이 필요하다. 24시간은 목표 RPO다. 실패 알림과 last-success를 확인하고 정기 복원한다.
- 인증서와 배포 SA 토큰은 정기 교체·폐기 대상이다. 이번 검색 서버 인증서의 만료는 2027-09-10 02:50:32 UTC(11:50:32 KST)다. 만료 전에 새 인증서/CA 신뢰를 준비하고 교체 후 TLS 거절/허용 검사를 반복한다. k3s 키 회전 뒤 datastore/token/key 사본도 갱신한다.
- k3s 현재 레코드 암호화는 과거 SQLite 페이지의 포렌식 삭제를 뜻하지 않는다.
- 배포용 Job 생성 권한은 관리 namespace의 Secret을 workload로 사용할 수 있다. namespace 내부의 완전한 Secret 격리로 표현하지 않는다.
- Tailscale 중앙 ACL은 수정하지 않았다. 소유자 기기만 SSH를 허용하는 호스트 guard가 적용됐다. 새 기기 추가 때 검토 후 규칙을 갱신한다.
- 외부 포트 timeout은 그 검사 지점에서 직접 접근하지 못했다는 증거이며 어느 방화벽이 차단했는지 특정하지 않는다. Cloudflare 관리 화면 전체 정책 감사와 동일하지 않다.
- 이미지 롤백은 DB·환경·스토어 전환 전체를 되감지 않는다. 새 Redis 보안 기록을 버리는 되돌리기는 금지한다.

블로그65/70은 로컬에 갱신했다. 원래 id·slug·발행일과 시리즈 연결을 보존했다. 운영 공개 manifest는 비어 있으며 운영 블로그 글을 발행하지 않았다.

임시 호스트 관리자 Pod와 백업용 Pod는 작업 뒤 삭제했다. 맥의 기존 Next 프로세스는 유지했고 Java 변경을 반영하기 위해 로컬 Spring만 재시작했다.

## 최종 완료 확인

- 자동 배포: https://github.com/jaymunsh/jay-wiki/actions/runs/34451516190 — success. 외부 데스크톱/모바일 브라우저8개 통과.
- 앱5개 모두 main `b7c210db65ffed828b1acc523dc5a7449a69e31a` 이미지이며 desired replicas만큼 Available. HPA의 추가 replica 기동 뒤 다시 대조했다.
- secure-search/security-redis/cache-redis 각각1개 Ready. 기존 redis-master/portfolio-search-master 각각0개, 원본 PVC 보존.
- 최신 이미지에서 실제 브라우저 로그인·보안 쿠키·세션·로그아웃, 관리 API의 secure-search 대상까지 확인했다.
- 근거: `.local-backups/security-20260910-final/{final-workflow.json,deployment-verification.json,production-browser-auth.json,offsite-verification.json}`.
- 이번에 합의한 일회성 전환·수정·검증은 완료했다. 백업 마지막 성공 확인·정기 복원·인증서/자격증명 갱신은 지속 운영이며 미배포 코드와 구분한다.

## 로컬 글과 저장소 전달 상태

- 로컬65/70의 최종 본문은 canonical draft와 일치한다. 기존 id·slug·publishedAt을 대조해 보존했다.
- 1440/390px 네 화면 모두 HTTP200, 가로 넘침0, 이전/다음 글 연결 정상. 로컬72편 기준 내부 링크18개 검사도 통과했다.
- 원고 두 편의 숫자 ID 링크는 로컬 DB 기준이다. 운영 발행은 이번 요청 범위가 아니며, 운영 발행 전에는 운영 ID/기준 해시를 다시 대조해야 한다. 이 로컬 원고 변경은 위 앱 배포 PR에 포함하지 않았다.
- 다른 작업의 `fixnet-macos-routing-blackhole.md`와 `scripts/mac-net/`는 이 작업의 커밋에서 제외했다.
