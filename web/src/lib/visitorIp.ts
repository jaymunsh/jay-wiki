import { headers } from 'next/headers';

/** 방문자 주소. 이걸 안 넘기면 Spring 이 모든 방문자를 웹 서버 하나로 본다. */
export async function visitorIp(): Promise<string> {
  const h = await headers();
  return h.get('cf-connecting-ip') ?? h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
}

/**
 * 방문자 신호 셋 -- 주소, 유입 경로, 브라우저. 위치 인자로 그대로 펼쳐 넘기려고 튜플로 준다.
 * react cache 가 원시값 인자로만 memoize 하므로 객체로 묶으면 같은 요청에서 두 번 세어진다.
 *
 * 어느 것도 원문으로 저장되지 않는다. IP 는 해시된 뒤 버려지고, referer 는 호스트만 보고
 * 소스 이름으로 줄며, User-Agent 는 모바일 여부 하나로 줄어든다.
 */
export async function visitorSignals(): Promise<readonly [string, string, string]> {
  const h = await headers();
  return [await visitorIp(), h.get('referer') ?? '', h.get('user-agent') ?? ''] as const;
}
