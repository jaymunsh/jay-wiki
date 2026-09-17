# 위키 콘텐츠 Markdown export

> 이 디렉터리는 `scripts/seed-portfolio-wiki.mjs`의 기준 콘텐츠를 읽기 좋은 Markdown 파일로 내보낸 결과다.

- 생성 문서: 89편
- 탭: 11개
- 생성 명령: `node scripts/export-portfolio-wiki.mjs`
- 운영 DB에만 남아 있는 레거시 문서 17편은 이 export에 포함하지 않는다.
- PostgreSQL은 운영 본문의 SoT이며, 이 파일은 검토·면접·백업용 콘텐츠 snapshot이다.

## 탭

- [대시보드](./00-start/) — 2편
- [인프라](./01-infra/) — 9편
- [백엔드](./02-backend/) — 11편
- [데이터](./03-data/) — 11편
- [프론트엔드](./04-frontend/) — 6편
- [운영·관측](./05-operations/) — 20편
- [시나리오·시연](./07-demo/) — 5편
- [보안](./08-security/) — 4편
- [운영 검증](./09-verification/) — 10편
- [개발 방식·AI](./10-development-process/) — 6편
- [콘텐츠·품질](./11-content-quality/) — 5편
