'use client';

import ErrorPage from '../error';

/**
 * error.tsx 를 눈으로 보려고 둔 라우트.
 *
 * 실제로 예외를 내면 dev 에서는 Next 오버레이가 화면을 덮어 정작 우리 화면이 안 보인다.
 * 그래서 예외 대신 컴포넌트를 직접 그린다. digest 는 실제 서버 예외에서 오는 값의 자리라
 * 아무 문자열이나 넣어 그 줄이 어떻게 보이는지까지 확인한다.
 *
 * robots.ts 의 disallow 에 들어 있다. 색인시킬 글이 아니다.
 */
export default function PreviewError() {
  const error = Object.assign(new Error('preview'), { digest: '1234567890abcdef' });
  return <ErrorPage error={error} reset={() => {}} />;
}
