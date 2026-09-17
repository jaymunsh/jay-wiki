
- 대시보드에서 고친 Tunnel ingress가 왜 실제 요청 경로에 반영되지 않았나?
- 이 프로젝트의 Tunnel은 locally configured tunnel이라 ingress 규칙의 정본은 대시보드가 아니라 miniPC의 config.yml이며, 이후 변경은 SSH로 붙어 그 파일부터 확인하기로 판단했다.
- config.yml의 hostname 매핑 확인, cloudflared tunnel --config <CONFIG> ingress validate, 재시작 뒤 공개 URL의 HTTP 응답 확인 순서로 복구했다.

Cloudflare Tunnel은 대시보드에서도 보이고 miniPC에서도 실행된다. 이 두 화면이 같은 설정을 뜻한다고
생각하면 문제를 엉뚱한 곳에서 고치게 된다.

## 증상 — 대시보드에서 고친 ingress 가 반영되지 않았다

공개 도메인의 ingress 규칙을 바꾸려 했지만, 대시보드에서 수정한 내용이 실제 요청 경로에 반영되지 않았다.
Tunnel은 정상처럼 보였고, Traefik과 web Pod도 살아 있었기 때문에 어디가 설정의 Source of Truth인지
먼저 다시 확인해야 했다.

## 원인 — 정본은 대시보드가 아니라 miniPC 의 config.yml 이다

이 프로젝트의 Tunnel은 miniPC에서 실행하는 locally configured tunnel이다. 실제 ingress 규칙은
cloudflared의 config.yml에 있고, 대시보드는 Tunnel의 상태와 DNS 연결을 보여주는 관리 화면에 가깝다.

| 구분 | 이 프로젝트에서의 역할 |
|---|---|
| Cloudflare 대시보드 | Tunnel 상태, DNS, Access 정책 확인 |
| miniPC config.yml | hostname을 Traefik과 내부 서비스로 연결하는 실제 ingress 규칙 |
| systemd cloudflared | config를 읽고 Tunnel 프로세스를 유지 |
| Traefik | 클러스터 내부 Ingress를 web Service로 연결 |

## 복구 순서 — config.yml 에서 시작해 공개 URL 로 끝난다

1. miniPC의 config.yml에서 hostname과 service 매핑을 확인한다.
2. cloudflared tunnel --config <CONFIG> ingress validate로 문법과 ingress 순서를 확인한다.
3. cloudflared 서비스를 재시작한다.
4. systemd active 상태와 Tunnel 연결 상태를 확인한다.
5. 공개 URL을 호출해 HTTP 응답을 확인한다.

## 이 사건 뒤로 대시보드를 먼저 열지 않는다

이 일 이후로 ingress 규칙을 바꿀 때는 대시보드를 먼저 열지 않는다. 대시보드에 보인다는 이유만으로
대시보드가 설정의 Source of Truth는 아니다. miniPC에 SSH로 붙어 cloudflared가 읽고 있는 config.yml을
확인하는 것이 첫 단계다. 어떤 hostname을 어디로 보내는지는
[miniPC k3s와 Cloudflare Tunnel 배포 구조](/wiki/minipc-k3s-cloudflare)에 정리했다.
