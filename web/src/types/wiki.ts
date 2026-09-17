/**
 * 위키 문서 종류/상태 — 에디터에서 선택지로 사용.
 * (탭/문서 트리 타입은 Spring API 응답 기준으로 각 파일에 인라인 — lib/api.ts 참고)
 */
export type ArticleKind =
  | 'wiki'
  | 'demo'
  | 'metric'
  | 'control'
  | 'chat'
  | 'board'
  | 'postmortem'
  | 'adr'
  | 'note'
  | 'series'
  | 'experiment';

export type ArticleStatus = 'published' | 'draft' | 'archived';
