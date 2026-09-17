# jay-wiki 공개 서비스 법적·정책 점검

> **2026-08-16 갱신 — 소셜 로그인을 걷어냈다.**
> 아래 본문은 Google OAuth 가 있던 시점(2026-07-15)의 점검이다. 그 뒤 소셜 로그인을
> **제거했고**, 지금 남은 인증은 관리자 비밀번호 + TOTP 뿐이다. 일반 이용자 가입 경로가
> 없어졌으므로 **OAuth 관련 요구(동의 획득·수집 항목 고지·파기 절차)는 해당 없음**이 됐다.
> 남은 개인정보성 항목은 접속 로그와 블로그 유입 통계뿐이다.
>
> 걷어낸 이유는 기능이 안 돼서가 아니다. 소셜 로그인을 두면 개인정보처리방침과 그 유지보수가
> 따라오고, 개인 포트폴리오가 계속 질 부담이 아니라고 판단했다. 본문은 그때의 판단 기록으로
> 그대로 둔다 — 무엇을 왜 접었는지가 사라지면 이 문서를 다시 쓰게 된다.

> 기준일: 2026-07-15
> 기준 관할: 대한민국에서 개인이 비영리 포트폴리오 서비스를 공개 운영하는 현재 범위
> 주의: 저장소와 공개 기능을 기준으로 한 실무 점검이다. 법률 자문이 아니며 사업화, 유료화,
> 대규모 이용자 모집 또는 분쟁 발생 시 변호사·개인정보 전문가의 확인이 필요하다.

## 1. 출시 판정

**현재는 제한 공개·테스트는 가능하지만, 일반 이용자에게 가입과 게시판 사용을 적극 권유하는 정식
출시 상태로 보기에는 P0 정책 공백이 있다.**

기술적으로는 HTTPS, HttpOnly·Secure cookie, BCrypt, 관리자 TOTP, 역할 분리, Markdown XSS 방어,
rate limit과 backup이 있다. 반면 개인정보 처리방침, 계정 탈퇴·정보주체 권리행사, 만 14세 미만 처리,
게시물 권리침해 신고, 외부 처리자·국외이전 공개가 없다.

## 2. 현재 처리하는 데이터

| 처리 활동 | 항목 | 목적 | 위치 | 현재 보유·삭제 |
|---|---|---|---|---|
| 로컬 회원가입 | username, BCrypt password hash, nickname, role, provider, createdAt | 로그인·권한·표시 이름 | PostgreSQL | 탈퇴 API·보유기간 없음 |
| Google OAuth | sub, email, name 기반 nickname, provider, createdAt | 계정 식별·로그인 | Google → Spring → PostgreSQL | 철회·삭제 경로 없음 |
| 로그인 session | jw_token JWT, JSESSIONID | 인증 상태 유지 | browser cookie·Spring | role별 JWT 만료, logout 삭제 |
| 관리자 보안 | OTP 시도 횟수, client IP 기반 key | brute-force 제한 | Redis | attempt window TTL |
| 자유게시판 | title, content, nickname, author type, password hash, createdAt | 글·댓글 제공과 본인 삭제 | PostgreSQL | 글별 삭제 가능, 전체 정책 없음 |
| 조회수·rate limit | post ID, client key 등 | 조회수·남용 방지 | Redis | 일부 TTL, 항목별 재확인 필요 |
| 채팅 | 임시 userId, nickname, message, joinedAt | 실시간 채팅·대기열 | Redis | heartbeat·rate TTL, Stream retention 재확인 |
| 위키 이미지 | original filename, MIME, size, checksum, uploader, object key | 문서 이미지 제공·무결성 | PostgreSQL·MinIO | TEMP/ATTACHED/UNUSED 정책 |
| metrics | 서비스·node 상태와 요청 집계 | 운영 관측 | Prometheus | 7일 |
| traces | service·route·request metadata 가능 | 요청 경로 분석 | Tempo | 24시간 |
| logs | application·proxy log, IP·query 포함 가능성 | 장애 조사 | Loki·Cloudflare | Loki 명시적 retention 없음, 확인 필요 |
| backup | 위 항목의 DB 복제본 | 장애 복구 | local volume, 향후 R2 | 세대·파기·탈퇴 반영 정책 필요 |

### 확인된 OAuth 최소 범위

`OAuthClientRegistrationConfig`는 `openid`, `profile`, `email`만 요청한다. Spring은 Google `sub`를
계정의 안정적인 식별자로 쓰고 email은 별도 속성으로 저장한다. Google도 email은 바뀔 수 있으므로
고유 식별자 대신 `sub`를 사용하도록 안내한다.

