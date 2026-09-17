# miniPC 감시 재부팅 런북 (2회차)

1회차는 2026-07-07 에 했고 결과가 위키 `minipc-reboot-recovery-drill` 에 있다.
**그 글이 스스로 "기록하지 못했다"고 적은 값이 회복 시각이다. 2회차의 목적은 그 빈칸을 채우는 것.**

작성 2026-08-08. **2026-08-09 23:31 에 실행했고 결과 표를 채웠다.** 자동 재부팅(⑤)까지 켰다.

## 왜 하는가

```
*** System restart required ***
libc6, linux-image-6.8.0-137-generic, linux-base
```

`unattended-upgrades` 는 켜져 있는데 `Automatic-Reboot` 이 꺼져 있다. 커널·libc 패치가
**설치만 되고 적용이 안 된 채 18일 누적**됐다. 정기 재부팅으로 풀 문제가 아니라,
필요할 때만 도는 자동 재부팅을 켜야 하는 문제다.

**순서가 중요하다: 감시 재부팅 → 그다음 자동화.** 자동 재부팅을 먼저 켜면 아무도 안 보는
새벽에 첫 회차가 돈다. `spellcrown` 은 아직 재부팅을 한 번도 안 겪었다.

## 1회차와 달라진 것

| | 내용 |
|---|---|
| `spellcrown.service` | 신규. `enabled` 는 확인했지만 재부팅 실증은 처음이다 |
| `cloudflared` | `Restart=always` drop-in 이 새로 붙었다 (2026-08-08 SIGHUP 사고 대응) |
| 검증 위치 | 터널 밖에서 잰다. 사용자가 겪는 다운타임은 밖에서만 보인다 |
| 접근 경로 | 사설망 SSH 가 실증됐다. 1회차 때는 터널이 유일한 경로였다 |

## 실행 전 검토 (2026-08-08, fable 코멘트 + 실측 확인)

초안을 그대로 돌리면 **1회차와 같은 실패를 반복한다는 지적이 나왔고, 맞았다.**
초안의 ④는 사람이 다시 붙는 시점에 한 번 훑는 방식이라 전부 이미 `1/1` 로 보인다.
"돌아왔다"는 알 수 있지만 **몇 시에 돌아왔는지가 안 남는다** — 그게 2회차의 전부인데.

받은 지적과 처리:

| 지적 | 확인 결과 | 처리 |
| --- | --- | --- |
| ④가 시각을 못 남긴다 | 맞다 | **④를 판정과 수확으로 나눴다.** 시각은 `ActiveEnterTimestamp` 와 Ready `lastTransitionTime` 으로 사후에 캐낸다 |
| 폴링 한 루프가 3호스트 순차라 최대 9초 밀린다 | 맞다 | 호스트별 백그라운드 루프로 분리, 시각을 curl 뒤에 찍음 |
| 맥이 자면 폴링이 끊긴다 | 맞다 | `caffeinate -i -w $$` 추가 |
| 터널이 죽어도 `000` 이 아니라 `530` 이다 | 그럴듯함 | 판독 기준으로 명시 |
| `Restart=always` 가 재부팅을 견디는지 안 본다 | 맞다 | ⑤ 진입 관문으로 승격 |
| `.rooms.json` 을 표에만 적고 안 본다 | 맞다 | ④-2 와 관문에 넣음 |
| `sed ,+1d` 가 `originRequest` 블록을 깨뜨릴 수 있다 | **이 설정에는 해당 없음.** 대상 둘 다 정확히 2줄이고 `originRequest` 는 `kube` 에만 있다 | 확인 사실을 ①에 적고, 실행 직전 재확인하라는 단서만 남김 |
| ①을 ④ 뒤로 미루라 | 채택하지 않음 | `validate` 게이트 + 2줄 확인 + ⓪ 사설망 확인이면 위험이 낮고, 미루면 cloudflared 재시작이 한 번 더 필요해 공개 표면이 따로 끊긴다 |

