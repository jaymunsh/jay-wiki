title: Orca ADE로 밖에서도 코딩 에이전트를 이어간 방법
slug: orca-mobile-agent-workflow-retrospective
category: 도구·워크플로
summary: Orca, donts3p와 Tailscale을 연결해 Mac의 작업을 모바일에서 확인·재개한 경험과, worktree·멀티 에이전트 활용에 남은 과제.
tags: ade,claude-code,codex,donts3p,git-worktree,mobile-workflow,multi-agent,orca,tailscale
toc: true
publishedAt: 2026-07-20T15:00:00Z
updatedAt: 2026-08-15T15:10:07.797568Z
syncHash: 49429397a09c6173516e49497e6fdf84b7d888c4edc5547d2a795a43c107fc52

---
![검은 배경의 흰색 범고래 모양 Orca 아이콘](/assets/tools/orca/icon.webp "width=180 align=center")

코딩 에이전트를 터미널 하나에서 실행하는 것은 어렵지 않다. 문제는 여러 작업을 동시에 넘기고, 각 에이전트가 어느 브랜치와 파일을
바꾸고 있는지 파악하며, 중간에 권한 확인이나 추가 질문이 생기면 다시 대화를 이어가는 일이다. 터미널 탭을 늘리는 것만으로는 이 상태를
잘 관리하기 어려웠다.

Orca는 이 문제를 일반 IDE의 플러그인으로 풀기보다 **ADE, Agent Development Environment**라는 작업 단위로 풀어낸다. Claude Code, Codex, OpenCode 같은
CLI 에이전트를 그대로 사용하되 각 작업을 Git worktree, 터미널, 파일 탐색기, 브라우저와 리뷰 흐름 안에 배치한다. Orca 자체가 다른 모델이나 Git 의 대체재는
아니다. 이미 사용하는 에이전트와 Git을 여러 작업으로 확장하는 조정 계층에 가깝다.

![데스크톱에서 여러 worktree와 에이전트, 터미널을 배치한 Orca 공식 화면](/assets/tools/orca/readme-hero.webp)

## 직접 사용하며 가장 먼저 좋았던 것은 문맥이었다

첫 사용 목적은 여러 에이전트를 대규모로 병렬 실행하는 것이 아니었다. 코드 작성 중에 자주 왕복하는 터미널, 디렉터리 구조, Markdown 문서, diff와 로컬 브라우저를
하나의 작업공간에서 보는 것이었다.

특히 다음 흐름이 편했다.

- 에이전트가 언급한 파일을 파일 트리에서 바로 찾았다.
- 작업 전 계획과 검증 결과를 Markdown 미리보기로 읽었다.
- 소스, 터미널과 브라우저를 분할해 에이전트의 설명과 실제 화면을 함께 확인했다.
- 다른 에이전트를 쓰더라도 작업공간과 파일 탐색 방식은 같게 유지했다.
- 외부에서는 모바일로 에이전트 상태와 최근 터미널 내용을 읽고 짧은 답을 보냈다.

개별 기능이 새롭다기보다 에이전트와 내가 **같은 저장소 문맥을 본다**는 점이 핵심이었다. 터미널만 원격 제어했다면 현재 위치와 변경 범위를 다시 짐작해야 했지만, Orca에서는 디렉터리와
문서를 함께 읽으며 판단할 수 있었다.

## tmux와 닮은 핵심은 창이 아니라 세션의 소유권이다

![여러 에이전트 터미널을 탭과 분할 pane으로 구성한 Orca 공식 화면](/assets/tools/orca/terminal-splits.webp)

Orca의 세션 유지는 tmux를 떠올리게 한다. tmux에서 실행 세션은 터미널 클라이언트와 분리되므로 접속을 끊어도 프로세스가 계속 돌아간다. Orca도 비슷하게 데스크톱 창이 아닌 백그라운드 daemon이 PTY를 소유한다.
그래서 Orca를 종료해도 실행 중인 Claude Code와 Codex가 종료되지 않고, 다시 앱을 열면 같은 프로세스에 warm reattach한다.

