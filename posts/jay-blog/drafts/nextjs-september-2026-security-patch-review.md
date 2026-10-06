title: Next.js 보안 공지를 우리 서비스에 대입해 봤다 — 15.5.25에서 15.5.27로
slug: nextjs-september-2026-security-patch-review
category: 리서치
tags: nextjs,security,dependency,cve,github-actions,k3s,maintenance
summary: 2026년 9월 Next.js 보안 공지를 운영 중인 jay-wiki와 jay-blog에 대입했다. 취약점의 영향 조건, 실제 운영 버전, 개발용 의존성 경고와 패치 배포를 구분해 정리한다.
toc: true
syncHash: df150c48bc27c582ee0b40ae75658b0a27dfd8e61b3ec64739d9fee38583652b
publishedAt: 2026-10-05T08:46:34.382Z

---

Next.js 보안 패치 소식을 보고 내 서비스도 바로 올려야 하는지 궁금해졌다. 버전 숫자가 비슷하다고 같은 취약점에 노출되는 것은 아니고, 로컬에서 패키지를 올렸다고 운영 서버까지 바뀌는 것도 아니다. 그래서 공지의 영향 조건과 실제 실행 중인 버전을 따로 확인했다.

확인 대상은 같은 Next.js 앱으로 운영하는 jay-wiki와 jay-blog다. 2026년 10월 5일 점검 시작 시점에 운영 컨테이너가 반환한 버전은 **15.5.25**였다. 이번에 선택한 버전은 15 계열의 보안 패치 **15.5.27**이다. 이 글의 버전과 영향 판단은 이날 확인한 공식 공지와 저장소 설정을 기준으로 한다.

## 9월 22일의 치명적 취약점과 9월 30일 패치를 구분했다