**사후 수확이 된다는 것이 이번 검토의 핵심이다.** 실시간으로 지켜볼 필요가 없으니
사람은 재부팅 순간에 매여 있지 않아도 되고, 놓쳐도 표를 채울 수 있다. 아래는 실측으로
확인한 값이다(2026-08-08 09:5x, 재부팅 전).

```
ActiveEnterTimestamp=Mon 2026-07-20 08:12:58 KST   # k3s
ActiveEnterTimestamp=Fri 2026-08-07 23:58:39 KST   # cloudflared (SIGHUP 사고 복구 시각)
ActiveEnterTimestamp=Sat 2026-08-08 09:35:19 KST   # spellcrown
Restart=always
node Ready lastTransitionTime: 2026-06-27T07:09:49Z
```

## 사전 스냅샷 (2026-08-08 00:5x 측정)

| 대상 | 값 |
|---|---|
| k3s node | `jaypc` Ready, v1.36.2+k3s1 |
| Deployment | 13개 전부 1/1 |
| StatefulSet | 7개 전부 1/1 (kafka, pg-postgresql, portfolio-search-master, redis-master, loki, prom-alertmanager, tempo) |
| systemd | `k3s` `cloudflared` `spellcrown` `actions.runner.jaymunsh-jay-wiki.jaypc` 4개 running |
| 공개 경로 | portfolio 200, blog 200, spellcrown 200 |

`backend/jaywiki` 가 1/1 이다. 1회차 때는 HPA 가 확장한 상태라 2/2 였다.
(**실행 시점에는 다시 2/2 였다.** 08-09 배포로 늘어난 뒤 HPA 가 줄이지 않았다.
결과 절 참조 — 위키 글의 `2/2` 표기는 고칠 것이 없다.)

**단, 이 스냅샷은 이미 낡았다.** 2026-08-08 09:5x 에 배포가 돌면서 `jaywiki` Pod 가 둘로 늘었다
(`00:55:13Z`, `00:56:33Z` Ready). 재부팅 직전에 스냅샷을 다시 뜨고, 회복 판정은 그 값과 비교한다.
배포 직후에는 HPA 가 아직 줄이지 않은 상태일 수 있다.

## 절차

### ⓪ 사설망 경로부터 확인한다 — 다른 무엇보다 먼저

터널이 안 돌아오면 이게 유일한 손이다. **끊긴 뒤에 확인하면 늦다.**

```bash
ssh -o BatchMode=yes -o ConnectTimeout=6 -i ~/.ssh/id_ed25519_minipc jaymunsh@192.168.0.82 'echo LAN_OK; uptime -p'
```

`LAN_OK` 가 안 나오면 **여기서 멈춘다.** 맥이 같은 랜에 있는지부터 본다.
(2026-08-08 09:5x 확인: `LAN_OK`, uptime 2주 5일.)

### ① 죽은 ingress 줄 제거

`api.leneu.cloud` 와 `admin.leneu.cloud` 는 `http://localhost:80` 을 가리키는데 그 포트에
아무도 없다(Traefik 은 NodePort 30220). 외부 `api` → 502, 내부 `curl -H "Host: api..." localhost:80` → `000`.

**어차피 재부팅이 cloudflared 를 재시작하므로 지금 지우면 추가 다운타임이 0이다.**
따로 지우려면 그것만으로 공개 표면이 한 번 끊긴다.

```bash
ssh -t -i ~/.ssh/id_ed25519_minipc jaymunsh@192.168.0.82 \
  'sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml.bak.$(date +%Y%m%d-%H%M%S) && \
   sudo sed -i "/hostname: api.leneu.cloud/,+1d; /hostname: admin.leneu.cloud/,+1d" /etc/cloudflared/config.yml && \
   sudo cloudflared tunnel --config /etc/cloudflared/config.yml ingress validate && \
   cat /etc/cloudflared/config.yml'
```

