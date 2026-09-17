#!/bin/zsh
# 기존 복구 순서를 유지하며 외부 netrecord로 복구 전후 기록한다.
# sudo route는 사용자가 fixnet을 실행했고 터널 경로를 확인했을 때만 실행된다.
export PATH="$HOME/.local/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
SCRIPT_DIR=${0:A:h}
NETRECORD_BIN=${FIXNET_NETRECORD:-"$SCRIPT_DIR/netrecord.py"}
[ -x "$NETRECORD_BIN" ] || NETRECORD_BIN="$HOME/.local/bin/netrecord"

netsnap() {
  if [ ! -x "$NETRECORD_BIN" ]; then
    echo "netrecord 실행 파일을 찾을 수 없음: $NETRECORD_BIN" >&2
    return 127
  fi
  "$NETRECORD_BIN" "$@"
}

https_ok() {
  /usr/bin/curl -q --noproxy '*' -4 -sS -o /dev/null --connect-timeout 3 --max-time 6 https://1.1.1.1/ >/dev/null 2>&1 &&
    /usr/bin/curl -q --noproxy '*' -4 -sS -o /dev/null --connect-timeout 3 --max-time 6 https://8.8.8.8/dns-query >/dev/null 2>&1
}

domain_ok() {
  /usr/bin/curl -q --noproxy '*' -4 -sS -o /dev/null --connect-timeout 3 --max-time 6 https://www.apple.com/ >/dev/null 2>&1
}

fixnet() {
  local log=~/fixnet.log ts=$(date '+%F %T') gw routes tunnel route_interface
  local -a target_routes=(0/2 64/2 128.0/2 192.0.0/2)
  # 한 목적지만 살아 있거나 DNS/HTTPS가 막힌 장애를 정상으로 오판하지 않는다.
  net_ok() {
    ping -c2 -W1000 1.1.1.1 >/dev/null 2>&1 &&
      ping -c2 -W1000 8.8.8.8 >/dev/null 2>&1 &&
      domain_ok
  }

  case "${1:-}" in
    --help|-h)
      echo "사용법: fixnet [--check]"
      echo "1.1.1.1, 8.8.8.8, 도메인 HTTPS를 검사하고 장애 시 down 기록과 경로 확인 후 복구·after 기록을 수행한다."
      return 0
      ;;
    --check)
      local failed=0 command_name
      echo "fixnet: $0"
      echo "netrecord: $NETRECORD_BIN"
      [ -x "$NETRECORD_BIN" ] || { echo "오류: netrecord를 실행할 수 없음" >&2; failed=1; }
      for command_name in ping route netstat sudo /usr/bin/curl; do
        command -v "$command_name" >/dev/null 2>&1 ||
          { echo "오류: 명령을 찾을 수 없음: $command_name" >&2; failed=1; }
      done
      [ $failed -eq 0 ] && echo "설치 상태 정상"
      return $failed
      ;;
  esac

  # 가드 1: 두 외부 목적지와 도메인 HTTPS가 모두 응답해야 정상으로 판단한다.
  if net_ok; then echo "인터넷 정상. 할 일 없음."; return 0; fi

  # 한 목적지만 실패해도 복구 전 기록을 남긴다.
  echo "[$(date '+%F %T')] 증거: $(netsnap down --note 'fixnet: public connectivity check failed; before repair')" | tee -a "$log"

  # ICMP 응답만 막힌 경우에는 정상 터널 경로를 지우지 않는다.
  if https_ok; then
    echo "[$ts] ICMP 검사 실패, 두 외부 IP의 HTTPS 연결 성공 → 경로 삭제 보류" | tee -a "$log"
    return 1
  fi

  # 가드 2: 게이트웨이도 안 되면 경로 삭제를 보류한다
  gw=$(route -n get default 2>/dev/null | awk '/gateway:/{print $2}')
  if [ -z "$gw" ] || ! ping -c2 -W1000 "$gw" >/dev/null 2>&1; then
    echo "게이트웨이($gw) 무응답 → 원인 미확정. 기록을 남기고 경로 삭제를 보류한다."
    echo "[$ts] 게이트웨이 무응답, 개입 안 함" >>"$log"; return 1
  fi

  echo "[$ts] --- fixnet 시작 (gw=$gw 응답, 외부만 불통) ---" | tee -a "$log"
  routes=$(netstat -nr -f inet)
  print -r -- "$routes" | egrep '^(default|0/2|64/2|128.0/2|192.0.0/2)' | tee -a "$log"

  # 가드 3: 네 /2가 같은 utun에 있고, 실패한 8.8.8.8도 그 터널로 향해야 한다.
  tunnel=$(print -r -- "$routes" | awk '
    $1=="0/2" || $1=="64/2" || $1=="128.0/2" || $1=="192.0.0/2" {
      if ($4 !~ /^utun[0-9]+$/ || $2 != $4) bad=1
      if (!($1 in seen)) count++
      seen[$1]=$4
    }
    END {
      if (bad || count!=4) exit 1
      for (name in seen) {
        if (interface && interface!=seen[name]) exit 1
        interface=seen[name]
      }
      print interface
    }') || tunnel=""
  route_interface=$(route -n get 8.8.8.8 2>/dev/null | awk '/interface:/{print $2; exit}')
  if [ -z "$tunnel" ] || [ "$route_interface" != "$tunnel" ]; then
    echo "[$ts] /2 터널 경로 불일치 (터널=$tunnel, 8.8.8.8=$route_interface) → 자동 삭제 보류" | tee -a "$log"
    return 1
  fi
  echo "[$ts] 확인: 네 /2와 8.8.8.8 경로가 $tunnel" | tee -a "$log"

  # 1단계: 확인한 인터페이스의 문제 경로만 삭제한다.
  local failed=0
  local n
  for n in ${target_routes[@]}; do
    sudo route -n delete "$n" -iface "$tunnel" 2>&1 | tee -a "$log" | grep -q 'not in table\|delete net' || failed=1
  done
  [ $failed -eq 1 ] && echo "[$ts] 경고: route 삭제 일부 실패 (sudo?)" | tee -a "$log"
  # 지운 뒤 테이블. 이게 없어서 "en0 로 돌아갔다" 의 증거가 ping 하나뿐이었다
  echo "[$ts] 삭제 후: $(netsnap after --note 'fixnet: after /2 route deletion attempt')" | tee -a "$log"
  if net_ok; then echo "[$ts] 결과: 경로 삭제로 해결" | tee -a "$log"; return 0; fi

  echo "[$ts] 결과: 경로 삭제 뒤에도 두 IP 검사가 실패. Tailscale은 변경하지 않음" | tee -a "$log"
  return 1
}

fixnet "$@"
