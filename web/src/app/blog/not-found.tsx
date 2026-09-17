import Link from 'next/link';

/**
 * 블로그 쪽 404.
 *
 * BlogShell 을 쓰지 않는다. 글 목록 레일을 그대로 두면 없는 글 하나를 알리자고
 * 글 열일곱 개와 방문 수를 펼치게 되고, 정작 안내가 구석의 링크 두 줄이 된다.
 * 되돌아갈 길 하나만 남긴다.
 */
export const metadata = {
  title: '글을 찾을 수 없습니다',
  robots: { index: false },
};

export default function BlogNotFound() {
  return (
    <main id="main-content" className="notfound">
      <p className="code">404</p>
      <h1>이 주소에는 글이 없습니다</h1>
      <p>주소가 바뀌었거나 아직 발행하지 않은 글입니다.</p>
      <Link className="btn btn-primary" href="/">
        블로그 첫 화면으로
      </Link>
    </main>
  );
}