**`tunnel` 이 빠지면 안 된다.** `cloudflared ingress validate` 는 하위 명령을 못 찾아
"use `cloudflared tunnel run` …" 만 찍고 **exit 1** 로 끝난다. `&&` 로 이어 붙인 뒤 단계가
조용히 건너뛰어져서 검증을 한 줄도 못 본 채 지나간다(2026-08-09 에 실제로 밟았다).
`validate` 자체는 sudo 없이도 돈다 — 설정 파일이 읽기 가능하다.

여기서 멈추고 출력을 확인한다. `api`·`admin` 이 사라졌고 `validate` 가 통과해야 한다.
**이 단계는 cloudflared 를 건드리지 않으므로 사이트가 안 끊긴다.**

`sed` 의 `,+1d` 는 "다음 한 줄"을 지운다. 대상 둘이 정확히 2줄인지 **미리 확인했다**
(2026-08-08). `originRequest` 블록이 붙은 건 `kube.leneu.cloud` 하나뿐이고 대상이 아니다.

```yaml
  - hostname: api.leneu.cloud        # 2줄
    service: http://localhost:80
  - hostname: admin.leneu.cloud      # 2줄
    service: http://localhost:80
```

**설정이 그 사이 바뀌었을 수 있으니 실행 직전에 다시 본다.** `cat /etc/cloudflared/config.yml`
은 sudo 없이 읽힌다. 줄 수가 다르면 `sed` 를 쓰지 말고 손으로 고친다 — 잘못 지우면
`validate` 를 통과하고도 재부팅 뒤 터널이 안 돌아온다. 그러면 이번 회차 측정이 오염될 뿐
아니라 SSH 도 같이 잃는다(그래서 ⓪이 먼저다).

### ② 폴링 시작 (재부팅 전에 켠다)

로컬 맥에서. 밖에서 재야 사용자가 겪는 다운타임이다.

**호스트마다 별도 루프로 돌린다.** 한 루프에서 셋을 순차로 돌면 최악의 경우 한 바퀴가 11초라
(3 × `--max-time 3` + sleep 2) 세 번째 호스트의 기록 시각이 최대 9초 밀린다. 결과 표가
요구하는 초 단위 정밀도가 안 나온다. 시각은 curl **뒤에** 찍는다.

```bash
for h in portfolio blog spellcrown; do
  ( while true; do
      code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "https://$h.leneu.cloud")
      printf '%s %s %s\n' "$(date +%H:%M:%S)" "$h" "$code"
      sleep 2
    done ) >> /tmp/reboot-poll-$h.log &
done
caffeinate -i -w $$ &        # 재부팅 대기 중 맥이 자면 폴링이 끊긴다
```

사설망 SSH 재연결 시각도 여기서 잡는다 (결과 표의 「SSH(사설망) 재연결」 행).

```bash
# 먼저 끊기기를 기다린 다음 복귀를 잰다. 순서를 뒤집으면 안 된다.
( while nc -z -G 2 192.168.0.82 22 2>/dev/null; do sleep 2; done
  echo "SSH down $(date +%H:%M:%S)"
  while ! nc -z -G 2 192.168.0.82 22 2>/dev/null; do sleep 2; done
  echo "SSH up $(date +%H:%M:%S)" ) >> /tmp/reboot-poll-ssh.log &
```

**끊김을 먼저 기다리는 절이 없으면 아무것도 못 잰다.** 2026-08-09 회차에서 초안대로
「올라올 때까지 기다린다」만 걸었다가, 재부팅 5분 전 폴링을 켠 그 순간 이미 열려 있어
`SSH up 23:26:28` 로 즉시 찍히고 끝났다. 그 회차의 SSH 재연결 시각은 못 얻었다.

