/**
 * 레일의 검색창. 평범한 GET form 이라 자바스크립트 없이도 동작하고,
 * 결과 주소가 /search?q=... 로 남아 뒤로 가기와 새로고침이 그대로 된다.
 *
 * 입력창과 버튼을 한 알약 안에 둔다. 버튼을 따로 떼면 좁은 레일에서 입력 폭을 잡아먹는다.
 */
export function BlogSearchBox({ defaultValue = '' }: { readonly defaultValue?: string }) {
  return (
    <form className="blog-search" action="/search" method="get" role="search">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="글 검색"
        aria-label="글 검색"
        minLength={2}
      />
      <button type="submit" aria-label="검색">
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M13 13l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </form>
  );
}
