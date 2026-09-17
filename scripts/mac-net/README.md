# netrecord — macOS 네트워크 장애 기록

네트워크 상태를 바꾸지 않고 나중에 분석할 자료를 모은다. Python 3 표준 라이브러리와 macOS 기본 명령을 사용한다.
관리자 권한이나 추가 패키지가 필요 없다. 로컬 로그만 저장하며 업로드·패킷 캡처·상주 감시는 하지 않는다.
진단용 ping과 HTTPS, Tailscale netcheck는 외부에 소량의 요청을 보낸다.

## 이 맥에 설치한 명령

```zsh
netrecord ok                              # 정상 비교 자료
netrecord down --note '브라우저와 메신저 불통' # 복구하기 전
netrecord after --note '유니콘 보호 재시작'   # 실제 조치를 적는다
fixnet                                    # 기록 후 기존 경로 복구, 다시 기록
```

실행 파일은 `~/.local/bin/netrecord`와 `~/.local/bin/fixnet`이다. 설치본은
`~/.local/lib/fixnet/`에 복사하므로 저장소의 브랜치를 바꾸거나 작업 트리를 정리해도 실행 경로가 끊어지지 않는다.
설치와 업데이트는 저장소에서 `scripts/mac-net/install.zsh`를 실행한다.
`netrecord`는 PATH와 무관하게 `~/.local/bin/netrecord down`으로도 실행할 수 있다.

기존 터미널에는 이전 fixnet 함수가 남을 수 있다. 설치 후 한 번 `source ~/.zshrc`를 실행하거나 새 터미널을 연다.
새 `.zshrc` 함수는 외부 파일만 호출하므로 다음부터 파일 수정은 실행할 때 바로 적용된다.
지금 열린 셸에서 즉시 최신 복구 명령을 사용하려면 `~/.local/bin/fixnet`을 직접 실행한다.

`netsnap ok/down/after`도 netrecord를 호출한다. 기존 이름을 유지하지만 결과는 텍스트 한 파일 대신 폴더다.
fixnet은 진단 도구와 별개로 조건이 맞을 때 네 경로를 삭제한다. sudo는 복구 단계에서만 필요하다.
이제 Tailscale을 자동 재연결하지 않는다. 이전 사건에서 문제 경로는 Unicorn Pro의 터널이었으므로,
경로 삭제 후에도 실패하면 기록을 남기고 멈춘다.
자동 수집은 fixnet을 실행했을 때다. 외부 연결 실패를 감지하면 복구 전에 `down`을 저장하고,
경로 삭제 시도 뒤에 `after`를 저장한다. `1.1.1.1`, `8.8.8.8` ping과 도메인 HTTPS를 검사하므로
한 IP만 응답하거나 DNS/HTTPS가 실패하는 부분 장애도 기록한다. 두 IP의 HTTPS는 통하면 경로를 지우지 않는다.
네 `/2` 경로가 같은 `utun`을 향하고 `8.8.8.8`의 실제 경로도 그 터널일 때만 자동 삭제한다.
사용자가 실행하지 않은 장애를 백그라운드에서 감지하지는 않는다.

설치 상태만 확인할 때는 `fixnet --check`를 쓴다. 이 모드는 ping, 경로 삭제,
netrecord 수집을 실행하지 않는다.

## 결과

`~/netrecords/YYYYMMDD-HHMMSS-마이크로초-종류/` 아래에 보관한다. 폴더 700, 파일 600 권한이다.

- `SUMMARY.md`: 관찰값, 직전 완료 기록과의 차이, 다음 조사자가 읽을 순서, 누락 항목
- `manifest.json`: 버전, 실행 시각, 사용자 메모, 명령별 시작·끝·종료 코드·시간 초과·절단 여부
- `routes_v4.txt`, `route_public.txt`, `route_google.txt`, `interfaces.txt`: 프로브 전에 수집한 경로·터널 상태
- `dns.txt`, `network_state.txt`, `proxy.txt`, `vpn_services.txt`, `dhcp_en0.txt`: 시스템 설정
- `ping_*.txt`, `https_*.txt`: 공유기, 외부 IP 2곳, 도메인 HTTPS와 IP HTTPS 도달성
- `processes.txt`, `tailscale*.txt`: 관련 프로세스와 Tailscale 상태·선택된 설정
- `unicorn/`: 유니콘 로그와 최근 회전 파일의 끝부분, 파일당 최대 4 MiB
- `system_log.txt`: 수집 시작 부근을 끝점으로 고정한 이전 15분의 macOS 관련 로그, 최대 4 MiB
- `fixnet.log`: 기존 복구 원장의 사본, 최대 4 MiB

라우팅과 유니콘 로그를 먼저 보존한다. 느린 명령은 병렬 실행하며 개별 제한 시간을 둔다.
통합 로그는 20초, 나머지는 3~8초 제한이다. 실패해도 다른 자료를 보존하며 중간 manifest도 갱신한다.
중단된 수집은 `complete: false`로 남는다. 로그 일부는 권한·시스템 정책에 따라 누락될 수 있다.
`complete: true`는 수집 절차가 끝났다는 뜻이며 모든 검사 성공이나 네트워크 정상을 뜻하지 않는다.
여러 명령의 실행 시각은 다르다. 복구 전 기록을 뜨는 동안 자동 회복될 수 있으므로 즉시 상태로 단정하지 않는다.

기본 DHCP 조회는 이번 맥의 Wi-Fi `en0` 기준이다. 다른 장치에서는 전체 ifconfig와 경로를 먼저 확인한다.
HTTPS는 IPv4, curl 설정 파일과 환경 프록시를 우회한 검사이며 브라우저의 모든 동작을 재현하지 않는다.
Tailscale prefs는 필요한 다섯 필드만 저장한다. 그래도 원본 로그에는 IP·기기명·접속 대상이 있을 수 있다.
외부 공유 전에 확인한다. 자동 삭제는 하지 않는다. 오래된 자료는 사용자가 정리한다.

## 다음에 분석을 요청할 때

“`~/netrecords`의 최근 down과 after를 보고, 그 이전 ok와 비교해 줘”라고 요청하면 된다.
다른 환경의 분석자에게는 해당 폴더들과 이 README를 전달한다.
로그에서 오류를 낸 프로그램을 곧바로 경로 소유자나 원인으로 취급하지 않는다.
정상/장애 양쪽에 경로가 존재할 수 있다. 복구 전후 실제 route 조회와 vendor 로그 시각을 연결한다.
`--note`에는 Wi-Fi 재연결·유니콘 보호 재시작·fixnet 실행 등 실제 조치를 적는다.
수동 비교는 해당 두 SUMMARY.md와 manifest.json부터 시작한다. 직전 기록이 꼭 정상 대조군은 아니다.

## 검증

```sh
python3 -m unittest discover -s scripts/mac-net -p 'test_*.py'
zsh -n scripts/mac-net/fixnet.zsh
```

실제 복구를 테스트 목적으로 실행하지 않는다. netrecord 정상 캡처로 수집 경로만 검증한다.

## 2026-09-10 설치 검증 기록

- 단위·복구 분기 시뮬레이션 10개 통과. 실제 sudo route나 Tailscale 재연결은 실행하지 않았다.
- 실제 정상 캡처에서 21개 명령 완료, 실패 항목 없음. 앱 버전과 직전 정상 기록 비교를 확인했다.
- 정상 대조군: `netrecords/20260910-124046-912938-ok` (`~` 기준).
- 로컬 글의 수정일 2026-09-10, 최초 발행일 2026-09-03 유지 및 데스크톱·모바일 넘침 없음 확인.
