import 'server-only';

/**
 * Spring 백엔드의 내부 주소. k3s 에서는 Service DNS, 로컬에서는 localhost.
 * 외부에 공개되지 않는 값이므로 서버에서만 읽는다.
 */
export const BACKEND_BASE = process.env.API_INTERNAL_BASE ?? 'http://localhost:8080';