하지만 Orca의 복원 단위는 터미널 세션보다 넓다.

| 복원 대상 | 실제 의미 |
|---|---|
| 실행 중인 agent process | 앱 종료·자동 업데이트·앱 crash 후에도 daemon이 살아 있으면 작업 계속 |
| worktree | 어느 저장소의 어느 지점에서 일했는지 유지 |
| tab·split layout | 소스, agent, 서버 로그와 브라우저를 배치한 모양까지 복원 |
| terminal scrollback | Orca가 닫힌 동안 출력된 내용까지 다시 확인 |
| focused worktree·tab | 종료 전 보던 작업 지점으로 복귀 |

이 차이 때문에 Orca의 세션 복원은 단순한 편의 기능이 아니다. 에이전트가 수분 이상 일하는 환경에서 **앱의 생명주기와 작업의 생명주기를 분리**한다. 업데이트나 UI 오류로 앱을 다시 열어도 작업을 처음부터 시작할 필요가 없다.

경계도 분명하다. 호스트 Mac이 재부팅되거나 전원이 끊기면 daemon도 종료되므로 실행 중이던 agent process는 유지되지 않는다. 다음 실행에서 worktree, layout과 마지막으로 저장된 scrollback은 돌아오지만 agent는 다시 실행해야 한다. 그래서 나의
원격 구성에서 donts3p로 호스트의 잠자기를 관리한 것은 Orca의 세션 유지와 보완 관계였다.

## Orca의 장점은 에이전트 실행 전후를 하나의 루프로 묶는 것이다

Orca를 에이전트 터미널 관리자로만 보면 실제 범위를 놓친다. 공식 문서에서 가장 의미 있어 보인 장점은 다음과 같다.

| 단계 | Orca가 제공하는 것 | 장점 |
|---|---|---|
| 분리 | task별 실제 Git worktree와 branch | 여러 agent가 같은 checkout을 덮어쓰는 경쟁 방지 |
| 실행 | agent 상태가 보이는 터미널·split·Quick Command | working, waiting, done을 터미널 출력 외부의 상태로 관리 |
| 복원 | daemon PTY와 workspace restore | 창을 닫거나 앱을 재시작해도 긴 작업 지속 |
| 확인 | worktree별 파일, Markdown·PDF·이미지 preview, browser | agent의 설명을 실제 산출물과 같은 문맥에서 비교 |
| UI 피드백 | Design Mode의 DOM·computed CSS·부분 screenshot·source location | “이 버튼”을 설명하는 대신 실제 요소를 agent에게 전달 |
| 리뷰 | diff line별 주석을 하나의 batch로 agent에 전달 | 라인 번호를 복사하지 않고 리뷰→수정→재확인 순환 |
| 원격 | SSH worktree, 재연결, port forwarding, Mobile companion | 실행은 다른 호스트에 두고 editor·diff·제어는 로컬과 모바일에서 유지 |
| 자원 관리 | 실험적 agent hibernation | 완료된 백그라운드 session을 중지하고 다시 열 때 provider resume 기능으로 재개 |

중요한 점은 이 표의 기능이 따로 놀지 않는다는 것이다. 작업을 나누고, agent를 실행하고, 결과를 화면과 diff로 확인한 뒤, 주석을 다시 agent에게 보내고, 완료된 브랜치를 ship하는 하나의 루프를 만든다. 이것이 터미널과 IDE를 여러 개 열어 조합하는 방식과의
실질적인 차이다.

## 화면과 diff를 agent에게 다시 넘겨 피드백 루프를 만들었다

![브라우저의 UI 요소를 선택해 agent에게 화면 문맥을 전달하는 Orca Design Mode](/assets/tools/orca/design-mode.webp)

