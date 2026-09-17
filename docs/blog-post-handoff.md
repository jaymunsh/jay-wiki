# jay-wiki · jay-blog 글쓰기 인수인계

작성일: 2026-08-04 (최종 갱신 2026-08-06)
목적: 세션이 바뀌어도 이어갈 수 있게 현재 상태와 대화에만 있던 판단을 남긴다.

> **절차는 이 문서가 아니라 저장소 루트의 `CLAUDE.md` 에 있다.**
> 초안 머리말 형식, 문체 규칙, 마크다운 함정, 이미지 배율, 화면 측정 스니펫, 발행 절차가 거기 있다.
> 이 문서는 **지금 어디까지 왔는지와 왜 그렇게 했는지**만 남긴다.

## 새 세션에서 이어받는 법 (2026-08-06 기준)

### 다음 할 일

**구글 로그인 제거** — 별도 문서로 뺐다. `google-login-removal-handoff.md`(지금은 없다)
조사와 결정은 끝났고 실행만 남았다. 그 문서의 프롬프트를 쓰면 된다.

그다음이 jay-wiki 쪽 나머지 손질인데 무엇을 할지는 아직 정하지 않았다.

### 글 상태

| 글 | 초안 | 운영 | 비고 |
|---|---|---|---|
| ai-trend-bot | `blog/drafts/ai-trend-bot-personal-briefing-bot.md` | 발행됨 `/9` | 예약 폐기 절 추가 반영 완료 |
| jay-blog | `blog/drafts/jayblog-split-from-wiki.md` | 발행됨 `/10` | |
| jay-wiki | `blog/drafts/jaywiki-runnable-portfolio.md` | 발행됨 `/11` | |
| 비전공자를 위한 AI 지식 | `blog/drafts/nondev-ai-book.md` | **미발행** | 아래 순서대로 해야 한다 |

**도서 글을 올리는 순서** — 어기면 표지가 404 가 된다.

1. `portfolio.leneu.cloud/admin/blog/categories` 에서 `도서` / `books` / 순서 4 카테고리 생성
   (로컬 DB 에는 이미 있다. 운영에는 없다.)
2. PR #11(표지·예스24 캡처) 머지 → 배포
3. `./scripts/publish-blog-drafts.sh --write blog/drafts/nondev-ai-book.md`

### 열려 있는 PR

| PR | 내용 | 상태 |
|---|---|---|
| #10 | 썸네일을 자르지 말고 정사각 상자에 `contain` | 머지 보류 — **폭이 길어진 느낌이라 세밀 조정하기로 했다** |
| #11 | 도서 글 이미지 2장 | 머지 대기 |

#10 을 머지하기 전에 데스크톱에서 눈으로 보고 상자 크기를 정한다. 지금은 목록 156×156,
레일 52×52 인데 가로로 긴 캡처(1600×687)는 위아래 여백이 많이 남는다. 납작하게 줄이면
책 표지가 작아진다 — 어느 쪽을 택할지가 남은 판단이다.

### 최근에 바뀐 것 (2026-08-04~06)

| PR | 내용 |
|---|---|
| #6 | 글 이미지 4장 + 인수인계 문서 |
| #8 | 대표 이미지를 본문 첫 이미지로 · og 카드를 글마다 1200×630 으로 생성 · 레일 클램프 수정 |
| #9 | `scripts/publish-blog-drafts.sh` 발행 스크립트 · `CLAUDE.md` 신설 |

**`.gitignore` 의 `blog/` 에 앞 슬래시가 없어서** 깊이에 상관없이 모든 `blog` 디렉터리가 무시되고
있었다. `web/src/app/blog`, `components/blog`, Spring 의 `blog` 패키지에 새 파일을 만들면
조용히 빠졌다. #8 에서 `/blog/` 로 고쳤다.

---

## 이 블로그의 글은 이렇게 생겼다

기존 8편(`blog/posts/`)을 한 편이라도 먼저 읽는다. 특히 `blog/posts/personal-projects/jaycron-local-first-calendar-dashboard.md` 가 개인 프로젝트 글의 본보기다.

