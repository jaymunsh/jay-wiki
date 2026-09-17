# 블로그 글쓰기 가이드

블로그 글의 정본은 운영 PostgreSQL 이다. `posts/jay-blog/` 는 작업용 사본·초안이다.
발행 뒤에 손볼 때의 순서는 `posts/jay-blog/README.md` 에 있다.

## 정본은 블로그 DB다

`posts/jay-blog/` 는 작업용 사본·초안이다(2026-08-10부터 추적한다). 발행된 글의 정본은 운영 PostgreSQL 이다.
같은 slug 를 다시 발행하면 화면에서 고친 내용이 덮인다. 발행 뒤에 손볼 때의 순서는 `posts/jay-blog/README.md` 에 있다.

## 초안 형식

`posts/jay-blog/drafts/<slug>.md` 에 쓴다. 첫 `---` 위가 머리말, 아래가 본문이다.

```
title: 글 제목
slug: post-slug
category: 개인 프로젝트
tags: a,b,c
summary: 목록과 공유 카드에 쓰이는 한두 문장
publishedAt: 2026-08-25T02:26:30.487314Z

---

본문 첫 문단부터 시작한다.
```

## 발행일은 저장소가 정본이다

**`publishedAt` 이 머리말에 있으면 그 값이 이긴다.** 없으면 로컬 DB 의 값을, 그것도 없으면
운영의 기존 값을 쓰고, 셋 다 없으면 서버가 지금 시각을 매긴다.

**왜 저장소가 들고 있어야 하나.** 배포는 miniPC 러너에서 돌아 이 맥의 로컬 API 를 못 읽는다.
그래서 로컬 발행일을 실어 보낼 길이 없고, 새 글은 배포가 돈 시각으로 찍힌다 — 2026-08-25 에
여덟 편이 실제로 그렇게 어긋났다. 머리말에 적힌 값만이 클러스터까지 따라간다.

**손으로 적을 일은 없다.** 어느 쪽에서 발행하든 스크립트가 채운다.

| 언제 | 무엇이 채우나 |
|---|---|
| `blog-sync.mjs --write` | 내려받은 글은 `stamp-blog-dates.mjs` 로 머리말에 새긴다 |
| `publish-blog-post.mjs --write` | 저장소 머리말의 값을 그대로 운영에 실어 보낸다 |
| `/sync` 의 「블로그 반영」 (옛 경로) | 발행 뒤 `--stamp-dates` 가 머리말에 적는다 |
| `publish-blog-drafts.sh` (옛 경로) | 로컬 API 의 발행일을 실어 보낸다 |
| `sync-local-from-prod.sh blog` | 운영 발행일을 머리말에 새긴다 |
| 아무 때나 손으로 | `node scripts/stamp-blog-dates.mjs --write` |

어긋났는지는 `node scripts/check-content-sync.mjs` 가 「발행일이 다른 글 N편」으로 알려 준다.

`publishedAt` 은 발행 뒤에 스크립트가 채운다. 사람이 손으로 적을 일은 없다.

카테고리는 여섯이다. **넷이라고 적혀 있던 것을 2026-08-20 에 운영 값으로 맞췄고, 2026-08-30 에
도서를 없애고 문제 해결을 개발 노트로 고쳤다.** 개발 노트는 겪은 문제와 혼자 정리한 메모를 함께 담는
칸이라 이름과 slug 가 어긋나 있다. slug 를 바꾸면 기존 링크가 깨지므로 그대로 둔다.

| 이름 | slug | 어디서 생겼나 |
|---|---|---|
| 개인 프로젝트 | `personal-projects` | `V13__blog.sql` |
| 팀 프로젝트 | `team-projects` | `V13__blog.sql` |
| 기술 실험 | `tech-lab` | `V13__blog.sql` |
| 도구·워크플로 | `tools-workflow` | `V13__blog.sql` |
| 개발 노트 | `trouble-shooting` | 관리자 화면에서 추가 |
| 리서치 | `research` | 관리자 화면에서 추가 |

