---
title: "cmux: 터미널 15개를 정리해 준 워크스페이스, 그리고 Ghostty로 돌아간 이유"
slug: cmux-workspace-freeze-session-restore-retrospective
category: 도구·워크플로
summary: cmux의 워크스페이스와 알림은 만족스러웠지만 반복된 프리징과 복원 경험 때문에 Ghostty로 돌아간 실제 사용 기록.
tags: cmux,coding-agent,ghostty,macos,notifications,session-restore,terminal,tmux,workspace
toc: true
source: https://portfolio.leneu.cloud/api/bff/blog/posts/5 (내려받음)
---
![검은 바탕에 흰색 명령 프롬프트 모양의 cmux 앱 아이콘](/assets/tools/cmux/icon.webp "width=180 align=center")

나는 프로젝트마다 개발 서버, 테스트, 로그, 데이터베이스와 코딩 에이전트 터미널을 함께 띄운다. 작업이 겹치면 터미널 창과 탭이 빠르게 늘고,
어느 세션이 입력을 기다리는지 확인하는 일 자체가 작업이 된다. cmux를 처음 사용했을 때 이 문제를 정확히 겨냥한 도구라고 느꼈다.

특히 워크스페이스 분리와 알림은 좋았다. 여러 창을 펼쳐 두는 대신 프로젝트와 작업별로 터미널을 묶고, 에이전트가 나의 응답을 기다릴 때 해당
위치를 바로 찾을 수 있었다. 하지만 내 환경에서 터미널이 약 15개까지 늘어난 뒤 프리징이 몇 차례 반복됐다. 세 차례가량 강제 종료한 뒤에는
작업 상태를 다시 구성하는 비용과 불안이 편의보다 커졌고, 결국 Ghostty로 돌아갔다.

이 글은 cmux가 느리다는 일반적인 결론이 아니다. **내가 좋았던 작업 방식, 문제가 발생한 조건, 당시 복원 경험과 현재 문서가 설명하는 복원 범위**를
나눠 기록한 사용 후기다.

![세로 워크스페이스와 여러 터미널 및 브라우저 pane을 함께 배치한 cmux 공식 화면](/assets/tools/cmux/workspaces.webp)

## cmux는 Ghostty에 워크스페이스 조정 계층을 더한다

cmux는 macOS용 오픈 소스 터미널이다. Ghostty를 포크한 앱은 아니며, 터미널 렌더링에 libghostty를 사용하고 기존 Ghostty의 테마·글꼴·색상
설정을 읽는다. 그 위에 세로 탭, 워크스페이스, 분할 pane, 알림, 내장 브라우저와 CLI·Unix socket 기반 제어를 더한다.

| 영역 | 제공하는 기능 | 여러 터미널을 쓸 때의 의미 |
|---|---|---|
| 워크스페이스 | 작업 단위 세로 탭 | 프로젝트와 목적별 터미널을 하나의 묶음으로 유지 |
| 사이드바 | 경로, Git branch, port, 최근 알림 표시 | 탭을 하나씩 열지 않고 현재 문맥 확인 |
| 분할 pane | 터미널과 브라우저의 수평·수직 배치 | 서버, 테스트, 로그와 화면을 한 작업공간에서 비교 |
| 알림 | OSC 알림, CLI, agent hook과 attention ring | 입력을 기다리는 세션으로 바로 이동 |
| 자동화 | CLI와 Unix socket API | workspace 생성, pane 분할, 입력과 브라우저 제어 |
| 렌더링 | libghostty와 GPU 가속 | 기존 Ghostty 설정과 터미널 사용감을 이어가기 쉬움 |

내가 기대한 것은 새로운 IDE가 아니었다. 익숙한 터미널을 유지하면서 **많은 세션의 위치와 상태만 더 잘 관리하는 것**이었다. cmux는 이 기대에
가장 먼저 답한 도구였다.

## 가장 만족한 기능은 워크스페이스와 알림이었다

![여러 터미널을 세로 탭과 가로 및 세로 분할로 구성한 cmux 공식 화면](/assets/tools/cmux/tabs-and-splits.webp)