[9월 22일 공지](https://nextjs.org/blog/nextjs-security-update-september-22-2026)는 Node.js에서 `next/og`의 `ImageResponse`를 사용하는 특정 Next.js 16 버전의 원격 코드 실행 문제를 다룬다. 영향 범위는 `>=16.2.0 <16.3.6`이다. 같은 날 15.5.26도 나왔지만 공식 설명은 15 계열의 추가 방어 조치이며, 15는 해당 원격 코드 실행 취약점의 영향 대상이 아니라고 구분한다.

우리 블로그도 공유 카드를 만드는 `opengraph-image.tsx`에서 `ImageResponse`를 쓴다. 함수 이름만 보고 영향 대상이라고 결론 내릴 수는 없었다. 실제 버전이 15.5.25였다는 확인이 함께 필요했다. 이번 점검에서 그 치명적 취약점에 해당한다는 근거는 없었다.

하지만 그 판단으로 업데이트를 끝낼 수는 없다. [9월 30일 보안 릴리스](https://nextjs.org/blog/september-2026-security-release)는 별도의 취약점들을 다루며, 공식 패치 버전은 **15.5.27과 16.3.8**이다. 9월 22일의 RCE 공지와 9월 30일의 누적 보안 패치를 한 사건처럼 읽으면 긴급성과 업데이트 필요성을 모두 잘못 판단할 수 있다.

## 취약점마다 우리 설정이 조건을 충족하는지 확인했다

아래는 공지를 읽고 현재 소스에 대입한 판단이다. 취약한 요청을 운영에 보내는 공격 재현은 하지 않았다. 사용하지 않는 기능과 설정을 확인한 범위에서의 영향 판단이며, 서비스 전체가 안전하다는 보증은 아니다.

| 9월 30일 공지의 항목 | 필요한 조건 | 현재 서비스에서 확인한 내용 |
|---|---|---|
| [이미지 최적화 SSRF](https://github.com/vercel/next.js/security/advisories/GHSA-cjq9-62q9-8jv4) · High | 허용된 외부 이미지 URL을 공격자가 제어 | `images.remotePatterns` 설정이 없다. 공식 공지의 비영향 조건에 해당한다. |
| [SSG·ISR 캐시 오염](https://github.com/vercel/next.js/security/advisories/GHSA-4jqv-mc3x-m676) · Medium | 자체 호스팅 Pages Router의 정적 생성·재생성 페이지 | 자체 호스팅이지만 라우트는 App Router다. Pages Router를 사용하지 않는다. |
| [루트 catch-all과 SSG·ISR 캐시 오염](https://github.com/vercel/next.js/security/advisories/GHSA-mcj8-r9mp-w47p) · Medium | 루트 catch-all 페이지와 정적 생성·재생성 라우트의 조합 | 루트 catch-all 페이지가 없다. API의 catch-all 경로와 페이지 경로를 구분했다. |
| [메타데이터 이미지의 dynamicParams 우회](https://github.com/vercel/next.js/security/advisories/GHSA-f87g-xv8r-7p7x) · Medium | webpack 기반 메타데이터 이미지 경로에서 동적 파라미터 제한에 의존 | 블로그 공유 카드 경로에 `dynamicParams = false`와 제외 목록을 통한 접근 제한을 두지 않았다. |
| [중첩 use cache의 root param 누출](https://github.com/vercel/next.js/security/advisories/GHSA-h694-7cp9-m8p3) · Medium | Cache Components와 중첩 캐시 함수 | Cache Components와 해당 캐시 함수를 사용하지 않는다. |
| [Draft Mode 내용의 캐시 누출](https://github.com/vercel/next.js/security/advisories/GHSA-3w37-wq28-93x7) · Medium | Cache Components 또는 실험적 useCache와 Draft Mode 미리보기 | 해당 설정과 Draft Mode 미리보기를 사용하지 않는다. |
| [개발 서버 MCP 정보 노출](https://github.com/vercel/next.js/security/advisories/GHSA-39w2-rjm5-chcv) · Low | 영향 버전의 `next dev` 실행 | 공식 개별 공지의 영향 버전은 16 계열이고, 운영은 개발 서버를 실행하지 않는다. |

겉으로 같은 기능이 있어도 제한 조건이 다르다. 예를 들어 공유 카드 경로가 있다는 사실은 맞지만, 제한된 파라미터를 우회해 숨긴 자료를 노출하는 조건과는 별도로 확인해야 한다. 관리자 도메인에 인증이 있다는 사실 역시 이미지 최적화나 캐시 구현을 고쳤다는 근거가 되지는 않는다.

## 현재 노출 근거가 약해도 15 계열 패치는 적용하기로 했다

위 대조에서 현재 구성에 직접 들어맞는 공격 조건은 확인하지 못했다. 그렇다고 15.5.25를 유지할 이유가 생긴 것은 아니다. 외부 이미지를 허용하거나 미리보기 기능을 추가하면 지금의 비영향 조건이 달라질 수 있다. 영향 판단은 이번 작업의 긴급성과 범위를 정하는 근거이고, 업데이트를 영구히 생략하는 근거로 삼지 않았다.

변경은 같은 15.5 계열 안에서 진행했다. Next.js와 관련 ESLint 설정을 15.5.27로 맞추고 React는 기존 설치 버전 19.2.7을 유지했다. 16으로의 메이저 업그레이드를 보안 패치와 함께 묶지 않았다. 라우팅과 인증 동작을 바꿀 필요가 없는 작업에서 검증 범위를 불필요하게 넓히지 않기 위해서다.

```sh
npm install next@15.5.27 eslint-config-next@15.5.27
```

`package.json`에 적힌 `^15.5.25`는 설치된 버전의 증거가 아니다. 이번에는 lockfile의 정확한 버전, 설치된 패키지, 운영 컨테이너의 `next/package.json`을 대조했다. `npm ci`와 컨테이너 이미지를 사용하는 배포에서는 lockfile과 새 이미지가 실제 변경을 전달한다.

## npm audit이 Next.js를 보고하지 않아도 공식 공지는 따로 읽었다

패치 전 `npm audit` 결과에는 Next.js 항목이 없었다. 대신 다른 의존성 경고들이 나왔다. 공식 보안 릴리스가 존재한다는 사실과 감사 도구가 지금 보고하는 항목은 완전히 같은 자료가 아니었다. 이 관찰만으로 등록 지연이나 누락의 원인을 확정할 수는 없지만, 도구가 조용하다는 이유로 공지를 무시할 수 없다는 점은 분명했다.

수정 버전이 있는 `brace-expansion`, DOMPurify, `fast-uri`는 호환 범위 안에서 lockfile을 갱신했다. 개발용 `react-doctor`도 문제가 있는 의존성 경로를 제거하는 버전으로 올렸다. 전체 결과와 운영용 결과를 따로 확인했다.

```sh
npm audit --json
npm audit --omit=dev --audit-level=high
```

패치 후 운영용 감사 결과는 취약점 0건이었다. 전체 감사에는 개발용 Vitest의 Moderate 경고와 아직 수정 버전이 없는 `braces`의 High 경고가 남았다. 운영용 감사의 0건을 전체 개발 환경의 0건으로 바꿔 쓰지 않았다.

## 수정 버전이 없는 개발용 경고는 만료일을 두고 기록했다

[braces의 CVE-2026-93687 공지](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)는 깊게 중첩된 패턴을 처리할 때 호출 스택이 고갈되는 문제를 설명한다. 10월 5일 확인 시점에 패치된 npm 버전은 없었다. 우리 lockfile에서는 다음 경로 전체가 개발용이었다.

```text
eslint-config-next
→ @next/eslint-plugin-next
→ fast-glob
→ micromatch
→ braces 3.0.3
```

High 경고 5개는 서로 다른 취약점 다섯 건이 아니라 이 한 건이 상위 패키지로 전파된 결과였다. 이 경로는 저장소의 파일 패턴을 처리하는 개발 도구이며, 현재 서비스의 공개 HTTP 입력을 받는 경로는 아니었다. 그렇더라도 `braces` 자체가 고쳐진 것은 아니다.

그래서 이 공지와 3.0.3 버전, 개발용 경로에만 **2026년 10월 19일 00:00 UTC까지** 임시 예외를 두었다. 다른 공지가 추가되거나 운영용 의존성이 같은 경로를 사용하면 차단하고, 만료일이 지나도 차단한다. 원본 감사 JSON은 보존하며, 새 High·Critical 경고를 통째로 무시하는 방식은 쓰지 않았다. 업스트림 패치가 나오면 예외를 제거하고, 나오지 않으면 기한 전에 다시 판단해야 한다.

이는 남은 위험을 관리하는 기록이지 취약점을 수정했다는 표현이 아니다. Vitest의 Moderate 경고도 그대로 남기며, 테스트 러너의 메이저 업그레이드는 별도의 작업으로 둔다.

## 전체 이미지 검사에서 다른 서비스의 패치도 발견했다

웹 검사만으로 운영 배포를 진행하지는 않았다. 전체 PR 보안 검사를 실행하자 Java 백엔드의 Jackson과 결제·배송 Python 서비스의 urllib3에서도 수정 버전이 있는 경고가 나왔다. 기존 lockfile과 버전 고정에 남아 있던 항목이었다.

Jackson은 [기존 2.21 계열의 패치 릴리스](https://github.com/FasterXML/jackson/wiki/Jackson-Release-2.21)인 2.21.7로 BOM을 맞췄다. urllib3는 두 서비스의 lockfile에서 2.7.0을 [2.8.0](https://github.com/urllib3/urllib3/releases/tag/2.8.0)으로 갱신했다. 후자는 HTTPS 프록시의 TLS 설정 문제, 제한 없이 chunk-size 줄을 버퍼링하는 문제와 Deflate 스트리밍 반복 문제를 고친 버전이다.

이 항목들은 수정 버전이 있으므로 예외를 추가하지 않았다. 의존성 해석 결과와 런타임 감사에 더해 Java·Python 통합 테스트와 새 이미지 검사까지 통과해야 운영에 반영하도록 했다. Next.js 패치를 시작했다는 이유로 다른 서비스의 실패를 넘기지 않는 것도 이번 검증 범위에 포함됐다.

## 패키지 설치와 운영 실행을 끝까지 대조했다

별도 checkout에서 웹 테스트 186개, 타입 검사, 린트와 프로덕션 빌드를 통과했다. 린트에는 기존 React effect 경고 7개가 남아 있다. 감사 정책 회귀 검사 12개를 포함한 Node 검사 15개와 로컬 브라우저 스모크 8개도 통과했다. 새 취약점과 운영용 경로, 예외 만료 조건이 차단되는지 확인한 결과다.

[보안 패치 PR](https://github.com/jaymunsh/jay-wiki/pull/13)의 전체 CI와 보안 검사를 통과한 뒤, main의 전체 커밋 SHA로 [운영 이미지 6개를 빌드했다](https://github.com/jaymunsh/jay-wiki/actions/runs/37283556871). 각 이미지의 공개 manifest를 조회하고, 별도 운영 저장소에서 같은 SHA를 지정해 preflight와 배포를 실행했다.

배포 후 확인 결과는 다음과 같다. 컨테이너의 패키지 버전과 빌드 산출물의 검증을 구분해 적었다.

| 대상 | 변경 | 확인한 결과 |
|---|---|---|
| 운영 웹의 Next.js | 15.5.25 → 15.5.27 | 실행 중인 컨테이너의 `next/package.json`이 15.5.27을 반환했다. |
| React | 19.2.7 유지 | 같은 컨테이너에서 19.2.7을 확인했다. |
| Java 백엔드의 Jackson | 2.21.5 → 2.21.7 | 런타임 JAR·이미지 보안 검사를 통과했고, 검증한 SHA의 이미지가 운영에서 실행된다. |
| 결제·배송 서비스의 urllib3 | 2.7.0 → 2.8.0 | 두 운영 컨테이너에서 각각 2.8.0을 확인했다. |

운영 배포, 콘텐츠 반영 전 DB 백업과 공개 페이지 검사가 성공했다. 운영 브라우저 스모크 8개도 통과했고, 롤백은 실행되지 않았다. 위키·블로그가 정상 응답하고 관리자 도메인의 인증 경계가 유지되는 것까지 확인했다. 패키지를 설치한 결과와 실제 운영에서 실행되는 결과를 함께 확인한 뒤 이번 패치를 완료했다.

이번 점검은 현재 설정에서의 영향 판단과 의존성 패치를 다룬다. 과거 침해가 없었음을 입증하는 포렌식이나 모든 취약점의 공격 재현은 하지 않았다. 외부 이미지, 캐시와 미리보기 설정을 바꿀 때에는 지금 남긴 비영향 판단도 함께 다시 읽어야 한다.


## 2026-10-06 업데이트 — 의존성 검사를 다시 돌렸다

전날의 패치 결과는 그날 조회한 보안 데이터 기준이었다. 10월 6일 전체 반영을 준비하며 다시 검사하니 Next.js 자체 외의 추가 경고가 확인됐다. Next.js 15.5.27과 React 19.2.7은 유지하고 다음 의존성을 정리했다.

- `source-map-js`를 1.2.2 이상으로 고정했다. 인덱스 소스맵의 큰 section offset이 이벤트 루프를 막는 문제이며, [공식 수정 릴리스](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2)와 [보안 공지](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)를 확인했다. 이 앱에서 외부 소스맵으로 공격이 성립했음을 관찰한 것은 아니다.
- Mermaid가 사용하는 KaTeX를 0.18.2 이상으로 고정했다. 기존 prototype pollution이 있을 때 trust 제한을 우회하는 [보안 공지](https://github.com/advisories/GHSA-238p-pmpm-9mq7)를 따른 조치다.
- 이미 본문 원본을 DB에서 읽어 사용하지 않던 `gray-matter`를 제거했다. 함께 들어오던 YAML·문자열 포맷 의존성도 빠진다. [sprintf-js 공지](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)의 경고를 구버전으로 다운그레이드해 숨기는 방식은 사용하지 않았다.
- 개발 테스트 도구 Vitest는 4.1.11 이상으로 올렸다. 패치된 테스트 모커를 사용하고, 이번 버전의 잠금 파일에서 취약한 Tinypool 의존성도 제거했다. [worker 옵션 공지](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3)와 [run 옵션 공지](https://github.com/advisories/GHSA-85c8-ppgw-ccpr)는 선행 prototype pollution을 전제로 하므로, 공개 웹 요청만으로 서비스가 침해됐다는 의미로 해석하지 않는다.

변경 후 `npm audit --omit=dev`의 보고 건수는 0이다. 개발 의존성까지 포함하면 이전에 기록한 `braces` 경로만 남는다. 한 원인에서 상위 패키지로 전파된 경고 5건이며 예외 범위와 만료일은 그대로다. 단위 검사·타입 검사·프로덕션 빌드·컨테이너 보안 검사로 새 버전의 호환성을 확인한 뒤 배포한다.

### 오목 이미지와 Spring의 실행 경로도 확인했다

새로 배포할 오목 컨테이너에서는 서비스 실행에 필요 없는 전역 npm·Corepack 도구를 제거하고 Alpine 패키지를 갱신했다. 앱의 운영 의존성은 설치한 채 유지하고, 실제 서버와 WebSocket이 실행되는지 다시 확인했다.

Java 검사에는 Spring MVC 6.2.19의 `CVE-2026-47884`도 표시됐다. [Spring 공식 공지](https://spring.io/security/cve-2026-47884/)의 공격 조건은 XSLT 뷰를 사용하는 앱에 화면 렌더링으로 이어지는 포괄 URL 매핑과 암묵적인 뷰 이름이 함께 있는 경우다. 공개 수정 버전은 7.0.9이고, 같은 6.2 계열의 6.2.20은 Enterprise Support 대상이다.

현재 백엔드는 REST 응답 본문을 반환하며 XSLT 뷰와 해석기를 설정하지 않았다. 실제 Spring 애플리케이션 컨텍스트를 띄워 이 조건과 정적 파일용 포괄 매핑을 검사하는 회귀 테스트 3개를 추가했다. 이를 근거로 현재 앱의 해당 실행 경로는 사용되지 않는다고 판단했다. 라이브러리가 패치됐거나 다른 앱도 안전하다는 뜻은 아니다.

검사 원본에는 경고를 남기고, 이 공지와 정확한 패키지 버전에만 현재 앱의 비영향 판단을 OpenVEX로 기록했다. **2026년 10월 20일 00:00 UTC 전에 재검토해야 하며**, 기한이 지나면 CI가 차단한다. MVC 화면 렌더링이나 의존성 버전을 바꿀 때도 다시 판단한다. 다른 취약점까지 검사에서 제외하지 않는다.