로컬 집필용으로 2026-09-12에 독립 카테고리 **시나리오**(`scenarios`)를 추가했다. 표시 순서는 기술 실험 바로 다음이다.
시나리오 시리즈의 미발행 편집 기록은 공개 snapshot에 포함하지 않는다.
카테고리는 DB 데이터이므로 초안 파일을 올리는 것만으로 생성되지 않는다.

**뒤의 둘은 마이그레이션에 없다.** 관리자 API 로 만든 것이라 `V13__blog.sql` 만 돌린 빈 DB
(로컬 초기화·CI)에는 없다. 그 환경에서 이 둘을 쓰는 글을 발행하면 카테고리를 못 찾는다.
설명(`description`)도 비어 있어 목록 화면에서 한 줄 소개가 안 나온다.

현재 값은 여기서 확인한다.

```bash
curl -s https://blog.leneu.cloud/api/bff/blog/categories | jq -r '.[] | "\(.slug)\t\(.name)"'
```

**본문을 `# 제목` 으로 시작하지 않는다.** 화면이 제목을 따로 그리므로 제목이 두 번 나온다.
(발행 스크립트가 첫 H1 을 떼기는 하지만 초안에서 안 쓰는 게 맞다.)

## 문체

기존 글(`posts/jay-blog/posts/personal-projects/jaycron-...`)을 한 편 읽고 시작한다.

| 항목 | 규칙 |
|---|---|
| 문체 | 평서체 `~다`. 존댓말 아님 |
| 여는 문단 | 기능 소개가 아니라 **내가 겪은 불편**에서 시작 |
| 소제목(`##`) | 명사구가 아니라 **결정을 서술한 문장** |
| 표 | 선택지 비교에 자주 쓴다 |
| 다이어그램 | ` ```mermaid ` 코드펜스. 렌더링된다 |
| 이미지 | `![대체텍스트](/assets/projects/<slug>/<파일>.png)` |
| 금지 | 과장 표현(`획기적`, `혁신적`), 이모지 |
| 마무리 | 잘된 것만 쓰지 않는다. 남은 한계를 그대로 적는다 |

## 마크다운 함정

- **닫는 `**` 앞에 따옴표를 두면 굵게가 안 먹는다.** `**"고른다"**로` 는 별표가 그대로 보인다.
  `"**고른다**"로` 로 쓴다. CommonMark 규칙이고 렌더러를 고치지 않았다.
- **코드블록에서 공백으로 열을 맞추지 않는다.** monospace 에서 한글은 2칸이라 어긋난다. 표를 쓴다.
- 물결표는 안전하다. 취소선은 `~~두 개~~` 로만 인정하도록 2026-08-04 에 고쳤다(`web/src/lib/markdown.ts`).
- **본문의 HTML 은 전부 글자로 이스케이프된다.** 예외는 하나뿐이다.
  - `<details>` / `<summary>` — 접는 블록. **속성은 못 쓴다.** 안쪽은 마크다운이 그대로 돈다.

    ~~~
    <details>
    <summary>펼치기 전에 보일 한 줄</summary>

    본문. 목록도 표도 코드블록도 된다.

    </details>
    ~~~

    `<summary>` 다음과 `</details>` 앞에 **빈 줄을 넣는다.** 없으면 안쪽이 통째로
    한 덩어리 HTML 로 묶여 마크다운이 안 돈다. 목록 항목 안에 넣을 때는 두 칸 들여쓴다.

## 글 상단 목차

`##` 과 `###` 을 모아 자동으로 그린다. 항목이 3개 미만이면 안 그린다.

**켜고 끄는 것은 머리말의 `toc` 다.** 기본은 켜짐이라 안 적어도 된다. 끄려면 `toc: false`.

```
toc: false
```

`tb_blog_post.toc_enabled` 컬럼에 저장되고, 관리자 화면의 체크박스와 같은 값이다.
위키도 같은 이름의 컬럼을 쓴다(`tb_article.toc_enabled`) — 다만 **위키는 기본 꺼짐**이라
켤 글에만 시드에 `tocEnabled: true` 를 적는다. 위키에는 목차가 필요 없는 짧은 글이 많다.

