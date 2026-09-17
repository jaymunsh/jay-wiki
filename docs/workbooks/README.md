# 구현 워크북

설계·현재 코드 근거·실행 순서·검증 기준을 함께 보관하는 작업 문서다. 상태가 `설계`인 문서는 구현이나 운영 반영이 끝났다는 뜻이 아니다.

예전 단계별 워크북은 `archive/workbook/README.md`에 있지만 `archive/`는 Git 추적에서 제외되어 있다. 새 작업의 정본은 이 디렉터리에 둔다. 오래된 워크북의 경로·인증·배포 설명을 현재 계약으로 그대로 사용하지 않는다.

| 문서 | 상태 | 범위 |
|---|---|---|
| [관리자 서브도메인 분리](admin-subdomain-separation.md) | A안 확정·다크모드 필수·구현 전 | admin.localhost / admin.leneu.cloud, 라우팅·JWT·BFF·Server Actions·내부 발행·운영 전환 |
| [Leneu Benchmark 유지관리](leneu-benchmark-maintenance.md) | 로컬 공개 경로 구축 완료·신규 모델 절차 정리 | 응시·독립 채점·카탈로그 생성·`/benchmark` 동기화·검증 경계 |

| [Actions 비용 절감](github-actions-cost-reduction.md) | 로컬 구현·검증 | 변경 영역 선택·중복 취소·보관 기간 |

공통 원칙:

- 현재 확인한 사실, 제안, 미검증 항목을 구분한다.
- 작업마다 목적·수정 지점·완료 조건·증거를 남긴다.
- 공개 글은 구현 후 별도로 작성한다. 이 문서들은 사이트에 자동 발행되지 않는다.
- 운영 상태는 실제 실행 결과로 확인한다. 로컬 테스트로 Cloudflare나 운영 설정을 검증했다고 쓰지 않는다.
