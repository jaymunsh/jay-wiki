---
name: wiki-writing
description: Use when writing or editing jay-wiki wiki articles - bodies are in content/wiki/articles and metadata is in content/wiki/manifest.json. Triggers on 위키 글, 위키 문서, seed-portfolio-wiki, 위키에 글 추가, 위키 글 고쳐.
---

# 위키 글쓰기

**먼저 `docs/wiki-writing-guide.md` 를 읽는다.** 형식·문체·함정이 전부 거기에 있다.

## 이 스킬이 강제하는 것

1. **가이드를 읽기 전에 시드를 편집하지 않는다.** 세 줄 요약과 종류별 뼈대가 있다
   - 모든 글은 **불릿 세 줄**로 시작한다. 줄마다 라벨(`무엇을 판단했나` 따위)을 붙이지 않는다.
     고정 칸을 두면 판단이 없는 글에서 없는 판단을 지어내게 된다
   - 세 줄은 문장으로 끝낸다(`~다.` 또는 `~나?`)
2. **본문은 `content/wiki/articles/<slug>.md`, 메타데이터는 `content/wiki/manifest.json`에 쓴다.** 일반 Markdown이므로 백틱을 사용할 수 있다. 실행 코드는 시드 스크립트에 둔다
3. **탭을 지우기 전에 글을 옮긴다.** 시드는 upsert 라 DB 를 자동 삭제하지 않는다
4. **쓰고 나서 검사하고, 로컬에 반영하고, 화면을 열어 본다.** 시드만 고치고 끝내지 않는다 —
   `--dry-run` 은 DB 를 안 건드리므로 그 상태로는 로컬에서 글이 안 보인다

```bash
node scripts/seed-portfolio-wiki.mjs --dry-run          # 중복 slug·고아 글
node scripts/seed-portfolio-wiki.mjs                    # 로컬 DB 에 반영 — 이걸 빠뜨리지 않는다
node scripts/check-wiki-consistency.mjs --seed-only     # 시드 안의 어긋남 (운영 대조는 --seed-only 없이)
node scripts/export-portfolio-wiki.mjs                  # posts/jay-wiki 갱신. 안 하면 CI 가 diff 로 잡는다
```

**그리고 주소를 사용자에게 알려준다**: `http://localhost:3000/wiki/<slug>`

화면은 자동 테스트가 못 잡는다. 표·코드블록 넘침은 `scripts/measure-layout.mjs` 로 재거나
브라우저에서 눈으로 본다. 모바일은 `--width 390` 으로 잰다(크롬 `--window-size` 는 가짜 폭을 준다).

## 운영 반영

위키 원본은 `content/wiki`다. 배포는 글을 쓰지 않는다(2026-10-22). 운영에는
`node scripts/content-sync.mjs`로 대조한 뒤 커밋하고 `--write <slug>`로 그 글만 옮긴다.
덮기 전 운영 사본은 `.local-backups/wiki-sync-*`에 남고, 바뀐 `content/wiki/sync-state.json`을 커밋한다.
운영 반영은 사용자가 명시적으로 요청할 때만 한다.