UI 작업에서 “위쪽 카드의 오른쪽 시간이 잘린다”는 설명만으로는 agent가 정확한 DOM과 CSS를 다시 찾아야 한다. Orca Design Mode는 브라우저에서 선택한 요소의 HTML, computed style, 잘라낸 screenshot과 source map이 있을 경우 파일 위치를 agent에게 한번에 전달한다.
수정 후에는 같은 브라우저에서 hot reload된 화면을 다시 확인할 수 있다.

![AI가 변경한 diff 라인에 주석을 달고 수정 요청을 묶어 보내는 Orca 공식 화면](/assets/tools/orca/annotate-diff.webp)

코드 리뷰에서도 같은 방식을 적용한다. AI가 만든 diff의 정확한 라인에 Markdown 주석을 남기고, 여러 주석을 한 번에 batch로 보내 하나의 수정 주기를 만든다. 피드백을 하나씩 보내 agent가 수정 방향을 계속 바꾸는 것보다, 사람이 한 번 리뷰하고 agent가 한 번 수정하는 구조가 된다.
주석은 diff가 바뀐 후에도 유지되어 수정 여부를 다시 확인할 수 있다.

## 모든 session을 계속 실행하는 것도 정답은 아니다

세션 유지는 강점이지만 worktree가 늘어나면 완료된 agent의 PTY와 모델 session도 메모리에 계속 남는다. Orca의 Agent hibernation은 완료 상태이고, 현재 화면에 없고, 입력과 새 출력이 없으며, 일정 시간 유휴인 resumable agent만 중지한다. 다시 worktree를 열면 Claude와 Codex 등의 provider resume 명령으로 같은 대화를 재개한다.

다만 이 기능은 현재 실험적이며 기본값이 off다. 모든 CLI agent가 resume를 지원하는 것도 아니다. 따라서 “Orca는 모든 프로세스를 영구히 유지한다”는 설명보다, **활성 작업은 daemon으로 유지하고 완료된 작업은 조건부로 hibernate하는 생명주기**로 이해하는 것이 정확하다.

## donts3p·Tailscale·Orca를 각기 다른 책임으로 연결했다

외부에서 모바일로 작업을 이어가려면 Orca 하나만 실행해서는 부족했다. 데스크톱 Mac이 잠들면 연결할 실행 환경 자체가 사라지고, 공개 포트를 열어 외부 접속을 만드는 방식은 원하지
않았다. 그래서 세 도구의 책임을 분리했다.

| 계층 | 도구 | 맡긴 책임 |
|---|---|---|
| 실행 지속 | [donts3p](/4/donts3p-macos-sleep-assertion-app) | Mac의 사용자 유휴 잠자기를 막고 에이전트 프로세스가 계속 돌아갈 수 있게 함 |
| 사설 네트워크 | Tailscale | 휴대폰과 Mac을 같은 tailnet에 두고 공개 포트 없이 접근 경로를 유지 |
| 작업 조정 | Orca Desktop | 저장소, worktree, 에이전트 터미널, 파일과 브라우저 상태를 소유 |
| 모바일 제어 | Orca Mobile | 에이전트 상태를 확인하고 대기 질문에 답하며 작은 후속 작업을 진행 |

이 구성에서 Tailscale은 Orca의 페어링이나 인증을 대체하지 않는다. Orca Desktop과 Mobile은 자체 페어링과 디바이스 토큰을 사용하고, Tailscale은 두 기기가 외부 네트워크에서도 사설 경로로 연결될 수 있게
하는 네트워크 계층이다. 또한 donts3p는 원격 제어 도구가 아니라 Mac의 잠자기 상태만 책임진다. 한 도구에 모든 역할을 억지로 넣지 않았기 때문에 연결이 끊겼을 때도 어느 계층을 먼저 확인할지
분명했다.