기존에는 프로젝트별 Ghostty 창을 만들고 그 안에 탭과 split을 추가했다. 창이 많아질수록 macOS 전환 화면에서 비슷한 터미널을 구분하기 어렵고,
코딩 에이전트가 완료됐는지 확인하려고 각 창을 순회했다. cmux에서는 다음과 같이 구성했다.

1. 프로젝트나 큰 작업마다 workspace를 만들었다.
2. 한 workspace 안에 agent, 개발 서버, 테스트와 로그 pane을 분리했다.
3. 사이드바의 경로와 branch로 잘못된 프로젝트에서 명령을 실행하지 않았는지 확인했다.
4. 다른 작업을 하는 동안에는 알림이 온 workspace만 다시 열었다.

~~~mermaid
flowchart TB
    SIDEBAR[cmux sidebar<br/>workspace status]
    SIDEBAR --> A[Project A<br/>agent · server · test]
    SIDEBAR --> B[Project B<br/>agent · logs · database]
    SIDEBAR --> C[Experiment<br/>shell · browser]
    A -->|needs input| NOTICE[attention ring<br/>notification]
    B -->|task completed| NOTICE
    NOTICE --> FOCUS[open only the<br/>workspace that needs attention]
~~~

이 구조의 장점은 pane 수를 줄이는 것이 아니라 **많아진 pane을 작업 문맥으로 묶는 것**이다. 나처럼 터미널을 많이 띄우는 사용자에게 workspace
분리는 실제로 유용했다.

![응답이 필요한 pane의 테두리와 workspace에 표시되는 cmux 공식 알림 화면](/assets/tools/cmux/notification-rings.webp)

알림도 단순한 macOS 배너보다 유용했다. pane에 attention ring이 생기고 sidebar에 읽지 않은 상태가 남으므로, 어떤 agent가 질문을 기다리는지
찾기 쉬웠다. 공식 문서상 cmux는 OSC 9·99·777 알림과 cmux notify 명령, agent hook을 받을 수 있다. 여러 agent를 동시에 실행할 때 계속
출력을 감시하는 대신 사람이 개입해야 할 시점만 확인하는 흐름을 만들 수 있다.

## 약 15개 터미널부터 내 사용 흐름은 무너졌다

문제는 terminal surface가 약 15개 안팎으로 늘어난 시점에 나타났다. 정확한 임계값을 계측한 부하 시험은 아니지만, 당시 실제 작업에서 UI가 멈추는
현상을 반복해서 겪었다. 잠시 기다려 복구된 경우보다 앱을 강제 종료해야 했던 경우가 더 기억에 남았고, 약 세 차례 강제 종료 후 사용을 중단했다.

여기서 내가 확인한 것과 확인하지 못한 것을 구분해야 한다.

| 구분 | 내용 |
|---|---|
| 직접 관찰 | 다수 workspace와 약 15개 terminal을 사용하던 중 반복적인 freeze 발생 |
| 직접 조치 | cmux를 약 세 차례 강제 종료하고 작업공간을 다시 열었음 |
| 결과 | 복구 과정에 대한 신뢰가 낮아져 Ghostty로 복귀 |
| 측정하지 못함 | cmux 버전별 재현 여부, CPU·memory·GPU 수치, 특정 pane이나 agent와의 상관관계 |
| 단정할 수 없음 | 모든 사용자에게 15개가 한계라는 주장, 현재 버전에도 같은 문제가 있다는 주장 |

터미널은 문제가 생겼을 때 다른 작업을 복구하는 도구이기도 하다. 그래서 화려한 기능보다 **입력과 세션에 대한 신뢰**가 우선한다. workspace가 아무리
편해도 앱이 멈출 때마다 어느 프로세스가 살아 있고 무엇을 다시 실행해야 하는지 확인해야 한다면, 세션 수가 많을수록 복구 비용도 커진다.

## 현재 Session Restore와 내가 기대한 세션 유지는 다르다

