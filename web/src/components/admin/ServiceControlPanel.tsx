'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminServiceStatus } from '@/lib/api';

interface Props {
  readonly services: readonly AdminServiceStatus[];
}

interface Flash {
  readonly serviceKey: string;
  readonly message: string;
  readonly tone: 'ok' | 'error';
}

export function ServiceControlPanel({ services }: Props) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);

  async function scale(service: AdminServiceStatus, replicas: number) {
    setPendingKey(service.key);
    setFlash(null);
    try {
      const response = await fetch(`/api/bff/admin/services/${encodeURIComponent(service.key)}/scale`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ replicas }),
      });
      if (!response.ok) {
        const detail = await response.text();
        setFlash({
          serviceKey: service.key,
          tone: 'error',
          message: detail || `요청 실패: ${response.status}`,
        });
        return;
      }
      setFlash({
        serviceKey: service.key,
        tone: 'ok',
        message: replicas === 0 ? '스케일 0 요청을 보냈습니다.' : '스케일 1 요청을 보냈습니다.',
      });
      router.refresh();
    } catch (error) {
      setFlash({
        serviceKey: service.key,
        tone: 'error',
        message: error instanceof Error ? error.message : '요청을 처리하지 못했습니다.',
      });
    } finally {
      setPendingKey(null);
    }
  }

  if (services.length === 0) {
    return (
      <div className="placeholder">
        제어 가능한 서비스 상태를 불러오지 못했습니다.
        <br />
        <small>로컬 실행이면 Kubernetes service account가 없어서 비어 보일 수 있습니다.</small>
      </div>
    );
  }

  return (
    <ul className="service-list">
      {services.map((service) => {
        const pending = pendingKey === service.key;
        const enabled = service.desiredReplicas > 0;
        const statusClass = enabled && service.available ? 'green' : enabled ? 'warn' : '';
        const statusText = enabled ? (service.available ? 'ON' : 'STARTING') : 'OFF';

        return (
          <li key={service.key} className="service-card">
            <div className="service-main">
              <div className="al-meta">
                <span className={`badge ${statusClass}`}>{statusText}</span>
                <span className="badge kind">{service.namespace}</span>
                <span className="badge">{service.kind}</span>
              </div>
              <div className="al-title">{service.title}</div>
              <div className="al-desc">{service.description}</div>
              <div className="service-foot">
                <code>{service.name}</code>
                <span>
                  replicas {service.currentReplicas}/{service.desiredReplicas}
                </span>
              </div>
              {flash?.serviceKey === service.key && (
                <p className={`service-flash ${flash.tone}`}>{flash.message}</p>
              )}
            </div>
            <div className="service-actions">
              <button
                type="button"
                className="btn"
                disabled={pending || service.desiredReplicas === 0}
                onClick={() => void scale(service, 0)}
              >
                끄기
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending || service.desiredReplicas === 1}
                onClick={() => void scale(service, 1)}
              >
                켜기
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
