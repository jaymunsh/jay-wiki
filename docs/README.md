# 문서 지도

애플리케이션과 CI가 참조하는 기존 파일 경로를 유지하고 역할별로 안내한다.

| 역할 | 시작점 |
|---|---|
| 현재 상태와 검증 | [현재 상태](current-project-status.md), [테스트 기록](test-summary.md) |
| 개발·편집 | [블로그 작성](blog-writing-guide.md), [위키 작성](wiki-writing-guide.md) |
| 설계·작업 기록 | [워크북](workbooks/README.md), `design/`, `analytics/` |
| 운영 구조와 배포 | [배포 런북](deploy-runbook.md), [배포 권한 경계](deployment-security-boundary.md) |
| 공개 배포 | [배포 안내](deploy-runbook.md), [Actions 비용](workbooks/github-actions-cost-reduction.md) |
| 포트폴리오 설명 | [인터뷰 자료](interview/README.md) |

계정 접근 원문과 일부 보안 중간 기록은 별도 private 운영 저장소로 옮겼다.
일반 구조 문서에는 Secret 참조 이름이 나올 수 있으나 실제 값은 보관하지 않는다.
파일 이름이 runbook이라는 이유만으로 실행 스크립트나 필요한 배포 설정을 함께 옮기지 않는다.
