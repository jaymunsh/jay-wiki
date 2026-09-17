import { notFound } from 'next/navigation';

import SyncConsole from './SyncConsole';

export const dynamic = 'force-dynamic';

/**
 * 개발 서버에서만 열린다. 운영 빌드에서는 페이지도 API 도 404 다 —
 * 인증이 없는 판이라 열려 있으면 그대로 운영 글을 쓰는 문이 된다.
 * 배포의 스모크 테스트가 매번 404 인지 확인한다.
 */
export default function SyncPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <SyncConsole />;
}
