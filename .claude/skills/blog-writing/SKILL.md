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

## 운영 발행

그림이 있든 없든 같다. **GitHub Actions 도 TOTP 도 안 쓴다.**

**어느 방향으로 가야 할지 모르겠으면 이것부터 친다.** 로컬과 운영을 대조해 편마다 방향을 정한다.

```
! node scripts/blog-sync.mjs
! node scripts/blog-sync.mjs --write
```

기준은 초안 머리말의 `updatedAt` 이다 — 「이 초안이 운영과 마지막으로 맞춰진 시각」이라, 운영이
그보다 새 값을 들고 있으면 관리 화면에서 고쳤다는 뜻이라 **올리지 않고 내린다.** 위 1번 조항을
명령이 대신 지키는 자리다. 덮이는 글의 운영 사본은 `.local-backups/blog-sync-<시각>/` 에 먼저 받는다.

**한 편만 올릴 때는 이것이다.**

```
! node scripts/publish-blog-post.mjs posts/jay-blog/drafts/<slug>.md --write
```

파일을 안 주면 초안 전부가 대상이고 **쓰다 만 초안까지 나간다.** 처음에는 `--write` 없이 본다.

이 명령이 하는 일은 넷이다.

1. `ssh miniPC` 로 클러스터 안의 문에 붙는다. 토큰은 그 자리에서 읽고 이 맥에 안 남긴다
2. 초안이 참조하는 `web/public` 그림을 운영 MinIO 에 올린다
3. 본문의 그림 주소를 `/api/wiki-assets/{id}` 로 바꾸고, 파일을 `posts/jay-blog/assets/<slug>/` 로 옮긴다
4. 본문을 운영에 올린다

**쓰는 동안에는 그림을 `web/public/assets/projects/<slug>/` 에 두고 평소처럼 참조한다.** 로컬에서
그대로 보인다. 옮기는 것은 발행할 때 스크립트가 한다 — `web/public` 에 남으면 그림 한 장 때문에
배포 한 판(과금 13분, 대기 20분)이 필요하다. 이유는 `docs/blog-writing-guide.md` 의 「이미지」에 있다.

`ssh miniPC` 가 전제다. 안 붙으면 이걸 먼저 친다.

```
! cloudflared access login https://ssh.leneu.cloud
```

`ssh` 가 끝내 안 되면 발행을 미룬다. TOTP 예비 경로(`publish-blog-drafts.sh`)는 2026-10-22 에 지웠다.
필요하면 git 이력에서 되살린다.

### 그림이 제자리에 있는지 본다

```
! node scripts/blog-assets.mjs
```

운영 창고에서 사라진 그림과, 아무도 안 쓰는 그림을 한 번에 보여 준다.
되살리려면 `--repair`, 치우려면 `--prune` 이다.

## 로컬에서 먼저 본다

초안은 **운영에 올리기 전에 로컬에 올려서 화면으로 본다.** 같은 스크립트를 대상만 바꿔 돌린다.

```bash
JAYWIKI_API_BASE=http://localhost:8080/api JAYWIKI_ADMIN_PASSWORD=admin1234 \
  node scripts/publish-blog-drafts.mjs --write posts/jay-blog/drafts/<slug>.md
```

로컬을 운영 글로 채우려면:

```bash
scripts/sync-local-from-prod.sh          # 블로그 + 위키 시드
scripts/sync-local-from-prod.sh blog     # 블로그만
```

운영 → 로컬 한 방향이다. 조회수는 안 옮긴다(저장 payload 에 없다). 이미지도 안 옮긴다 —
본문과 대표 이미지가 전부 저장소의 정적 파일이라 git 이 이미 맞춰 준다.

## 발행 뒤 확인

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://blog.leneu.cloud/<id>/<slug>
curl -s -o /dev/null -w '%{http_code}\n' https://blog.leneu.cloud/blog/<id>/<slug>/opengraph-image
```
