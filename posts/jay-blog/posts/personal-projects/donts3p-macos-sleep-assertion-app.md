---
title: "donts3p: 화면은 쉬게 하고 작업은 계속 돌리는 macOS 앱"
slug: donts3p-macos-sleep-assertion-app
category: 개인 프로젝트
summary: IOKit assertion, 관찰 상태, LaunchAgent 복구와 이벤트 기반 UI로 만든 Apple Silicon 메뉴 막대 앱 개발기.
tags: appkit,iokit,launchagent,macos,power-management,swift
toc: true
source: https://portfolio.leneu.cloud/api/bff/blog/posts/4 (내려받음)
---
![검은 배경에 흰색 Z³를 그린 donts3p 앱 아이콘](/assets/projects/donts3p-icon.webp "width=280 align=center")

AI 에이전트, 로컬 서버와 긴 빌드를 실행한 채 자리를 비우면 Mac이 사용자 유휴 상태로 잠들어 작업이 멈출 수 있다.
화면을 계속 켜거나 매번 시스템 설정과 터미널 명령을 바꾸는 대신, **디스플레이 절전과 화면 잠금은 유지하면서
사용자 유휴 시스템 잠자기만 막는 메뉴 막대 앱**을 만들었다.

donts3p는 macOS 14 이상 Apple Silicon을 대상으로 하는 Swift 네이티브 앱이다. Dock에는 나타나지 않고 메뉴 막대에만
상주하며, 현재 power assertion이 실제로 확인된 경우에만 정상 상태를 표시한다.

## 필요한 경계만 선택적으로 막기로 했다

| 요구 | 설계 판단 |
|---|---|
| 백그라운드 작업은 계속 실행 | IOKit의 PreventUserIdleSystemSleep assertion만 생성 |
| 화면과 잠금은 정상 동작 | display sleep assertion은 사용하지 않음 |
| 성공 상태를 즉시 확인 | 사용자의 요청이 아니라 실제 assertion 관찰 결과를 표시 |
| 비정상 종료 뒤 복구 | 사용자 LaunchAgent와 별도 recovery supervisor 구성 |
| 시스템 설정을 함부로 바꾸지 않음 | 기본 기능은 관리자 권한 없이 프로세스 수명 안에서만 유지 |

핵심은 더 강한 잠자기 방지가 아니라 필요한 경계만 선택적으로 제어하는 것이었다.

## 1. 명령 상태와 관찰 상태를 분리했다

사용자가 켜기를 선택한 것과 assertion이 실제로 살아 있는 것은 다르다. 생성 실패, 상태 확인 지연과 프로세스 종료가
발생할 수 있기 때문이다.

| 상태 | 의미 |
|---|---|
| Desired state | 사용자가 잠자기 방지를 원하는가 |
| Observed state | 앱이 assertion 활성 상태를 최근 확인했는가 |

SleepAssertionController가 assertion 생성, 확인과 해제를 소유한다. UI는 desired state만 보고 낙관적으로 체크를 그리지 않고,
observed state가 정상일 때만 체크를 표시한다. 상태 확인이 오래됐거나 실패하면 X 상태로 내려간다.

## 2. 앱 수명보다 긴 복구 경계를 설계했다

활성 상태에서 앱이 충돌하면 맡겨 둔 작업이 다시 잠자기에 노출된다. 사용자 단위 LaunchAgent가 recovery supervisor를 실행하고,
supervisor는 다음 조건을 확인한 뒤에만 앱을 복구 모드로 다시 연다.

1. 사용자의 활성 의도가 파일에 남아 있는가
2. 앱 프로세스가 실제로 종료됐는가
3. 다른 supervisor나 앱 인스턴스가 복구 중이지 않은가
4. 현재 부팅에서 유효한 recovery lease인가

중복 실행과 재실행 폭주를 막기 위해 advisory lock, 단일 인스턴스 조정, 부팅 식별자와 mach_continuous_time 기반 lease를
사용했다. 복구 실행은 앱을 전면으로 가져오거나 사용자의 활성 의도를 임의로 바꾸지 않는다.

## 3. 작은 메뉴 막대 UI도 수명주기 문제였다

처음에는 SwiftUI MenuBarExtra를 사용했지만 특정 실행 경로에서 프로세스가 살아 있어도 메뉴 항목이 안정적으로 나타나지 않았다.
최종 구현은 AppKit NSStatusItem을 명시적으로 생성하고 컨트롤러를 앱 수명 동안 강하게 보존하는 구조로 바꿨다.

18px 안에서 상태를 읽을 수 있도록 Z³ glyph, 체크와 X 배지, 도형이 겹치지 않는 knockout을 직접 렌더링했다.
앱 아이콘은 같은 정체성을 유지하되 상태 배지를 제거해 실행 상태와 제품 아이콘의 책임을 나눴다.

## 4. 1초 폴링을 상태 변화 구독으로 바꿨다