- https://developers.google.com/identity/openid-connect/reference
- https://developers.google.com/identity/protocols/oauth2/scopes

## 3. P0: 공개 출시 전에 필요한 조치

### 3.1 개인정보 처리방침

개인정보 보호법 제30조 기준으로 최소한 다음을 공개한다.

1. 개인정보 처리 목적
2. 처리 항목과 수집 방법
3. 보유·이용 기간과 파기 절차
4. 제3자 제공 여부
5. 처리위탁과 수탁자
6. 국외 이전이 있다면 이전 국가·시점·방법·받는 자·목적·기간과 근거
7. 정보주체와 법정대리인의 열람·정정·삭제·처리정지 요구 방법
8. 개인정보 보호책임자 또는 담당 연락처
9. cookie 등 자동 수집 장치의 목적·기간·거부 방법
10. 안전성 확보 조치와 권익침해 구제기관
11. 처리방침 시행일과 변경 이력

현재 footer에는 저작권 문구만 있고 정책 링크가 없다. 로그인하지 않은 이용자도 접근할 수 있는
`/privacy` 페이지와 footer·login 화면 링크가 필요하다.

공식 근거:

- 개인정보 보호법 제30조: https://www.law.go.kr/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900078922
- 개인정보 보호법 전체: https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=270351

### 3.2 적법 처리 근거와 동의 화면

동의를 처리 근거로 삼는 항목은 수집 목적, 항목, 기간, 거부권과 불이익을 명확히 구분해 받아야 한다.
개인정보 처리방침에 적는 것만으로 필요한 동의를 대신할 수 없다.

현실적인 선택:

- 로컬 가입은 가입 화면에서 필수 수집·이용 고지와 동의를 받는다.
- Google 로그인은 버튼 직전에 `sub·email·name을 로그인과 계정 표시에 사용`한다는 짧은 고지와
  개인정보 처리방침 링크를 둔다.
- 마케팅, 광고, 선택 프로필 수집은 현재 하지 않는다.
- email이 실제 기능에 필요하지 않다면 scope와 DB 저장을 제거하는 데이터 최소화도 검토한다.

개인정보 보호법 제22조: https://www.law.go.kr/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900078945

### 3.3 Google OAuth 운영 조건

Google 운영 OAuth 앱은 공개 homepage, 기능 설명, privacy policy와 terms link, 소유한 검증 도메인,
지원 email과 정확한 앱 identity를 요구한다. OAuth Console에 등록한 정책 URL과 실제 footer URL을
일치시켜야 한다.

현재 `portfolio.leneu.cloud`의 공개 홈은 존재하지만 privacy policy와 terms link가 없다.

- Google OAuth 2.0 Policies: https://developers.google.com/identity/protocols/oauth2/policies
- App homepage requirements: https://support.google.com/cloud/answer/13807376
- OAuth consent configuration: https://support.google.com/cloud/answer/13461325

### 3.4 계정 탈퇴와 정보주체 권리

현재 account delete API가 없다. 다음 중 하나는 출시 전에 제공한다.

- 권장: 로그인 사용자가 자신의 계정과 연결 데이터를 조회·탈퇴 요청하는 화면
- 최소: 공개된 privacy email로 열람·정정·삭제·처리정지를 요청하고 본인확인 후 처리하는 절차

탈퇴 시 범위를 미리 결정해야 한다.

| 데이터 | 권장 처리 |
|---|---|
| OAuth sub·email·nickname | 계정 삭제 시 파기 |
| password hash | 계정 삭제 시 파기 |
| 작성 게시물 | 이용약관에 삭제·익명화 선택을 명시 |
| 로그·backup | 보유기간 뒤 파기, 즉시 삭제가 불가능한 이유와 격리 기준 공개 |
| 보안 사고 증거 | 법적 필요가 있는 범위와 기간을 별도 근거로 보존 |

개인정보 보호법 제21조와 제35조부터 제37조의 파기·열람·정정·삭제·처리정지 권리를 정책과 절차에
연결한다.

### 3.5 만 14세 미만 아동

현재 생년월일을 받지 않고 Google 계정만으로 연령을 확인할 수 없다. 개인정보 처리 동의를 근거로
만 14세 미만 정보를 처리하면 법정대리인 동의와 확인이 필요하다.

개인 포트폴리오의 합리적인 초기 선택은 `만 14세 미만에게 회원 기능을 제공하지 않음`을 가입 고지와
이용약관에 명시하고, 실제로 확인·차단할 수 있는 절차를 정하는 것이다. 문구만 두고 아무 확인도 하지
않는 상태는 충분하다고 단정하지 않는다.

- 개인정보 보호법 제22조의2: https://www.law.go.kr/LSW/lsLinkCommonInfo.do?ancYnChk=&chrClsCd=010202&lsJoLnkSeq=1029334873