~~~mermaid
flowchart TB
    PHONE[Mobile<br/>Orca companion] -->|private reachability| TS[Tailscale<br/>tailnet]
    TS --> MAC[Mac<br/>Orca Desktop]
    KEEP[donts3p<br/>sleep assertion] -->|keeps runtime awake| MAC
    MAC --> AGENT[Codex / Claude Code<br/>agent session]
    MAC --> REPO[Repository<br/>files and Git state]
~~~

## 모바일은 작은 IDE가 아니라 원격 제어기로 사용했다

![Orca Desktop에 연결된 모바일 컴패니언에서 에이전트 상태를 확인하는 공식 화면](/assets/tools/orca/mobile-companion.webp)

Orca 공식 문서는 모바일 컴패니언을 전체 편집기보다 **read-mostly remote control**로 설명한다. 이 경계는 실제 사용과도 맞았다. 휴대폰에서 긴 코드를 수정하기보다 다음 작업에 집중했다.

1. 에이전트가 working, done, waiting 중 어느 상태인지 확인했다.
2. 최근 terminal scrollback을 읽고 실패 지점과 추가 질문을 파악했다.
3. 권한 확인이나 방향 선택에 짧게 답했다.
4. 파일 트리와 Markdown 문서를 열어 작업 결과를 확인했다.
5. 필요한 경우에만 작은 후속 지시를 보냈다.

이 방식은 외부에서 모든 개발 행위를 하겠다는 시도가 아니다. 데스크톱에서 시작한 긴 작업이 질문 하나를 기다리며 멈추지 않게 하는 것이 목표였다. 코드 리뷰와 구조적 수정은 다시 큰 화면에서 하고, 모바일은 상태 확인과 짧은
의사결정에 사용했다.

## Git worktree는 Orca의 핵심이지만 아직 충분히 써보지 못했다

~~~mermaid
flowchart TB
    MAIN[main / base ref]
    MAIN --> WTA[worktree A<br/>approach A]
    MAIN --> WTB[worktree B<br/>approach B]
    MAIN --> WTC[worktree C<br/>tests and review]
    WTA --> A[Agent A]
    WTB --> B[Agent B]
    WTC --> C[Agent C]
    A --> REVIEW[Compare diffs<br/>tests and evidence]
    B --> REVIEW
    C --> REVIEW
    REVIEW --> SHIP[Select or merge<br/>then ship]
~~~

Orca는 각 작업에 실제 Git worktree를 만든다. 각 worktree는 독립된 브랜치, 파일 복사본과 에이전트 터미널을 갖는다. 그 결과 두 에이전트가 같은 checkout의 파일을 동시에 덮어쓰는 충돌을 피하고,
한 문제에 여러 접근을 동시에 실행한 뒤 diff로 비교할 수 있다.

하지만 이 글은 그 생산성을 충분히 검증했다는 성공담이 아니다. 실제로는 Orca를 하나의 에이전트 세션과 모바일 접속을 잘 보여주는 작업공간으로 더 많이 사용했다. worktree를 여러 개 만들어 동일한 요청을 병렬로
시도하거나, 여러 에이전트가 역할을 나눠 하나의 목표를 완성하는 orchestration은 제대로 실험하지 못했다.

아쉬운 점은 기능을 모르는 것보다 **병렬화할 수 있는 작업을 나누는 기준**이 부족했다는 것이다. 서로 같은 파일을 바꾸는 업무를 여러 에이전트에게 넘기면 worktree가 있어도 마지막 merge와 리뷰가 어려워진다. 반대로 탐색,
구현, 테스트와 리뷰처럼 입력과 산출물이 분명한 일은 병렬화의 이점을 얻기 쉽다.

## 다음에는 multi-agent orchestration을 기능이 아니라 실험으로 검증한다

다음 Orca 사용은 에이전트 수를 늘리는 시연으로 끝내지 않을 계획이다. 작은 실제 개발 과제를 정하고 단일 에이전트와 worktree 기반 병렬 작업을 같은 기준으로 비교한다.

