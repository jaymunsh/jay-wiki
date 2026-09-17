# jay-wiki Spring backend

Spring Boot 3.5·Java 21 기반 API다. 위키·블로그·게시판·검색, 관리자 인증, Redis 채팅,
Saga orchestration, Kafka Outbox·retry·DLQ와 운영 시나리오의 상태를 담당한다.

## 로컬 실행

저장소 루트에서 PostgreSQL, Redis, Kafka, OpenSearch와 MinIO를 먼저 실행한다.

```bash
docker compose -f docker-compose.dev.yml up -d
cd spring
SPRING_PROFILES_ACTIVE=local ./gradlew bootRun
# http://localhost:8080/actuator/health
```

로컬 기본 연결값은 `src/main/resources/application.yml`과 `application-local.yml`에 있다. 운영에서는
`APP_JWT_SECRET`, 관리자·TOTP, MinIO, 외부 participant와 PostgreSQL 자격증명을 Kubernetes Secret으로
주입하며 실제 값은 저장소에 두지 않는다.

## 검증

```bash
SPRING_PROFILES_ACTIVE=local ./gradlew test
```

테스트는 JUnit 5와 Testcontainers를 사용한다. 스키마 변경은 `src/main/resources/db/migration/`의
Flyway migration으로만 추가하고, JPA의 `ddl-auto=validate`가 엔티티와 스키마의 불일치를 막는다.

## 주요 패키지

| 패키지 | 역할 |
|---|---|
| `auth`, `account` | 관리자 비밀번호·TOTP, JWT와 권한 경계 |
| `wiki`, `blog`, `board` | 콘텐츠, revision, 게시판과 댓글 |
| `search` | PostgreSQL·OpenSearch 검색 경계 |
| `chat` | Redis 기반 랜덤 채팅과 대기열 |
| `saga` | 주문 orchestration과 보상 흐름 |
| `kafka` | Outbox, consumer fan-out, retry와 DLQ |
| `domainlab`, `ops` | 실행형 운영 시나리오와 관리자 운영 API |

운영 배포, Secret과 장애 대응 절차는 [배포 런북](../docs/deploy-runbook.md)과
[계정·접근 런북](../docs/account-access-runbook.md)을 따른다.