### 3.6 외부 처리자와 국외 이전

확정 전에 각 계약·설정과 실제 data flow를 다시 확인해야 한다.

| 외부 서비스 | 가능한 처리 | 점검 |
|---|---|---|
| Cloudflare Tunnel·edge | 요청 IP, header, timestamp, 보안·접속 log | DPA, 처리 위치, log 기간, 위탁·국외이전 공개 |
| Google OAuth | OAuth 요청·동의, 계정 claims | Google user data 사용, privacy policy, domain verification |
| GitHub Actions·GHCR | source·build·image metadata | 일반 이용자 개인정보가 build artifact에 들어가지 않도록 유지 |
| Telegram alert | 서비스 상태·alert label | email·IP·본문 등 개인정보를 alert에 넣지 않음 |
| 향후 Cloudflare R2 | 암호화된 DB backup 가능 | 국외 보관, 암호화 key 분리, 기간과 파기 공개 |

개인정보 보호법 제28조의8은 국외 제공·위탁·보관의 근거와 고지·공개를 요구한다. Cloudflare DPA는
처리 데이터 예시로 IP address 등의 log를 포함하므로 실제 계정 설정과 계약을 기준으로 정책 항목을
확정한다.

- 개인정보 보호법 제28조의8: https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=0&chrClsCd=010202&efYd=20251002&lsiSeq=270351&urlMode=lsInfoP
- Cloudflare DPA: https://www.cloudflare.com/cloudflare-customer-dpa/

### 3.7 게시판·채팅 권리침해 대응

자유게시판과 채팅은 이용자 생성 콘텐츠다. 다음을 이용약관 또는 별도 운영정책으로 공개한다.

- 개인정보, 사생활 침해, 명예훼손, 불법정보와 저작권 침해 콘텐츠 금지
- 신고 email 또는 form, 대상 URL·권리·연락 수단
- 관리자 삭제와 임시조치 기준
- 게시자와 신청인 통지, 이의·재개 절차
- 반복 침해자 제한
- 보존이 필요한 신고 처리 기록의 범위와 기간

정보통신망법 제44조의2는 삭제 요청, 필요한 조치와 통지를 규정한다. 저작권법 제102조·제103조의
책임 제한과 복제·전송 중단 절차를 이용자 신고 flow에 연결한다.

- https://www.law.go.kr/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900628377
- https://www.law.go.kr/LSW/lsInfoP.do?lsId=000798

## 4. P1: 운영 증거를 보강할 조치

### 4.1 보유기간 표

| 저장소 | 현재 | 조치 |
|---|---|---|
| PostgreSQL account | 무기한 | 탈퇴·휴면·삭제 기준 결정 |
| PostgreSQL post/comment | 무기한 | 이용자 삭제와 운영 보존 기준 분리 |
| Redis auth attempt | TTL 있음 | 실제 값 문서화 |
| Redis chat | 일부 TTL | Stream MAXLEN·실제 잔존 기간 검증 |
| Prometheus | 7일 | 처리방침 또는 내부 운영표와 일치 |
| Tempo | 24시간 | 개인정보 attribute redaction 확인 |
| Loki | 명시적 retention 없음 | filesystem 용량 의존 대신 기간 설정 |
| PostgreSQL backup | CronJob·세대 관리 | 탈퇴 데이터가 backup에서 사라지는 시점 기록 |
| Cloudflare log | plan·설정 의존 | dashboard 설정과 계약 기준 확인 |

### 4.2 로그 최소화와 유출 대응

- Authorization, Cookie, OAuth code, password, OTP와 MinIO key를 log·trace에 남기지 않는다.
- URL query에 nickname이나 userId가 있는 WebSocket handshake가 proxy log에 남을 수 있는지 확인한다.
- Grafana 공개 범위를 최소화하고 log·trace 열람은 관리자 인증으로 제한한다.
- 유출 발견 시 영향 항목, 시점·경위, 이용자 대응, 운영자 조치와 연락처를 통지할 runbook을 둔다.
- 개인정보 보호법 제29조 안전조치와 제34조 유출 통지를 incident rehearsal에 포함한다.

- https://law.go.kr/LSW/lsInfoP.do?lsiSeq=270351
- https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1020398739

### 4.3 저작권·오픈소스·상표

상세 점검은 `docs/open-source-and-content-license-audit.md`에 있다.