| 검증 항목 | 확인할 질문 |
|---|---|
| 작업 분할 | 각 에이전트의 소유 파일과 완료 조건이 충돌 없이 나뉘는가 |
| 격리 | 동시 작업 중 다른 worktree의 파일을 건드리지 않는가 |
| 리뷰 | 에이전트별 diff와 검증 결과를 사람이 비교할 수 있는가 |
| 통합 비용 | 절약한 구현 시간보다 merge, 재테스트와 설명 비용이 더 커지지 않았는가 |
| 완료 시간 | 순차 작업보다 실제로 더 빨랐는가 |
| 품질 | 테스트, 런타임 검증과 회귀 확인이 동일한 수준으로 남았는가 |

예정한 첫 실험은 기존 프로젝트의 작은 UI 결함 하나를 대상으로 한다. 한 에이전트는 재현과 원인 분석, 다른 에이전트는 테스트, 또 다른 에이전트는 접근성과 반응형 검토를 맡는다. 구현 소유자는 하나로 유지하고 나머지는
증거를 전달하도록 해 merge 충돌을 줄인다. 실험 후에는 속도가 아니라 분할 정확도, 재작업 횟수와 통합 비용까지 기록할 것이다.

## 써 보고 내린 판단은 이렇다

Orca를 사용하며 가장 크게 변한 것은 코드 작성 방법보다 **에이전트 작업을 보는 방법**이었다. 터미널 출력만 따라가는 것에서 벗어나, 저장소, 파일, 문서, 브랜치, 에이전트 상태를 하나의 작업공간으로 이해하게
됐다.

donts3p와 Tailscale을 함께 사용한 모바일 흐름도 유용했다. 다만 이것은 어디서나 휴대폰으로 완전한 개발을 했다는 의미가 아니다. Mac의 작업을 지속하고, 에이전트가 멈춘 지점에 답하며, 다시 데스크톱에 왔을 때 바로 리뷰를
이어가게 한 것에 가치가 있었다.

현재의 결론은 간단하다. Orca는 터미널을 예쁘게 묶은 도구로만 보기에는 worktree, diff review, mobile companion과 orchestration의 책임이 넓다. 그러나 그 가치를 얻으려면 에이전트 수를 늘리기 전에 작업 분할, 소유권, 리뷰와 통합 기준을 먼저
설계해야 한다. 그 부분을 아직 충분히 시도하지 못했다는 것이 이번 사용의 가장 큰 아쉬움이며, 다음 기록에서 검증할 주제다.

## 참고 자료와 이미지 출처

- [Orca 공식 사이트](https://www.onorca.dev/)
- [Orca 공식 문서: What is Orca?](https://www.onorca.dev/docs)
- [Orca 공식 문서: Mobile companion](https://www.onorca.dev/docs/mobile)
- [Orca 공식 문서: Worktrees](https://www.onorca.dev/docs/model/worktrees)
- [Orca 공식 문서: Session restore](https://www.onorca.dev/docs/model/session-restore)
- [Orca 공식 문서: Terminal](https://www.onorca.dev/docs/terminal)
- [Orca 공식 문서: Agent hibernation](https://www.onorca.dev/docs/agents/hibernation)
- [Orca 공식 문서: Design Mode](https://www.onorca.dev/docs/browser/design-mode)
- [Orca 공식 문서: Annotate AI Diff](https://www.onorca.dev/docs/review/annotate-ai-diff)
- [Orca 공식 문서: SSH worktrees](https://www.onorca.dev/docs/ssh)
- [Orca GitHub 저장소](https://github.com/stablyai/orca)
- [Tailscale 공식 문서](https://tailscale.com/docs/concepts/what-is-tailscale)
- Orca 아이콘과 화면 이미지는 공식 GitHub 저장소의 공개 자산을 사용했으며, 저장소는 MIT License로 배포된다.
