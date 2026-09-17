import { ServiceControlPanel } from '@/components/admin/ServiceControlPanel';
import { getAdminServices } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function ServicesPage() {
  const services = await getAdminServices();

  return (
    <>
      <div className="admin-head">
        <div>
          <div className="eyebrow">Admin · Services</div>
          <h1>서비스 제어판</h1>
          <p className="admin-desc">
            화이트리스트에 등록된 Kubernetes 워크로드만 0/1 replica로 조정합니다. 앱 본체는 여기서 끄지 않습니다.
          </p>
        </div>
      </div>

      <ServiceControlPanel services={services} />
    </>
  );
}