- Pretendard 1.3.9는 SIL OFL이고 현재 공식 CDN 방식은 허용 범위다.
- CSS fallback font는 파일을 재배포하지 않는다.
- Lucide는 ISC, Simple Icons SVG는 CC0이지만 기업 logo의 상표권은 별개다.
- npm·Gradle·Python 전이 의존성과 최종 container image는 SBOM으로 다시 확인해야 한다.
- 저장소 자체 LICENSE와 콘텐츠 이용정책은 아직 결정되지 않았다.
- 위키 외부 이미지에는 creator·source URL·license·edit history가 필요하다.

현재 `THIRD_PARTY_NOTICES.md`는 주요 직접 요소의 고지 초안이며 완전한 SBOM이 아니다.

## 5. 현재 적용 대상이 아닌 항목

| 항목 | 현재 판단 | 재검토 시점 |
|---|---|---|
| 통신판매업·전자상거래 표시 | 실제 상품·서비스 판매와 결제가 없어 현재 비대상 | 유료 상품, 후원 대가, 실제 payment 추가 |
| 환불·청약철회 | Saga payment는 장애 시연이며 금전 거래 없음 | 실제 유료 계약 추가 |
| 광고성 정보 전송 | email·SMS marketing 없음 | newsletter·홍보 알림 추가 |
| 위치정보 | 수집하지 않음 | GPS·정밀 위치 기능 추가 |
| CCTV·영상정보 | 수집하지 않음 | camera·출입 영상 추가 |
| 민감정보·고유식별정보 | 의도적으로 수집하지 않음 | 건강·생체·주민번호 등 추가 |
| 광고·analytics cookie 동의 banner | 추적 SDK 없음. 필수 인증 cookie만 사용 | 광고, cross-site analytics 또는 대상 국가 변경 |

`비대상`은 영구 면제가 아니라 현재 기능과 사업 모델을 전제로 한 판단이다. Saga 화면에는 실제
결제·상품 구매가 아니라 운영 시연이라는 문구를 유지한다.

## 6. 이용약관·운영정책 구성

하나의 긴 문서에 모든 것을 섞기보다 다음처럼 나눈다.

| 문서 | 핵심 내용 |
|---|---|
| 개인정보 처리방침 | 개인정보 항목·목적·기간·위탁·국외이전·권리·contact |
| 이용약관 | 서비스 성격, 계정, 이용 제한, 콘텐츠 책임, 변경·종료 |
| 커뮤니티 운영정책 | 금지 콘텐츠, 신고·임시조치·삭제·이의 절차 |
| 오픈소스·제3자 고지 | font·library·icon·runtime component license |
| 콘텐츠 이용정책 | jay-wiki 글·코드·사진의 재사용 허용 범위 |

약관을 쓰면 중요한 제한을 이용자가 예상할 수 있도록 명확하게 표시하고 동의 시점을 기록한다.
개인정보 수집 동의는 이용약관 동의와 구분한다.

## 7. 구현 순서

### P0 출시 전

1. 운영자 표시명, privacy·support email, 시행일을 결정한다.
2. `/privacy`, `/terms`, `/community-policy`를 로그인 없이 공개하고 footer·login에서 연결한다.
3. 가입·Google login 직전에 필요한 개인정보 고지·동의 UI를 추가한다.
4. 계정 열람·탈퇴 또는 privacy email 처리 절차를 구현한다.
5. 만 14세 미만 정책을 선택하고 UI·backend 경계를 맞춘다.
6. Cloudflare·Google의 위탁·국외이전 사실과 기간을 실제 설정·계약에서 확정한다.
7. 게시물 신고·임시조치·통지 절차와 contact를 공개한다.
8. Google OAuth consent screen의 app name, homepage, privacy, terms, domain과 support email을 맞춘다.

### P1 운영 후

1. Loki·backup·Cloudflare log 보유기간을 측정하고 정책과 일치시킨다.
2. account deletion과 backup 만료를 정기 rehearsal한다.
3. container SBOM·license notice를 CI artifact로 만든다.
4. 이미지 provenance metadata를 schema에 추가한다.
5. 개인정보 유출·게시물 신고 tabletop rehearsal을 기록한다.

## 8. 운영자가 결정해야 하는 값

정책 페이지를 실제 공개하려면 다음 값은 자동으로 추측하지 않고 운영자가 정해야 한다.

- 공개할 운영자 표시명
- 개인정보·권리침해·사용자 지원을 받을 email
- 정책 시행일
- 계정·게시물·로그·backup 보유기간
- 만 14세 미만 회원 기능 제공 여부
- 계정 탈퇴 시 게시글 삭제 또는 익명화 방식
- Cloudflare plan·log 설정과 실제 처리 지역
- Google OAuth production project와 verified domain 상태
- 프로젝트 코드와 글·사진에 적용할 자체 license

이 값이 확정되기 전에는 법적 페이지를 그럴듯한 문구로 먼저 게시하지 않는다.
