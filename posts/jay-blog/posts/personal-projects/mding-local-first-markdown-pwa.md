---
title: "mding: 네이티브 앱 대신 PWA로 만든 로컬 우선 Markdown 작업공간"
slug: mding-local-first-markdown-pwa
category: 개인 프로젝트
summary: IndexedDB, Service Worker와 명시적 백업으로 서버 없이 설치·오프라인 사용을 지원하는 Markdown PWA 개발기.
tags: indexeddb,local-first,markdown,pwa,react,service-worker,typescript
toc: true
source: https://portfolio.leneu.cloud/api/bff/blog/posts/8 (내려받음)
---
![파란 문서 모양의 mding PWA 아이콘](/assets/projects/mding/icon.webp "width=220 align=center")

iPhone과 Mac에서 Markdown 파일을 빠르게 읽고 필요할 때만 수정하고 싶었다. 계정, 서버와 실시간 협업보다 중요한 것은
작은 작업공간, 설치 가능한 앱 형태와 오프라인 사용이었다. 처음 검토한 SwiftUI 네이티브 앱 대신 React와 TypeScript 기반
PWA를 선택하고, 브라우저 저장소 안에서 데이터 소유권과 백업 경계를 명확히 설계했다.

![mding 데스크톱 Markdown 미리보기](/assets/projects/mding/desktop-markdown.webp)

## 문제를 기능보다 배포에서 다시 정의했다

처음에는 NavigationSplitView를 사용하는 iOS·macOS 앱을 생각했다. 하지만 개인 도구를 무료 Apple 개발자 계정으로 직접
설치하면 코드 서명을 주기적으로 갱신해야 하고, TestFlight도 빌드와 배포 절차를 계속 관리해야 한다. 반면 필요한 기능은
파일 트리, Markdown 읽기·편집과 오프라인 실행에 집중되어 있어 네이티브 전용 API가 제품의 핵심은 아니었다.

그래서 질문을 **네이티브 앱을 어떻게 배포할까**에서 **브라우저 저장소와 PWA만으로 원하는 사용 경험을 보장할 수 있는가**로
바꿨다. PWA를 선택하면서 한 코드베이스로 iOS·iPadOS 홈 화면 앱, macOS Safari 웹 앱, 데스크톱과 Android 설치형 PWA,
일반 브라우저를 함께 지원할 수 있었다.

이 선택은 네이티브와 같아 보이게 만드는 것이 아니라 브라우저 안의 로컬 작업공간이라는 경계를 받아들이는 결정이었다.
자유로운 디스크 접근과 백그라운드 처리는 플랫폼별 차이가 있으므로 핵심 범위에서 제외했다. 운영체제 수준 파일 연결은 manifest 의 file_handlers 와 launchQueue 로 붙였다 — 표준 API 하나로 끝나서 제외할 이유가 없었다.

## 제품 범위를 먼저 제한했다

| 포함한 기능 | 의도적으로 제외한 기능 |
|---|---|
| Markdown 생성·편집·미리보기 | 실시간 협업 |
| 폴더 구성과 다중 이동 | 사용자 계정과 서버 저장 |
| Markdown·HTML 가져오기와 내보내기 | 클라우드 자동 동기화 |
| Mermaid, 코드 하이라이트와 콜아웃 | Notion 데이터베이스 |
| 읽기 진행률과 집중 읽기 | Obsidian 전체 플러그인 호환 |
| zip 전체 백업과 복원 | 로컬 이미지 자산 관리자 |

이미지는 URL이나 data URL로 표시할 수 있지만 앱 안에서 이미지 폴더까지 관리하지 않는다. 이를 지원하면 백업 포맷, 파일 이동,
상대 경로 변경과 용량 정책도 함께 설계해야 하기 때문이다. 기능을 추가하지 않은 이유까지 설명할 수 있는 상태를 제품 범위의
완료 조건으로 삼았다.

## 앱 자산과 사용자 데이터를 분리했다

mding은 React와 TypeScript로 작성하고 Vite로 빌드한다. 앱 본체와 사용자 문서는 서로 다른 저장 계층을 사용한다.

