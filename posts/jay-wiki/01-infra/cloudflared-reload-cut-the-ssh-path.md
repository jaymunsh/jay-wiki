---
title: "터널을 고치려다 터널로 들어가는 문을 닫은 날"
slug: cloudflared-reload-cut-the-ssh-path
tab: "인프라"
parentId: infra
sortOrder: 6
kind: postmortem
tags: cloudflare,tunnel,systemd,incident,infra
source: scripts/seed-portfolio-wiki.mjs
---
- cloudflared에 보낸 SIGHUP 하나가 왜 공개 hostname 전부와 SSH 복구 경로까지 함께 끊었나?
- 원인을 없애는 대신 Restart=always drop-in으로 어떤 종료도 복구 불가능 상태로 이어지지 않게 막고, ingress 수정은 사설망에서 붙어 몰아서 한 번에 하기로 판단했다.
- systemd 로그의 Sent signal SIGHUP과 Deactivated successfully 두 줄로, 이 버전이 SIGHUP을 정상 종료로 받아 Restart=on-failure가 다시 띄우지 않았음을 확인했다.

ingress에 hostname 하나를 추가하는 작업이었다. 설정 파일의 위치도 알았고, 넣을 내용도 맞았다.
틀린 것은 **그 설정을 반영하는 방법**이었다.

## 증상 — SIGHUP 하나에 공개 hostname 전부가 530 을 냈다

새 hostname 블록을 config.yml에 넣고 반영하려 했다.

1. systemctl reload cloudflared → 실패
2. 대신 systemctl kill -s HUP cloudflared 를 보냄
3. **공개 hostname 전부가 530을 돌려주기 시작했다**
4. SSH 세션이 끊겼고, 다시 붙으려 하자 websocket bad handshake

포트를 열어 둔 적이 없는 서버라, 원격에서 손을 넣을 방법이 하나도 남지 않았다.

## 원인 — 정상 종료와 Restart=on-failure 가 맞물렸다

두 가지가 겹쳤다. 하나만 있었으면 사고가 아니었다.

### 1. cloudflared는 SIGHUP을 reload가 아니라 종료로 받는다

유닛에 ExecReload가 없어서 systemctl reload는 애초에 실패한다. 그래서 관례대로 SIGHUP을 보냈는데,
이 버전은 그것을 정상 종료 신호로 처리했다.

~~~
systemd[1]: Sent signal SIGHUP to main process (cloudflared) on client request.
systemd[1]: cloudflared.service: Deactivated successfully.
~~~

유닛은 Restart=on-failure였다. **정상 종료는 실패가 아니므로 systemd가 다시 띄우지 않았다.**
설정 하나가 틀린 게 아니라, 두 설정이 맞물려 조용히 죽는 조합이었다.

### 2. 원격 접근 경로가 고치려는 대상 안에 있었다

SSH는 ssh.leneu.cloud를 통해 같은 Tunnel로 들어온다. 인바운드 포트를 열지 않는다는 원칙의 결과인데,
그 원칙이 **자기 자신을 고칠 때만은 반대로 작동한다.** 터널이 죽으면 터널을 되살릴 통로도 같이 죽는다.

같은 공유기 안의 사설 IP로 직접 SSH를 붙여 복구했다. 이 경로가 없었으면 기계 앞까지 가야 했다.

## 고친 것 — Restart=always 로 어떤 종료든 다시 띄운다

~~~
# /etc/systemd/system/cloudflared.service.d/restart.conf
[Service]
Restart=always
~~~

이제 어떤 이유로 종료되든 systemd가 다시 띄운다. 원인을 없앤 것이 아니라
**원인이 복구 불가능 상태로 이어지지 않게** 막은 것이다.

## 남는 규칙 — ingress 수정은 사설망에서 몰아서 한다

| 항목 | 결론 |
|---|---|
| ingress 반영 방법 | restart뿐이다. reload는 유닛이 지원하지 않고 SIGHUP은 종료된다 |
| 실행 위치 | **사설망에서 붙어서 한다.** Tunnel 경유로 restart하면 자기가 앉은 가지를 자른다 |
| 재시도 비용 | 공개 표면 전체가 잠깐 끊긴다. ingress 수정은 몰아서 한 번에 한다 |

마지막 줄이 실무에서 제일 크다. hostname 하나 지우자고 restart하지 않게 되고,
그래서 config.yml에 죽은 항목이 쌓인다. 실제로 아무도 듣지 않는 localhost:80을 가리키던
api와 admin 두 줄이 한동안 그렇게 남아 있었고, 몰아서 정리한 지금은 config에 없다.

## 앞선 사건과의 차이 — 위치가 아니라 동작을 몰랐다

[Cloudflare Tunnel 설정 위치를 잘못 짚은 날](/wiki/cloudflare-tunnel-config-postmortem)은
**어느 파일이 정본인지** 몰라서 생긴 일이었다. 이번은 파일도 내용도 맞았고, 그 파일을 읽히는
동작이 무엇을 끊는지를 몰랐다.

설정의 위치를 아는 것과, 그 설정을 적용하는 명령이 무엇을 끊는지 아는 것은 다른 지식이다.
단일 노드에서는 후자가 더 자주 사람을 다치게 한다.
