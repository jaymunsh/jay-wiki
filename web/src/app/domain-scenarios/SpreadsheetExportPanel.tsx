'use client';

import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, LockKeyhole } from 'lucide-react';
import { adminOriginFor } from '@/lib/siteHost';

type AuthState = { readonly loaded: boolean; readonly isAdmin: boolean };
type ExportResult = { readonly rows: number; readonly durationMs: number; readonly bytes: number };

export function SpreadsheetExportPanel() {
  const [auth, setAuth] = useState<AuthState>({ loaded: false, isAdmin: false });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch('/api/bff/auth/me', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload: unknown) => {
        if (!active || typeof payload !== 'object' || payload === null) return;
        const role = 'role' in payload && typeof payload.role === 'string' ? payload.role : '';
        setAuth({ loaded: true, isAdmin: role === 'ADMIN' });
      })
      .catch(() => {
        if (active) setAuth({ loaded: true, isAdmin: false });
      });
    return () => { active = false; };
  }, []);

  function openAdmin(event: React.MouseEvent<HTMLAnchorElement>): void {
    event.preventDefault();
    window.location.assign(`${adminOriginFor(window.location.host, window.location.protocol)}/tools/spreadsheet-export`);
  }

  async function downloadExport(): Promise<void> {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch('/api/spreadsheet-export', { method: 'POST' });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const detail = typeof payload === 'object' && payload !== null && 'detail' in payload && typeof payload.detail === 'string'
          ? payload.detail
          : 'Excel 파일을 생성하지 못했습니다.';
        throw new Error(detail);
      }
      const blob = await response.blob();
      const filename = readFilename(response.headers.get('content-disposition'));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setResult({
        rows: readHeaderNumber(response.headers, 'x-export-rows'),
        durationMs: readHeaderNumber(response.headers, 'x-export-duration-ms'),
        bytes: readHeaderNumber(response.headers, 'x-export-bytes'),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Excel 생성 중 알 수 없는 오류가 발생했습니다.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="domain-lab-panel spreadsheet-export-panel">
      <header><span>REAL EXPORT</span><h2>게시글 10만 건 Streaming Excel</h2></header>
      <div className="spreadsheet-export-layout">
        <div className="spreadsheet-export-copy">
          <FileSpreadsheet aria-hidden="true" size={22} />
          <div><strong>검색 비교와 같은 PostgreSQL corpus</strong><p>2,000행 fetch와 500행 workbook window로 읽습니다. 본문과 password hash는 파일에 포함하지 않습니다.</p></div>
        </div>
        <button className="btn btn-primary spreadsheet-export-button" disabled={!auth.loaded || !auth.isAdmin || running} onClick={downloadExport} type="button">
          {auth.isAdmin ? <Download aria-hidden="true" size={16} /> : <LockKeyhole aria-hidden="true" size={16} />}
          {running ? '10만 건 생성 중' : '10만 건 Excel 다운로드'}
        </button>
      </div>
      {!auth.isAdmin && auth.loaded && <p className="spreadsheet-export-note">miniPC 자원 보호를 위해 실제 파일은 <a href="https://admin.leneu.cloud/tools/spreadsheet-export" onClick={openAdmin}>관리자 사이트</a>에서 생성합니다.</p>}
      {error && <p className="domain-lab-error" role="alert">{error}</p>}
      {result && <dl className="spreadsheet-export-result"><Metric label="ROWS" value={`${result.rows.toLocaleString('ko-KR')}건`} /><Metric label="GENERATED" value={`${result.durationMs.toLocaleString('ko-KR')} ms`} /><Metric label="FILE SIZE" value={formatBytes(result.bytes)} /></dl>}
    </section>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function readHeaderNumber(headers: Headers, name: string): number {
  const value = Number(headers.get(name));
  return Number.isFinite(value) ? value : 0;
}

function readFilename(disposition: string | null): string {
  const match = disposition?.match(/filename="([^"]+)"/);
  return match?.[1] ?? 'jaywiki-posts-100k.xlsx';
}

function formatBytes(bytes: number): string {
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}
