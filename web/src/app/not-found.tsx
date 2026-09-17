import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';

/**
 * 위키 쪽 404.
 *
 * 지금까지는 Next 기본 화면이 떴다. 헤더도 링크도 없어서 방문자가 되돌아갈 길이 없었다.
 * 되돌아갈 길 하나만 둔다 — 링크를 여러 개 늘어놓으면 화면이 목차가 되고,
 * 정작 찾던 글이 없다는 사실이 묻힌다. 나머지 길은 헤더에 이미 다 있다.
 *
 * 블로그는 레이아웃이 달라 app/blog/not-found.tsx 를 따로 둔다.
 */
export const metadata = {
  title: '문서를 찾을 수 없습니다',
  robots: { index: false },
};

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main-content">
        <div className="notfound">
          <p className="code">404</p>
          <h1>이 주소에는 글이 없습니다</h1>
          <p>주소가 바뀌었거나 지워진 글입니다.</p>
          <Link className="btn btn-primary" href="/">
            위키 첫 화면으로
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
