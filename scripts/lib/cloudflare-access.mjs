import { execFileSync } from 'node:child_process';

const ADMIN_HOST = 'admin.leneu.cloud';
const ADMIN_ORIGIN = `https://${ADMIN_HOST}`;

export function accessHeadersFor(target, token) {
  let hostname;
  try { hostname = new URL(target).hostname; } catch { return {}; }
  if (hostname !== ADMIN_HOST) return {};
  if (!token?.trim()) throw new Error('admin.leneu.cloud에는 Cloudflare Access 토큰이 필요합니다.');
  return { 'cf-access-token': token.trim() };
}

export function cloudflareAccessHeaders(target) {
  let hostname;
  try { hostname = new URL(target).hostname; } catch { return {}; }
  if (hostname !== ADMIN_HOST) return {};

  let token = process.env.JAYWIKI_CF_ACCESS_TOKEN?.trim();
  if (!token) {
    try {
      token = execFileSync('cloudflared', ['access', 'token', '--app', ADMIN_ORIGIN], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      throw new Error(`Cloudflare Access 인증이 없습니다. 먼저 cloudflared access login ${ADMIN_ORIGIN} 을 실행하세요.`);
    }
  }
  return accessHeadersFor(target, token);
}
