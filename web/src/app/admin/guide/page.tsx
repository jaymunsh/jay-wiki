const ARTICLE_FIELDS = [
  ['slug', '문서를 고유하게 찾는 URL·API 식별자', '/wiki/donts3p-macos-sleep-assertion-app', '생성 뒤 변경하지 않음'],
  ['kind', '문서 성격과 목록 badge를 구분', 'wiki, postmortem, adr, demo', '내용의 목적에 맞게 선택'],
  ['status', '공개·초안·보관 상태를 결정', 'published, draft, archived', '공개 전 draft 권장'],
  ['sortOrder', '수정 시각이 같을 때만 쓰는 tiebreak', '0, 1, 2', '목록은 최근 수정 순이 우선'],
  ['last_review', '마지막 내용 검토일을 기록', '2026-07-17', '90일 이후 검토 badge'],
] as const;

const IMAGE_EXAMPLES = [
  ['기본 반응형', '![구성도](/assets/example/architecture.webp)'],
  ['280px 가운데', '![앱 아이콘](/assets/projects/app-icon.webp "width=280 align=center")'],
  ['360px 오른쪽', '![상태 화면](/assets/example/status.webp "width=360 align=right")'],
] as const;

export default function AdminGuidePage() {
  return (
    <>
      <header className="admin-head">
        <div>
          <div className="eyebrow">Admin · Authoring reference</div>
          <h1>위키 편집 가이드</h1>
          <p className="admin-desc">
            문서 필드, Markdown 이미지와 저장 경계를 편집 전에 빠르게 확인합니다.
          </p>
        </div>
      </header>

      <div className="admin-guide">
        <section aria-labelledby="guide-fields">
          <header>
            <span>01</span>
            <div><h2 id="guide-fields">문서 필드</h2><p>slug는 제목의 보조 정보가 아니라 문서의 안정적인 식별자입니다.</p></div>
          </header>
          <div className="admin-guide-table-scroll">
            <div className="admin-guide-table" role="table" aria-label="문서 필드 설명">
              <div className="admin-guide-table-head" role="row">
                <span role="columnheader">필드</span><span role="columnheader">역할</span>
                <span role="columnheader">예시</span><span role="columnheader">운영 규칙</span>
              </div>
              {ARTICLE_FIELDS.map(([field, role, example, rule]) => (
                <div role="row" key={field}>
                  <code role="cell">{field}</code><span role="cell">{role}</span>
                  <code role="cell">{example}</code><span role="cell">{rule}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="admin-guide-callout">
            <strong>slug가 연결되는 곳</strong>
            <code>/wiki/&lt;slug&gt;</code>
            <code>/api/articles/&lt;slug&gt;</code>
            <span>revision 조회·되돌리기도 같은 값을 사용합니다.</span>
          </div>
        </section>

        <section aria-labelledby="guide-images">
          <header>
            <span>02</span>
            <div><h2 id="guide-images">이미지 크기와 정렬</h2><p>raw HTML 대신 허용된 Markdown title 옵션만 사용합니다.</p></div>
          </header>
          <div className="admin-guide-examples">
            {IMAGE_EXAMPLES.map(([label, source]) => (
              <div key={label}><span>{label}</span><code>{source}</code></div>
            ))}
          </div>
          <dl className="admin-guide-rules">
            <div><dt>width</dt><dd>64~1200 사이 정수. 지정하지 않으면 자연 크기를 사용합니다.</dd></div>
            <div><dt>align</dt><dd>left, center, right만 지원합니다.</dd></div>
            <div><dt>모바일</dt><dd>지정한 너비가 본문보다 크면 max-width 100%로 줄어듭니다.</dd></div>
            <div><dt>alt text</dt><dd>이미지가 없어도 상태와 목적을 이해할 수 있게 작성합니다.</dd></div>
          </dl>
        </section>

        <section aria-labelledby="guide-assets">
          <header>
            <span>03</span>
            <div><h2 id="guide-assets">업로드와 저장 경계</h2><p>편집기 이미지 버튼, 붙여넣기와 drag-and-drop은 같은 경로를 사용합니다.</p></div>
          </header>
          <ol className="admin-guide-steps">
            <li><b>검사</b><span>이미지 MIME type과 10MB 상한을 확인합니다.</span></li>
            <li><b>임시 저장</b><span>Spring이 MinIO wiki-assets bucket에 object를 생성합니다.</span></li>
            <li><b>본문 삽입</b><span>브라우저에는 same-origin asset URL만 들어갑니다.</span></li>
            <li><b>문서 연결</b><span>글을 저장하면 asset과 article revision의 관계를 남깁니다.</span></li>
          </ol>
        </section>

        <section aria-labelledby="guide-safety">
          <header>
            <span>04</span>
            <div><h2 id="guide-safety">작성 안전 규칙</h2><p>현재 renderer와 sanitizer가 보장하는 범위입니다.</p></div>
          </header>
          <ul className="admin-guide-checks">
            <li>raw HTML은 text로 escape하므로 img tag를 직접 작성하지 않습니다.</li>
            <li>javascript와 data scheme은 link와 image source로 허용하지 않습니다.</li>
            <li>외부 이미지는 출처·라이선스·장기 보존 가능성을 확인한 뒤 반입합니다.</li>
            <li>운영 MinIO endpoint와 credential은 본문에 기록하지 않습니다.</li>
            <li>시드 본문에서는 backtick 대신 물결표 세 개로 code block을 만듭니다.</li>
          </ul>
        </section>
      </div>
    </>
  );
}
