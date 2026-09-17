# GitHub Actions 실행 비용 정리

2026-09-15. 로컬 구현과 검증 기록이다. GitHub에 푸시하거나 운영에 배포한 상태는 아니다.

## 확인한 사용량

2026-09-12 PR 실행 한 쌍의 완료된 job 시작·종료 시간을 GitHub API로 읽었다.

| 실행 | job 수 | 실제 job 실행 시간 합계 | job별 분 올림 추정 |
|---|---:|---:|---:|
| CI 34690294105 | 5 | 10.70분 | 13분 |
| Security 34690294099 | 12 | 13.28분 | 21분 |
| 합계 | 17 | 23.98분 | 34분 |

병렬 job은 대기 시간이 줄어도 사용 시간이 합산된다. 위 숫자는 실행 기록으로 계산한 추정이며 청구서나 월간 잔여량을 확인한 결과가 아니다.
최근 두 실행만으로 월간 절감률을 확정할 수 없다.

Actions artifacts API 응답: 766개, 약 1.6MB.
활성 캐시: 80개, 9,141,522,282 bytes(약 8.51GiB).
과거 산출물·캐시는 삭제하지 않았다. 캐시는 재빌드 비용을 줄이므로 공간 확보 목적으로 무조건 비우지 않는다.

## 변경 내용

- CI와 Security의 동일 PR 실행은 새 커밋이 올라오면 이전 실행을 취소한다.
- PR 전체 merge-base diff로 변경 영역을 선택한다. 마지막 커밋만 보지 않는다.
- 삭제·이동된 파일은 이전 경로도 검사 선택에 반영한다.
- 비교 실패는 job 실패로 처리하며, 빈 변경 목록으로 취급하지 않는다.
- 공용 스크립트·워크플로·infra·모르는 경로는 전체 검사를 선택한다.
- workflow_dispatch 및 Security 주간 실행은 전체 검사를 선택한다.
- 모든 PR의 문서 검사, 전체 이력 비밀정보 검사, 공개 HTTP 보안 경계 검사는 유지한다.
- 브라우저 실패 자료와 PR 보안 보고서는 7일 보관한다. 주간·수동 보안 보고서는 30일을 유지한다.

| PR 변경 | CI | 추가 보안 검사 |
|---|---|---|
| docs, posts, content의 Markdown | 문서 | 공통 보안 검사 |
| web | 문서 + 웹 전체 검사/E2E | 웹 이미지 + npm audit |
| spring | 문서 + Spring + 웹 전체 검사/E2E | Spring 이미지 + JAR 검사 |
| payment-api | 문서 + 결제 테스트 | 결제 이미지 + Python 의존성 |
| shipping-api | 문서 + 배송 테스트 | 배송 이미지 + Python 의존성 |
| partner-simulator | 문서 | 해당 이미지 + Python 의존성 |
| scripts, infra, workflow, 미분류 경로 | 전체 | 전체 |

웹 editorial 테스트는 실제 Spring을 실행하므로 Spring 변경에서도 웹 검사를 생략하지 않는다.
글·문서만 바뀐 PR은 기존 17개 실행 job에서 선택 job 2개와 공통 검사 3개, 총 5개로 줄어든다.
각 job의 실제 시간과 청구 절감량은 적용 이후 실행에서 확인해야 한다.

## 변경하지 않은 배포 경계

main 배포 워크플로의 verify, build, rollout, smoke, rollback은 그대로 유지한다.
production 배포는 진행 중 취소하지 않는다.
self-hosted runner를 PR CI에 추가하지 않는다.
저장소 공개 전환과 운영 발행은 이 작업에 포함하지 않는다.

## 검증과 적용 후 확인

- `python3 scripts/test-ci-scope.py`: 글 전용, 웹, Spring 연동, 서비스, 공통 경로, 전체 실행, 이동/다중 커밋 PR 회귀 검사.
- `actionlint -shellcheck= -pyflakes= .github/workflows/ci.yml .github/workflows/security.yml`: workflow 문법과 expression 검사. shellcheck/pyflakes 별도 분석은 실행하지 않음.
- PR에서는 changes job이 실패하지 않았는지도 필수로 확인한다. 상위 job 실패로 하위 job이 생략된 것은 정상 선택 생략과 다르다.
- GitHub에서 글 전용 PR과 코드 변경 PR을 각각 확인하고 job별 시간·skipped 상태를 비교한다.
- 선택 규칙 자체를 바꾸는 이번 PR은 전체 검사를 실행한다.
- 브랜치 보호를 도입할 때에는 선택 job 및 실패/생략을 올바르게 처리하는 종합 gate를 포함해 필수 검사 구성을 정한다.
- 정기 보안 검사는 기본 브랜치의 workflow로 실행되므로 기본 브랜치 반영 여부를 확인한다.

관련 파일: [CI](../../.github/workflows/ci.yml), [Security](../../.github/workflows/security.yml),
[선택 규칙](../../scripts/ci-scope.py), [회귀 검사](../../scripts/test-ci-scope.py).

참고: [GitHub Actions 과금](https://docs.github.com/en/billing/concepts/product-billing/github-actions),
[동시 실행 제어](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency).
