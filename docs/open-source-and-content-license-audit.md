# 오픈소스·콘텐츠 라이선스 점검

> 기준일: 2026-09-16
> 범위: jay-wiki 저장소, 웹 자산, 직접 의존성, 주요 런타임 서비스와 위키 콘텐츠
> 주의: 저장소 기반의 기술 점검이며 법률 자문이나 완전한 법적 의견서가 아니다.

## 결론

현재 확인한 폰트와 주요 애플리케이션 의존성에는 포트폴리오 사이트 운영을 즉시 중단해야 할
명백한 제한이 없다. Pretendard는 SIL OFL, Lucide는 ISC이며 주요 웹·Spring·Python 직접
의존성은 MIT, Apache-2.0, BSD 계열이 중심이다.

코드에는 MIT License를 적용하고, 글·설계 기록·이미지·음원·벤치마크 자료는 별도의
`CONTENT_LICENSE.md`에서 기본 저작권 보유 범위로 분리했다. 다음 세 항목은 계속 `관리 중`이다.

1. 전체 전이 의존성과 최종 컨테이너에 대한 자동 SBOM·고지 생성이 없다.
2. Simple Icons SVG의 라이선스와 개별 기술 로고의 상표권을 분리한 자산 대장이 없다.
3. 위키 이미지 metadata에는 저작자·출처·라이선스·편집 내역 필드가 없다.

## 1. 폰트

| 항목 | 코드상 상태 | 판단 | 근거·조치 |
|---|---|---|---|
| Pretendard 1.3.9 | jsDelivr에서 실제 로드 | 사용 가능 | SIL OFL. 버전이 고정돼 있으며 공식 CDN 예시와 일치 |
| Apple SD Gothic Neo | CSS fallback | 배포하지 않음 | 방문자 OS에 설치된 경우만 사용 |
| Noto Sans KR | CSS fallback | 배포하지 않음 | 저장소와 public 디렉터리에 폰트 파일 없음 |
| JetBrains Mono | CSS fallback | 배포하지 않음 | 실제 webfont import 없음. 자체 배포 시 OFL 고지 재확인 |
| Fira Code | CSS fallback | 배포하지 않음 | 실제 webfont import 없음. 자체 배포 시 OFL 고지 재확인 |
| Menlo·system-ui | CSS fallback | 배포하지 않음 | 장치 기본 글꼴 선택 |

Pretendard 공식 문서는 SIL OFL 아래 상업적 사용, 수정과 재배포를 허용하고 현재 사용하는
jsDelivr 1.3.9 경로를 webfont 예제로 제공한다.

- https://github.com/orioncactus/pretendard/blob/main/packages/pretendard/docs/en/README.md
- https://software.sil.org/fonts/faq/

## 2. 프론트엔드 패키지

`web/package.json`의 직접 런타임 의존성은 다음처럼 관리한다. 실제 의무 판단은 package-lock과
최종 standalone/container 결과를 함께 본다.

| 패키지군 | 대표 라이선스 | 용도 | 상태 |
|---|---|---|---|
| Next.js, React | MIT | 웹 프레임워크와 UI runtime | 저작권·라이선스 고지 유지 |
| Mermaid | MIT | 문서 다이어그램 | 고지 유지 |
| marked, marked-highlight | MIT | Markdown 파싱 | 고지 유지 |
| highlight.js | BSD-3-Clause | 코드 강조 | 고지 유지 |
| sanitize-html | MIT | HTML sanitization | 고지 유지 |
| Lucide | ISC | UI 아이콘 | 고지 유지 |
| gray-matter | MIT | front matter 파싱 | 고지 유지 |

2026-07-15 package-lock metadata 점검에서는 MIT가 다수였고 Apache-2.0, BSD, ISC도 포함됐다.
추가 주의 대상으로 optional sharp/libvips의 LGPL 계열, caniuse-lite 데이터의 CC BY 4.0,
DOMPurify의 MPL-2.0 또는 Apache-2.0 선택지가 확인됐다. 이 항목은 `직접 import하지 않는다`는
이유만으로 제외하지 않고 최종 이미지 SBOM에서 실제 포함 여부를 판정한다.

