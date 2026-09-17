import 'server-only';

/**
 * 지금 도는 웹 프로세스가 기동한 시각(ISO).
 *
 * 이 값이 곧 "이 버전이 운영에서 서비스를 시작한 순간"이다. rollout 이 끝나 새 파드가 뜨면
 * 프로세스도 새로 시작하므로, CI 가 이미지를 만든 시각(파이프라인 맨 앞)보다 실제 반영 시점에 가깝다.
 * deploy.yml 은 배포 시각을 어디에도 남기지 않고, tb_article.synced_at 은 읽는 코드가 없는 V1 잔재다.
 *
 * 한계: 배포가 아닌 재기동(OOM·노드 재부팅)에도 갱신된다. 그래서 라벨은 '배포'가 아니라
 * '최신 반영 일자' — 무엇 때문이든 지금 도는 것이 언제부터인지를 말한다.
 *
 * process.uptime() 은 프로세스 자체 값이라 I/O 가 없다.
 */
export function deployedAt(): string {
  return new Date(Date.now() - process.uptime() * 1000).toISOString();
}
