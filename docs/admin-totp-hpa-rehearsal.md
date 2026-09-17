# 관리자 TOTP와 Kubernetes HPA Autoscaling 리허설

## 목적

관리자 로그인은 비밀번호와 Google Authenticator TOTP를 모두 확인한다. 인증된 관리자만 서버에 고정된 부하 Job을 실행하고, Kubernetes Horizontal Pod Autoscaler(HPA)가 CPU 80% 기준으로 Spring Pod를 `1→2→1`로 조정하는 과정을 검증한다. 공개 방문자는 익명화된 Pod와 CPU·replica 변화만 읽는다.

## 인증 경계

- 관리자 JWT는 1시간, 일반 사용자 JWT는 6시간으로 발급한다.
- TOTP는 30초 주기와 앞뒤 1개 시간 창을 허용한다.
- 올바른 OTP도 90초 내에 재사용하면 거부한다.
- 클라이언트별 실패를 Redis에 누적하고 5분에 5회를 넘으면 일시 차단한다.
- TOTP secret은 Git에 저장하지 않고 `backend/jaywiki-secrets`에만 둔다.

## 운영 등록

```bash
REMOTE_HOST=miniPC scripts/configure-admin-totp.sh
```

스크립트가 출력한 Account와 Key를 Google Authenticator의 `setup key`에 등록한다. 사용자가 등록 완료를 확인해야만 Secret patch와 backend rollout을 수행한다.

## Horizontal Pod Autoscaling 실행 경계

- 버튼은 ADMIN JWT가 있을 때만 노출되고 변경 API도 Spring Security에서 ADMIN을 다시 확인한다.
- 부하는 `180초`, `최대 2 Pods`로 서버에 고정된다. 워커 수만 클라이언트가 고르고, 서버가 `1~16`으로 다시 가둔다.
- 부하 Job이 스스로 센 보낸 건수·실패 수·평균/최대 응답 시간을 파드 로그에서 읽어 화면에 싣는다.
- Redis 분산 락으로 동시 실행을 하나로 제한한다.
- ServiceAccount는 Job 생성·조회·삭제와 특정 HPA·Deployment, Pod·Pod 로그·metrics 조회만 허용받는다.
- 공개 API는 Pod 실제 이름을 `Pod 1`, `Pod 2`로 바꿠고 CPU, memory, Ready, restart, image 정보만 노출한다.
- Job이 성공해도 scale-out을 관측하지 못하면 `NO_SCALE`로 종료해 성공으로 오인하지 않는다.

### 로컬에서 miniPC 상태 읽기

- `HPA_REHEARSAL_REMOTE_URL=https://portfolio.leneu.cloud/api/bff/rehearsals/hpa`을 `web/.env.local`에만 설정한다.
- 로컬 Next.js route가 운영의 공개 GET만 서버 측에서 읽고, 브라우저에 운영 내부 주소나 인증 정보를 노출하지 않는다.
- 원격 응답이 `canControl=true`를 포함해도 로컬 route가 무조건 `false`로 덮어쓴다. 따라서 로컬에서는 `REMOTE · miniPC`로 CPU·Pod·replica를 보기만 하고 Job을 실행할 수 없다.
- 운영에 공개 HPA endpoint가 아직 배포되지 않은 동안은 `REMOTE · miniPC · 연결 없음`을 표시한다.

## 실검증 체크리스트

1. 비밀번호만 입력한 관리자 로그인이 `OTP_REQUIRED`로 거부되는지 확인한다.
2. 올바른 OTP로 로그인한 뒤 같은 OTP 재사용이 거부되는지 확인한다.
3. 비로그인 방문자의 POST가 403이고 GET은 200인지 확인한다.
4. 리허설에서 `1 Ready → 2 Ready → 1 Ready`와 CPU 80% 기준선을 시각적으로 확인한다.
5. Job과 Redis lock이 종료되고 HPA가 1 replica로 복귀했는지 확인한다.

## 면접에서 설명할 핵심

“2FA를 화면에만 추가한 것이 아니라 OTP 재사용·시도 제한·짧은 관리자 세션을 두었습니다. HPA도 임의 부하 입력 대신 서버에 고정된 Job과 최소 RBAC을 사용했고, 공개 화면에서는 운영 사실만 읽기 전용으로 보여줍니다.”

## 런타임 가설과 증거

| 가설 | 검증 | 결과 |
|---|---|---|
| Next.js BFF가 `otp`를 누락하거나 ADMIN cookie를 전달하지 않을 수 있다 | 390px 실제 브라우저에서 잘못된 OTP 거부 → 올바른 OTP 로그인 → `/api/bff/auth/me` 조회 | `role=ADMIN`, HPA 실행 버튼 노출, page error 0건 |
| 비로그인 방문자가 부하 Job을 실행할 수 있다 | 쿠키 없이 공개 GET과 관리자 POST를 각각 `curl` | GET 200, POST 403 |
| Job TTL 삭제와 scale-down이 겹치면 `STABILIZING`에 멈출 수 있다 | `SCALED_OUT/STABILIZING` 이력과 Job `NONE`, replica 1 조합을 단위 테스트 | `COMPLETED`로 종료하도록 보정, scale-out 미관측은 `NO_SCALE` |
| Kubernetes API가 없는 로컬에서 실행 버튼이 오류를 유발할 수 있다 | `available=false`, `canControl=true` 응답을 실제 브라우저에 주입 | 버튼 disabled, 가로 overflow·page error 0건 |

### 2026-07-14 로컬 Google Authenticator 실검증

- 임시 Base32 secret과 QR을 권한 `600` 디렉터리에 생성하고 Spring에 환경변수로만 주입했다.
- Google Authenticator가 생성한 6자리 코드로 로그인하자 HTTP 200, `role=ADMIN`, `jw_token` cookie 발급을 확인했다.
- 같은 6자리 코드를 즉시 재사용하자 HTTP 401, `OTP_INVALID`로 거부됐다.
- 검증 후 임시 secret·QR·JWT header와 Redis TOTP 테스트 키를 삭제하고 로컬 서버를 종료했다.

### 2026-07-14 운영 Google Authenticator 반영

- 운영용 QR을 Google Authenticator에 등록한 후 Base32 secret을 Git이 아닌 `backend/jaywiki-secrets`에만 저장했다.
- backend rollout 후 공개 인증 옵션이 `adminTotpEnabled=true`를 반환했다.
- 비밀번호만 전송한 로그인은 HTTP 401, Google Authenticator의 실제 OTP를 포함한 로그인은 HTTP 200·`role=ADMIN`·JWT cookie 발급을 확인했다.
- 같은 OTP를 즉시 재사용한 로그인은 HTTP 401로 거부됐다. 검증 중 비밀번호·TOTP secret·JWT 값은 출력하지 않았다.
- HPA는 관리자 버튼이 아닌 backend rollout 시작 부하에도 CPU 60% 기준을 넘어 `1→2`로 확장됐다. 버튼은 HPA를 켜는 기능이 아니라 상시 HPA의 동작을 재현하는 고정 부하 Job이다.
- Prometheus 최근 6시간 합산 CPU는 평균 `26m`, p95 `73m`, 최대 `518m`이었다. 기존 `100m × 60%` 기준은 평시 p95에도 반응했으므로 request는 유지하고 목표를 80%로 조정했다. 평시 상위 구간은 1 Pod가 처리하고 시나리오·실부하의 수백 mCPU에는 계속 확장한다.
