'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * 렌더 도중 예외가 났을 때의 화면. 404 와 달리 이건 우리 잘못이다.
 *
 * digest 를 화면에 남긴다. 서버에서 난 예외는 본문이 브라우저로 오지 않고 digest 만 오는데,
 * 그 값이 서버 로그의 같은 항목을 가리킨다. 방문자가 알려 주면 로그에서 바로 찾을 수 있다.
 * 원인 문구 자체는 싣지 않는다 — 내부 구조가 그대로 나간다.
 */
export default function Error({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    // 브라우저 콘솔에는 남긴다. 서버 예외는 이미 서버 로그에 있다.
    console.error(error);
  }, [error]);

  return (
    <main id="main-content">
      <article className="prose" style={{ margin: '0 auto' }}>
        <p className="eyebrow">오류</p>
        <h1>화면을 그리지 못했습니다</h1>
        <p>
          잠시 뒤 다시 시도하면 되는 경우가 많습니다. 계속 같은 화면이 나오면 아래 표시를 알려
          주세요. 서버 기록에서 같은 항목을 찾을 수 있습니다.
        </p>
        {error.digest && (
          <p>
            오류 표시 <code>{error.digest}</code>
          </p>
        )}
        <p>
          <button className="btn" onClick={reset} type="button">
            다시 시도
          </button>{' '}
          <Link className="btn" href="/">
            첫 화면으로
          </Link>
        </p>
      </article>
    </main>
  );
}
