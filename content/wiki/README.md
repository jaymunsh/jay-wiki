# 위키 원고

`articles/<slug>.md`는 본문 원본이다. `manifest.json`은 제목·태그·순서·탭·대표 글을 담는다.
본문은 JavaScript 템플릿이 아니므로 백틱과 `${...}`를 일반 Markdown으로 작성할 수 있다.

`scripts/lib/wiki-source.mjs`가 시드·export·일관성 검사에 동일한 자료를 제공한다.
`posts/jay-wiki/`는 기존 형식의 생성물이므로 직접 수정하지 않는다.
운영 DB를 자동으로 읽거나 쓰는 import는 없다.

```bash
node scripts/seed-portfolio-wiki.mjs --dry-run
node scripts/seed-portfolio-wiki.mjs
node scripts/check-wiki-consistency.mjs --seed-only
node scripts/export-portfolio-wiki.mjs
```

운영에는 배포가 아니라 `node scripts/content-sync.mjs --write <slug>`가 옮긴다.