~~~mermaid
flowchart TB
  A[정적 HTTPS 호스트] --> B[Service Worker Cache]
  B --> C[React UI와 렌더러]
  C --> D[IndexedDB]
  D --> E[파일 트리와 문서 원문]
  D --> F[읽기 진행률<br/>localStorage]
  D --> G[zip 백업]
~~~

- **Service Worker Cache**는 HTML, JavaScript, CSS, 아이콘과 렌더러 청크를 저장한다.
- **IndexedDB**는 사용자가 만든 파일, 폴더, Markdown·HTML 원문을 저장한다. 읽기 진행률만 localStorage 에 둔다 — 문서가 아니라 화면 상태라 백업에 실을 이유가 없다.
- **zip 파일**은 브라우저 밖에서 사용자가 직접 보관하는 이동 가능한 백업이다.

서버가 내려가도 이미 설치되어 캐시가 남은 앱은 오프라인으로 실행할 수 있다. 다만 새 설치, 재설치와 업데이트는 호스트가
필요하다. 서버는 문서를 보관하는 곳이 아니라 앱을 설치하고 업데이트하는 진입점이다.

## 트리와 문서를 분리해 로컬 우선 모델을 만들었다

작업공간은 파일·폴더 메타데이터를 가진 nodes와 본문을 가진 documents로 나눈다. 실제 디스크 폴더가 아니라 parentId 관계로
트리를 구성해 데스크톱 drag-and-drop과 모바일 다중 선택 이동이 같은 도메인 로직을 사용하도록 했다.

