# 위키 전면 재개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 위키를 면접관 한 사람의 5분 읽기에 맞춰 재구성한다 — 탭 19→11, 정본 없는 글 17편 정리, 글 형식 통일.

**Architecture:** 위키 글의 정본은 `scripts/seed-portfolio-wiki.mjs` 이고 운영 PostgreSQL 은 그 결과다. 시드는 upsert 라 DB 에만 있는 항목을 지우지 않으므로, **DB 정리는 관리자 API 로 따로** 하고 시드는 그 결과와 일치시킨다. 탭 구조는 `web/src/lib/wikiCategories.ts` 와 시드 `TABS` 두 곳이 함께 움직인다.

**Tech Stack:** Node.js ESM 스크립트, Next.js 15 / TypeScript, Spring Boot 3.5, vitest, PostgreSQL, OpenSearch

## Global Constraints

- **시드 본문은 `String.raw` 다. 백틱을 쓰면 스크립트가 ReferenceError 로 죽는다.** 인라인 코드는 백틱 없이, 코드 블록은 물결표 세 개(`~~~`). `assertNoBacktick()` 이 강제한다.
- **글을 먼저 옮기고 탭을 나중에 지운다.** 시드는 upsert 이고 DB 를 자동 삭제하지 않는다. 탭을 먼저 지우면 그 탭 글이 고아가 된다.
- **운영 DB 를 바꾸는 명령은 사용자가 `!` 로 직접 친다.** 자동 승인 분류기가 `--write` 를 막는다. TOTP 는 사람이 그 자리에서 넣는다. 비밀번호·TOTP 를 대화·로그에 남기지 않는다.
- **`main` 에 머지하는 순간 운영 배포다.** 작업은 전부 `develop` 에 모은다.
- 검증 기준선: Spring 172 / web 82 / `tsc` 통과 / lint 경고 **정확히 8** (`--max-warnings 8`).
- 문체는 평서체 `~다`. 소제목은 명사구가 아니라 결정을 서술한 문장. 굵게 안에 따옴표를 넣지 않는다(`"**질문**"` 로 쓴다). mermaid 는 `flowchart TB`.
- `docs/` 와 `posts/` 만 바뀐 커밋은 배포 경로 필터 밖이라 운영에 안 나간다. 시드(`scripts/**`)는 필터 안이다.

## 실행 조정 (2026-08-10 합의)

계획을 서브에이전트로 실행하면서 둘을 바꿨다.

1. **운영 DB 삭제는 배포 직전에 한 번에 모은다.** 서브에이전트는 분류기와 TOTP 때문에
   `--write` 를 실행할 수 없다. Task 3·4·9 의 운영 삭제 단계는 **대상 목록만 확정하고
   실행하지 않는다.** 새 Task 12.5 에서 사용자가 한 번에 친다. TOTP 를 세 번이 아니라
   한 번만 넣는다.
2. **Task 11 은 대분류 넷으로 쪼갠다** — BUILD / OPERATE / IMPROVE / DASHBOARD.
   각각 별도 디스패치와 검토를 받는다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `scripts/archive-orphan-wiki-articles.mjs` | 운영에만 있는 글을 md 로 내려 `posts/archive/` 에 쓴다. 읽기 전용, 인증 불필요 |
| `scripts/delete-wiki-articles.mjs` | slug 목록을 받아 관리자 API 로 지운다. 탭 삭제도 겸한다 |
| `scripts/delete-wiki-articles.sh` | 위 스크립트의 Keychain + TOTP 래퍼. `publish-blog-drafts.sh` 와 같은 경계 |
| `scripts/check-wiki-consistency.mjs` | 운영과 시드가 어긋나는지 검사한다. 고아·유령·탭 불일치 |
| `scripts/seed-portfolio-wiki.mjs` | 위키 글의 정본. `TABS` 배열과 각 글의 `parentId`·본문 |
| `web/src/lib/wikiCategories.ts` | 대분류 4개와 각 대분류의 `tabIds` |
| `web/src/lib/wikiCategories.test.ts` | 위 파일의 계약 |
| `docs/wiki-writing-guide.md` | 위키 글 형식의 정본 |
| `docs/blog-writing-guide.md` | 블로그 글 형식의 정본 |
| `.claude/skills/wiki-writing/SKILL.md` | 위키 글 쓸 때 열리는 스킬 |
| `.claude/skills/blog-writing/SKILL.md` | 블로그 글 쓸 때 열리는 스킬 |
| `CLAUDE.md` | 어떤 글에 어떤 스킬을 쓰는지 두 줄 |
| `posts/archive/` | 지운 글의 유일본 보관 |

---

## Task 1: 유령 글 백업 스크립트

운영에만 있는 글은 `posts/jay-wiki/` 에 사본이 없다. 지우기 전에 내려받는다.

**Files:**
- Create: `scripts/archive-orphan-wiki-articles.mjs`
- Create: `posts/archive/` (스크립트가 만든다)

**Interfaces:**
- Produces: `posts/archive/<slug>.md` 파일들. 머리말에 `tabId`, `title`, `updatedAt` 을 담는다
- Produces: `scripts/archive-orphan-wiki-articles.mjs` — `node scripts/archive-orphan-wiki-articles.mjs [--write]`

- [ ] **Step 1: 스크립트를 만든다**

```javascript
#!/usr/bin/env node
// 운영 위키에만 있고 시드에 없는 글을 md 로 내려 posts/archive/ 에 둔다.
// 시드가 DB 를 자동 삭제하지 않아 쌓인 글들이고, posts/jay-wiki 에 사본이 없다.
// 지우기 전에 반드시 --write 로 한 번 돌린다.
//
//   node scripts/archive-orphan-wiki-articles.mjs           목록만 본다
//   node scripts/archive-orphan-wiki-articles.mjs --write   파일로 쓴다
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_BASE = process.env.JAYWIKI_PUBLIC_BASE ?? 'https://portfolio.leneu.cloud';
const OUT_DIR = path.join(root, 'posts', 'archive');
const WRITE = process.argv.includes('--write');

// Cloudflare 가 기본 UA 를 403 으로 막는다.
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (jay-wiki archive script)' };

function seedSlugs() {
  const source = fs.readFileSync(path.join(root, 'scripts', 'seed-portfolio-wiki.mjs'), 'utf8');
  return new Set(
    [...source.matchAll(/slug: '([a-z0-9-]+)',[\s\S]{0,600}?parentId: '/g)].map((m) => m[1]),
  );
}

async function get(pathname) {
  const res = await fetch(`${API_BASE}${pathname}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`${pathname} -> ${res.status}`);
  return res.json();
}

const seed = seedSlugs();
const tabs = await get('/api/bff/tabs');
const orphans = [];
for (const tab of tabs) {
  for (const article of tab.articles ?? []) {
    if (seed.has(article.slug)) continue;
    orphans.push({ tabId: tab.tabId, tabTitle: tab.title, ...article });
  }
}

if (orphans.length === 0) {
  console.log('운영에만 있는 글이 없다.');
  process.exit(0);
}

if (WRITE) fs.mkdirSync(OUT_DIR, { recursive: true });

for (const orphan of orphans) {
  const full = await get(`/api/bff/articles/${encodeURIComponent(orphan.slug)}`);
  const body = full.body ?? '';
  const head = [
    '---',
    `slug: ${orphan.slug}`,
    `title: ${full.title ?? orphan.title}`,
    `tabId: ${orphan.tabId}`,
    `tabTitle: ${orphan.tabTitle}`,
    `updatedAt: ${full.updatedAt ?? orphan.updatedAt ?? ''}`,
    'note: 운영 DB 에만 있던 글이다. 시드에 정본이 없어 여기에 보관한다.',
    '---',
    '',
  ].join('\n');
  const file = path.join(OUT_DIR, `${orphan.slug}.md`);
  if (WRITE) fs.writeFileSync(file, head + body, 'utf8');
  console.log(`${WRITE ? 'write' : 'would write'} ${path.relative(root, file)} (${body.length}자)`);
}

