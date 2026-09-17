# blog.leneu.cloud 서브도메인 연결 runbook

작성일: 2026-08-02
대상: `blog.leneu.cloud`를 기존 miniPC k3s의 `jaywiki-web`으로 연결하는 수동 작업
관련 설계: [blog.leneu.cloud 설계](./superpowers/specs/2026-08-02-blog-leneu-cloud-design.md)

코드와 매니페스트 변경은 구현 계획에서 다룬다. 위에서부터 순서대로 따라 하면 된다.

## 누가 어느 단계를 하는가

에이전트와 번갈아 진행할 수 있게 단계마다 담당을 적었다. **판단이 필요하거나 되돌리기 어려운 단계는 사람이 한다.**

| 단계 | 담당 | 상태 | 이유 |
|---|---|---|---|
| 0. 선행 조건 확인 | 에이전트 | 대기 | 배포 상태 조회 |
| 1. config.yml 경로 확인·백업 | 에이전트 (SSH 필요) | **완료 2026-08-03** | 읽기와 복사뿐 |
| 2. Traefik Ingress 추가 | 에이전트가 편집, 적용은 **CI** | **편집 완료**, 적용은 push 때 | 매니페스트가 저장소에 있고 `deploy.yml` 이 `kubectl apply` 한다 |
| 3. cloudflared ingress 추가 | **사람** | **완료 2026-08-03** | 규칙 순서를 틀리면 기존 사이트가 같이 죽는다. 재시작 시점에 사람이 봐야 한다. **쓰기에 sudo 가 필요하다** |
| 4. DNS 레코드 | **사람** | 남음 | 대시보드 작업. CLI 로 해도 공개 주소가 열리는 순간이라 확인이 필요하다 |
| 5. Cloudflare Access 확인 | 에이전트 | **완료 — 조치 불필요** | 밖에서 응답 코드로 확인됐다 |
| 6. 검증 | 에이전트 | 남음 | curl 실행과 결과 보고 |
| 되돌리기 | **사람** | — | 장애 상황 판단 |

**2단계 담당이 바뀐 이유**: `.github/workflows/deploy.yml` 이 main push 때
`infra/k8s/frontend/jaywiki-web.yaml` 을 `kubectl apply` 한다. 사람이 따로 apply 할 필요가 없다.
Ingress 만으로는 공개되지 않으므로(3·4단계가 있어야 밖에서 닿는다) 먼저 들어가도 안전하다.

에이전트에게 맡길 때는 **그 단계만** 주고 결과를 받는다. 문서 전체를 주고 "알아서 해"라고 하지 않는다.
공개 경계를 건드리는 작업이라 어느 단계까지 갔는지 사람이 항상 알고 있어야 한다.

## 로컬에서는 이 문서가 필요 없다

로컬은 Cloudflare 도 Traefik 도 거치지 않는다. 블로그 화면은 `localhost:3000` 에서 바로 뜬다.

다만 **host 기반 rewrite 자체는 `localhost:3000` 으로 확인되지 않는다.** Host 헤더가
`blog.leneu.cloud` 가 아니기 때문이다. 로컬에서 rewrite 를 확인하려면 둘 중 하나를 쓴다.

```bash
# 1) Host 헤더를 직접 지정한다 (가장 간단, 서버 응답만 확인)
curl -s -H 'Host: blog.leneu.cloud' http://localhost:3000/ | grep -o '<title>[^<]*</title>'

# 2) 브라우저로 보려면 blog.localhost 를 쓴다.
#    middleware 가 'blog.' 접두사도 인식하게 만들어 두면 별도 hosts 편집이 필요 없다.
open http://blog.localhost:3000/
```

두 번째를 쓰려면 middleware 의 host 판정을 `blog.leneu.cloud` 하나로 고정하지 말고
`blog.` 로 시작하는 host 를 모두 블로그로 보내야 한다. 구현 계획에서 그렇게 만든다.

---

## 먼저 알아야 할 것 하나

**이 프로젝트의 Cloudflare Tunnel은 대시보드가 설정 정본이 아니다.**

miniPC에서 실행하는 locally configured tunnel이고, 실제 ingress 규칙은 cloudflared의
`config.yml`에 있다. 대시보드는 Tunnel 상태·DNS·Access를 보는 관리 화면에 가깝다.

