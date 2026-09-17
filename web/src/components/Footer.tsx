import Link from 'next/link';

export function Footer() {
  return (
    <footer>
      {/* 개인정보 처리방침이 자유게시판을 문의·삭제 요청 창구로 안내한다. 헤더에서 뺐으니
          여기가 유일한 상시 경로다. */}
      © 2026 jay-wiki · <Link href="/board">자유게시판</Link> ·{' '}
      {/* 위키 자체 처리방침. 블로그는 수집 항목이 달라 blog.leneu.cloud/privacy 를 따로 둔다. */}
      <Link href="/privacy">개인정보 처리방침</Link> · <code>web-0.4</code>
    </footer>
  );
}