**앵커 id 규칙은 `web/src/lib/toc.ts` 의 `headingSlug` 하나뿐이다.** 목차와 렌더러가
이 함수를 함께 쓴다. 갈리면 링크가 조용히 아무 데도 안 닿는다 — 화면은 멀쩡해 보인다.
`web/src/lib/toc.test.ts` 가 그 계약을 고정한다.

## 이미지

**쓰는 동안에는** `web/public/assets/projects/<slug>/` 에 두고 본문에서
`/assets/projects/<slug>/<파일>.png` 로 건다. 로컬에서 그대로 보이고 git 이 이력을 든다.

**발행할 때 스크립트가 알아서 옮긴다.** 그림을 운영 MinIO 에 올리고, 본문의 주소를
`/api/wiki-assets/{id}` 로 바꾸고, 파일을 `posts/jay-blog/assets/<slug>/` 로 옮긴다.

```bash
node scripts/publish-blog-post.mjs posts/jay-blog/drafts/<slug>.md --write
```

**왜 옮기나.** `web/public` 은 컨테이너 이미지에 구워지는 폴더라, 그림이 거기 있으면 글 한 편에
배포 한 판(과금 13분, 대기 20분)이 필요하다. `posts/jay-blog/assets/` 는 저장소 안이지만
이미지에 안 구워져서, **git 이력은 그대로 지키면서 배포만 떼어낸다.**

- 이 명령은 GitHub Actions 를 안 지나고 TOTP 도 안 쓴다. `ssh miniPC` 로 클러스터 안의 문을 쓴다
- 로컬 개발 서버는 운영 주소를 대신 불러 그림을 보여 준다. 로컬에 파일이 없어도 화면은 맞다
- **초안이 정본이다.** 운영 화면에서만 주소를 고치면 다음 배포가 되돌린다
- 이미 발행된 글 127곳의 `/assets/...` 참조는 그대로 둔다. 잘 뜨고 있고 옮기면 본문을 다시 써야 한다

**그림이 제자리에 있는지 가끔 본다.** 정본은 저장소이고 창고는 서빙용 사본이라, 사본이 사라지면
글의 그림만 조용히 깨진다.

```bash
node scripts/blog-assets.mjs             # 상태만 본다
node scripts/blog-assets.mjs --repair    # 사라진 그림을 저장소 원본으로 되올리고 초안도 고친다
node scripts/blog-assets.mjs --prune     # 아무도 참조하지 않는 그림을 지운다
```

`--prune` 은 서버가 막아 준다. 위키 본문, 과거 판, 블로그 본문, 커버 이미지 중 한 곳이라도
참조가 남아 있으면 409 로 거부한다.

- **읽혀야 하는 캡처는 원본 배율로 찍는다.** 데스크톱 배율로 넓게 찍어 본문 폭(약 730px)에 맞추면
  글자가 절반 이하가 되어 안 읽힌다. 세로로 길어지는 건 감수한다.
- **가변 수치를 캡처와 함께 쓰지 않는다.** 본문의 "OPERATE 18편" 과 캡처의 15 가 어긋나면 바로 걸린다.
- **다이어그램은 캡처하지 말고 mermaid 로 넣는다.** 블로그가 직접 렌더하므로 이미지로 만들 이유가 없다.
  가로로 긴 `flowchart LR` 은 본문 폭에서 글자가 안 읽히니 `TB` 로 세운다.

## YouTube 영상

원시 HTML의 `<iframe>`은 본문에서 이스케이프되므로 직접 넣지 않는다. 영상은 `youtube` 코드펜스에
YouTube URL 하나만 적는다.

~~~youtube
https://youtu.be/xuWCNbn3vk0
~~~

`youtu.be` 또는 `www.youtube.com/watch?v=...` 형식의 HTTPS URL만 허용한다. 렌더러가 영상 ID를
검증한 뒤 `youtube-nocookie.com`의 지연 로딩 iframe으로 바꾸므로, 외부 HTML과 임의의 iframe을
글쓴이가 실행할 수는 없다. YouTube가 차단되거나 쿠키 동의 화면이 필요한 환경을 위해 같은 영상의
일반 링크도 함께 적는다.