## 3. Spring·Python 패키지

| 계층 | 주요 항목 | 대표 라이선스 | 확인 기준 |
|---|---|---|---|
| Spring | Spring Boot, Spring Kafka, Micrometer | Apache-2.0 | Gradle resolved graph와 배포 JAR |
| 데이터·인증 | PostgreSQL JDBC, JJWT, MinIO Java, TOTP | BSD·Apache-2.0·MIT 계열 | 정확한 artifact version의 POM·LICENSE |
| 빌드 보조 | Lombok | MIT | 컴파일 결과와 소스 고지 |
| FastAPI | FastAPI, Pydantic, Uvicorn | MIT·BSD 계열 | uv.lock과 payment image |
| 관측 | OpenTelemetry, prometheus-client | Apache-2.0 계열 | uv.lock과 payment image |

직접 의존성이 허용적이어도 전이 의존성은 달라질 수 있으므로 Gradle dependency graph와 uv.lock을
SBOM 입력으로 사용한다. 표의 `대표 라이선스`는 요약이며 최종 배포물 고지를 대체하지 않는다.

## 4. 런타임 서비스와 컨테이너

| 서비스 | 일반적으로 확인되는 라이선스 | 프로젝트에서 주의할 점 |
|---|---|---|
| PostgreSQL | PostgreSQL License | 정확한 image tag와 포함 패키지 확인 |
| Kafka | Apache-2.0 | Apache NOTICE 보존 |
| OpenSearch | Apache-2.0 | 커스텀 nori 이미지의 추가 파일까지 SBOM 생성 |
| Prometheus·OpenTelemetry Collector | Apache-2.0 | Helm chart와 image를 구분 |
| Grafana·Loki·Tempo | 버전별 AGPL 계열 확인 필요 | 실행, 수정, 이미지 전달 형태를 구분 |
| MinIO | 버전별 AGPL 계열 확인 필요 | 서버와 mc tag, 수정 여부, 외부 제공 범위 기록 |
| Redis | tag별 라이선스 확인 필요 | 라이선스 변경 이력이 있으므로 `Redis` 이름만으로 단정 금지 |
| cloudflared | Apache-2.0 | binary와 container image 고지 확인 |

서비스를 네트워크로 사용하는 것, 수정한 소스를 서비스하는 것, 바이너리나 컨테이너를 제3자에게
전달하는 것은 서로 다른 행위다. 특히 AGPL·LGPL 항목은 `오픈소스니까 무료`로 끝내지 않고 정확한
버전, 수정 여부, 배포 대상을 함께 검토한다.

## 5. 로고·아이콘·이미지

오케스트레이션 맵은 `cdn.simpleicons.org`에서 SVG를 내려받아 MinIO에 둔다. Simple Icons는
SVG 데이터의 이용 조건을 제공하지만 각 회사의 로고·명칭에 대한 상표 허가를 대신하지 않는다.

현재 사용 원칙:

- 실제 사용 기술을 식별하는 설명적 문맥에서만 표시한다.
- 후원, 제휴, 공식 인증을 암시하지 않는다.
- 브랜드별 공식 지침이 존재하면 색상·여백·변형 기준을 우선한다.
- 기술을 제거하면 관련 logo asset도 함께 제거한다.
- Simple Icons 버전 또는 다운로드 날짜를 자산 대장에 추가한다.

프로젝트 favicon과 OG 이미지는 현재 저장소에 있으나 제작자·생성 과정이 별도 metadata로 남아
있지 않다. 직접 제작 자산인지 확인한 뒤 `docs/asset-provenance.md` 형식의 대장을 만드는 것이 좋다.

- https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md
- https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md
- https://github.com/lucide-icons/lucide/blob/main/LICENSE