console.log(`\n${orphans.length}편.${WRITE ? '' : ' --write 를 붙이면 실제로 쓴다.'}`);
```

- [ ] **Step 2: dry-run 으로 17편이 나오는지 본다**

Run: `node scripts/archive-orphan-wiki-articles.mjs`
Expected: `would write posts/archive/<slug>.md` 가 17줄, 마지막에 `17편.`

- [ ] **Step 3: 실제로 쓴다**

Run: `node scripts/archive-orphan-wiki-articles.mjs --write`
Expected: `posts/archive/` 에 md 17개

- [ ] **Step 4: 본문이 비지 않았는지 확인한다**

Run: `wc -c posts/archive/*.md | sort -n | head -3`
Expected: 가장 작은 것도 700바이트 이상. 0바이트가 있으면 API 응답 키가 다른 것이니 `full.body` 를 고친다.

- [ ] **Step 5: 커밋**

```bash
git add scripts/archive-orphan-wiki-articles.mjs posts/archive
git commit -m "chore: 운영에만 있던 위키 글 17편을 posts/archive 로 내린다

시드가 DB 를 자동 삭제하지 않아 08-02 대개편 때 버려진 1세대가 그대로
살아 있었다. posts/jay-wiki 에 사본이 없는 유일본이라 지우기 전에 내린다."
```

---

## Task 2: 삭제 스크립트 (관리자 API)

**Files:**
- Create: `scripts/delete-wiki-articles.mjs`
- Create: `scripts/delete-wiki-articles.sh`

**Interfaces:**
- Consumes: Task 1 의 `posts/archive/` (백업이 끝났다는 전제)
- Produces: `scripts/delete-wiki-articles.sh [--write] <slug|tab:tabId> ...` — 인자 없으면 dry-run 으로 대상만 출력

- [ ] **Step 1: mjs 를 만든다**

```javascript
#!/usr/bin/env node
// 위키 글과 탭을 관리자 API 로 지운다. 기본은 dry-run.
// SQL 로 직접 지우지 않는 이유: ArticleService.delete 가 ArticleIndexEvent.DELETE 를
// 발행해 OpenSearch 색인까지 정리한다. SQL 은 색인에 지운 글을 남긴다.
//
//   scripts/delete-wiki-articles.sh a-slug b-slug tab:ops
//   scripts/delete-wiki-articles.sh --write a-slug tab:ops
const API_BASE = (process.env.JAYWIKI_API_BASE ?? 'http://localhost:8080').replace(/\/+$/, '');
const USERNAME = process.env.JAYWIKI_ADMIN_USERNAME ?? 'admin';
const PASSWORD = process.env.JAYWIKI_ADMIN_PASSWORD;
const OTP = process.env.JAYWIKI_ADMIN_OTP;
const WRITE = process.argv.includes('--write');
const targets = process.argv.slice(2).filter((a) => a !== '--write');

if (targets.length === 0) {
  console.error('지울 대상을 인자로 준다. slug 또는 tab:tabId');
  process.exit(1);
}

let cookie = '';

async function api(pathname, init = {}) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${pathname} -> ${res.status}`);
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  return res.status === 204 ? null : res.json().catch(() => null);
}

async function login() {
  if (!PASSWORD) throw new Error('JAYWIKI_ADMIN_PASSWORD 가 없다. scripts/delete-wiki-articles.sh 로 실행한다.');
  if (!OTP) throw new Error('TOTP 가 없다. scripts/delete-wiki-articles.sh 로 실행한다.');
  await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: USERNAME, password: PASSWORD, otp: OTP }),
  });
}

if (!WRITE) {
  for (const t of targets) console.log(`would delete ${t}`);
  console.log(`\n${targets.length}건. --write 를 붙이면 실제로 지운다.`);
  process.exit(0);
}

await login();
for (const target of targets) {
  const isTab = target.startsWith('tab:');
  const pathname = isTab
    ? `/api/tabs/${encodeURIComponent(target.slice(4))}`
    : `/api/articles/${encodeURIComponent(target)}`;
  await api(pathname, { method: 'DELETE' });
  console.log(`deleted ${target}`);
}
console.log(`\n${targets.length}건 지웠다.`);
```

- [ ] **Step 2: sh 래퍼를 만든다**

`publish-blog-drafts.sh` 와 같은 인증 경계다. 비밀번호는 Keychain 에서 실행 순간에만 읽는다.

```bash
#!/usr/bin/env bash
# 위키 글·탭을 운영에서 지운다. 기본은 dry-run, --write 에서만 실제로 지운다.
# 비밀번호는 Keychain 에서 실행 순간에만 읽고 TOTP 는 사람이 넣는다.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYCHAIN_SERVICE="${KEYCHAIN_SERVICE:-jay-wiki-production-admin}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
API_BASE="${JAYWIKI_API_BASE:-https://portfolio.leneu.cloud/api/bff}"

if [[ " $* " == *" --write "* ]]; then
  password="$(security find-generic-password -s "${KEYCHAIN_SERVICE}" -a "${ADMIN_USERNAME}" -w 2>/dev/null || true)"
  if [[ -z "${password}" ]]; then
    echo "Missing macOS Keychain service ${KEYCHAIN_SERVICE} for ${ADMIN_USERNAME}." >&2
    echo 'Run scripts/store-production-admin-password.sh first.' >&2
    exit 1
  fi
  if [[ -t 0 ]]; then
    read -r -s -p 'Current Google Authenticator TOTP: ' otp
    echo
  else
    otp="$(osascript -e 'text returned of (display dialog "Current Google Authenticator TOTP" default answer "" with hidden answer buttons {"Cancel", "Continue"} default button "Continue")')"
  fi
else
  password=''
  otp=''
fi

JAYWIKI_API_BASE="${API_BASE}" \
JAYWIKI_ADMIN_USERNAME="${ADMIN_USERNAME}" \
JAYWIKI_ADMIN_PASSWORD="${password}" \
JAYWIKI_ADMIN_OTP="${otp}" \
NODE_OPTIONS="${NODE_OPTIONS:-} --no-network-family-autoselection --dns-result-order=ipv4first" \
  node "${ROOT_DIR}/scripts/delete-wiki-articles.mjs" "$@"
```

- [ ] **Step 3: 실행 권한을 준다**

Run: `chmod +x scripts/delete-wiki-articles.sh`

- [ ] **Step 4: dry-run 이 인증 없이 도는지 본다**

Run: `./scripts/delete-wiki-articles.sh tab:ops`
Expected: `would delete tab:ops` 와 `1건.` — TOTP 를 묻지 않는다

- [ ] **Step 5: 커밋**

```bash
git add scripts/delete-wiki-articles.mjs scripts/delete-wiki-articles.sh
git commit -m "feat(scripts): 위키 글·탭 삭제 스크립트

SQL 대신 관리자 API 로 지운다. ArticleService.delete 가 ArticleIndexEvent.DELETE
를 발행해 OpenSearch 색인까지 정리하기 때문이다. SQL 로 지우면 색인에 남는다."
```

---

## Task 3: 운영에서 유령 11편과 `ops` 탭 삭제

**Files:**
- 없음 (운영 DB 만 바뀐다)

**Interfaces:**
- Consumes: Task 1 의 `posts/archive/`, Task 2 의 `delete-wiki-articles.sh`

- [ ] **Step 1: 백업이 있는지 먼저 확인한다**

Run: `ls posts/archive/*.md | wc -l`
Expected: `17`. 17이 아니면 여기서 멈추고 Task 1 로 돌아간다.

- [ ] **Step 2: dry-run 으로 대상을 확인한다**

Run:
```bash
./scripts/delete-wiki-articles.sh \
  jay-wiki-overview jay-wiki-current-status \
  oauth-user-admin-boundary oauth-admin-separation \
  loki-tempo-request-trace board-100k-search-comparison \
  redis-chat-queue-zset kafka-outbox-saga-split \
  markdown-to-db-wiki workbook-06-minipc-deploy \
  scenario-hub-tech-showcase
```

**slug 는 실제 값으로 바꾼다.** 정확한 slug 는 `posts/archive/` 파일 이름에서 가져온다 — 삭제 11편은 아래 제목에 해당하는 파일이다.

| 제목 | 대체하는 시드 글 |
|---|---|
| jay-wiki 프로젝트 개요 | `jaywiki-main-map` |
| jay-wiki 현재 상태: 배포부터 운영 자동화까지 | `jaywiki-main-map` |
| OAuth USER와 로컬 ADMIN 권한 경계 | `admin-user-role-boundary` |
| Google OAuth와 관리자 권한을 분리한 이유 | `admin-user-role-boundary` |
| Loki와 Tempo로 요청 하나를 추적하는 방법 | `observability-loki-tempo-grafana` |
| 10만 게시판과 검색 비교를 만든 이유 | `search-comparison-100k` |
| 랜덤채팅 대기열을 Redis ZSET으로 만든 이유 | `redis-random-chat-queue` |
| Kafka, Outbox, Saga를 주문 시나리오로 분리한 이유 | `saga-kafka-outbox-order` |
| Markdown 파일에서 DB 위키로 전환한 이유 | `postgres-db-wiki-revision` |
| 워크북 06 미니PC 배포 기록 | 워크북이 `archive/` 로 갔다 |
| 시나리오 허브로 기술을 보여주는 방법 | 지금 시나리오는 26편이라 안 맞는다 |

Expected: `would delete <slug>` 11줄

- [ ] **Step 3: 삭제 대상 목록을 확정해 파일로 남긴다 (실행하지 않는다)**

실행은 Task 12.5 로 모았다. slug 11개를 `.superpowers/sdd/2026-08-10-wiki-ia-rebuild/delete-targets.txt` 에 한 줄씩 적는다. 참고로 실행될 명령은 이 형태다.

```
! ./scripts/delete-wiki-articles.sh --write <slug 11개>
```

Expected: `deleted <slug>` 11줄, `11건 지웠다.`

- [ ] **Step 4: `ops` 탭을 지운다**

**글을 먼저 지운 다음이다.** `ops` 탭의 7편은 위 11편과 편입 6편에 나뉘어 들어 있다. 편입 6편은 Task 8 에서 시드로 다시 들어오므로, 탭만 먼저 지우면 그 6편이 고아가 된다. **그래서 `ops` 탭 삭제는 Task 8 이 끝난 뒤에 한다.** 여기서는 건너뛴다.

- [ ] **Step 5: (Task 12.5 이후에 확인한다) 운영에서 사라졌는지 확인한다**

Run: `for s in <지운 slug 3개>; do curl -s -o /dev/null -w "$s %{http_code}\n" https://portfolio.leneu.cloud/wiki/$s; done`
Expected: 전부 `404`

- [ ] **Step 6: (Task 12.5 이후에 확인한다) 검색 색인에서도 빠졌는지 확인한다**

Run: `curl -s "https://portfolio.leneu.cloud/api/bff/search?q=워크북" -H 'User-Agent: Mozilla/5.0' | head -c 200`
Expected: 지운 글이 안 나온다

---

## Task 4: LAB 8편 제거

블로그에 같은 slug 로 이미 있다. 위키 탭은 이 시스템의 구성을 나타내므로 남의 프로젝트 회고가 들어갈 자리가 없다.

**Files:**
- Modify: `scripts/seed-portfolio-wiki.mjs` (글 8개와 탭 4개 블록 삭제)
- Modify: `web/src/lib/wikiCategories.ts:38` (LAB `tabIds` 를 빈 배열로)
- Modify: `web/src/lib/wikiCategories.test.ts`

**Interfaces:**
- Produces: `WIKI_CATEGORY_GROUPS` 의 `lab` 그룹은 `tabIds: []` 이고 `acceptsUnmapped: true`, `externalHref` 유지

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`web/src/lib/wikiCategories.test.ts` 에 더한다.

```typescript
it('LAB 그룹은 자기 탭을 갖지 않고 블로그로만 보낸다', () => {
  const lab = WIKI_CATEGORY_GROUPS.find((g) => g.id === 'lab');
  expect(lab).toBeDefined();
  expect(lab?.tabIds).toEqual([]);
  expect(lab?.externalHref).toBeTruthy();
});

it('LAB 탭 id 는 어느 그룹에도 없다', () => {
  const all = WIKI_CATEGORY_GROUPS.flatMap((g) => g.tabIds);
  for (const gone of ['personal-projects', 'team-projects', 'tech-lab', 'tools-workflow']) {
    expect(all).not.toContain(gone);
  }
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd web && npx vitest run src/lib/wikiCategories.test.ts`
Expected: FAIL — `tabIds` 가 4개라 `toEqual([])` 가 깨진다

- [ ] **Step 3: `wikiCategories.ts` 를 고친다**

```typescript
  {
    id: 'lab',
    code: 'LAB',
    title: '프로젝트',
    // 이 그룹의 글은 blog.leneu.cloud 로 옮겼고 위키에서 지웠다(2026-08-10).
    // 그룹 자체는 지우지 않는다 — acceptsUnmapped 때문에 지우면 매핑되지 않은
    // 새 탭이 갈 곳을 잃는다.
    tabIds: [],
    acceptsUnmapped: true,
    externalHref: BLOG_ORIGIN,
  },
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

Run: `cd web && npx vitest run src/lib/wikiCategories.test.ts`
Expected: PASS. 기존 테스트가 `personal-projects` 를 tabs 픽스처에 쓰고 있으면 `acceptsUnmapped` 로 여전히 lab 에 매핑되므로 깨지지 않는다. 깨지면 픽스처에서 그 네 개를 뺀다.

- [ ] **Step 5: 시드에서 글 8개와 탭 4개를 지운다**

지울 글 slug:
```
donts3p-macos-sleep-assertion-app
mding-local-first-markdown-pwa
jaycron-local-first-calendar-dashboard
quantinue-ai-mock-trading-team-project-retrospective
gongsitoktok-team-rag-mvp-retrospective
local-llm-qwen36-ollama-omlx-benchmark
orca-mobile-agent-workflow-retrospective
cmux-workspace-freeze-session-restore-retrospective
```

지울 탭 줄(`TABS` 배열 끝의 네 줄):
```javascript
  { tabId: 'personal-projects', title: '개인 프로젝트', sortOrder: 15 },
  { tabId: 'team-projects', title: '팀 프로젝트', sortOrder: 16 },
  { tabId: 'tech-lab', title: '기술 실험', sortOrder: 17 },
  { tabId: 'tools-workflow', title: '도구·워크플로', sortOrder: 18 },
```

- [ ] **Step 6: 시드 자체 검사가 통과하는지 본다**

Run: `node -e "process.argv.push('--dry-run')" ; node scripts/seed-portfolio-wiki.mjs --dry-run`
Expected: `assertUniqueSlugs` 가 던지지 않는다. `article ... points at unknown tab` 이 나오면 8편 중 못 지운 것이 있다.

- [ ] **Step 7: 삭제 대상을 목록 파일에 덧붙인다 (실행하지 않는다)**

`delete-targets.txt` 에 아래 12건을 더한다. 실행은 Task 12.5 다.

```
# ./scripts/delete-wiki-articles.sh --write donts3p-macos-sleep-assertion-app mding-local-first-markdown-pwa jaycron-local-first-calendar-dashboard quantinue-ai-mock-trading-team-project-retrospective gongsitoktok-team-rag-mvp-retrospective local-llm-qwen36-ollama-omlx-benchmark orca-mobile-agent-workflow-retrospective cmux-workspace-freeze-session-restore-retrospective tab:personal-projects tab:team-projects tab:tech-lab tab:tools-workflow
```

Expected: `12건 지웠다.` (글 8 + 탭 4)

- [ ] **Step 8: 커밋**

```bash
cd web && npx vitest run && npx tsc --noEmit && cd ..
git add scripts/seed-portfolio-wiki.mjs web/src/lib/wikiCategories.ts web/src/lib/wikiCategories.test.ts
git commit -m "chore(wiki): LAB 8편과 4탭을 위키에서 지운다

전부 jay-wiki 바깥의 다른 프로젝트 이야기이고 같은 slug 로 블로그에 이미 있다.
위키 탭은 이 시스템의 구성을 나타내므로 남의 프로젝트 회고가 들어갈 자리가 없다.
리다이렉트는 걸지 않는다."
```

---

## Task 5: 위키 글쓰기 가이드

**Files:**
- Create: `docs/wiki-writing-guide.md`

**Interfaces:**
- Produces: 공통 머리 3줄과 종류별 뼈대 셋의 정본. Task 6 의 스킬이 이 문서를 가리킨다

- [ ] **Step 1: 가이드를 쓴다**

아래 내용을 담는다. 새 규칙을 만드는 것이 아니라 흩어져 있던 것을 모으는 것이다.

````markdown
# 위키 글쓰기 가이드

이 사이트의 독자는 면접관 한 사람이다. 그 사람은 5분 훑고, 고른 한 곳만 판다.
그래서 **훑는 부분은 모든 글이 같고, 파는 부분은 글의 종류를 따른다.**

위키 글의 정본은 `scripts/seed-portfolio-wiki.mjs` 다. 운영 PostgreSQL 은 그 결과다.

## 공통 머리 — 모든 글이 이 3줄로 시작한다

훑을 때 읽히는 것은 이것뿐이다.

```
한 줄 요약 — 이 글이 답하는 것
무엇을 판단했나 — 결정 한 문장
무엇으로 확인했나 — 근거 한 문장 (커밋 해시, 수치, 실행한 명령)
```

「무엇으로 확인했나」에 문서 이름만 적지 않는다. 문서는 근거가 아니다.
코드·커밋·실측값을 적는다.

## 본문 뼈대 — 종류별로 셋

| 종류 | 뼈대 |
|---|---|
| `wiki` (설명) | 결론 → 왜 그렇게 했나 → 실제 구성 → 한계 |
| `postmortem` (사건) | 증상 → 잘못 짚은 원인 → 실제 원인 → 남긴 방어 |
| `adr` (결정) | 맥락 → 후보와 기각 이유 → 결정 → 결과와 되돌리는 법 |

`note` 는 뼈대를 강제하지 않는다.

**postmortem 에서 「잘못 짚은 원인」을 비우지 않는다.** 처음부터 맞혔다면 그 글은
사건 기록이 아니라 설명 문서다. 종류를 `wiki` 로 바꾼다.

## 문체

| 항목 | 규칙 |
|---|---|
| 문체 | 평서체 `~다`. 존댓말 아님 |
| 소제목(`##`) | 명사구가 아니라 **결정을 서술한 문장** |
| 금지 | 과장 표현(`획기적`, `혁신적`), 이모지 |
| 독자 지목 | 「면접에서 받을 법한 질문」처럼 **읽는 사람을 심사자로 지목하지 않는다.** `## 핵심 질문 넷` 처럼 쓴다 |
| 마무리 | 잘된 것만 쓰지 않는다. 남은 한계를 그대로 적는다 |

## 수치

**지어내지 않는다. 그리고 근거 문서도 낡을 수 있다.**

- 시나리오 배지 값의 정본은 `web/src/app/scenarios/scenarios.ts` 다
- 위키 편수는 `posts/jay-wiki/` 파일 수와 운영 사이트가 다르다. 스냅샷이 낡았다
- 다른 저장소 이야기를 쓸 때는 그 저장소의 README·워크플로 파일을 직접 읽는다

## 시드 편집 규칙

- **본문은 `String.raw` 다. 백틱을 쓰면 스크립트가 ReferenceError 로 죽는다.**
  인라인 코드는 백틱 없이 쓰고, 코드 블록은 물결표 세 개를 쓴다
- 본문을 `# 제목` 으로 시작하지 않는다. 화면이 제목을 따로 그린다
  (`renderMarkdownPreview` 의 `stripLeadingH1` 이 떼기는 한다)
- `parentId` 는 `TABS` 에 있는 탭이어야 한다. `assertUniqueSlugs` 가 검사한다
- **탭을 지울 때는 글을 먼저 옮긴다.** 시드는 upsert 라 DB 를 자동 삭제하지 않는다

## 마크다운 함정

- 굵게의 닫는 별표 바로 앞에 따옴표를 두면 굵게가 안 먹고 별표가 그대로 보인다.
  따옴표를 **밖으로** 뺀다 — `"**질문**"` 이 맞고, 별표 안에 따옴표를 가둔 쪽이 틀렸다
- 코드블록에서 공백으로 열을 맞추지 않는다. monospace 에서 한글은 2칸이라 어긋난다
- mermaid 는 `flowchart TB`. 가로로 긴 `LR` 은 본문 폭에서 글자가 안 읽힌다
- mermaid 노드에 `[/텍스트/]` 를 쓰지 않는다. 도형 문법과 충돌한다

## 쓰고 나서 돌리는 검사

```bash
node scripts/seed-portfolio-wiki.mjs --dry-run   # 백틱·중복 slug·고아 글
node scripts/check-wiki-consistency.mjs          # 운영과 시드의 어긋남
```

```python
import re
body = open('...').read()
re.finditer(r'\*\*[^*\n]*["”’][ ]*\*\*', body)   # 굵게 깨짐
# 오탐이 있다. 굵게 뒤에 따옴표와 별표를 함께 담은 인라인 코드가 오면
# 둘을 한 덩어리로 잡는다. 걸린 곳은 눈으로 한 번 본다.
re.finditer(r'\w+\[/[^\]]*/\]', body)             # mermaid 도형 문법 충돌
re.search(r'(flowchart|graph)\s+LR', body)        # 가로 다이어그램
```

**화면은 자동 테스트가 못 잡는다.** vitest 가 node 환경이라 DOM 이 없다.
정렬·줄바꿈·넘침은 브라우저에서 눈으로 본다.
````

- [ ] **Step 2: 마크다운 함정 검사를 이 문서 자신에게 돌린다**

Run:
```bash
python3 -c "
import re; s=open('docs/wiki-writing-guide.md',encoding='utf-8').read()
print('굵게 깨짐:', re.findall(r'\*\*[^*\n]*[\"”’][ ]*\*\*', s) or '없음')
print('가로 mermaid:', re.findall(r'(flowchart|graph)\s+LR', s) or '없음')
"
```
Expected: 둘 다 `없음`

- [ ] **Step 3: 커밋**

```bash
git add docs/wiki-writing-guide.md
git commit -m "docs: 위키 글쓰기 가이드

