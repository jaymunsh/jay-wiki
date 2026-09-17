import { SpreadsheetExportPanel } from '@/app/domain-scenarios/SpreadsheetExportPanel';

export const dynamic = 'force-dynamic';

export default function AdminSpreadsheetExportPage() {
  return <>
    <header className="admin-head">
      <div>
        <div className="eyebrow">OPERATIONS · EXPORT</div>
        <h1>Excel 내보내기</h1>
        <p className="admin-desc">대량 게시글 내보내기를 관리자 인증 경계 안에서 실행합니다.</p>
      </div>
    </header>
    <SpreadsheetExportPanel />
  </>;
}
