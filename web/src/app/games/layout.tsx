/**
 * 게임 세그먼트 공통 레이아웃.
 *
 * body 는 사이트 공통 --bg-0(차가운 회색)과 위쪽 보라 글로우를 쓴다. 게임 로비의
 * 아이보리가 페이지 밖(오버스크롤·가장자리)까지 이어지게 이 세그먼트에서만 덮는다.
 * CSS 모듈은 로컬 클래스 없는 전역 선택자를 허용하지 않아(:global(body) 는 pure
 * selector 규칙에 걸림) 인라인 <style> 로 둔다 — 세그먼트를 벗어나면 같이 내려간다.
 */
export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`body { background: #f4f3ed; }`}</style>
      {children}
    </>
  );
}