공통 머리 3줄과 종류별 뼈대 셋을 정본으로 둔다. 문체·수치·마크다운 규칙은
새로 만든 것이 아니라 CLAUDE.md 와 인계 문서에 흩어져 있던 것을 모았다."
```

---

## Task 6: 블로그 글쓰기 가이드와 스킬 둘, `CLAUDE.md` 정리

**Files:**
- Create: `docs/blog-writing-guide.md`
- Create: `.claude/skills/wiki-writing/SKILL.md`
- Create: `.claude/skills/blog-writing/SKILL.md`
- Modify: `CLAUDE.md` (「블로그 글 작업」 절 전체를 가이드로 옮기고 두 줄로 줄인다)

**Interfaces:**
- Consumes: Task 5 의 `docs/wiki-writing-guide.md`
- Produces: 스킬 두 개. `CLAUDE.md` 는 어떤 글에 어떤 스킬을 쓰는지만 남는다

- [ ] **Step 1: `CLAUDE.md` 의 블로그 절을 통째로 옮긴다**

`CLAUDE.md` 의 `# 블로그 글 작업` 부터 문서 끝까지(초안 형식 / 문체 / 마크다운 함정 / 글 상단 목차 / 이미지 / 로컬 확인 / 운영 발행 / 대표 이미지 / 수치)를 `docs/blog-writing-guide.md` 로 옮긴다. 내용은 그대로 두고 맨 앞에 이 한 줄만 더한다.