**끊긴 신호는 `000` 이 아니라 `530` 이다.** 터널이 죽어도 Cloudflare 엣지가 즉시 응답하므로
`--max-time 3` 이 안 걸린다. 마지막 200 과 첫 200 사이가 다운타임이고, 그 사이는 530 으로 찬다.
`000` 이 보이면 그건 터널이 아니라 맥의 네트워크가 끊긴 것이다.

### ③ 재부팅

**반드시 사설망 세션에서.** 터널 경유로 하면 회복 과정을 못 본다.

```bash
ssh -t -i ~/.ssh/id_ed25519_minipc jaymunsh@192.168.0.82 'sudo systemctl reboot'
```

### ④ 검증 — 통과 판정과 시각 캐내기를 나눈다

1회차가 실패한 지점이 여기다. 1회차는 "돌아왔다"만 확인하고 **몇 시에 돌아왔는지를 안 적었다.**
사람이 다시 붙는 시점에 한 번 훑으면 전부 이미 `1/1` 이라 시각이 안 남는다.

**핵심: 계층별 회복 시각은 나중에 캐낼 수 있다.** 실시간으로 지켜볼 필요가 없다.
systemd 는 `ActiveEnterTimestamp` 를, k8s 는 Pod Ready 조건의 `lastTransitionTime` 을 들고 있다.
(2026-08-08 에 실제로 확인함 — `spellcrown` 재시작 시각 `09:35:19` 를 이 방법으로 얻었다.)

**단 node 는 예외다.** `kubectl get node` 의 Ready `lastTransitionTime` 은 재부팅에도
안 바뀐다 — 2026-08-09 회차에서 재부팅 뒤에도 `2026-06-27T07:09:49Z` 그대로였다.
NotReady 로 넘어가기 전에 노드가 돌아오기 때문이다. **node 회복 시각은 Pod Ready 시각의
가장 이른 값으로 대신한다.**

**④-1 통과 판정** — 헤더만 남으면 전부 회복이다.

```bash
ssh -i ~/.ssh/id_ed25519_minipc jaymunsh@192.168.0.82 \
  'uptime -p; kubectl get node; kubectl get deploy,sts -A | grep -v "1/1"; \
   systemctl is-active k3s cloudflared spellcrown actions.runner.jaymunsh-jay-wiki.jaypc'
```

**④-2 시각 수확** — 결과 표를 채운다. 몇 시간 뒤에 돌려도 값이 남아 있다.

```bash
ssh -i ~/.ssh/id_ed25519_minipc jaymunsh@192.168.0.82 '
  echo "== systemd 기동 시각 =="
  systemctl show -p ActiveEnterTimestamp k3s cloudflared spellcrown actions.runner.jaymunsh-jay-wiki.jaypc
  echo "== cloudflared 재시작 정책이 살아남았나 =="
  systemctl show cloudflared -p Restart
  echo "== node Ready =="
  kubectl get node jaypc -o jsonpath="{.status.conditions[?(@.type==\"Ready\")].lastTransitionTime}"; echo
  echo "== pod Ready =="
  kubectl get pods -A -o jsonpath="{range .items[*]}{.metadata.name} {.status.conditions[?(@.type==\"Ready\")].lastTransitionTime}{\"\n\"}{end}" | sort -k2
  echo "== spellcrown 방 상태 =="
  ls -l --time-style=full-iso ~/spellcrown/.rooms.json'
```

**⑤로 넘어가기 전 통과해야 할 관문 셋.** 하나라도 어긋나면 그 자리에서 멈춘다.

| 관문 | 왜 |
| --- | --- |
| `systemctl show cloudflared -p Restart` → `Restart=always` | 2026-08-08 SIGHUP 사고의 정확한 재발 방지책이다. drop-in 이 재부팅을 견디는지가 이번에 처음 확인된다. 이게 안 붙어 있으면 무인 재부팅은 터널과 SSH 를 함께 잃는 도박이 된다 |
| `.rooms.json` 이 재부팅 뒤에도 있다 | SIGTERM 저장 경로가 실제 종료에서 도는지는 검증된 적이 없다. 안 남으면 무인 재부팅이 진행 중인 판을 조용히 죽인다 |
| 공개 3개 호스트가 200 | 당연하지만, 폴링 로그로 시각과 함께 확인한다 |

