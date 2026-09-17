# jay-blog 원고 — 발행하면 정본이 여기가 아니게 된다

| 폴더 | 무엇 |
|---|---|
| `drafts/` | 발행 대상. 발행 명령이 이 폴더를 읽는다 |
| `posts/` | 발행된 글의 작업용 사본. 문체 참고용으로 읽는다 |
| `assets/` | 그림 원본. 발행할 때 `web/public` 에서 여기로 옮겨진다 |

`assets/` 가 `web/public` 밖에 있는 이유가 있다. `web/public` 은 컨테이너 이미지에 구워지는
폴더라, 그림이 거기 남으면 글 한 편에 배포 한 판이 필요하다. 여기로 옮기면 **git 이력은 그대로
지키면서 배포만 떼어낸다.** 화면에 나가는 사본은 운영 MinIO 에 있다.

## 정본은 운영 블로그 DB 다

한 번 발행한 뒤로는 **관리자 화면에서 고친 내용이 최신**이다. 여기 파일을 고쳐서 같은 slug 로
다시 발행하면 그 수정이 조용히 덮인다.

발행한 글을 다시 손볼 때는 순서가 있다.

1. 운영에서 그 글이 그 사이에 바뀌었는지 본다
2. 안 바뀌었으면 여기 초안을 고쳐 재발행한다
3. 바뀌었으면 관리자 화면에서 고친다 — 초안으로 덮지 않는다

**이 순서를 명령이 대신 지킨다.** `blog-sync.mjs` 가 편마다 대조해서, 운영이 더 최신이면
올리지 않고 내린다.

```bash
node scripts/blog-sync.mjs             # 편마다 어느 방향으로 갈지 보여준다
node scripts/blog-sync.mjs --write     # 실제로 맞춘다
```

기준은 초안 머리말의 `updatedAt` 이다. 그 값이 「이 초안이 운영과 마지막으로 맞춰진 시각」이라,
운영이 그보다 새 값을 들고 있으면 그 뒤에 관리 화면에서 고쳤다는 뜻이 된다.
덮이는 글의 운영 사본은 `.local-backups/blog-sync-<시각>/` 에 먼저 받아 둔다.

## 한 편만 올릴 때

```bash
node scripts/publish-blog-post.mjs posts/jay-blog/drafts/<slug>.md --write
```

그림까지 한 번에 간다. **파일을 안 주면 초안 전부가 대상이고, 쓰다 만 초안도 같이 나간다** —
처음 돌릴 때는 `--write` 없이 한 번 보고 붙인다.

## 로컬을 운영으로 통째로 덮으려면

```bash
scripts/sync-local-from-prod.sh blog
```

운영 글 전부를 로컬 DB 에 넣고, 같은 내용을 여기 `posts/<카테고리>/` 사본으로도 떨어뜨린다.
한 방향이라 로컬에서 고친 것은 사라진다. 어긋난 글만 골라 맞추려면 위의 `blog-sync.mjs` 를 쓴다.

## 그림이 제자리에 있는지

```bash
node scripts/blog-assets.mjs             # 상태만 본다
node scripts/blog-assets.mjs --repair    # 창고에서 사라진 그림을 여기 원본으로 되올린다
node scripts/blog-assets.mjs --prune     # 아무도 참조하지 않는 그림을 지운다
```

정본은 이 저장소이고 MinIO 는 서빙용 사본이라, 사본이 사라지면 글의 그림만 조용히 깨진다.
`--prune` 은 참조가 한 곳이라도 남아 있으면 서버가 409 로 거부한다.

---

형식·문체 규칙은 `docs/blog-writing-guide.md` 에 있다.
옆의 `posts/jay-wiki/` 는 성격이 반대다 — 사람이 쓰지 않는 생성물이다.
