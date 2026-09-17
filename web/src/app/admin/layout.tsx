import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdminSession } from '@/lib/adminSession';
import { hostnameOf } from '@/lib/siteHost';

/**
 * 관리 메뉴는 위키·블로그·공통 세 묶음이다.
 * 소제목 없이 나열하면 '글 목록' 이 둘이 되어 무엇이 무엇인지 구분되지 않는다.
 */
export const metadata: Metadata = { robots: { index: false, follow: false }, title: '관리자 콘솔' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [session, requestHeaders] = await Promise.all([requireAdminSession(), headers()]);
  const local = hostnameOf(requestHeaders.get('host')) === 'admin.localhost';
  return <AdminShell session={session} local={local}>{children}</AdminShell>;
}