### ⑤ 자동 재부팅 켜기 — **④가 통과한 뒤에만**

```bash
ssh -t -i ~/.ssh/id_ed25519_minipc jaymunsh@192.168.0.82 \
  'printf "Unattended-Upgrade::Automatic-Reboot \"true\";\nUnattended-Upgrade::Automatic-Reboot-WithUsers \"true\";\nUnattended-Upgrade::Automatic-Reboot-Time \"04:00\";\n" \
   | sudo tee /etc/apt/apt.conf.d/52auto-reboot >/dev/null && sudo unattended-upgrade --dry-run -v 2>&1 | tail -3'
```

확인은 이걸로 한다. `unattended-upgrade --dry-run` 은 업그레이드 로직을 보지 재부팅 설정을 안 본다.

```bash
ssh -i ~/.ssh/id_ed25519_minipc jaymunsh@192.168.0.82 'apt-config dump | grep -i Automatic-Reboot'
```

`reboot-required` 가 생긴 날에만 04:00 에 돈다. `ai-trend-bot` cron(07:30)과 안 겹친다.
`apt-daily-upgrade.timer` 가 06:32 에 도니 패치 적용은 그다음 새벽이 된다 — 하루 늦지만
타이머까지 옮기면 파일이 둘로 는다.

**`Automatic-Reboot` 에는 "지금 바쁜지" 를 보는 장치가 없다.** 이 기계에서 걸리는 건 셋이다.

| 대상 | 무인 재부팅이 끊는 것 | 판단 |
| --- | --- | --- |
| `spellcrown` | 진행 중인 판. SIGTERM 저장으로 살아남아야 한다 | ④의 관문으로 검증하고 넘어간다 |
| Actions 러너 | 04:00 에 도는 잡. 배포가 그 시각에 걸리면 중단된다 | 사람이 자는 시간이라 실질 위험은 낮다 |
| k3s StatefulSet | 정상 종료 경로가 있다 | 1회차에서 회복 확인됨 |

러너까지 막고 싶으면 u-u 의 재부팅을 끄고 타이머로 조건을 거는 방법이 있다.
**다만 파일이 하나 더 늘고 04:00 은 이미 한산하다. 안 넣는 쪽을 기본으로 하되,
"안 넣기로 정했다" 를 여기 적어 두는 것이 요점이다** — 빠뜨린 것과 정한 것은 다르다.

```bash
# 필요해지면 이 조건을 쓴다 (지금은 안 넣는다)
[ -f /var/run/reboot-required ] && ! pgrep -f Runner.Worker && systemctl reboot
```

### ⑥ 위키 반영

`scripts/seed-portfolio-wiki.mjs` 의 `minipc-reboot-recovery-drill` 을 고친다.
**정본은 seed 스크립트다. `posts/jay-wiki/` 는 낡은 스냅샷이라 고쳐도 화면이 안 바뀐다.**

- 「다음 기록에 남길 것」 4개 중 회복 시각 관련 3개를 아래 결과 표로 대체
- 확인 대상 표에 `spellcrown` 추가
- backend `2/2` → 이번 관측값
- 본문에 백틱 금지 (`String.raw` 안이다)

`main` 머지 시점에 시드가 자동으로 돌아 운영에 반영된다.

## 되돌리기

| 단계 | 되돌리는 법 |
|---|---|
| ① | `config.yml.bak.<timestamp>` 로 복원 |
| ③ 이 실패 | 사설망 SSH 가 살아 있다. 터널이 안 돌아와도 손이 닿는다 |
| ⑤ | `/etc/apt/apt.conf.d/52auto-reboot` 삭제 |

---

## 결과 — 2026-08-09 23:31 실행