초기 UI는 1초마다 상태를 판정하고 같은 아이콘을 다시 그렸다. 기능은 맞았지만 아무 변화가 없어도 메인 run loop를 깨웠다.
v1.1.0에서는 AppModel의 관찰 상태를 Combine으로 구독하고 assertion 생성·해제, 깨우기와 건강 점검 결과가 달라질 때만
아이콘을 갱신한다. 아이콘 bitmap도 최초 한 번만 생성해 캐시한다.

30초 건강 점검은 UI animation을 위한 polling이 아니라 assertion이 계속 유효한지 재확인하는 안전장치로 남겼다.
릴리스 빌드를 Activity Monitor로 반복 관찰했을 때 유휴 CPU는 대부분 0.0%, 점검 순간 약 0.2%였다.
이 값은 정밀한 전력 benchmark가 아니라 동일 장비에서 확인한 운영 관찰값이다.

## 5. 위험한 전역 설정은 Labs로 격리했다

v1.1.0에는 pmset disablesleep을 사용하는 시스템 전역 override를 선택적 Labs 기능으로 추가했다. 기본 기능과 달리 앱 종료 뒤에도
설정이 남고 관리자 인증이 필요하므로 기본값은 OFF다.

- 앱은 관리자 비밀번호를 받거나 저장하지 않는다.
- macOS 표준 인증 창을 통해 /usr/bin/pmset 과 /usr/bin/grep 만, 경로를 고정해 실행한다.
- 변경 전에 Battery, AC와 UPS profile의 기존 값을 JSON snapshot으로 저장한다.
- 해제할 때 모든 값을 0으로 덮지 않고 저장한 profile별 값을 복원한 뒤 재조회한다.
- 복원이 끝나지 않으면 snapshot과 상태 디렉터리를 보존하고 제거를 차단한다.

이 기능도 MacBook 덮개 닫힘을 보장하지 않는다. 열 보호, 배터리 방전, 종료와 재시작 같은 운영체제·하드웨어 경계를
우회하지 않으며, 전원과 환기가 확보된 환경에서만 실험적으로 사용하도록 제한했다.

## 6. 배포 artifact 자체를 검증했다

Swift Package Manager로 arm64 release binary를 만들고 스크립트가 app bundle과 ZIP을 조립한다.

| 단계 | 확인 내용 |
|---|---|
| build | donts3p 앱과 recovery supervisor를 release mode로 생성 |
| assemble | Info.plist, LaunchAgent, license와 icon을 정해진 위치에 배치 |
| sign | 내부 실행 파일부터 app bundle 순서로 ad-hoc 서명 |
| archive | macOS arm64 ZIP 생성 |
| verify | 압축 경로, plist 계약, 실행 파일, 서명과 bundle 구조 재검증 |

v1.0.0과 v1.1.0을 Git tag와 GitHub Release로 나눠 보존해 최초 동작과 이후 기능·성능 변경을 각각 재현할 수 있게 했다.

## 각 동작을 테스트와 릴리스 태그로 고정했다

| 항목 | 근거 |
|---|---|
| assertion 수명주기 | SleepAssertionController와 AppModel 단위 테스트 |
| 복구와 단일 인스턴스 | supervisor, lease, marker와 launcher 테스트 |
| 전역 override 복원 | profile parsing, 인증 명령과 부분 실패 테스트 |
| 설치 artifact | app bundle·LaunchAgent·ZIP 경로 통합 명세와 release verifier |
| 배포 이력 | v1.0.0, v1.1.0 tag와 release artifact |

## Apple 기본 설정과의 차이를 제품 범위의 일부로 다뤘다

전원 연결 상태에서 항상 잠자기를 막아 두려면 macOS의 기본 설정만으로 충분할 수 있다. donts3p는 설정을 영구 변경하는 대신
작업할 때만 켜고, assertion이 실제로 살아 있는지 메뉴 막대에서 확인하며, 앱 장애 뒤 사용자의 활성 의도를 복구하는 데 초점을 둔다.

이 차이를 설명하지 않으면 운영체제가 이미 제공하는 기능을 다시 만든 것처럼 보인다. 기본 기능으로 해결되는 사용자와
프로세스 수명, 관찰 상태와 충돌 복구가 필요한 사용자를 구분하는 것이 제품 범위의 일부다.

## 원격 작업 중 로컬 화면을 계속 끄는 기능은 넣지 않았다

초기에는 원격 작업이 진행되는 동안 Mac의 물리 디스플레이만 계속 꺼 두는 기능을 검토했다. 원격 키보드와 마우스 입력은
애플리케이션에 전달하되, MacBook의 내장 키보드나 트랙패드를 직접 만졌을 때만 화면이 다시 켜지는 동작을 목표로 했다.

결론부터 말하면 화면을 한 번 즉시 끄는 것은 가능하지만, macOS 공개 API만으로 입력 출처에 따라 화면 깨우기를 선택적으로
차단하는 동작까지 안정적으로 보장하기는 어려웠다. 보안 기능처럼 보이는 불완전한 근사 구현을 추가하기보다 지원 범위에서
제외하는 쪽을 선택했다.

### 디스플레이 절전은 상태 고정이 아니라 한 번의 요청이다