영상은 외부 네트워크에 의존하므로 로컬 미리보기에서는 iframe의 존재와 비율, 원본 링크를 확인하고,
네트워크가 없는 환경에서 영상이 재생되지 않는 것은 글 오류로 보지 않는다.

## 로컬에서 화면 확인

**발행 스크립트를 로컬로 돌린다.** 운영에 올릴 때와 같은 경로를 그대로 타므로, 머리말 파싱도
카테고리 연결도 목차도 실제와 같게 확인된다. 운영에는 영향이 없다.

```bash
JAYWIKI_API_BASE=http://localhost:8080/api JAYWIKI_ADMIN_PASSWORD=admin1234 \
  node scripts/publish-blog-drafts.mjs --write posts/jay-blog/drafts/<slug>.md
```

끝에 `/<id>/<slug>` 를 찍어 준다. 주소는 `http://blog.localhost:3000/<id>/<slug>` 다.

TOTP 는 로컬에서만 면제된다. 주소가 localhost 인지로 가르고, 그 밖에는 예전처럼 막는다
(`publish-blog-drafts.mjs`). 로컬 관리자에는 2FA 가 없어서 요구하면 미리보기 길이 막힌다.

로컬을 운영 글로 채우려면 `scripts/sync-local-from-prod.sh blog` 다. 한 방향이고 조회수는 안 옮긴다.
어긋난 글만 골라 양방향으로 맞추려면 `node scripts/blog-sync.mjs` 를 쓴다.

## 발행일은 어디서 오나

**`/sync` 의 「블로그 반영」은 로컬 발행일을 그대로 실어 보낸다.** 로컬이 정본이라는
방향과 맞춘 것이라, 로컬 화면에서 본 날짜가 운영에 그대로 뜬다. 발행 로그에 `(로컬)` 로 찍힌다.

로컬을 못 읽으면(서버가 꺼져 있으면) 경고 한 줄을 내고 **운영의 기존 발행일을 그대로 둔다.**
서버도 발행일을 안 받으면 이미 있는 값을 먼저 쓰고, 그것도 없을 때만 지금 시각을 넣는다
(`BlogPostService`). 그래서 **글을 고쳐도 발행일이 오늘로 밀리지 않는다** —
2026-08-17에 고치기 전까지는 배포로 글을 수정할 때마다 밀렸다.

날짜 자체를 바꾸고 싶으면 로컬 관리자 화면에서 고친 뒤 반영한다.

**스크린샷이 안 찍힐 수 있다.** Orca 창이 두 번째 디스플레이에 있으면 타임아웃한다.
그럴 때는 `orca eval` 로 수치를 잰다.

```js
(() => {
  const prose = document.querySelector('.prose');
  const lh = parseFloat(getComputedStyle(prose).lineHeight);
  const ps = [...prose.querySelectorAll(':scope > p')].filter(p => p.textContent.trim());
  const dist = {};
  ps.forEach(p => { const n = Math.round(p.getBoundingClientRect().height / lh); dist[n] = (dist[n]||0)+1; });
  return JSON.stringify({
    줄수분포: dist,
    본문에_남은_별표: ps.filter(e => e.textContent.includes('**')).map(e => e.textContent.slice(0,40)),
    표넘침: [...prose.querySelectorAll('table')].filter(t => t.scrollWidth - t.clientWidth > 1).length,
    코드넘침: [...prose.querySelectorAll('pre')].filter(p => p.scrollWidth - p.clientWidth > 1).length,
    문서가로넘침: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  });
})()
```

**기준**: `본문에_남은_별표` 는 `[]`, 표·문서 넘침은 0, 문단은 5줄 이하.

**데스크톱 배치는 `document.documentElement.style.zoom='0.62'` 로 재현한다.** 기본 뷰포트가 744px 이라
그대로 두면 모바일 배치가 나온다. 측정값은 zoom 으로 나눠 CSS px 로 환산한다.
**모바일 폭에서 코드 블록이 좌우로 밀리는 건 정상이다** — 데스크톱 폭에서 재고 판단한다.
좌측 레일처럼 zoom 으로도 재현되지 않는 화면이 있다. 그건 사용자에게 PC 캡처를 받는 게 빠르다.