| 화면 | 실제 역할 |
|---|---|
| Cloudflare 대시보드 | Tunnel 상태, DNS 레코드, Access 정책 |
| miniPC `config.yml` | **hostname을 어디로 보낼지 정하는 실제 ingress 규칙** |
| systemd `cloudflared` | config를 읽고 Tunnel 프로세스를 유지 |
| Traefik Ingress | 클러스터 안에서 host를 Service로 연결 |

이걸 헷갈려서 대시보드만 고치고 반영이 안 됐던 기록이
[Cloudflare Tunnel 설정 위치를 잘못 짚은 날](https://portfolio.leneu.cloud/wiki/cloudflare-tunnel-config-postmortem)에 있다.
**대시보드부터 열지 않는다. miniPC의 config.yml부터 본다.**

---

## 0단계. 선행 조건 확인  ·  에이전트

이 작업 전에 아래가 끝나 있어야 한다.

- [ ] Next.js `middleware.ts`에 host 기반 rewrite가 들어가 있다 (`blog.leneu.cloud` → `/blog/*`)
- [ ] 그 코드가 빌드되어 miniPC에 rollout 되어 있다

**아직이면 2~4단계를 하지 않는다.** rewrite 없이 hostname 을 열면 `blog.leneu.cloud`가
위키와 **똑같은 사이트를 두 번째 주소로 공개**한다. 인프라에는 문제가 없지만 검색엔진에는
중복 콘텐츠이고, 두 주소가 같은 내용으로 색인되면 어느 쪽도 이득을 보지 못한다.
공개 포트폴리오에서 굳이 만들 상태가 아니다.

### 선행 조건 전에 해도 되는 것

아래 둘은 읽기와 백업뿐이라 지금 해도 안전하고, 미리 해두면 본 작업이 빨라진다.

- **1단계** — `config.yml` 경로를 찾고 백업을 뜬다. 경로를 미리 알아두면 본 작업에서 헤매지 않는다.
- **5단계** — Cloudflare Access 정책이 `blog.leneu.cloud`를 덮는지 확인한다.
  덮고 있으면 정책을 먼저 조정해야 하므로 일찍 알수록 좋다.

2~4단계는 middleware 가 배포된 뒤에 한 번에 진행한다.

---

## 1단계. miniPC 접속과 현재 설정 위치 확인  ·  에이전트 (SSH 필요)  ·  **2026-08-03 완료**

> **결과 요약** — 다시 찾을 필요 없다.
> - 정본 경로: **`/etc/cloudflared/config.yml`** (systemd `ExecStart` 의 `--config` 로 확정)
> - 이 파일은 **world-readable 이라 sudo 없이 읽힌다.** 쓰기만 sudo 가 필요하다.
> - 백업: `~/config.yml.bak.20260803-090448` (원본 옆 백업은 sudo 가 필요해 남겨 뒀다)
> - 터널 UUID: `38074bba-cd0d-4d15-a410-7c8b4135ef96` — 4단계 방법 B 에서 쓴다

경로를 추측하지 말고 실행 중인 프로세스가 읽는 파일을 직접 찾는다.

```bash
ssh <miniPC>

# cloudflared 서비스가 어떤 명령으로 뜨는지 본다. --config 인자에 경로가 있다
systemctl cat cloudflared

# 위에 안 보이면 실행 중인 프로세스에서 확인
ps -ef | grep '[c]loudflared'

# 서비스 상태 확인
systemctl status cloudflared --no-pager
```

찾은 경로를 아래에서 `<CONFIG>`로 쓴다. 흔한 위치는 `/etc/cloudflared/config.yml`
또는 `~/.cloudflared/config.yml`이지만 **반드시 위 명령으로 확인한 경로를 쓴다.**

현재 내용을 본다.

```bash
sudo cat <CONFIG>
```

`ingress:` 아래에 `portfolio.leneu.cloud`와 `grafana.leneu.cloud` 규칙이 있고,
맨 아래에 `service: http_status:404` 같은 catch-all이 있을 것이다.

**백업부터 뜬다.**

```bash
sudo cp <CONFIG> <CONFIG>.bak.$(date +%Y%m%d-%H%M%S)
ls -l <CONFIG>*
```

---

## 2단계. Traefik Ingress에 host 추가  ·  편집은 에이전트, 적용은 사람

저장소의 매니페스트를 고친다. `infra/k8s/frontend/jaywiki-web.yaml`의 Ingress에
`blog.leneu.cloud` 규칙을 추가한다. Service는 기존 것을 그대로 쓴다.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: jaywiki-web
  namespace: frontend
spec:
  ingressClassName: traefik
  rules:
    - host: portfolio.leneu.cloud
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: jaywiki-web
                port:
                  number: 3000
    # 여기부터 추가
    - host: blog.leneu.cloud
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: jaywiki-web
                port:
                  number: 3000
```

적용한다.

```bash
kubectl apply -f infra/k8s/frontend/jaywiki-web.yaml
kubectl get ingress -n frontend jaywiki-web -o wide
```

`HOSTS` 열에 두 hostname이 모두 보이면 된다.

클러스터 안에서 먼저 확인한다. DNS가 아직 없어도 Host 헤더만 바꿔 부르면 된다.

```bash
kubectl run curl-check --rm -it --restart=Never --image=curlimages/curl -- \
  curl -s -o /dev/null -w '%{http_code}\n' \
  -H 'Host: blog.leneu.cloud' http://traefik.kube-system.svc.cluster.local/
```

`200`이면 Traefik까지는 연결된 것이다. `404`면 Ingress 규칙이 안 먹은 것이니 다음으로 넘어가지 않는다.

> Traefik Service 이름이 다르면 `kubectl get svc -A | grep traefik`으로 확인한다.

---

## 3단계. cloudflared config.yml에 ingress 규칙 추가  ·  사람  ·  **2026-08-03 완료**

> **검증 결과** — `ingress validate` 가 `OK`, `blog.leneu.cloud` 가 **Matched rule #1**
> (catch-all 이 아니다), `portfolio.leneu.cloud` 는 **#0** 로 그대로다. cloudflared 재시작됨.
> **SSH 도 이 터널을 타므로 재시작하면 SSH 세션이 끊긴다.** 정상이다 — 다시 붙으면 된다.

**순서가 중요하다.** cloudflared는 ingress 규칙을 **위에서부터 순서대로** 평가하고
처음 맞는 규칙을 쓴다. catch-all(`service: http_status:404`)은 **항상 맨 아래**여야 한다.
새 규칙을 catch-all 아래에 넣으면 영원히 도달하지 못한다.

```bash
sudo nano <CONFIG>
```

기존 `portfolio.leneu.cloud` 규칙 **바로 아래, catch-all 위에** 추가한다.

**2026-08-03 에 실제 파일을 확인했다.** 아래가 현재 내용이고, 추가할 것은 주석 친 두 줄뿐이다.
`portfolio` 규칙은 **평문 http 한 줄이고 `originRequest` 가 없다** — 이 문서가 원래 안내하던
`https://` + `originRequest` 복사는 이 환경에 맞지 않는다. 그대로 따라 하면 502 가 난다.

```yaml
tunnel: 38074bba-cd0d-4d15-a410-7c8b4135ef96
credentials-file: /etc/cloudflared/38074bba-cd0d-4d15-a410-7c8b4135ef96.json

ingress:
  # 공개
  - hostname: portfolio.leneu.cloud
    service: http://localhost:30220
  - hostname: blog.leneu.cloud          # ← 추가 (공개 묶음 안, Access 묶음 위)
    service: http://localhost:30220     # ← 추가 (portfolio 와 같은 값)
  - hostname: api.leneu.cloud
    service: http://localhost:80

  # Cloudflare Access 로 보호
  - hostname: grafana.leneu.cloud
    service: http://localhost:30220
  - hostname: admin.leneu.cloud
    service: http://localhost:80
  - hostname: ssh.leneu.cloud
    service: ssh://localhost:22
  - hostname: kube.leneu.cloud
    service: https://localhost:6443
    originRequest:
      noTLSVerify: true

  # catch-all 은 반드시 맨 마지막
  - service: http_status:404
```

> `30220` 은 Traefik 의 NodePort 다. `service` 값을 **새로 만들지 말고 `portfolio` 규칙에서
> 그대로 복사한다.** 같은 Traefik 으로 보내는 것이므로 값이 달라야 할 이유가 없다.
>
> **`# Cloudflare Access 로 보호` 주석 아래에 넣지 않는다.** 주석은 문법상 아무 힘이 없어
> 넣어도 동작은 하지만, 다음 사람이 blog 가 Access 뒤에 있다고 오해한다.

문법과 ingress 순서를 검증한다. **재시작 전에 반드시 한다.**

> **`--config` 는 `tunnel` 바로 뒤에 온다.** `ingress` 뒤에 붙이면
> `flag provided but not defined: -config` 로 죽는다.
> USAGE 가 `cloudflared tunnel [--config FILEPATH] ingress rule URL` 이다.

```bash
cloudflared tunnel --config <CONFIG> ingress validate
```

특정 URL이 어느 규칙에 걸리는지도 확인할 수 있다.

```bash
cloudflared tunnel --config <CONFIG> ingress rule https://blog.leneu.cloud/
```

출력에 `blog.leneu.cloud` 규칙이 매칭됐다고 나와야 한다. `http_status:404`가 나오면
규칙이 catch-all 아래에 있는 것이다.

검증이 통과하면 재시작한다.

```bash
sudo systemctl restart cloudflared
systemctl status cloudflared --no-pager
sudo journalctl -u cloudflared -n 40 --no-pager
```

로그에 커넥션이 다시 맺혔다는 메시지가 보이고 에러가 없어야 한다.

---

## 4단계. DNS 레코드 추가  ·  사람

Tunnel에 hostname을 연결한다. **두 방법 중 하나만** 하면 된다.

### 방법 A. CLI (권장)

miniPC에서 실행한다. 레코드를 자동으로 만들고 Tunnel에 붙인다.

```bash
# 터널 이름 또는 UUID 확인
cloudflared tunnel list

# DNS 레코드 생성
cloudflared tunnel route dns <터널이름또는UUID> blog.leneu.cloud
```

이미 있으면 에러가 나는데, 그 경우 방법 B로 값을 확인한다.

### 방법 B. 대시보드

Cloudflare 대시보드 → `leneu.cloud` → **DNS** → **Add record**

| 항목 | 값 |
|---|---|
| Type | `CNAME` |
| Name | `blog` |
| Target | `<터널UUID>.cfargotunnel.com` |
| Proxy status | **Proxied (주황 구름)** — 회색이면 Tunnel을 안 탄다 |
| TTL | Auto |

터널 UUID는 기존 `portfolio` 레코드의 Target에서 그대로 복사하면 된다. 같은 터널이다.

전파 확인:

```bash
dig +short blog.leneu.cloud
# Cloudflare 프록시 IP 가 나오면 정상 (터널 주소가 직접 보이지 않는다)
```

---

## 5단계. Cloudflare Access가 걸리지 않았는지 확인  ·  **2026-08-03 확인됨 — 조치 불필요**

> **와일드카드 정책은 없다.** 대시보드를 열지 않고 밖에서 확인했다.
>
> ```
> portfolio.leneu.cloud → 200        (Access 없음)
> grafana.leneu.cloud   → 302 …cloudflareaccess.com/…  (Access 있음)
> ```
>
> `*.leneu.cloud` 정책이 있었다면 `portfolio` 도 같이 302 로 튕겼을 것이다. 튕기지 않으므로
> Access 는 **hostname 별로** 걸려 있고, `blog.leneu.cloud` 는 별도 조치 없이 공개된다.
> 6단계 첫 요청에서 한 번 더 확인된다.

`grafana.leneu.cloud`는 Cloudflare Access 뒤에 있다. **블로그는 전면 공개**여야 하므로
Access 정책이 `*.leneu.cloud` 같은 와일드카드로 걸려 있지 않은지 본다.

대시보드 → **Zero Trust** → **Access** → **Applications**

- `blog.leneu.cloud`를 포함하는 Application이 있으면 제외하거나 대상에서 뺀다
- 없으면 그대로 두면 된다

확인 방법은 6단계의 첫 요청이다. 로그인 화면으로 302되면 Access가 걸린 것이다.

---

## 6단계. 검증  ·  에이전트

```bash
# 1) 공개 접근 — 200 이어야 한다. 302 로 cloudflareaccess.com 이 나오면 5단계로 돌아간다
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' https://blog.leneu.cloud/

# 2) 기존 사이트가 멀쩡한지 — 함께 확인한다
curl -s -o /dev/null -w '%{http_code}\n' https://portfolio.leneu.cloud/
curl -s -o /dev/null -w '%{http_code}\n' https://portfolio.leneu.cloud/wiki/jaywiki-main-map

# 3) 인증서 — Cloudflare 가 자동 발급한다
curl -sI https://blog.leneu.cloud/ | head -3

# 4) 두 host 가 서로 다른 화면을 내는지 (middleware rewrite 적용 후에만 의미 있음)
curl -s https://blog.leneu.cloud/ | grep -o '<title>[^<]*</title>'
curl -s https://portfolio.leneu.cloud/ | grep -o '<title>[^<]*</title>'
```

체크리스트:

- [ ] `blog.leneu.cloud` 200
- [ ] `portfolio.leneu.cloud` 200 (기존 사이트 영향 없음)
- [ ] HTTPS 인증서 정상
- [ ] Access 로그인 화면으로 튕기지 않음
- [ ] middleware 적용 후: 두 host의 `<title>`이 다름

---

## 되돌리기  ·  사람

문제가 생기면 역순으로 되돌린다. **DNS를 먼저 지우면 안 된다** — 그러면 원인 파악이 어려워진다.

```bash
# 1) cloudflared config 복구
sudo cp <CONFIG>.bak.<타임스탬프> <CONFIG>
cloudflared tunnel --config <CONFIG> ingress validate
sudo systemctl restart cloudflared

# 2) Traefik Ingress 되돌리기 — blog host 블록을 지우고 다시 apply
kubectl apply -f infra/k8s/frontend/jaywiki-web.yaml

# 3) DNS 레코드 삭제 (대시보드에서. 마지막에 한다)
```

`portfolio.leneu.cloud`가 200을 유지하는지 매 단계 확인한다.

---

## 자주 틀리는 곳

| 증상 | 원인 | 확인 |
|---|---|---|
| 404가 계속 나온다 | ingress 규칙이 catch-all 아래에 있다 | `cloudflared tunnel --config <CONFIG> ingress rule https://blog.leneu.cloud/` |
| 502 / 원본 연결 실패 | Traefik Ingress에 host가 없다 | `kubectl get ingress -n frontend jaywiki-web -o wide` |
| 로그인 화면으로 튕긴다 | Cloudflare Access가 걸려 있다 | Zero Trust → Access → Applications |
| DNS가 안 잡힌다 | Proxy status가 회색(DNS only)이다 | 대시보드 DNS 화면에서 주황 구름 확인 |
| 대시보드를 고쳤는데 그대로다 | **설정 정본은 miniPC의 config.yml이다** | 1단계로 돌아간다 |
| 블로그가 위키와 같은 화면 | middleware rewrite가 아직 배포 안 됨 | 0단계 선행 조건 |

---

## 이 작업이 건드리지 않는 것

혼동을 막기 위해 적어 둔다.

- **Pod가 늘지 않는다.** 기존 `jaywiki-web` Deployment를 그대로 쓴다
- **새 이미지가 필요 없다.** middleware 코드가 들어간 이미지 한 번만 rollout하면 된다
- **`APP_PUBLIC_ORIGIN`은 그대로 둔다.** `https://portfolio.leneu.cloud`다.
  OAuth 콜백과 위키의 절대 URL 생성이 이 값을 쓴다. 블로그는 읽기 전용 공개라
  이 값을 바꿀 필요가 없고, 바꾸면 OAuth가 깨진다
- **`jw_token` 쿠키 설정을 건드리지 않는다.** 블로그는 로그인이 없고 관리자 편집은
  계속 `portfolio.leneu.cloud/admin`에서 한다
- **백업 설정을 건드리지 않는다.** `pg_dump`가 DB 전체를 뜨므로 새 테이블이 자동 포함된다
