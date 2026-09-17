/**
 * 히어로의 '최근 수정' 목록에 넣을 글을 가린다.
 *
 * 발행 직후에는 updatedAt 이 createdAt 과 같아서, 거르지 않으면 '최근 발행' 목록과 거의
 * 겹친다. 그래서 문턱을 두는데, 이 문턱은 **발행 그 순간을 떼어내는 값**이지 "고친 지 얼마나
 * 됐나"가 아니다. 처음엔 24시간이었는데 그러면 같은 날 고친 글이 통째로 사라진다 —
 * 19:34 에 발행하고 21:19 에 고친 글이 목록에 없는 것으로 실제로 드러났다.
 */
const PUBLISH_WINDOW_MS = 10 * 60 * 1000;

export function isEdited(article: { createdAt?: string; updatedAt?: string }): boolean {
  if (!article.createdAt || !article.updatedAt) return false;
  const created = Date.parse(article.createdAt);
  const updated = Date.parse(article.updatedAt);
  if (Number.isNaN(created) || Number.isNaN(updated)) return false;
  return updated - created > PUBLISH_WINDOW_MS;
}