현재 cmux 공식 문서는 Session Restore를 명시적으로 설명한다. 앱이 관리하는 창, workspace, pane 배치, 작업 경로, 브라우저 URL과 history를
복원하고 terminal scrollback은 가능한 범위에서 다시 표시한다. 지원되는 AI agent는 hook이 native session ID를 기록했다면 Claude, Codex 등의
자체 resume 명령으로 대화를 재개할 수 있다.

하지만 문서도 임의의 실행 프로세스를 checkpoint하지 않는다고 설명한다. 일반 shell 명령, vim이나 지원되지 않는 TUI는 보통 terminal로 다시 열릴 뿐,
종료 전 프로세스가 그대로 이어지는 것은 아니다. scrollback도 제한된 텍스트를 재생하는 best effort 방식이다.

| 복원 대상 | 현재 cmux 문서의 범위 |
|---|---|
| window·workspace·pane | 저장된 layout을 다시 구성 |
| 작업 경로 | 각 surface의 cwd에서 새 terminal 시작 |
| scrollback | 제한된 텍스트를 best effort로 재생 |
| browser | URL과 navigation history 복원 |
| 지원 agent | hook으로 session ID를 확보했을 때 agent 자체 resume 사용 |
| 임의의 실행 프로세스 | live process state를 checkpoint하지 않음 |

따라서 이 기능은 **작업공간 재구성**에 가깝고, tmux server가 살아 있는 동안 PTY와 그 안의 프로세스를 계속 소유하는 **실행 세션 지속**과는 계약이
다르다. cmux는 custom surface resume binding으로 tmux session에 다시 attach할 수도 있다. 장시간 프로세스의 생존이 중요하다면 cmux의 UI와
tmux의 process ownership을 함께 쓰는 편이 목적에 더 맞을 수 있다.

내가 사용하던 시점에는 강제 종료 후 원하는 상태로 원활하게 돌아오지 않았고, 그 경험이 Ghostty 복귀를 결정했다. 현재 기능이 개선됐다는 문서와 과거의
경험은 모순되지 않는다. 다만 다시 평가한다면 “화면이 비슷하게 돌아왔다”와 “실행하던 프로세스가 이어졌다”를 구분해 검증해야 한다.

## cmux, Ghostty와 tmux는 대체 관계만은 아니다

| 기준 | cmux | Ghostty | tmux |
|---|---|---|---|
| 주된 책임 | GUI workspace, 알림, split과 browser | 빠르고 집중된 terminal emulator | terminal multiplexer와 PTY session 유지 |
| 작업 구분 | 세로 workspace와 sidebar metadata | window, tab, split 중심 | session, window와 pane 중심 |
| agent 알림 | attention ring, badge, hook 지원 | 일반 terminal notification 활용 | 별도 script·plugin 구성 필요 |
| 앱 재시작 | layout 복원과 지원 agent resume | shell·프로세스는 별도 복구 | tmux server가 살아 있으면 attach |
| 확장 | CLI, socket, browser automation | terminal 설정과 shell 도구 조합 | command, config와 plugin 생태계 |
| 플랫폼 | 현재 macOS | macOS와 Linux | 여러 Unix 계열 및 원격 서버 |

내 선택은 Ghostty가 모든 면에서 우월하다는 뜻이 아니다. 당시에는 workspace 관리에서 얻은 이익보다 freeze와 복구 불확실성의 비용이 더 컸고, 역할이
단순한 Ghostty가 나에게 더 예측 가능했다. 반대로 여러 agent의 입력 대기를 자주 놓치고 workspace 전환 비용이 큰 사용자라면 cmux의 sidebar와 알림이
분명한 장점이 될 수 있다.

## 장점과 한계를 함께 놓고 보면 이렇다

### 이런 점이 좋았다

- 터미널이 많아져도 workspace 단위로 프로젝트와 작업을 구분하기 쉬웠다.
- 경로, branch, port와 최근 알림을 sidebar에서 확인할 수 있었다.
- agent의 입력 대기를 attention ring과 읽지 않은 상태로 찾는 흐름이 좋았다.
- libghostty를 사용하고 기존 Ghostty 설정을 읽어 새 terminal로 옮기는 비용이 작았다.
- terminal 옆 browser와 CLI·socket API는 향후 자동화할 여지가 크다.
- Swift와 AppKit 기반의 macOS native 앱이며 무료 GPL 오픈 소스다.

