import { AnalyticsPrivacy } from '@/components/AnalyticsPrivacy';
import type { Metadata } from 'next';
import { BlogRail } from '@/components/blog/BlogRail';
import { BlogShell } from '@/components/blog/BlogShell';
import { PUBLIC_SITE_ORIGIN } from '@/lib/siteConfig';

export const metadata: Metadata = {
  title: '개인정보 처리방침',
  alternates: { canonical: '/privacy' },
};

/**
 * 설계 8절: "악용 방지 목적의 접속 정보 사용"을 명시한다.
 * 여기 적는 내용은 실제 구현과 일치해야 한다 —
 * 원본 IP 미저장, ip_prefix 2옥텟, ip_hash(salted SHA-256),
 * 방문자 집합 24시간 TTL(SiteStatsService.VISITOR_TTL),
 * 유입 경로는 호스트만 보고 소스 이름으로(stats.Referrer),
 * 유입 호스트 세션 쿠키 jw_src(EntrySourceCookie)와 댓글의 source 열.
 * 구현이 바뀌면 이 문서도 같이 바꾼다.
 */
export default function BlogPrivacyPage() {
  return (
    <BlogShell rail={<BlogRail />} title="개인정보 처리방침">
      <article className="prose blog-art-body">
        <h1>개인정보 처리방침</h1>
        <p>
          이 블로그(blog.leneu.cloud)는 개인이 운영합니다. 회원 가입이 없고, 글을 읽는 데 어떤
          정보도 요구하지 않습니다.
        </p>

        <h2>1. 댓글을 쓸 때 남는 것</h2>
        <ul>
          <li>이름 — 입력하신 값 그대로 화면에 표시됩니다.</li>
          <li>
            암호 — 본인이 쓴 댓글을 삭제하기 위한 값이며, 되돌릴 수 없는 형태(BCrypt)로만
            보관합니다.
          </li>
          <li>내용 — 입력하신 값 그대로 보관·표시됩니다.</li>
          <li>
            유입 경로 — 이 사이트에 처음 들어오실 때 거쳐 온 곳을{' '}
            <b>이름 하나로만</b>(예: google, naver, sns:x, 직접 유입) 함께 보관합니다. 주소
            전체나 검색어는 보관하지 않습니다.
          </li>
          <li>
            접속 IP — <b>원본을 저장하지 않습니다.</b> 화면 표시용으로 앞 두 자리(예: 121.135)만
            남기고, 악용 차단 목적의 대조를 위해 비밀 키를 섞어 되돌릴 수 없게 변환한 값을 함께
            보관합니다.
          </li>
        </ul>

        <h2>2. 사용하는 쿠키</h2>
        <p>
          처음 들어오실 때 <b>거쳐 온 곳의 주소 이름 하나만</b> 담은 쿠키(jw_src)를 하나
          둡니다. 댓글을 쓰실 때 그 값을 유입 경로로 함께 남기기 위한 것입니다 — 댓글을 보내는
          순간에는 원래 어디에서 오셨는지가 이미 사라져 있기 때문입니다.
        </p>
        <p>
          이 쿠키에는 <b>사람을 가리키는 번호가 들어 있지 않습니다.</b> 그래서 여러 방문을 이어
          붙이거나 같은 분을 다시 알아보는 데 쓸 수 없습니다. <b>브라우저를 닫으면 사라집니다.</b>
        </p>

        <AnalyticsPrivacy />
        <p>댓글은 삭제할 때까지 보관합니다. jw_src 유입 쿠키는 브라우저 세션 종료 정책에 따릅니다.</p>

        <h2>5. 제3자 제공</h2>
        <p>제공하지 않습니다. 외부 광고·분석 서비스에 보내지 않습니다.</p>

        <h2>6. 문의</h2>
        <p>
          댓글 삭제나 문의는 <a href={`${PUBLIC_SITE_ORIGIN}/board`}>자유게시판</a>으로 남겨
          주세요.
        </p>
      </article>
    </BlogShell>
  );
}