```markdown
# 블로그 글쓰기 가이드

블로그 글의 정본은 운영 PostgreSQL 이다. `posts/jay-blog/` 는 작업용 사본·초안이다.
발행 뒤에 손볼 때의 순서는 `posts/jay-blog/README.md` 에 있다.
```

- [ ] **Step 2: `CLAUDE.md` 에 두 줄만 남긴다**

옮긴 자리에 이걸 넣는다.

```markdown
# 글 작업

| 무엇을 쓰나 | 무엇을 읽나 |
|---|---|
| 위키 글 (`scripts/seed-portfolio-wiki.mjs`) | `wiki-writing` 스킬 → `docs/wiki-writing-guide.md` |
| 블로그 글 (`posts/jay-blog/drafts/`) | `blog-writing` 스킬 → `docs/blog-writing-guide.md` |

형식·문체·함정은 전부 가이드에 있다. 글을 쓰거나 고치기 전에 해당 스킬을 연다.
```

- [ ] **Step 3: 위키 스킬을 만든다**

`.claude/skills/wiki-writing/SKILL.md`:

```markdown
---
name: wiki-writing
description: Use when writing or editing jay-wiki wiki articles - the canonical source is scripts/seed-portfolio-wiki.mjs. Triggers on 위키 글, 위키 문서, seed-portfolio-wiki, 위키에 글 추가, 위키 글 고쳐.
---

# 위키 글쓰기

**먼저 `docs/wiki-writing-guide.md` 를 읽는다.** 형식·문체·함정이 전부 거기에 있다.

## 이 스킬이 강제하는 것

1. **가이드를 읽기 전에 시드를 편집하지 않는다.** 공통 머리 3줄과 종류별 뼈대가 있다
2. **`String.raw` 본문에 백틱을 쓰지 않는다.** 하나면 시드 전체가 ReferenceError 로 죽는다
3. **탭을 지우기 전에 글을 옮긴다.** 시드는 upsert 라 DB 를 자동 삭제하지 않는다
4. **쓰고 나서 두 검사를 돌린다**

```bash
node scripts/seed-portfolio-wiki.mjs --dry-run
node scripts/check-wiki-consistency.mjs
```

## 배포

위키 글은 `develop` → `main` 머지로 운영에 나간다. 배포가 시드를 자동 실행한다.
`develop` 까지만 가면 화면이 안 바뀐다.
```

