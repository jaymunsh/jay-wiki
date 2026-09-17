/**
 * 공개 사이트의 외부 주소. 서버·클라이언트 양쪽에서 읽으므로 NEXT_PUBLIC_ 접두사를 쓴다.
 * 값이 빌드 시점에 번들로 인라인되므로, 배포 이미지를 다른 도메인에서 재사용하려면
 * 빌드 인자로 넘겨야 한다.
 */
export const PUBLIC_SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://portfolio.leneu.cloud';

/** Grafana 대시보드 공개 주소. 시나리오 화면의 관측 링크에 쓴다. */
export const GRAFANA_ORIGIN =
  process.env.NEXT_PUBLIC_GRAFANA_ORIGIN ?? 'https://grafana.leneu.cloud';
