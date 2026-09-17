import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import { isProductionAdminHost, safeAdminNext } from '@/lib/siteHost';

export const metadata: Metadata = { title: '관리자 로그인', robots: { index: false, follow: false } };

export default async function AdminLoginPage({ searchParams }: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [params, requestHeaders] = await Promise.all([searchParams, headers()]);
  const next = safeAdminNext(params.next);
  return <AdminLoginForm next={next} otpRequiredInitially={isProductionAdminHost(requestHeaders.get('host'))} />;
}