- [ ] **Step 4: 블로그 스킬을 만든다**

`.claude/skills/blog-writing/SKILL.md`:

```markdown
---
name: blog-writing
description: Use when writing or editing jay-blog posts - drafts live in posts/jay-blog/drafts and the canonical source is the production blog DB. Triggers on 블로그 글, 블로그 초안, 블로그에 글 써, 발행, publish-blog-drafts.
---

# 블로그 글쓰기

**먼저 `docs/blog-writing-guide.md` 를 읽는다.** 형식·문체·함정이 전부 거기에 있다.

## 이 스킬이 강제하는 것

1. **정본은 운영 DB 다.** 발행한 글을 다시 손볼 때는 운영에서 그 사이 바뀌었는지 먼저 본다.
   바뀌었으면 관리자 화면에서 고친다 — 초안으로 덮지 않는다
2. **본문을 `# 제목` 으로 시작하지 않는다.** 화면이 제목을 따로 그린다
3. **발행은 사용자가 직접 친다.** 자동 승인 분류기가 `--write` 를 막는다

```
! ./scripts/publish-blog-drafts.sh --write posts/jay-blog/drafts/<slug>.md
```

## 발행 뒤 확인

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://blog.leneu.cloud/<id>/<slug>
curl -s -o /dev/null -w '%{http_code}\n' https://blog.leneu.cloud/blog/<id>/<slug>/opengraph-image
```
```

- [ ] **Step 5: 옮기는 과정에서 내용이 빠지지 않았는지 본다**

Run:
```bash
for k in "닫는" "no-toc" "details" "opengraph" "satori" "Keychain" "headingSlug" "zoom"; do
  printf '%-14s guide=%s claude=%s\n' "$k" \
    "$(grep -c "$k" docs/blog-writing-guide.md)" "$(grep -c "$k" CLAUDE.md)"
done
```
Expected: 모든 항목이 `guide` 쪽에 1 이상. `claude` 쪽은 0 이어도 된다(옮긴 것이므로).

- [ ] **Step 6: 커밋**

```bash
git add docs/blog-writing-guide.md .claude/skills CLAUDE.md
git commit -m "docs: 글쓰기 규칙을 가이드로 옮기고 스킬로 연다

CLAUDE.md 의 절반이 블로그 글쓰기 규칙이었다. 그 규칙은 매 세션이 아니라 글 쓸
때만 필요하므로 항상 컨텍스트를 차지할 이유가 없다. 가이드 문서로 옮기고
스킬이 열게 한다. CLAUDE.md 에는 어떤 글에 어떤 스킬을 쓰는지만 남는다."
```

---

## Task 7: 탭 병합 — 글 이동

**탭을 지우기 전에 글을 먼저 옮긴다.** 이 순서를 어기면 그 탭 글이 고아가 된다.

**Files:**
- Modify: `scripts/seed-portfolio-wiki.mjs` (해당 글들의 `parentId`)

**Interfaces:**
- Produces: `observability`·`ai-usage`·`roadmap` 탭에 글이 0편이 된다

- [ ] **Step 1: 옮길 글을 센다**

Run:
```bash
python3 -c "
import re
s=open('scripts/seed-portfolio-wiki.mjs',encoding='utf-8').read()
from collections import Counter
c=Counter(re.findall(r\"parentId: '([a-z-]+)'\",s))
for t in ['observability','ai-usage','roadmap']: print(t, c[t])
"
```
Expected: `observability 1`, `ai-usage 2`, `roadmap 2`

- [ ] **Step 2: `parentId` 를 바꾼다**

| 옮기는 글 | `parentId` 이전 → 이후 |
|---|---|
| `observability-loki-tempo-grafana` | `observability` → `operations` |
| `ai-assisted-development-harness` | `ai-usage` → `development-process` |
| `ai-agent-keychain-production-auth-boundary` | `ai-usage` → `development-process` |
| `roadmap-after-content` | `roadmap` → `retrospective` |