## 운영에 발행

**TOTP 도 배포도 안 쓴다** (2026-09-02부터). `ssh miniPC` 로 클러스터 안의 내부 문을 쓰고,
토큰은 그 자리에서 읽어 이 맥에 남기지 않는다. 그림이 있든 없든 같은 명령이고 몇 초 걸린다.

```bash
# 양쪽을 맞춘다 — 어느 방향으로 가야 할지 모를 때 이것부터
node scripts/blog-sync.mjs             # 편마다 방향만 보여준다
node scripts/blog-sync.mjs --write     # 실제로 맞춘다

# 한 편만 올린다
node scripts/publish-blog-post.mjs posts/jay-blog/drafts/<slug>.md --write

# 파일을 안 주면 초안 전부다. 쓰다 만 초안까지 나가므로 --write 없이 먼저 본다
node scripts/publish-blog-post.mjs
```

`blog-sync` 가 방향을 정하는 기준은 **초안 머리말의 `updatedAt`** 이다. 그 값은 「이 초안이 운영과
마지막으로 맞춰진 시각」이라, 운영이 그보다 새 값을 들고 있으면 그 사이 관리 화면에서 고쳤다는 뜻이다.
그때는 올리지 않고 내린다 — 아래 「정본은 블로그 DB다」가 요구하는 순서를 명령이 대신 지킨다.

덮이는 글의 운영 사본은 `.local-backups/blog-sync-<시각>/` 에 먼저 받아 둔다.

`ssh miniPC` 가 이 흐름의 전제다. 안 붙으면 이것부터 친다.

```bash
cloudflared access login https://ssh.leneu.cloud
```

### 안 될 때의 옛 경로

`ssh` 가 끝내 안 되면 예전 길이 그대로 있다. **이쪽은 TOTP 를 묻고, 새 그림이 있으면 막힌다.**

```bash
./scripts/publish-blog-drafts.sh                       # dry-run. 무엇이 신규/갱신인지만 보여준다
./scripts/publish-blog-drafts.sh --write               # 실제 발행
./scripts/publish-blog-drafts.sh --write posts/jay-blog/drafts/one.md   # 특정 파일만
```

비밀번호는 macOS Keychain(`jay-wiki-production-admin`)에서 실행 순간에만 읽고, TOTP 는 사람이 그 자리에서 넣는다.
**비밀번호와 TOTP 를 대화·문서·로그에 남기지 않는다.** 이쪽은 **dry-run 에도 TOTP 가 필요하다** —
블로그는 목록 조회도 관리 API 뒤에 있다.

발행 뒤 확인할 것:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://blog.leneu.cloud/<id>/<slug>
curl -s -o /dev/null -w '%{http_code}\n' https://blog.leneu.cloud/blog/<id>/<slug>/opengraph-image
```

## 대표 이미지와 공유 카드

- 목록 썸네일과 `og:image` 는 같은 값을 쓴다. 관리자 화면에서 지정한 자산이 있으면 그것, 없으면
  **본문의 첫 이미지**다(`BlogCoverImage.resolve`).
- 공유 카드는 `opengraph-image.tsx` 가 글마다 1200×630 으로 그린다. `objectFit: contain` 이라 잘리지 않는다.
- **카드에 글자를 넣지 않는다.** satori 는 woff2 를 못 읽고 이 저장소 폰트는 둘 다 woff2 다.
- `generateMetadata` 에 `openGraph.images` 를 적으면 파일 규약이 죽는다. 비워 두면 Next 가 카드 URL 과
  크기, `twitter:card` 를 알아서 넣는다.

## 수치는 저장소에서만 가져온다

지어내지 않는다. 그리고 **근거 문서도 낡을 수 있다.**

- 시나리오 배지 값의 정본은 `web/src/app/scenarios/scenarios.ts` 다. `docs/interview/README.md` 의 문구는 낡았다.
- 위키 편수는 `posts/jay-wiki/` 파일 수와 운영 사이트가 다르다. export 스냅샷이 낡았다.
- 다른 저장소 이야기를 쓸 때는 그 저장소의 README·설계 문서·워크플로 파일을 직접 읽는다.