pmset displaysleepnow는 디스플레이를 즉시 절전시킬 수 있지만 계속 꺼진 상태로 고정하지는 않는다. 이후 사용자 입력이 들어오면
macOS가 정상적으로 화면을 깨운다. 원격 제어 앱이 만든 입력도 사용자 입력으로 처리될 수 있어, 원격 작업이 시작되자마자
디스플레이가 다시 켜질 수 있다.

요구사항을 만족하려면 입력은 애플리케이션에 전달하면서 그 입력이 만드는 디스플레이 wake만 차단하고, 동시에 물리 키보드와
트랙패드 입력에는 wake를 허용해야 한다. 그러나 화면 깨우기는 WindowServer와 전원 관리 계층에서 처리되며 일반 사용자 공간 앱에
이 정책을 입력별로 제어하는 공식 인터페이스가 제공되지 않는다.

### 물리 입력과 원격 입력의 출처를 일반화할 수 없다

IOKit과 HID 정보로 내장 키보드나 USB 장치를 일부 식별할 수는 있다. 문제는 원격 제어 앱마다 입력 주입 방식이 다르다는 점이다.
합성 이벤트를 만드는 앱도 있지만 로컬 HID 입력과 안정적으로 구분하기 어려운 형태를 사용하는 앱도 있다. 입력 출처를 추측하는
구현은 특정 원격 앱에 종속되고 macOS 업데이트 뒤 깨질 가능성이 있다. 전역 입력 감시를 위해 접근성 또는 입력 모니터링 권한까지
요구할 수 있다는 점도 작은 전원 관리 앱의 책임 범위를 넘어선다.

### 화면을 반복해서 끄는 우회안도 채택하지 않았다

화면이 켜질 때마다 displaysleepnow를 다시 실행하는 근사 구현은 만들 수 있다. 하지만 화면이 잠깐 노출되는 깜박임이 생기며,
입력 출처를 잘못 판단하면 로컬 사용자가 돌아온 뒤에도 화면이 계속 꺼질 수 있다. 이를 완화하려면 상태 감시, 복구 단축키,
자동 해제 장치를 추가해야 하므로 복잡성과 권한, 리소스 사용량도 함께 증가한다.

무엇보다 이 방식은 화면 내용이 노출되지 않는다고 보장하지 못한다. 따라서 Curtain Mode나 Privacy Mode라는 이름으로 제공하면
사용자가 기대하는 보안 수준과 실제 동작 사이에 위험한 차이가 생긴다.

### 화면 보호의 책임은 원격 세션을 소유한 앱에 둔다

신뢰할 수 있는 Curtain Mode는 원격 제어 앱이 세션과 화면 출력 경로를 직접 관리할 때 가능하다. 원격 사용자에게는 정상 화면을
전송하면서 로컬 디스플레이에는 가림 화면을 표시하거나 세션을 분리할 수 있기 때문이다. donts3p는 원격 세션 내부를 소유하지
않으므로 같은 보장을 제공할 수 없다. 특정 원격 앱이 공식 CLI, API 또는 URL Scheme을 제공한다면 별도 연동은 가능하지만,
모든 원격 앱에 공통으로 적용할 수 있는 donts3p의 핵심 기능으로 삼지는 않았다.

### 보장할 수 있는 동작만 범위로 남겼다

donts3p는 구현 가능 여부보다 사용자에게 약속한 동작을 실제로 보장할 수 있는지를 기준으로 범위를 정했다.

- 사용자 유휴 상태로 인한 시스템 잠자기를 막는다.
- 디스플레이 절전과 화면 잠금 정책은 macOS에 맡긴다.
- 실제 power assertion의 관찰 상태를 메뉴 막대에 표시한다.
- 원격 화면 보호는 원격 앱의 공식 Curtain 또는 Privacy Mode에 맡긴다.

이 결정으로 기능 수는 줄었지만, 전원 관리와 화면 보안을 혼동하지 않고 donts3p가 책임질 수 있는 경계를 명확히 했다.

## 현재 한계와 다음 단계

- ad-hoc 서명이므로 최초 실행에 Gatekeeper 확인이 필요하다.
- Developer ID 서명과 notarization은 아직 적용하지 않았다.
- macOS 14 이상 Apple Silicon만 지원하며 Intel Mac은 검증하지 않았다.
- 덮개 닫힘, 열 보호와 배터리 방전은 지원 범위가 아니다.
- CPU 관찰 외에 Instruments 기반 wakeup·energy 측정은 아직 남아 있다.
- 자동 업데이트와 사용자 진단 로그 내보내기는 다음 단계다.

작은 메뉴 막대 앱이지만 전원 관리, 관찰 가능한 상태, 프로세스 복구, 권한 경계, artifact 검증을 한 흐름으로 다뤘다.
기능을 많이 넣는 것보다 한 가지 동작이 실패했을 때도 예측 가능하게 복구되는 것을 목표로 한 프로젝트다.

- [GitHub 저장소](https://github.com/jaymunsh/donts3p)
- [v1.1.0 Release](https://github.com/jaymunsh/donts3p/releases/tag/v1.1.0)
- License: MIT