`roadmap` 탭에 글이 2편으로 잡히지만 `roadmap-after-content` 가 두 번 나온다. 실제 글은 1편이다. 세어서 남은 것이 있으면 그것도 `retrospective` 로 옮긴다.

- [ ] **Step 3: 세 탭이 비었는지 확인한다**

Run: Step 1 과 같은 명령
Expected: `observability 0`, `ai-usage 0`, `roadmap 0`

- [ ] **Step 4: 시드 자체 검사**

Run: `node scripts/seed-portfolio-wiki.mjs --dry-run`
Expected: 던지지 않는다. 옮긴 글 4편이 `[update]` 로 나온다

- [ ] **Step 5: 커밋**

```bash
git add scripts/seed-portfolio-wiki.mjs
git commit -m "refactor(wiki): 한 편짜리 탭의 글을 받는 탭으로 옮긴다

관측 1편은 운영으로, AI 활용 2편은 개발 프로세스로, 로드맵은 회고로 보낸다.
탭 삭제는 다음 커밋이다 — 시드가 upsert 라 순서를 바꾸면 글이 고아가 된다."
```

---

## Task 8: 편입 6편 다시 쓰기

옮기기가 아니라 다시 쓰기다. 여섯 편 다 존댓말이거나 낡은 수치를 갖고 있다.

**Files:**
- Modify: `scripts/seed-portfolio-wiki.mjs` (글 6개 추가)
- Read: `posts/archive/<slug>.md` (Task 1 이 내린 원본)

**Interfaces:**
- Consumes: Task 1 의 `posts/archive/`, Task 5 의 `docs/wiki-writing-guide.md`
- Produces: 시드에 글 6편. 각각 공통 머리 3줄로 시작한다

- [ ] **Step 1: 가이드를 읽는다**

Run: `cat docs/wiki-writing-guide.md`

- [ ] **Step 2: 여섯 편을 하나씩 다시 쓴다**

| 원본 (`posts/archive/`) | 새 `parentId` | `kind` | 손볼 것 |
|---|---|---|---|
| OAuth 로그아웃 세션을 실제로 끝내기 | `backend` | `postmortem` | 문체. 증상→오진→진짜 원인→방어 뼈대로 |
| schema 분리 과설계를 걷어낸 기록 | `data` | `adr` | 706자로 짧다. 「후보와 기각 이유」를 채운다 |
| PostgreSQL 백업 Phase B: R2 외부 복제 플랜 | `operations` | `adr` | **아직 계획인지 확인한다.** README 의 「R2 는 계획 단계」와 맞는지 |
| 관측과 Telegram 알림 리허설 기록 | `verification` | `postmortem` | 문체 |
| HPA와 서비스 제어판 시연 기록 | `verification` | `postmortem` | **CPU 60% 는 틀렸다. 지금은 80%** — `infra/k8s/` 의 HPA 매니페스트에서 실측한다 |
| miniPC 운영 명령어 런북 | `operations` | `wiki` | `docs/minipc-reboot-drill-runbook.md` 와 겹치는지 본다. 겹치면 겹치지 않는 부분만 남긴다 |

각 글은 이렇게 시작한다.

```
한 줄 요약 — ...
무엇을 판단했나 — ...
무엇으로 확인했나 — ...
```

- [ ] **Step 3: HPA 수치를 실측한다**

Run: `grep -rn "averageUtilization\|minReplicas\|maxReplicas" infra/k8s/ | head`
Expected: 실제 값. 글의 60% 를 이 값으로 바꾼다

- [ ] **Step 4: 백틱이 없는지 확인한다**

Run: `node scripts/seed-portfolio-wiki.mjs --dry-run`
Expected: `[create] article` 6줄. `article body must not contain a backtick` 이 나오면 물결표로 바꾼다

- [ ] **Step 5: 굵게 깨짐과 mermaid 를 검사한다**

Run:
```bash
python3 -c "
import re; s=open('scripts/seed-portfolio-wiki.mjs',encoding='utf-8').read()
print('굵게 깨짐:', re.findall(r'\*\*[^*\n]*[\"”’][ ]*\*\*', s)[:5] or '없음')
print('가로 mermaid:', re.findall(r'(flowchart|graph)\s+LR', s) or '없음')
"
```
Expected: 둘 다 `없음`

- [ ] **Step 6: 커밋**

```bash
git add scripts/seed-portfolio-wiki.mjs
git commit -m "docs(wiki): 정본 없이 운영에만 있던 글 6편을 다시 써서 편입한다

원본은 posts/archive 에 있다. 존댓말과 낡은 수치(HPA 60% -> 실측값)를 고치고
공통 머리 3줄과 종류별 뼈대를 입혔다. 옮긴 것이 아니라 다시 쓴 것이다."
```

---

## Task 9: 탭 삭제와 대분류 재구성

**글 이동(Task 7)과 편입(Task 8)이 끝난 뒤에만 한다.**

**Files:**
- Modify: `scripts/seed-portfolio-wiki.mjs` (`TABS` 에서 3줄 삭제)
- Modify: `web/src/lib/wikiCategories.ts`
- Modify: `web/src/lib/wikiCategories.test.ts`

**Interfaces:**
- Produces: `WIKI_CATEGORY_GROUPS` 의 `tabIds` 합계가 10개, `start` 를 더해 11탭

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```typescript
it('탭은 대시보드를 빼고 열 개다', () => {
  const all = WIKI_CATEGORY_GROUPS.flatMap((g) => g.tabIds);
  expect(all).toHaveLength(10);
  expect(new Set(all).size).toBe(10);
});

it('합쳐 없앤 탭은 어느 그룹에도 없다', () => {
  const all = WIKI_CATEGORY_GROUPS.flatMap((g) => g.tabIds);
  for (const gone of ['observability', 'ai-usage', 'roadmap']) {
    expect(all).not.toContain(gone);
  }
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd web && npx vitest run src/lib/wikiCategories.test.ts`
Expected: FAIL — 지금은 14개다

- [ ] **Step 3: `wikiCategories.ts` 를 고친다**

```typescript
export const WIKI_CATEGORY_GROUPS: readonly WikiCategoryGroup[] = [
  { id: 'build', code: 'BUILD', title: '구축', tabIds: ['infra', 'backend', 'data', 'frontend'] },
  {
    id: 'operate',
    code: 'OPERATE',
    title: '운영',
    // 관측(1편)을 운영에 접었다. 한 편짜리 탭은 탭이 아니다.
    tabIds: ['operations', 'verification', 'demo', 'security'],
  },
  {
    id: 'process',
    code: 'IMPROVE',
    title: '개선',
    // AI 활용은 프로세스의 한 갈래이고, 로드맵과 회고는 같은 화면에서 읽힌다.
    tabIds: ['development-process', 'governance', 'retrospective'],
  },
  {
    id: 'lab',
    code: 'LAB',
    title: '프로젝트',
    tabIds: [],
    acceptsUnmapped: true,
    externalHref: BLOG_ORIGIN,
  },
] as const;
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

Run: `cd web && npx vitest run`
Expected: 82개 + 새로 더한 것 전부 PASS

- [ ] **Step 5: 시드 `TABS` 에서 세 줄을 지운다**

```javascript
  { tabId: 'observability', title: '관측', sortOrder: ... },
  { tabId: 'ai-usage', title: 'AI 활용', sortOrder: ... },
  { tabId: 'roadmap', title: '로드맵', sortOrder: ... },
