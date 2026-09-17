import { getFeaturedArticles, listArticles } from '@/lib/api';
import { saveFeaturedAction } from '@/lib/actions';

export const dynamic = 'force-dynamic';

/**
 * 첫 화면 '대표 문서' 다섯 칸.
 *
 * 칸마다 저장 버튼을 두지 않는다. 순서를 바꿀 때 두 칸이 같은 자리를 잠깐 나눠 갖는 상태가
 * 생기지 않도록, 다섯 칸을 한 번에 보낸다(서버도 같은 이유로 목록 단위로 받는다).
 * 비워 두면 그 칸은 빠지고, 다섯 칸을 다 비우면 첫 화면에서 탭이 사라진다.
 */
export default async function FeaturedAdminPage() {
  const [all, featured] = await Promise.all([listArticles(), getFeaturedArticles()]);
  const slots = Array.from({ length: 5 }, (_, i) => featured[i]?.slug ?? '');

  return (
    <>
      <div className="admin-head">
        <div>
          <div className="eyebrow">Admin · Featured</div>
          <h1>대표 문서 — 첫 화면에 전시할 {slots.filter(Boolean).length}편</h1>
          <p className="admin-desc">
            첫 화면 오른쪽 「대표 문서」 탭에 이 순서로 나옵니다. 시드가 덮지 않는 값이라 배포해도 그대로
            남습니다(조회수와 같습니다).
          </p>
        </div>
      </div>

      <form action={saveFeaturedAction} className="editor-meta" style={{ marginTop: 18 }}>
        {slots.map((slug, index) => (
          <label key={index} className="field">
            <span className="field-label">{index + 1}번째</span>
            <select name="slug" defaultValue={slug}>
              <option value="">— 비움 —</option>
              {all.map((a) => (
                <option key={a.slug} value={a.slug}>
                  [{a.tabTitle}] {a.title}
                </option>
              ))}
            </select>
          </label>
        ))}
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" type="submit">
            다섯 칸 저장
          </button>
        </div>
      </form>
    </>
  );
}