~~~mermaid
erDiagram
  NODE {
    string id PK
    string parentId FK
    string kind
    string name
    boolean pinned
    number updatedAt
  }
  DOCUMENT {
    string id PK
    string format
    string markdown
  }
  NODE ||--o| DOCUMENT : has
  NODE ||--o{ NODE : contains
~~~

고정 기능도 파일을 실제로 옮기지 않는다. 원본 parentId는 유지하고 pinned 메타데이터만 저장해 목록 상단에서 같은 파일을
참조한다. 고정을 해제할 때 원래 폴더를 복원하는 추가 상태가 필요하지 않다.

## 백업을 부가 기능이 아닌 저장 전략으로 다뤘다

IndexedDB는 일반 사용에서는 유지되지만 사이트 데이터 삭제, 브라우저 프로필 제거, 운영체제 재설치와 저장 공간 정책에서
완전히 독립적이지 않다. 서버 저장을 제거했다면 데이터 복구 책임을 사용자에게 설명하고 실제 이동 수단을 제공해야 했다.

전체 작업공간은 manifest.json과 사람이 직접 열 수 있는 workspace 디렉터리로 구성한 zip으로 내보낸다.

~~~mermaid
flowchart TB
  A[IndexedDB snapshot] --> B[manifest.json]
  A --> C[workspace Markdown]
  A --> D[workspace HTML]
  B --> E[mding backup.zip]
  C --> E
  D --> E
~~~

manifest는 폴더 구조와 메타데이터를 정확히 복원하고, workspace 안의 파일은 mding이 없어도 직접 열 수 있다. 앱 종속적인
복원성과 일반 파일의 이동성을 함께 확보했다. 기기 간 자동 동기화는 인증, 충돌 해결, 삭제 전파와 오프라인 병합을 요구하므로
경량 개인 도구의 범위에서는 명시적인 백업·복원을 선택했다.

## Markdown은 읽기 경험에 필요한 만큼 확장했다

CommonMark와 GitHub Flavored Markdown을 바탕으로 표, 체크박스, 취소선, 중첩 목록, 코드 하이라이트, Mermaid와 Obsidian 스타일
콜아웃을 지원한다. Mermaid와 Shiki는 CDN이 아니라 빌드 자산에 포함해 관련 청크가 캐시된 뒤에는 오프라인에서도 렌더링한다.

HTML은 가져오기와 읽기 전용 미리보기만 지원한다. 신뢰한 개인 문서의 메뉴와 테마 버튼이 동작하도록 iframe 안의 script 실행을
허용하기 때문에 **출처를 신뢰할 수 없는 HTML은 가져오지 않는다**는 보안 전제를 UI와 문서에 명시했다. HTML 편집과 asset 묶음까지
지원하면 에디터, 경로와 백업 범위가 급격히 커지므로 단일 원문 미리보기에서 멈췄다.

## 화면 크기에 따라 탐색 방식만 바꿨다

Mac에서는 사이드바와 문서를 한 화면에 보여주고 마우스 drag-and-drop을 제공한다. 모바일에서는 목록과 상세 화면을 분리하고
체크박스 기반 다중 선택과 뒤로 가기 흐름을 사용한다. 데이터 모델과 상태는 공유하되, 각 플랫폼에 자연스러운 상호작용을 억지로 통일하지 않았다.

![mding 모바일 파일 작업공간](/assets/projects/mding/mobile-workspace.webp "width=300 align=center")

![mding 모바일 Markdown 미리보기](/assets/projects/mding/mobile-markdown.webp "width=300 align=center")

문서별 마지막 읽기 위치, 본문 검색, 75~150% 배율, 파일 고정, 집중 읽기, 테마와 한국어·영어 UI도 반복 사용에서 생긴 작은
불편을 줄이는 방향으로 추가했다.

## 렌더링 자원이 누적되지 않게 했다

Markdown, Mermaid, Shiki와 HTML iframe을 함께 사용하면 파일을 바꿀 때 이전 문서 자원이 남을 수 있다. 모든 캐시를 지우면
오프라인 경험과 다음 실행 속도가 나빠지므로 앱 자산 캐시와 문서별 렌더링 수명을 분리했다.

- Service Worker의 앱 자산 캐시는 유지한다.
- Mermaid와 Shiki 모듈은 한 번 로드한 뒤 재사용한다.
- 파일 전환 시 이전 HTML iframe을 중단하고 빈 문서로 교체한다.
- 이전 Mermaid SVG와 검색 표시를 제거한다.
- 오래된 비동기 렌더링은 취소 신호로 결과 반영을 막는다.
- Mermaid 다이어그램은 하나의 테마 감시자를 공유한다.

목표는 브라우저 엔진 메모리를 0에 가깝게 만드는 것이 아니라, 문서를 반복해서 전환할 때 이전 문서의 자원이 계속
누적되지 않게 하는 것이었다.

## 실제 브라우저까지 검증했다

단위 테스트만으로는 모바일 viewport, iframe scroll, Service Worker cache와 설치형 레이아웃 문제를 찾기 어렵다.

~~~mermaid
flowchart TB
  A[Biome] --> E[정적 검증]
  B[Vitest] --> E
  C[TypeScript] --> E
  D[Vite build] --> E
  E --> F[Playwright 모바일·데스크톱 QA]
  F --> G[정적 배포]
~~~

Markdown·Mermaid·코드 렌더링, iframe script, 모바일·데스크톱 scroll, 검색과 진행률, zip 복원, 테마 전환과 반복 파일 전환을
브라우저 시나리오로 확인했다. README, MIT License, SECURITY, CONTRIBUTING과 CHANGELOG도 함께 관리해 개인 도구를 다른 사람이
설치할 수 있는 오픈소스 프로젝트로 정리했다.

## 현재 한계와 다음 단계

- 기기 간 자동 동기화가 없다.
- 로컬 이미지 폴더를 앱 자산으로 관리하지 않는다.
- HTML은 신뢰한 파일의 읽기 전용 미리보기만 지원한다.
- 브라우저 저장소 정책에서 완전히 독립적이지 않다.
- 플랫폼마다 PWA 설치와 업데이트 시점이 다르다.

다음 단계는 백업 시점 안내, 대용량 문서 렌더링, 선택적 폴더 연결, 접근성과 키보드 탐색을 실제 사용 빈도에 따라 개선하는 것이다.
클라우드 동기화는 인증과 충돌 해결까지 책임질 준비가 되었을 때 별도 기능으로 검토한다.

mding은 Markdown 앱을 하나 더 만드는 것보다 **실제로 계속 사용할 수 있는 가장 작은 도구가 무엇인가**에서 시작했다. PWA를
선택해 설치와 오프라인 실행을 해결하는 대신 브라우저 저장소의 경계를 받아들이고, 백업을 핵심 흐름으로 만들었다.

- [GitHub 저장소](https://github.com/jaymunsh/mding-app)
- License: MIT
