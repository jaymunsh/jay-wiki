import { AnalyticsPrivacy } from '@/components/AnalyticsPrivacy';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { blogAbsoluteUrl } from '@/lib/blogLinks';

export const metadata: Metadata = {
  title: '개인정보 처리방침',
  alternates: { canonical: '/privacy' },
};

/**
 * 위키(portfolio.leneu.cloud)용 처리방침. 블로그(app/blog/privacy)와 짝이지만 내용이 다르다 —
 * 블로그는 댓글·방문 통계, 위키는 회원가입·게시판·방문 통계를 처리한다.
 *
 * 여기 적는 내용은 실제 구현과 일치해야 한다. 근거:
 *   계정 항목  tb_user (V3, V17 에서 email·subject 드롭)
 *   게시판     tb_post / tb_comment — author_name 과 익명 삭제용 password_hash
 *   IP         BoardRateLimitInterceptor · AdminTotpService 가 Redis 키로만 쓴다(만료됨)
 *   채팅       ChatRoomService — Redis 에만 있고 테이블이 없다
 * 구현이 바뀌면 이 문서도 같이 바꾼다.
 */
export default function WikiPrivacyPage() {
  return (
    <>
      <Header />
      <main id="main-content">
        {/* .prose 는 46rem 에서 끊긴다. 이 화면은 곁에 두는 것이 없어 그대로 두면
            1320px 칸 왼쪽에 붙는다. 다른 화면의 .prose 는 옆에 목차·사이드바가 있으므로
            공용 규칙을 건드리지 않고 여기서만 가운데로 둔다. */}
        <article className="prose" style={{ margin: '0 auto' }}>
          <h1>개인정보 처리방침</h1>
          <p>
            이 사이트(portfolio.leneu.cloud)는 개인이 운영합니다. 글을 읽는 데 어떤 정보도 요구하지
            않고, 회원 가입 없이도 게시판에 글과 댓글을 쓸 수 있습니다. 가입은 선택입니다.
          </p>

          <h2>1. 회원 가입을 할 때 남는 것</h2>
          <ul>
            <li>아이디 — 직접 정하신 값입니다. 실명이나 이메일을 요구하지 않습니다.</li>
            <li>
              비밀번호 — 되돌릴 수 없는 형태(BCrypt)로만 보관합니다. 원문은 저장하지 않습니다.
            </li>
            <li>표시 이름 — 게시판에서 작성자로 보이는 값입니다.</li>
            <li>가입한 시각.</li>
          </ul>
          <p>
            가입 유입 경로도 함께 기록합니다. 이메일, 전화번호, 실명, 생년월일은 받지 않습니다. 로그인해도 서버에서
            새로 열리는 기능은 없고, 게시판 작성자 이름이 &quot;익명&quot; 대신 표시 이름으로 바뀔
            뿐입니다.
          </p>

          <h2>2. 게시판에 글을 쓸 때 남는 것</h2>
          <ul>
            <li>작성자 이름 — 입력하신 값 또는 로그인한 계정의 표시 이름입니다.</li>
            <li>내용 — 입력하신 값 그대로 보관·표시됩니다.</li>
            <li>
              암호 — 로그인 없이 쓴 글을 본인이 지우기 위한 값이며, 되돌릴 수 없는
              형태(BCrypt)로만 보관합니다.
            </li>
          </ul>

          <h2>3. 접속 IP</h2>
          <p>
            <b>저장하지 않습니다.</b> 도배 차단과 관리자 로그인 시도 제한을 위해 잠시 메모리에만
            두고, 정해진 시간이 지나면 자동으로 사라집니다. 데이터베이스에 남는 자리가 없습니다.
          </p>
          <p>실시간 채팅 데모의 대화 내용도 메모리에만 있고 따로 저장하지 않습니다.</p>

          <AnalyticsPrivacy />
          <p>
            첫 유입 호스트는 jw_src 세션 쿠키에 담고 가입할 때 유입 경로를 분류하는 데 씁니다.
            쿠키에는 사용자 식별자를 넣지 않으며 브라우저의 세션 종료 정책에 따라 삭제됩니다.
          </p>

          <h2>4. 구글 로그인은 더 쓰지 않습니다</h2>
          <p>
            2026년 8월 6일에 구글 로그인을 제거했습니다. 그때까지 구글 계정으로 가입한 분에게서
            받았던 이메일 주소와 구글 계정 식별자는 해당 계정과 함께 삭제했고, 그 값을 담던 자리도
            없앴습니다. 지금은 어떤 외부 로그인도 쓰지 않습니다.
          </p>

          <h2>5. 보관 기간</h2>
          <p>
            계정은 삭제를 요청하실 때까지, 글과 댓글은 지우실 때까지 보관합니다. 도배 차단용 값은
            정해진 시간이 지나면 자동으로 사라집니다.
          </p>
          <p>
            계정 삭제는 아직 화면에서 직접 하실 수 없습니다.{' '}
            <Link href="/board">자유게시판</Link>으로 요청해 주시면 지웁니다.
          </p>

          <h2>6. 제3자 제공</h2>
          <p>광고나 외부 접속 분석 도구는 붙이지 않았습니다. 위에 설명한 자체 방문 통계를 사용합니다.</p>

          <h2>7. 문의</h2>
          <p>
            <Link href="/board">자유게시판</Link>으로 남겨 주세요. 블로그(blog.leneu.cloud)는 수집
            항목이 달라 <a href={blogAbsoluteUrl('/privacy')}>별도의 처리방침</a>을 둡니다.
          </p>

          <hr />
          <p>
            <b>최종 수정: 2026년 9월 8일</b>
            <br />
            받는 항목이나 보관 방식이 바뀌면 이 문서를 먼저 고치고 날짜를 갱신합니다. 이전 내용은
            저장소의 커밋 기록에 남습니다.
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