```

남은 탭의 `sortOrder` 는 빈 번호가 생겨도 정렬만 맞으면 되므로 다시 매기지 않는다.

- [ ] **Step 6: 고아 글이 없는지 확인한다**

Run: `node scripts/seed-portfolio-wiki.mjs --dry-run`
Expected: `article ... points at unknown tab` 이 **안 나온다.** 나오면 Task 7 에서 못 옮긴 글이 있다

- [ ] **Step 7: 탭 4개를 목록 파일에 덧붙인다 (실행하지 않는다)**

`delete-targets.txt` 에 `tab:observability tab:ai-usage tab:roadmap tab:ops` 를 더한다. 실행은 Task 12.5 다.

`ops` 는 Task 3 에서 미뤄 둔 유령 탭이다. 이 시점에는 그 안의 글이 전부 삭제되거나 다른 탭으로 편입돼 있다.

Expected: `4건 지웠다.`

- [ ] **Step 8: 커밋**

```bash
cd web && npx tsc --noEmit && npm run lint && npm test && cd ..
git add scripts/seed-portfolio-wiki.mjs web/src/lib/wikiCategories.ts web/src/lib/wikiCategories.test.ts
git commit -m "refactor(wiki): 탭을 19개에서 11개로 접는다

독자가 두 번 고르고서야 글을 만나는데 그 끝이 1~2편인 탭이 여섯이었다.
관측을 운영에, AI 활용을 개발 프로세스에, 로드맵을 회고에 접었다.
글의 종류는 탭이 아니라 배지가 나타낸다."
```

---

## Task 10: 일관성 검사 스크립트

**Files:**
- Create: `scripts/check-wiki-consistency.mjs`

**Interfaces:**
- Produces: `node scripts/check-wiki-consistency.mjs` — 어긋나면 exit 1

- [ ] **Step 1: 스크립트를 만든다**

```javascript
#!/usr/bin/env node
// 운영 위키와 시드가 어긋나는지 검사한다. 어긋나면 exit 1.
//
// 검사 셋:
//   1) 유령  — 운영에 있는데 시드에 없는 글
//   2) 고아  — 시드 글의 parentId 가 TABS 에 없는 것 (시드 자체 검사와 겹치지만 운영도 본다)
//   3) 탭    — 운영 탭 집합이 wikiCategories 의 tabIds + start 와 같은지
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_BASE = process.env.JAYWIKI_PUBLIC_BASE ?? 'https://portfolio.leneu.cloud';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (jay-wiki consistency check)' };

const seedSource = fs.readFileSync(path.join(root, 'scripts', 'seed-portfolio-wiki.mjs'), 'utf8');
const seedSlugs = new Set(
  [...seedSource.matchAll(/slug: '([a-z0-9-]+)',[\s\S]{0,600}?parentId: '/g)].map((m) => m[1]),
);
const seedTabs = new Set(
  [...seedSource.matchAll(/\{ tabId: '([^']+)', title: '[^']+', sortOrder: \d+ \}/g)].map((m) => m[1]),
);

const categorySource = fs.readFileSync(
  path.join(root, 'web', 'src', 'lib', 'wikiCategories.ts'),
  'utf8',
);
const groupedTabs = new Set(
  [...categorySource.matchAll(/tabIds: \[([^\]]*)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/'([a-z-]+)'/g)].map((x) => x[1])),
);
groupedTabs.add('start');

const res = await fetch(`${API_BASE}/api/bff/tabs`, { headers: HEADERS });
if (!res.ok) throw new Error(`tabs -> ${res.status}`);
const liveTabs = await res.json();

const problems = [];

for (const tab of liveTabs) {
  for (const article of tab.articles ?? []) {
    if (!seedSlugs.has(article.slug)) {
      problems.push(`유령 글: [${tab.tabId}] ${article.slug}`);
    }
  }
  if (!seedTabs.has(tab.tabId)) problems.push(`유령 탭: ${tab.tabId}`);
  if (!groupedTabs.has(tab.tabId)) problems.push(`대분류에 없는 탭: ${tab.tabId}`);
}

for (const tabId of seedTabs) {
  if (!groupedTabs.has(tabId)) problems.push(`시드에만 있는 탭: ${tabId}`);
}

const liveCount = liveTabs.reduce((n, t) => n + (t.articles?.length ?? 0), 0);
console.log(`운영 ${liveCount}편 / ${liveTabs.length}탭, 시드 ${seedSlugs.size}편 / ${seedTabs.size}탭`);

if (problems.length === 0) {
  console.log('어긋난 곳이 없다.');
  process.exit(0);
}
for (const p of problems) console.error(`  ${p}`);
console.error(`\n${problems.length}건 어긋났다.`);
process.exit(1);
```

- [ ] **Step 2: 배포 전이라 어긋나는 게 정상인지 확인한다**

Run: `node scripts/check-wiki-consistency.mjs`
Expected: 아직 배포 전이므로 시드에 새로 넣은 글이 운영에 없다. **유령·유령 탭·대분류에 없는 탭이 0 이어야 하고**, 편수 차이는 배포 전이라 정상이다. 유령이 남아 있으면 Task 3 이 덜 끝난 것이다.

- [ ] **Step 3: 커밋**

```bash
git add scripts/check-wiki-consistency.mjs
git commit -m "feat(scripts): 운영과 시드의 어긋남을 검사한다

