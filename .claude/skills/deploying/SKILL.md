---
name: deploying
description: Use when deploying jay-wiki to production or collecting work into develop. Public main merge only builds images; production deploy runs from the private ops repo in private/. Triggers on 배포, 배포해줘, 서버에 반영, 운영에 올려, 운영 반영, 취합해줘, develop 에 올려줘, main 에 머지.
---

# 배포

운영 절차의 정본은 이 폴더 안의 비공개 저장소 `private/`에 있다. 먼저 읽는다.

- `private/docs/daily-operations.md`: 무엇을 어디서 하는가
- `private/skills/jay-wiki-production-deploy/SKILL.md`: 코드 운영 배포
- `private/skills/jay-wiki-content-publish/SKILL.md`: 블로그·위키 글 발행

## 이 스킬이 강제하는 것

1. **요청을 먼저 가른다.** 「취합해줘」는 공개 `develop` 통합이다. 「배포해줘 / 운영에 반영해줘」만
   공개 `main` 머지 → 이미지 빌드 확인 → 비공개 `release.json` → preflight → deploy 다
2. **공개 `main` 머지는 배포가 아니다.** 이미지를 만들고 멈춘다. 운영은 비공개 workflow가 바꾼다
3. **`main`에 직접 push 하지 않는다.** `--base main` PR 은 사용자 확인 뒤에 만든다
4. **운영 변경은 명시적 요청이 있을 때만 한다.** 「준비해줘」, 「확인해줘」는 preflight 까지다
5. **배포 후 확인까지가 배포다.** workflow 의 deploy, browser smoke 가 끝날 때까지 보고 run URL 을 남긴다