재부팅 명령 `23:31:34`, 커널 부팅 `23:31:48`(14초). 실행 시점 uptime 은 2주 6일 15시간이었고
`reboot-required` 가 떠 있었다. 재부팅 뒤 사라졌으므로 밀려 있던 커널·libc 패치가 적용됐다.

### 회복 시각 (외부 폴링 기준, 2초 간격)

| 대상 | 마지막 200 | 첫 복귀 200 | 다운타임 |
|---|---|---|---|
| portfolio.leneu.cloud | 23:31:31 | 23:32:31 | **60초** |
| blog.leneu.cloud | 23:31:31 | 23:32:30 | **59초** |
| spellcrown.leneu.cloud | 23:31:32 | 23:32:00 | **28초** |

**응답 코드가 계층을 그대로 보여준다.** 셋 다 `530`(터널 down)으로 시작해서,
portfolio·blog 는 `502`(터널 복귀, Traefik 아직) → `503`(Traefik 복귀, Pod 아직) → `200`
순으로 올라왔다. spellcrown 은 k3s 를 안 거치므로 `530` → `200` 으로 끝났고 그래서 절반이다.

첫 200 뒤에도 `000`(3초 타임아웃)이 portfolio 23:32:47, blog 23:32:46 까지 몇 번 섞였다.
**복귀 직후 첫 응답들이 느리다** — 200 하나로 "끝났다"고 보면 실제 체감은 20초쯤 더 간다.

### 계층별

| 대상 | 준비 시각 | 비고 |
|---|---|---|
| SSH(사설망) 재연결 | **못 쟀다** | 폴링 스크립트가 끊김을 안 기다렸다. ②에 고쳐 뒀다 |
| k3s node Ready | **이 방법으로는 못 잰다** | `lastTransitionTime` 이 `2026-06-27` 그대로다. ④-2 참조 |
| spellcrown | 23:31:53 | **첫 재부팅 통과.** `.rooms.json` mtime 이 `23:31:34` — 종료 순간 SIGTERM 저장 경로가 실제로 돌았다 |
| actions.runner | 23:32:00 | |
| cloudflared | 23:32:01 | `Restart=always` 가 재부팅을 견뎠다 |
| k3s | 23:32:08 | |
| Pod 첫 Ready | 23:32:12 | Pod 28개 중 23개가 재기동했다 |
| Deployment 13 / StatefulSet 7 | 23:33:05 | 마지막은 `portfolio-search-master-0`. 명령 시점부터 **91초** |

`backend/jaywiki` 는 재부팅 전후 모두 `2/2` 였다(HPA 확장 상태). 1회차의 `2/2` 표기가
낡은 게 아니라 그때와 같은 상태다 — 위키 글의 그 줄은 고칠 것이 없다.

### ⑤ 자동 재부팅

관문 셋(`Restart=always` / `.rooms.json` 생존 / 공개 3호스트 200)을 전부 통과해 켰다.
`/etc/apt/apt.conf.d/52auto-reboot`, 04:00, `apt-config dump` 로 반영 확인.

### 회복하지 못한 것 / 수동 조치

**없음.** 재부팅 뒤 손댄 것이 하나도 없다. 죽은 ingress 줄 제거(①)는 재부팅 전에 했고
그 자체로는 끊김이 없었다.

### 다음 회차에 고쳐 갈 것

| 항목 | 내용 |
|---|---|
| ① 명령 | `cloudflared tunnel ingress validate` — `tunnel` 빠뜨리면 exit 1 로 조용히 건너뛴다 |
| ② SSH 폴링 | 끊김을 먼저 기다리는 절이 있어야 한다 |
| ④-2 node | Ready `lastTransitionTime` 은 안 움직인다. Pod Ready 최솟값을 쓴다 |
| 다운타임 정의 | 첫 200 이 아니라 `000` 이 그친 시각까지 봐야 체감에 맞는다 |
