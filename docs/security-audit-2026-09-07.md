# 보안 점검 및 개선 작업 기록 — 2026-09-07

작업 상태: 2026-09-07 보안 변경 배포 완료. 2026-09-08에 GitHub 실행 기록으로 재확인했다.
보안 검사 [34091404882](https://github.com/jaymunsh/jay-wiki/actions/runs/34091404882)와
배포 [34091493156](https://github.com/jaymunsh/jay-wiki/actions/runs/34091493156)가 성공했다.
운영 파드·호스트의 현재 상태는 Cloudflare Access 재인증이 필요해 이번에는 직접 재검증하지 못했다.

아래 표·다음 작업 순서·후속 검증·중단 기록은 **당시 시점의 기록**이다. 그 안의 배포 대기는 현재 상태가 아니다.
2026-09-08 변경과 남은 작업의 정본은 [후속 개선 기록](security-followup-2026-09-08.md)이다.

## 점검 목록과 결과

| 영역 | 확인 결과 | 상태 |
|---|---|---|
| 호스트 권한 | 관리자 kubeconfig 원본·사용자 사본이 644 | 사용자 사본 600, 디렉터리 700 적용. root 원본은 관리자 그룹 640으로 제한하는 스크립트를 사용자 실행 |
| SSH | 비밀번호 로그인 허용, root 키 로그인 허용, X11 허용 | 사용자 실행 스크립트로 차단, TCP 포워딩 유지. 최종 출력은 서버 host-hardening.txt |
| 방화벽 | UFW active, 기본 incoming deny, LAN SSH 허용 | 유지. IPv6·Tailscale 우회 경로 및 실제 외부망 도달성은 추가 점검 필요 |
| OS | 자동 업데이트 활성, 재부팅 요구 파일 없음 | 보류된 업데이트 및 이미지 OS 패치는 별도 추적 |
| Secret 저장 | k3s Secret 암호화 비활성 | 미적용. 백업·복원 및 재시작을 포함한 별도 작업 필요 |
| 네트워크 | Redis Helm 정책은 모든 출처 허용, OpenSearch 정책 없음 | 운영에 접근 제한 적용. backend→두 서비스 성공, frontend→두 서비스 ECONNREFUSED 확인. **차트 values 로는 운영과 같은 좁기를 못 만든다는 것을 렌더 대조로 확인해 표준 매니페스트로 옮겼다**(아래 후속 검증 1번) |
| RBAC | backend 서비스 계정이 같은 네임스페이스 Job 생성 가능 | rehearsal 네임스페이스, Restricted PSA, quota, egress 제한으로 분리하는 코드·매니페스트 작성. 배포 대기 |
| 컨테이너 | 앱이 root 실행, 불필요한 SA 토큰 | non-root·capabilities 제거·no-new-privileges·토큰 미마운트 수정. 앱별 최종 이미지 검증은 아래 참조 |
| 웹 | 회원가입 제한 누락, BFF 무제한 버퍼, 헤더 누락 | 회원가입 제한, 요청 11MiB·응답 32MiB·타임아웃, Origin 검사, no-store 및 보안 헤더 구현 |
| 빌드 컨텍스트 | web/.dockerignore가 .env를 제외하지 않음 | .env 및 .env.* 제외 |
| Node | 최초 npm audit --omit=dev: High 7, Moderate 3 | 전체 npm audit 0건. Next 15.5.25, PostCSS override 등 적용 |
| Java | 실제 bootJar: Critical 3, High 6, Medium 15 | Boot BOM 구성요소 패치 후 실제 JAR Trivy 결과 0건 |
| Python | payment·shipping 0건, partner h2 1건 | h2 4.4.1 반영, 재검사 0건 |
| Git 비밀정보 | 764개 커밋 검사, 후보 3개 | 문서 Idempotency-Key 예제와 격리된 TOTP 테스트 픽스처. 정확한 fingerprint만 .gitleaksignore에 기록, 재검사 0건 |
| CI | 전용 보안 검사 없음 | security.yml 작성: npm, pip-audit, 실제 JAR Trivy, Git 이력 Gitleaks. Actions 실행 미확인 |
| 백업 | 최근 백업 Job 3개 Complete | 이번 점검에서 복원 리허설은 하지 않음 |

## 검증 근거

- Spring 패치 후 전체 테스트: 274개, 실패·오류 0. bootJar 성공.
- Web: 135개 통과, tsc 성공, lint 기존 경고 7개 유지.
- Playwright: Docker 운영 빌드 대상으로 데스크톱·모바일 8개 통과. 보안 헤더 포함.
- Partner: pytest 4개 통과, non-root Docker 기동 성공.
- 새 웹 Docker non-root 기동과 보안 헤더 확인.
- RBAC·격리 정책·CI YAML 파싱 확인. rehearsal 네임스페이스는 운영에 아직 만들지 않음.
- 원본 증거는 gitignore 대상 `.tmp/security-audit-20260907/`에 있다. 공개 글에 원본 로그를 싣지 않는다.

## 다음 작업 순서

1. 사용자 실행 `~/security-audit-20260907/host-hardening.txt` 확인 및 새 SSH·kubectl 확인.
2. 이미지 OS 검사 결과 검토. 최초 웹 이미지 High 12/Critical 1, partner High 77/Critical 9였으며 앱 의존성과 다른 결과다. 최종 Dockerfile에 OS 패치와 웹 런타임 npm 제거를 추가했으므로 재빌드·재스캔 필요. 미수정 배포판 항목은 도달성과 벤더 상태를 구분한다.
3. Spring·payment·shipping 최종 이미지 non-root 기동 확인. HPA Job 생성 JSON과 권한의 서버 검증, 실행·취소·로그 조회 회귀 확인.
4. Redis 운영 정책은 직접 패치했고 Helm values에도 대응 설정을 기록했다. 다음 Helm 렌더가 접근 제한을 유지하는지 대조한다. NetworkPolicy는 합집합이므로 기존 allow-all 정책을 남기면 새 정책만 추가해도 막히지 않는다.
5. 앱·매니페스트 수정분만 작업 브랜치에 분리하고 리뷰. main 머지는 운영 배포이므로 배포 스킬에 따라 나가는 커밋 전체를 제시한 뒤 사용자 확인. 원래 있던 미발행 초안이나 다른 세션 변경을 포함하지 않는다.
6. 운영 배포 후 재검증하고 블로그 초안의 상태표를 갱신한다. 초안은 아직 운영 발행하지 않는다.
7. 후속: k3s Secret 암호화, Tailscale ACL·외부망 테스트, Cloudflare Access/WAF 실설정, Redis 인증·보안 키 eviction 분리, JWT 강제 폐기, CSRF 전체 경로, 백업 복원, CI 러너 권한 분리.

## 공개 글 작성 원칙

발견·로컬 수정·운영 적용·검증을 분리한다. 취약점 건수를 침해 건수로 쓰지 않는다. 내부 IP, Secret, kubeconfig 내용, 관리자 경로와 미해결 취약점의 구체적인 공격 절차는 제외한다.

참고: https://kubernetes.io/docs/concepts/security/rbac-good-practices/ , https://docs.k3s.io/cli/server , https://tomcat.apache.org/security-10.html

## 후속 검증 (2026-09-07 05:31, 다음 세션)

중단 시점의 「다음 작업 순서」 1~4번을 닫았다. 5~7번은 사람의 판단이 필요해 남긴다.

### 1. Redis Helm 렌더 대조 — 결함을 찾아 고쳤다

miniPC 의 helm 으로 저장소 values 를 렌더해 운영에 적용된 정책과 대조했다. **차트가 만드는 정책이 운영 정책보다 넓었다.**

~~~yaml
ingress:
  - ports: [{ port: 6379 }]
    from:
      - podSelector: { matchLabels: { redis-client: "true" } }   # 운영 정책에는 없다
      - podSelector: { redis 자기 자신 }
      - namespaceSelector: { backend } + podSelector: { app: jaywiki }
~~~

Bitnami 차트는 allowExternal: false 를 줘도 "같은 네임스페이스에서 redis-client: true 라벨을 단 파드" 항목을 항상 끼워 넣고, 이 값을 끄는 옵션이 없다. NetworkPolicy 의 ingress 는 합집합이라 그 한 줄이 정책 전체를 넓힌다. **그 라벨을 단 파드는 클러스터 전체에 0개라 지금 뚫려 있지는 않지만, 다음 Helm 렌더가 손으로 좁혀 둔 정책을 이 넓은 판으로 되돌린다.**

opensearch-network-policy.yaml 과 같은 방식으로 옮겼다.

- infra/k8s/data/redis-values.yaml — networkPolicy.enabled: false
- infra/k8s/data/redis-network-policy.yaml — 신규. 운영 정책과 허용 대상이 동일함을 대조 확인
- .github/workflows/deploy.yml — 매 배포마다 적용하도록 추가

렌더 결과에서 NetworkPolicy 가 0개로 사라지는 것과, 새 매니페스트가 서버 dry-run 을 통과하는 것을 확인했다.

### 2. 이미지 재빌드·재스캔 — 조치할 것이 남지 않았다

다섯 이미지를 최종 Dockerfile 로 빌드하고 Trivy 로 다시 쟀다(scanners=vuln, CRITICAL·HIGH).

| 이미지 | 최초 | 최종 | 수정본이 있는데 안 잡은 것 |
|---|---|---|---|
| web | HIGH 12 / CRITICAL 1 | **0건** | 0 |
| spring | (앱 의존성만 측정했었다) | **0건** | 0 |
| partner | HIGH 77 / CRITICAL 9 | HIGH 55 / CRITICAL 5 | **0** |
| payment | 미측정 | HIGH 55 / CRITICAL 5 | **0** |
| shipping | 미측정 | HIGH 55 / CRITICAL 5 | **0** |

**Python 서비스 셋에 남은 항목은 전부 데비안이 아직 고치지 않은 것이다.** status 가 affected·fix_deferred·will_not_fix 뿐이고 fixed 는 0건이다. apt-get upgrade 가 할 수 있는 일은 이미 다 했다는 뜻이다. 남은 CRITICAL 은 libsqlite3-0, perl-base, zlib1g 로 애플리케이션이 직접 쓰지 않는 기반 이미지 구성요소다.

**줄이려면 기반 이미지를 바꿔야 한다**(uv 의 bookworm-slim → alpine 계열 등). 이건 런타임 동작이 바뀌는 변경이라 이번 범위에서 하지 않는다.

### 3. non-root 기동 확인 — 다섯 이미지 전부

| 이미지 | Config.User | 실제 id | 기동 |
|---|---|---|---|
| web | 10001:10001 | uid=10001 | running, 보안 헤더 6종 확인 |
| spring | 10001:10001 | uid=10001 | — |
| partner | 10001:10001 | uid=10001 | running, /health/ready 200 |
| payment | 10001:10001 | uid=10001 | DB 없이는 안 뜬다(원래 그렇다) |
| shipping | 10001:10001 | uid=10001 | 위와 같다 |

web 의 응답 헤더에서 X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, Content-Security-Policy, Strict-Transport-Security 를 모두 확인했다.

### 4. HPA 격리 — 매니페스트와 Job 스펙, 그리고 선택자가 실제와 맞는지

운영에 rehearsal 네임스페이스를 아직 만들지 않았으므로 서버 dry-run 대신 스펙과 실제 라벨을 대조했다.

앱이 만드는 Job 이 Restricted PSA 요건을 전부 갖췄다 — runAsNonRoot, seccompProfile RuntimeDefault, allowPrivilegeEscalation false, capabilities drop ALL, automountServiceAccountToken false. requests·limits 도 둘 다 있어 ResourceQuota 를 통과한다(pod 1/2, job 1/2, cpu 20m/1, memory 16Mi/128Mi).

**egress 정책이 가리키는 선택자가 실제와 맞는지도 확인했다.** 여기가 어긋나면 부하 Job 이 이름 풀이부터 막혀 조용히 실패한다.

| 정책이 가리키는 것 | 운영의 실제 |
|---|---|
| kube-system / k8s-app=kube-dns | CoreDNS 파드 1개, Running |
| kube-system 네임스페이스 라벨 | 있음 |
| backend / app=jaywiki, TCP 8080 | 파드 2개, Service 포트 8080 |

**적용 순서도 확인했다.** jaywiki-control-rbac.yaml 이 rehearsal 네임스페이스의 Role 을 담게 됐는데, deploy.yml 에서 00-namespaces.yaml(290행)이 같은 job 안에서 먼저 돈다(374행). 네임스페이스가 없어 실패하는 경로는 없다.

### 검증 기준선 재측정

| 무엇 | 주장 | 재측정 |
|---|---|---|
| Spring 테스트 | 274개 | **274개, 실패·오류 0** |
| web 테스트 | 135개 | **135개 통과 (22 파일)** |
| tsc | 통과 | 통과 |
| lint | 기존 경고 7개 유지 | 0 errors, 7 warnings |
| Gitleaks | 재검사 0건 | **764 커밋, no leaks found** |
| 워크플로 YAML | 파싱 확인 | security.yml·deploy.yml 파싱 OK |

## 사용량 제한으로 중단

사용량 최신 기록 91% 사용(5시간 잔여 약 9%)에서 사용자 요청에 따라 중단했다.
사용자 호스트 수정 후 새 SSH와 kubectl 접속 성공, 노드 Ready, 원본 kubeconfig 640 root:관리자그룹과 사용자 사본 600을 확인했다. host-hardening.txt는 없어 해당 로그를 통한 검증은 불가했다.
공개 위키·블로그는 네트워크 정책 적용 후 모두 HTTP 200이다.
최종 OS 패치를 포함한 partner 이미지 빌드가 성공했고 웹 재빌드는 중단 직전 진행 중이었다. 최종 이미지 재스캔 및 나머지 이미지 검증은 이어서 해야 한다.
검증용 로컬 컨테이너 jaywiki-security-web(3107), jaywiki-security-partner(3108)는 중단 시 정리한다. 기존 3000/8080 개발 서버는 건드리지 않는다.
