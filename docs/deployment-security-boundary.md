# 운영 배포와 관리자 작업의 권한 경계

2026-09 보안 후속 변경 당시의 배포 경계 기록이다. 현재 공개 소스와 비공개 운영 저장소의 배포 구분은 [배포 안내](./deploy-runbook.md)를 우선한다.

## 일상 배포

작업 브랜치→develop PR, 운영 배포는 develop→main PR이다. main 직접 push 금지. 배포 요청 범위와 나가는 커밋을 확인하고 진행한다.

GitHub-hosted runner가 테스트와 이미지를 빌드한다. miniPC의 별도 OS 계정 `jaywiki-runner`는 Node22를 준비하고 승인된 인프라 fingerprint를 확인한 뒤 backend/frontend 앱과 secure-search 이미지를 배포한다. DB 백업, 위키 싱크, 명시적으로 선택한 블로그 발행, 공개 스모크는 유지한다. 콘텐츠가 쓰이기 전 Node 준비가 완료되어야 한다.

`delivery/application-deployer`는 관리하는 namespace에서 앱·Job·ConfigMap 등을 조작한다. kube-system Secret, cluster role binding, node, RBAC, ServiceAccount/token 생성, bootstrap 승인 수정은 허용하지 않는다. 관리 namespace의 Job 생성 권한에는 해당 namespace의 Secret을 workload로 사용하는 능력이 포함된다. 이를 namespace 내부의 완전한 비밀 격리로 설명하지 않는다. PodSecurity baseline이 privileged/hostPath/host namespace 사용을 차단한다.

## 관리자 bootstrap

`infra/k8s/{data,observability,backup,delivery}` 및 namespace·제어판RBAC·rehearsal 격리 변경은 관리자 identity로 실물 diff를 확인하고 적용한다. 새 Secret 값과 인증서도 이 경로에서 관리한다. 일반 러너에 임시 cluster-admin을 주지 않는다.

검증한 뒤 저장소 루트에서 `scripts/approve-deployment-bootstrap.sh --applied-and-verified`로 fingerprint를 기록한다. 이 플래그는 인프라 전체를 자동 적용하는 옵션이 아니다. 관리자가 변경된 리소스를 적용·검증했다는 명시적인 체크포인트다. 다음 배포의 `verify-deployment-bootstrap.sh`가 일치 여부를 확인한다.

옛 무인증 Redis/OpenSearch는 전환 후 replicas0으로 보존한다. `deploy-opensearch-image.sh`는 secure-search만 갱신하며, 옛 Helm 릴리스를 다시 올리지 않는다. 옛 values를 무작정 재적용하지 않는다.

## 전환과 되돌리기

최초 Redis 전환은 쓰기 정지, 기존 앱 Pod 종료 확인, 보안 키의 TTL 이전 및 일반 캐시 string/set 이전, 인증 연결 설정, 앱 기동과 인증 거절 검증 순서다. 이전 도구는 원본을 지우지 않는다. 전환 이후 되돌릴 때 새 JWT 폐기·OTP 기록을 버리고 옛 Redis로 돌아가면 안 된다. 새 보안 기록을 보존하는 역이전이나 호환 앱 버전으로 복구한다.

검색 인덱스 복사는 비활성 목적지에서만 한다. source/target shard history가 모두 일치하는 완료 checkpoint만 재사용한다. 운영 앱이 이미 목적지를 사용한다면 --target-inactive를 지정하지 않는다.

이미지 배포 실패 시 기존 rollback 스크립트가 이전 이미지로 되돌린다. 이 자동화는 데이터/환경/인프라 전체를 되감는 기능이 아니다. 앱/스토어 최초 전환과 평상시 이미지 롤백의 차이를 확인한다.

## 러너와 복구 자격증명

러너 HOME과 tool cache는 `/opt/jaywiki-runner` 안에 있고 관리자 홈, sudo, Docker 소켓 권한을 주지 않는다. systemd에 NoNewPrivileges/ProtectHome/ProtectSystem과 capability 제한을 적용한다. 실제 계정 전환은 진행 중 Runner.Worker가 없는 때에만 수행한다.

SA token은 `delivery/application-deployer-token`에 연결된 별도 배포 자격증명이다. 폐기는 Secret 삭제, 교체는 새 토큰 준비→kubeconfig 교체→권한 검증→옛 Secret 폐기 순서다. 기존 관리자 kubeconfig를 새 사용자에게 복사하지 않는다.

매일04:30 맥의 LaunchAgent가 DB3개·객체·MinIO IAM/버킷 설정·클러스터 API 설정을 암호화해 외부 사본을 만든다. 깨어 있는 맥과 유효한 Cloudflare SSH 인증이 전제다. 24시간은 목표 RPO이며 last-success가 오래되면 달성하지 못한 것이다. k3s 데이터스토어·서버token·암호화key 사본은 별도로 관리하고, 키 회전 후 다시 복원 검증한다.

## 공개 HTTPS와 내부 프록시

Cloudflare Tunnel→Traefik→Next의 내부 HTTP 연결을 방문자의 외부 HTTP로 오인하면 정상 HTTPS 로그인도 Origin 검사에서403이 된다. 공개 두 도메인에 한해 관리자 소유 `public-origin-proxy.yaml`을 적용한다. Cloudflare의 CF-Visitor가 HTTP인 요청은 우선순위가 높은 별도 라우터에서 HTTPS로301 전환하고, 정상 공개 경로는 X-Forwarded-Proto를https로 정규화한다. 로컬 개발의 Origin 검사는 바꾸지 않는다. 원본 직접 접근 차단과 Cloudflare가 제공하는 헤더를 신뢰할 수 있는 현재 Tunnel 구조가 전제다.

일반 러너는 이 middleware/IngressRoute를 읽어 존재를 확인할 수 있지만 수정 권한은 없다. frontend Ingress는 승인된 middleware를 참조한다. 배포 스모크는 HTTP301, 정상 Origin을 포함한 실제 쓰기200, 다른 Origin 쓰기403을 확인한다. `node scripts/check-production-auth.mjs --public`은 별도의 운영 관리자 검사로 실제 공개 OTP 로그인부터 폐기 토큰 재사용 거절까지 확인한다. 비밀번호/OTP/쿠키는 프로세스 메모리에만 둔다.

캐시·인증 연결을 새 백엔드로 전환했다면 프런트엔드도 같은 요청 표식을 지원하는 버전이어야 한다. 백엔드만 새 버전인 상태에서 구형 프런트로 이미지 롤백하면 쓰기403이 생길 수 있다. 9월10일 호환 프런트 이미지를 복구하고 공개 쓰기/로그인을 검증했다. 이후 롤백 기준은 이 호환 조합 이후의 이미지로 잡는다.