유령 17편과 유령 탭 ops 를 사람이 눈으로 발견하기까지 한 달 넘게 걸렸다.
에러가 안 나는 종류의 사고라 검사를 남긴다."
```

---

## Task 11: 기존 글에 공통 머리 3줄 입히기

**전체에서 가장 큰 작업이다. 약 50편.** 탭 단위로 나눠 커밋한다.

**Files:**
- Modify: `scripts/seed-portfolio-wiki.mjs`

**Interfaces:**
- Consumes: Task 5 의 `docs/wiki-writing-guide.md`
- Produces: 모든 글이 「한 줄 요약 / 무엇을 판단했나 / 무엇으로 확인했나」로 시작한다

- [ ] **Step 1: 머리가 없는 글을 센다**

Run:
```bash
python3 -c "
import re
s=open('scripts/seed-portfolio-wiki.mjs',encoding='utf-8').read()
blocks=re.split(r\"\n  \{\n    slug: '\",s)[1:]
missing=[b.split(\"'\")[0] for b in blocks if '한 줄 요약' not in b[:1200]]
print(len(missing),'편에 공통 머리가 없다')
for m in missing[:10]: print('  ',m)
"
```
Expected: 약 50편

- [ ] **Step 2: 탭 하나씩 처리한다**

순서는 독자가 만나는 순서다.

1. `start` (2편) 2. `infra` (7) 3. `backend` (5+1) 4. `data` (7+1) 5. `frontend` (2)
6. `operations` (5+1+2) 7. `verification` (5+2) 8. `demo` (3) 9. `security` (2)
10. `development-process` (3+2) 11. `governance` (4) 12. `retrospective` (2+1)

각 글의 본문 맨 앞에 3줄을 넣는다. **본문을 읽고 실제 내용에서 뽑는다 — 제목을 바꿔 쓰지 않는다.**
「무엇으로 확인했나」에는 커밋 해시·수치·명령을 적는다. 없으면 그 글은 근거가 약한 것이니 표시해 둔다.

- [ ] **Step 3: 탭마다 검사하고 커밋한다**

각 탭을 끝낼 때마다:

```bash
node scripts/seed-portfolio-wiki.mjs --dry-run
python3 -c "
import re; s=open('scripts/seed-portfolio-wiki.mjs',encoding='utf-8').read()
print('굵게 깨짐:', re.findall(r'\*\*[^*\n]*[\"”’][ ]*\*\*', s)[:5] or '없음')
"
git add scripts/seed-portfolio-wiki.mjs
git commit -m "docs(wiki): <탭이름> 탭 글에 공통 머리 3줄을 넣는다"
```

- [ ] **Step 4: 전부 들어갔는지 확인한다**

Run: Step 1 과 같은 명령
Expected: `0 편에 공통 머리가 없다`

---

## Task 12: 재개편 회고 1편

**Files:**
- Modify: `scripts/seed-portfolio-wiki.mjs` (글 1개 추가)

**Interfaces:**
- Produces: `wiki-information-architecture-rebuild`, `parentId: 'retrospective'`, `kind: 'postmortem'`

- [ ] **Step 1: 글을 쓴다**

`kind: 'postmortem'` 이므로 뼈대는 증상 → 오진 → 진짜 원인 → 방어다.

| 절 | 내용 |
|---|---|
| 증상 | 탭 19개인데 그중 여섯이 1~2편. 처음 온 사람이 읽을 경로가 없다 |
| 잘못 짚은 원인 | "글이 모자라서 탭이 빈 것"이라고 봤다. 그래서 글을 더 쓰려 했다 |
| 진짜 원인 | 분류를 늘리면 정리된다는 착각이었다. 그리고 **운영 74편 중 17편이 정본 없이 살아 있었다** — 시드 upsert 가 DB 를 자동 삭제하지 않는 설계의 대가다. 정의되지 않은 탭 `ops` 가 「5. 관측·운영」이라는 옛 이름으로 7편을 달고 노출되고 있었다 |
| 남긴 방어 | `scripts/check-wiki-consistency.mjs` — 유령 글·유령 탭·대분류 불일치를 검사한다. `docs/wiki-writing-guide.md` 와 스킬 둘 |

**「에러가 안 나는 종류의 사고」라는 관점을 넣는다.** 화면은 멀쩡해 보였고 테스트도 다 통과했다.

- [ ] **Step 2: 검사**

Run: `node scripts/seed-portfolio-wiki.mjs --dry-run`
Expected: `[create] article wiki-information-architecture-rebuild`

- [ ] **Step 3: 커밋**

```bash
git add scripts/seed-portfolio-wiki.mjs
git commit -m "docs(wiki): 정보구조 재개편 회고

에러가 안 나는 종류의 사고를 적는다. 화면은 멀쩡했고 테스트도 통과했는데
운영 74편 중 17편에 정본이 없었다."
```

---

## Task 12.5: 운영 DB 삭제 — 사용자가 한 번에 실행

Task 3·4·9 가 모아 둔 `delete-targets.txt` 를 한 번에 친다. TOTP 는 한 번만 넣는다.

**Files:** 없음 (운영 DB 만 바뀐다)

- [ ] **Step 1: 백업이 있는지 먼저 확인한다**

Run: `ls posts/archive/*.md | wc -l`
Expected: `17`. 아니면 여기서 멈추고 Task 1 로 돌아간다.

- [ ] **Step 2: 목록을 확인한다**

Run: `cat .superpowers/sdd/2026-08-10-wiki-ia-rebuild/delete-targets.txt`
Expected: 글 19개(유령 11 + LAB 8) + 탭 8개(LAB 4 + observability, ai-usage, roadmap, ops) = 27줄

- [ ] **Step 3: dry-run**

Run: `./scripts/delete-wiki-articles.sh $(grep -v '^#' .superpowers/sdd/2026-08-10-wiki-ia-rebuild/delete-targets.txt | tr '\n' ' ')`
Expected: `would delete` 27줄. TOTP 를 묻지 않는다

- [ ] **Step 4: 사용자가 실행한다**

```
! ./scripts/delete-wiki-articles.sh --write $(grep -v '^#' .superpowers/sdd/2026-08-10-wiki-ia-rebuild/delete-targets.txt | tr '\n' ' ')
```

Expected: `27건 지웠다.`

- [ ] **Step 5: 확인**

Run: `node scripts/check-wiki-consistency.mjs`
Expected: 유령 글·유령 탭이 0. 편수는 아직 배포 전이라 시드와 다를 수 있다

---

## Task 13: 로컬 확인과 배포

**Files:**
- 없음

- [ ] **Step 1: 로컬 서버가 하나만 떠 있는지 본다**

Run: `pgrep -f next-server | wc -l`
Expected: `1`. 둘 이상이면 `.next` 가 갈려 CSS 가 빠진 것처럼 보인다

- [ ] **Step 2: 로컬에 시드를 반영한다**

Run: `node scripts/seed-portfolio-wiki.mjs`
Expected: `Synced N tabs and M articles into http://localhost:8080`

- [ ] **Step 3: 브라우저로 본다**

자동 테스트가 못 잡는 것을 눈으로 본다.

- 대분류 넷이 뜨고 LAB 은 블로그로 나가는지
- 탭이 11개인지, 없앤 셋(`관측`·`AI 활용`·`로드맵`)이 안 보이는지
- `start` 탭에서 「한눈에 보기」가 맨 위인지
- 글을 열면 공통 머리 3줄이 보이는지
- 표가 가로로 넘치지 않는지

- [ ] **Step 4: 검증 기준선을 돌린다**

Run:
```bash
cd spring && ./gradlew test && cd ..
cd web && npx tsc --noEmit && npm run lint && npm test && cd ..
```
Expected: Spring 172 / lint 경고 정확히 8 / web 82

- [ ] **Step 5: export 를 다시 돌린다**

`posts/jay-wiki/` 스냅샷이 낡아 있다.

Run: `node scripts/export-portfolio-wiki.mjs`
Expected: `posts/jay-wiki/` 파일 수가 시드 편수와 맞는다

- [ ] **Step 6: 커밋**

```bash
git add posts/jay-wiki
git commit -m "chore: 위키 스냅샷을 재개편 결과로 다시 뽑는다"
```

- [ ] **Step 7: 사용자에게 배포를 확인받는다**

**`develop` → `main` 머지가 곧 운영 배포다.** 사용자에게 이렇게 묻는다.

> 재개편이 끝났다. `develop` 이 `origin/main` 보다 N커밋 앞이고, 머지하면 운영에 배포된다.
> 위키 전 편의 탭이 바뀌고 본문 앞에 3줄이 붙는다. 지금 배포할까?

- [ ] **Step 8: 배포 뒤 확인**

Run:
```bash
node scripts/check-wiki-consistency.mjs
curl -s -o /dev/null -w '%{http_code}\n' https://portfolio.leneu.cloud/wiki/wiki-information-architecture-rebuild
```
Expected: `어긋난 곳이 없다.` 와 `200`

---

## 자체 검토 결과

**스펙 대조** — 스펙의 6절 실행 순서와 이 계획의 대응:

| 스펙 | 계획 |
|---|---|
| 1. 유령 11편 백업 | Task 1 |
| 2. 운영에서 유령 11편·`ops` 탭 삭제 | Task 3 (탭은 Task 9 로 미룸 — 편입 6편이 그 탭에 있어서 먼저 지우면 고아가 된다) |
| 3. LAB 8편·4탭 제거 | Task 4 |
| 4. 가이드 2 + 스킬 2 + `CLAUDE.md` | Task 5, 6 |
| 5. 탭 병합 | Task 7(글 이동) + Task 9(탭 삭제) |
| 6. 편입 6편 | Task 8 |
| 7. 공통 머리 약 50편 | Task 11 |
| 8. 회고 1편 | Task 12 |
| 9. 배포 | Task 13 |
| 검증 절 | Task 10 (`check-wiki-consistency.mjs`) |

**스펙에서 바뀐 것 하나:** 스펙은 `ops` 탭을 2단계에서 지운다고 했으나, 그 탭의 7편 중 6편이 편입 대상이라 **먼저 지우면 고아가 된다.** Task 9 로 미뤘다. 「글을 먼저 옮기고 탭을 지운다」는 원칙 그대로다.