| 항목 | 규칙 |
|---|---|
| 문체 | 평서체 `~다`. 존댓말 아님 |
| 여는 문단 | 기능 소개가 아니라 **내가 겪은 불편**에서 시작 |
| 소제목(`##`) | 명사구가 아니라 **결정을 서술한 문장**. 예: "여러 생산성 도구를 합치는 대신 경계를 먼저 나눴다" |
| 표 | 선택지 비교에 자주 쓴다 (`접근 / 대가 / 채택`) |
| 다이어그램 | ` ```mermaid ` 코드펜스. 렌더링된다 |
| 이미지 | `![대체텍스트](/assets/projects/<slug>/<파일>.png "width=420 align=center")` |
| 금지 | 과장 표현(`획기적`, `혁신적`), 이모지 |
| 마무리 | 잘된 것만 쓰지 않는다. 남은 한계를 그대로 적는다 |

**틀을 잡을 때 참고**: 2026-08-04에 쓴 `blog/drafts/ai-trend-bot-personal-briefing-bot.md` 가 가장 최근 예다. 동기 → 결정별 소제목 → 실측 → 비용 → 남은 한계 순서다.

---

## 절차

### 1. 초안을 파일로 쓴다

```
blog/drafts/<slug>.md
```

`blog/` 는 `.gitignore` 에 들어 있다. 정본은 블로그 DB이고 여기는 작업용 사본·초안이다.

맨 위에 제목 후보 3개를 두고 `---` 로 본문과 나눈다. DB에 넣을 때 그 위쪽은 잘라낸다.

### 2. 로컬에 올려 화면으로 본다

**관리 API 는 ADMIN 로그인 쿠키가 필요하다. 비밀번호는 모르고 물어볼 것도 아니다.**
로컬 개발 DB에 직접 넣는다. 운영에는 아무 영향이 없다.

```bash
# 카테고리 id: 1 개인 프로젝트 / 2 팀 프로젝트 / 3 기술 실험 / 4 도구·워크플로
python3 - <<'PY' > /tmp/insert.sql
src = open('blog/drafts/<slug>.md', encoding='utf-8').read()
body = src.split('\n---\n', 1)[1].strip()
assert '$body$' not in body
title, slug, summary = '...', '<slug>', '...'
print(f"""
INSERT INTO tb_blog_post (slug, category_id, title, summary, body, status, published_at)
VALUES ('{slug}', 1, $t${title}$t$, $s${summary}$s$, $body${body}$body$, 'published', now());
""")
PY
docker exec -i pf-postgres psql -U portfolio -d portfolio -v ON_ERROR_STOP=1 < /tmp/insert.sql
```

수정할 때는 같은 방식으로 `UPDATE ... SET body=$body$...$body$`.

주소는 `http://blog.localhost:3000/<id>/<slug>` 다. `blog.` 접두사를 미들웨어가 블로그 host 로 인식한다.
dev 서버는 `cd web && npm run dev`.

### 3. 화면을 **측정해서** 확인한다

**스크린샷이 안 찍힐 수 있다.** Orca 창이 두 번째 디스플레이에 있으면 `orca screenshot` 이
"tab may not be visible" 로 타임아웃한다. 창을 옮기지 말고 `orca eval` 로 수치를 잰다.

```js
// 문단이 벽처럼 길지 않은가 / 넘치는 게 없는가
(() => {
  const prose = document.querySelector('.prose');
  const lh = parseFloat(getComputedStyle(prose).lineHeight);
  const ps = [...prose.querySelectorAll(':scope > p')].filter(p => p.textContent.trim());
  const dist = {};
  ps.forEach(p => { const n = Math.round(p.getBoundingClientRect().height / lh); dist[n] = (dist[n]||0)+1; });
  return JSON.stringify({
    줄수분포: dist,
    본문에_남은_별표: [...prose.querySelectorAll(':scope > p')].filter(e => e.textContent.includes('**')).map(e => e.textContent.slice(0,40)),
    표넘침: [...prose.querySelectorAll('table')].filter(t => t.scrollWidth - t.clientWidth > 1).length,
    코드넘침: [...prose.querySelectorAll('pre')].filter(p => p.scrollWidth - p.clientWidth > 1).length,
    문서가로넘침: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  });
})()
```

폭을 바꿔 보려면 `document.documentElement.style.zoom='0.5'` 로 줄이고 측정값을 zoom 으로 나눠
CSS px 로 환산한다. 내 뷰포트는 744px 이라 그대로 두면 데스크톱 배치가 재현되지 않는다.

**기준**: `본문에_남은_별표` 는 반드시 `[]`, 넘침은 전부 0, 문단은 5줄 이하.

### 4. 이미지

파일을 `web/public/assets/projects/<slug>/` 에 두고 본문에서 `/assets/projects/<slug>/<파일>.png` 로 건다.
스크린샷은 사용자가 준다. 없으면 본문에 `[이미지: 설명]` 으로 자리만 잡아 두고 물어본다.