### 내 사용에서는 이런 점이 아쉬웠다

- terminal이 약 15개로 늘어난 실제 작업에서 freeze가 반복됐다.
- 강제 종료 뒤 작업을 다시 구성해야 한다는 불안이 workspace의 편의를 상쇄했다.
- Session Restore는 arbitrary process persistence가 아니므로 기대하는 복원 수준을 먼저 확인해야 한다.
- 기능과 상태 정보가 늘어날수록 단순 terminal보다 관찰하고 검증할 계층도 늘어난다.
- 현재 macOS 전용이어서 다른 데스크톱 환경과 동일한 workflow를 쓰기 어렵다.

## 다시 사용한다면 감상이 아니라 재현 기록을 남긴다

cmux의 workspace 분리는 여전히 다시 시험할 가치가 있다. 다음에는 “많이 열었더니 멈췄다”에서 끝내지 않고 같은 환경에서 단계적으로 검증할 계획이다.

| 단계 | 검증 방법 | 남길 증거 |
|---|---|---|
| 기준선 | cmux·macOS 버전, Mac 사양과 Ghostty 설정 기록 | 재현 환경 |
| 규모 증가 | 5, 10, 15, 20개 terminal surface를 같은 명령으로 구성 | 단계별 CPU·memory와 UI 응답 |
| 원인 분리 | idle shell, 로그 출력, agent, browser pane을 따로 증가 | freeze를 유발하는 surface 유형 |
| 정상 종료 | 종료 후 layout, cwd, scrollback과 browser 복원 확인 | 항목별 성공·실패 |
| 강제 종료 | 동일한 구성에서 강제 종료 후 복원 | 손실된 상태와 복구 시간 |
| agent resume | cmux hooks setup 후 Codex·Claude session 재개 | session ID 연결 여부 |
| process 지속 | 긴 작업을 cmux 단독과 tmux 결합으로 비교 | 실제 PID와 출력 연속성 |

이 결과가 안정적이라면 workspace와 알림을 다시 주 작업 흐름에 넣을 수 있다. 반대로 같은 freeze가 재현된다면 version, resource profile과 최소 재현 절차를
이슈로 남기는 것이 단순히 Ghostty로 돌아가는 것보다 더 나은 다음 단계다.

## 지금은 Ghostty로 돌아왔고, 다음 평가는 재현 기록으로 한다

cmux에서 가장 좋았던 것은 terminal 자체보다 **많은 terminal을 작업 단위로 이해하게 해 준 workspace**였다. 알림도 agent가 사람의 판단을 기다리는 순간을
놓치지 않게 해 실제 멀티태스킹에 도움이 됐다.

그러나 터미널 수가 늘어난 상황에서 반복된 freeze와 강제 종료, 기대만큼 원활하지 않았던 복원은 핵심 도구에 요구하는 신뢰를 낮췄다. 그래서 현재는
Ghostty로 돌아왔다. 지금의 Session Restore가 더 명시적인 계약과 agent resume를 제공하는 만큼 다시 시험할 이유는 생겼지만, 다음 평가는 기능 목록이 아니라
15개 이상의 terminal과 강제 종료를 포함한 재현 가능한 검증으로 판단할 것이다.

## 참고 자료와 이미지 출처

- [cmux 공식 사이트](https://cmux.com/ko)
- [cmux 공식 문서: Session Restore](https://cmux.com/ko/docs/session-restore)
- [cmux 공식 GitHub 저장소](https://github.com/manaflow-ai/cmux)
- [Ghostty 공식 사이트](https://ghostty.org/)
- [tmux 공식 GitHub 저장소](https://github.com/tmux/tmux)
- 아이콘과 화면 이미지는 cmux 공식 GitHub 저장소의 공개 자산을 사용했다. cmux 소스는 GPL-3.0 License로 배포된다.