## 6. 위키 본문과 업로드 이미지

| 콘텐츠 | 허용 기준 | 기록할 것 |
|---|---|---|
| 직접 쓴 글·코드 | 본인 저작 또는 프로젝트 코드 | 작성일, revision |
| 외부 사실·문서 | 요약·비평하고 공식 원문 링크 | 출처 URL, 확인일 |
| 짧은 인용 | 필요한 범위만 명확히 구분 | 저자, 제목, 링크 |
| 직접 촬영 사진 | 본인이 촬영하고 공개 가능한 대상 | 촬영자, 촬영일, 편집 내역 |
| 외부 이미지 | 명시적 라이선스·허가가 있을 때만 업로드 | 저작자, 원본, 라이선스 |
| AI 생성 이미지 | 도구 정책과 제3자 권리를 함께 확인 | 도구, 날짜, prompt 요약, 후편집 |

MinIO asset lifecycle은 무결성과 삭제 안전성을 관리하지만 권리 상태를 판정하지 않는다. 후속
스키마에는 `creator`, `source_url`, `license`, `rights_note`, `modified_at`을 선택 또는 필수
필드로 추가하고, 출처 미확인 자산의 게시를 막는 정책을 검토한다.

## 7. 저장소 자체 라이선스

루트 `LICENSE`에는 직접 작성한 소프트웨어 코드에 적용할 MIT License를 두었다. README와
`CONTENT_LICENSE.md`에서 적용 경계를 함께 명시한다.

- `.github/`, `web/` 소스, `spring/`, `services/`, `scripts/`, `infra/`의 직접 작성 코드는 MIT
- `content/`, `posts/`, `docs/`, 이미지·음원·영상과 브랜드 표현은 일괄 MIT 대상에서 제외
- `web/public/assets/`와 제3자 폰트·로고는 파일별 출처와 원 라이선스를 우선

공개 열람과 재사용 허가를 같은 뜻으로 쓰지 않는다. 코드 라이선스와 글·사진의 콘텐츠 이용
범위를 분리해, 저장소를 공개해도 개인 콘텐츠가 자동으로 MIT가 되지 않게 했다.

## 8. 실행 계획

### P0 — 완료

- 프로젝트 코드에 MIT License를 적용했다.
- 콘텐츠 이용 범위를 `CONTENT_LICENSE.md`로 분리했다.
- 직접 의존성·기술 로고의 주요 출처를 `THIRD_PARTY_NOTICES.md`에 유지한다.

외부 이미지 provenance 검증은 아래 P1에 남긴다.

### P1

- 외부 이미지는 provenance가 없으면 게시하지 않도록 자산 대장과 발행 검사를 연결한다.
- Syft 등으로 web, backend, payment-api, opensearch 이미지의 SPDX 또는 CycloneDX SBOM을 만든다.
- CI에서 SBOM artifact와 license scan 결과를 보존한다.
- 배포 tag가 바뀌면 Grafana, MinIO, Redis 등 서비스 라이선스를 다시 확인한다.

### P2

- 위키 asset metadata에 권리 정보를 추가한다.
- favicon, OG 이미지와 직접 제작 다이어그램의 provenance 대장을 만든다.
- 사이트 footer 또는 README에서 Third-party notices와 콘텐츠 정책으로 연결한다.

## 검증 명령 예시

~~~bash
# npm 직접·전이 의존성
cd web && npm ls --all

# JVM resolved dependencies
cd spring && ./gradlew dependencies

# Python resolved dependencies
cd services/payment-api && uv tree

# 최종 이미지 SBOM 예시
syft portfolio-web:<tag> -o cyclonedx-json > web.sbom.json
syft portfolio-backend:<tag> -o cyclonedx-json > backend.sbom.json
~~~

`npm audit`, Trivy 취약점 검사와 라이선스 검사는 결과가 겹칠 수 있어도 서로 대체하지 않는다.