세로로 긴 휴대폰 캡처는 `"width=420 align=center"` 가 적당하다. 폭 허용 범위는 64~1200이다.

---

## 반드시 알고 있어야 할 함정

이번 세션에 실제로 다 밟았다.

### 물결표는 글자를 삼킨다 (렌더러는 고쳤다)

GFM 은 `~한쪽~` 도 취소선으로 본다. 한국어에서 물결표는 범위 표기라 한 문단에 둘이면
그 사이가 통째로 `del` 이 되고, `del` 이 sanitize 허용 목록에 없어 **물결표와 서식과 글자가 함께 사라졌다.**
발행된 글이 `-0.55%~-0.65%` 를 `-0.55%-0.65%` 로 내보내고 있었다.

**2026-08-04에 고쳤다.** 취소선은 `~~두 개~~` 로만 인정한다(`web/src/lib/markdown.ts`).
회귀 테스트 3개가 `markdown.test.ts` 에 있다. 이제 `15~18콜` 은 그대로 나온다.

### 닫는 `**` 앞에 따옴표를 두면 굵게가 안 먹는다

```
✗  **"고른다"**로 바꿨다      →  별표가 그대로 보인다
✓  "**고른다**"로 바꿨다
```

CommonMark 규칙이다. 닫는 `**` 앞이 구두점이고 뒤가 한글이면 닫는 표시로 인정되지 않는다.
**이건 안 고쳤다.** 글 쓸 때 피해야 한다.

### 코드블록에서 공백으로 열을 맞추지 말 것

monospace 에서 한글은 2칸이라 공백으로 맞춘 표가 어긋난다. **표를 쓴다.**

### 숫자는 근거 문서에서만 가져온다

지어내지 않는다. 그리고 **근거 문서도 낡을 수 있다.** ai-trend-bot 글을 쓸 때
설계서의 "하루 6~9콜"이 배치 도입 전 값이라 실제와 두 배 차이가 났다. 코드로 다시 셌다.

---

## 진행 상태 (2026-08-04 갱신)

**두 편 다 초안이 나왔고 로컬에서 확인했다. 남은 것은 운영 발행뿐이다.**

| 편 | 초안 | 로컬 주소 | 이미지 |
|---|---|---|---|
| jay-wiki | `blog/drafts/jaywiki-runnable-portfolio.md` | `/14/jaywiki-runnable-portfolio` | `assets/projects/jaywiki/` 3장 |
| jay-blog | `blog/drafts/jayblog-split-from-wiki.md` | `/15/jayblog-split-from-wiki` | `assets/projects/jayblog/` 1장 |

**운영에 올릴 때는 관리자 화면에서 쓴다** — 로컬 DB의 글을 옮기는 경로는 없다
(`docs/blog-work-handoff.md` "다음에 할 일 0번"). 이미지는 `web/public/assets/` 정적 파일이라
배포와 함께 나간다. 본문의 `/assets/projects/...` 경로는 그대로 쓰면 된다.

### 이번에 새로 확인한 함정

- **화면 캡처를 넣으면 본문 수치가 캡처와 어긋날 수 있다.** jay-wiki 글에 "OPERATE 18편"을
  적었는데 사용자가 준 캡처에는 15로 찍혀 있었다(환경이 다름). 그림 옆 문장이 그림과 다르면
  바로 걸리므로 **편수 같은 가변 수치는 캡처와 함께 쓰지 않는 편이 안전하다.**
- **`docs/interview/README.md` 의 배지 문구가 낡았다.** 화면은 `실무 기반 / 운영 검증 /
  정책 비교` 와 `LIVE / MOCK` 인데 문서는 옛 문구다. 배지 값의 정본은
  `web/src/app/scenarios/scenarios.ts` 다(`SCENARIO_EXECUTION`, 7 LIVE / 14 SCRIPTED).
- **`posts/jay-wiki/` 는 49개 파일인데 운영 사이트는 그보다 많다.** export 스냅샷이 낡았다.
  편수를 쓸 일이 있으면 운영 화면이나 DB에서 센다.
- **내 뷰포트(744px)로는 데스크톱 배치가 재현되지 않는 화면이 있다.** 블로그 좌측 레일이
  그렇다. `zoom` 을 낮춰도 브레이크포인트가 안 바뀐다. **PC 캡처를 사용자에게 받는 게 빠르다.**
