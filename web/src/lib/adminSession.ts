import 'server-only';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { BACKEND_BASE } from './backend';
import { isAdminHost } from './siteHost';

export type AdminSession = {
  authenticated: true;
  username: string;
  displayName: string;
  role: 'ADMIN';
  provider?: string;
};

function isSession(value: unknown): value is AdminSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<AdminSession>;
  return session.authenticated === true && session.role === 'ADMIN'
    && typeof session.username === 'string' && typeof session.displayName === 'string';
}

export async function requireAdminHost(): Promise<void> {
  const host = (await headers()).get('host');
  if (!isAdminHost(host)) throw new Error('관리 기능은 관리자 호스트에서만 사용할 수 있습니다.');
}

export async function readAdminCookie(): Promise<string> {
  await requireAdminHost();
  const token = (await cookies()).get('jw_token')?.value;
  if (!token) throw new Error('관리자 로그인이 필요합니다.');
  return `jw_token=${token}`;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  let cookie: string;
  try {
    cookie = await readAdminCookie();
  } catch {
    return null;
  }
  const response = await fetch(`${BACKEND_BASE}/api/auth/me`, {
    headers: { cookie, 'x-jaywiki-request': 'server' },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const payload: unknown = await response.json();
  return isSession(payload) ? payload : null;
}

export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect('/login');
  return session;
}
