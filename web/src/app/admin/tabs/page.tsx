import { getTabs } from '@/lib/api';
import { saveTabAction, deleteTabAction } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function TabsPage() {
  const tabs = await getTabs();
  return (
    <>
      <div className="admin-head">
        <div>
          <div className="eyebrow">Admin · Tabs</div>
          <h1>탭(카테고리) 관리 — {tabs.length}개</h1>
          <p className="admin-desc">1차 카테고리는 PostgreSQL(`wiki.tab`)에 저장됩니다. 코드 수정 없이 추가/수정/삭제·정렬.</p>
        </div>
      </div>

      {/* 새 탭 / 수정 (같은 tabId 면 수정) */}
      <form action={saveTabAction} className="editor-meta" style={{ marginBottom: 24 }}>
        <label className="field">
          <span className="field-label">tabId<em>*</em><small>영문소문자/숫자/-_</small></span>
          <input name="tabId" placeholder="ai" pattern="[a-z0-9][a-z0-9-_]*" required />
        </label>
        <label className="field">
          <span className="field-label">제목<em>*</em></span>
          <input name="title" placeholder="7. AI" required />
        </label>
        <label className="field">
          <span className="field-label">정렬(sortOrder)</span>
          <input name="sortOrder" type="number" defaultValue={tabs.length} />
        </label>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary">저장(추가/수정)</button>
        </div>
      </form>

      <ul className="article-list">
        {tabs.map((t) => (
          <li key={t.tabId} className="al-item">
            <div className="al-row">
              <div className="al-meta">
                <span className="badge kind">{t.tabId}</span>
                <span className="badge">order {t.sortOrder}</span>
                <span className="badge">문서 {t.articles.length}</span>
              </div>
              <div className="al-title">{t.title}</div>
            </div>
            <form action={deleteTabAction} className="al-delete">
              <input type="hidden" name="tabId" value={t.tabId} />
              <button type="submit" className="btn btn-danger" title="삭제(문서 없을 때만)"
                disabled={t.articles.length > 0}>🗑</button>
            </form>
          </li>
        ))}
      </ul>
      <p className="admin-desc" style={{ marginTop: 12 }}>
        ※ 순서 변경은 같은 tabId 로 sortOrder 만 바꿔 저장하면 됩니다. (드래그 UI 는 추후 @dnd-kit)
      </p>
    </>
  );
}