- **이미지 안 글자가 본문보다 작으면 못 읽는다.** 데스크톱 배율로 넓게 찍어 본문 폭(736px)에
  맞추면 글자가 절반 이하가 된다. 읽혀야 하는 캡처는 원본 배율로 찍고 세로로 긴 것을 감수한다.

## 이번에 쓸 두 편의 재료

### jay-wiki

이 저장소 자체다. 재료가 많으니 **무엇을 뺄지**가 관건이다.

| 재료 | 위치 |
|---|---|
| 위키 본문 49편 | `posts/jay-wiki/` (00-start ~ 14-roadmap) |
| 실무 사례 21편 | `docs/interview/` — 원리·대안·구두답변 |
| 설치·운영 | `상세_설치가이드.md`, `포트폴리오_완성가이드.md` |
| 사이트 지도 | `현재_사이트_지도.md` |
| 아키텍처 | `posts/jay-wiki/00-start/jaywiki-main-map.md` |

**후보 관점**: k3s 홈랩 위에 올린 실행형 포트폴리오. 글을 읽는 게 아니라 **눌러서 돌려 보는** 위키.
21편 중 실제로 도는 건 7편뿐이고 그걸 배지로 정직하게 밝힌 결정이 이 프로젝트의 핵심이다
(`docs/interview/README.md` 의 진위 지도).

### jay-blog

이 위키에서 갈라져 나온 블로그다.

| 재료 | 위치 |
|---|---|
| 이전 라운드 기록 | `docs/blog-work-handoff.md` |
| 서브도메인 구성 | `docs/blog-subdomain-setup-runbook.md` |
| 코드 | `web/src/app/blog/`, `web/src/components/blog/` |
| 스타일 | `web/src/app/styles/blog.css` |

**후보 관점**: 위키에 있던 프로젝트 회고 8편을 왜 블로그로 떼어냈는가.
같은 Next.js 앱을 host 로 갈라 `blog.leneu.cloud` 로 서빙하는 구조(`web/src/lib/blogHost.ts`,
`middleware.ts`), 개인정보를 안 모으는 댓글·통계 설계(IP 원본 대신 앞 2옥텟 + salt 해시),
그리고 **이번 세션에 잡은 두 버그**(물결표 소실, 머리말 폭)가 좋은 소재다.

---

## 이번 세션(2026-08-04)에 바뀐 것

블로그 글을 쓰다 발견해서 고쳤다. 모두 `main` 에 머지·배포 완료.

| PR | 내용 |
|---|---|
| #2 | 글 상세에 og:image 가 없어 공유 카드가 파비콘으로 나가던 것 |
| #3 | 물결표 소실 · 머리말이 본문보다 넓던 것 · `blog/` 디렉터리 정리 |
| #4 | 좌측 레일을 `--bg-0` 으로 내려 본문과 구분 |

`blog/posts/` 에 옮겨 둔 8편은 **위키에 있던 시점의 원본**이다. 블로그로 옮긴 뒤 편집한 내용은
반영돼 있지 않을 수 있다. 정본은 블로그 DB다.

## 검증 기준선

```bash
cd web && npx tsc --noEmit          # 통과
cd web && npm run lint              # 경고 정확히 8개 (--max-warnings 8, 하나만 늘어도 빌드가 깨진다)
cd web && npm test                  # 64개
```

## 남겨 둔 것

- **자산 경로가 두 갈래다.** `web/public/assets`(7.2MB, 참조 26회)와 MinIO(188KB, 참조 2회).
  의도는 "고정 자산은 저장소, 런타임 업로드는 MinIO"인데 어디에도 안 적혀 있어 매번 헷갈린다.
  사용자와 "나중에 보완" 하기로 합의했다.
- 글 상세의 `[이미지: …]` 자리 두 곳이 ai-trend-bot 글에 남아 있다(드라이런 터미널, 아키텍처 다이어그램).

---

## 다음 세션 프롬프트

아래를 그대로 붙여 넣으면 된다.

```
docs/blog-post-handoff.md 와 CLAUDE.md 읽고 이어서 진행해.

블로그 글 네 편은 끝났고(도서 글만 발행 전이다) 다음은 jay-wiki 쪽을 최종적으로
손보는 일이다. 무엇을 손볼지부터 같이 정하자.

먼저 지금 상태를 확인하고, 손볼 후보를 근거와 함께 제시해라.
저장소 문서는 낡을 수 있으니 코드와 운영 화면에서 확인한다.
수치는 지어내지 말고, 잘된 것만 보고하지 마라.
```

서버부터 띄워야 하면 `CLAUDE.md` 의 "서버 띄우기"를 본다.
