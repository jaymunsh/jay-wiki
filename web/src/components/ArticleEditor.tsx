'use client';

import Link from 'next/link';
import { useActionState, useRef, useState } from 'react';
import { saveArticleAction, type SaveResult } from '@/lib/actions';
import { MarkdownBodyEditor } from './MarkdownBodyEditor';
import type { ArticleKind, ArticleStatus } from '@/types/wiki';

const KINDS: { value: ArticleKind; label: string }[] = [
  { value: 'wiki', label: '📄 wiki — 일반 위키 문서' },
  { value: 'note', label: '🗒️ note — 운영 노트(블로그)' },
  { value: 'postmortem', label: '📌 postmortem — 회고' },
  { value: 'adr', label: '📐 adr — 의사결정 기록' },
  { value: 'demo', label: '🧪 demo — 라이브 시연' },
  { value: 'metric', label: '📊 metric — Grafana 임베드' },
  { value: 'control', label: '🎛️ control — 관리자 제어판' },
  { value: 'chat', label: '💬 chat — WebSocket' },
  { value: 'board', label: '📋 board — 게시판' },
  { value: 'series', label: '📚 series — 글 목록' },
  { value: 'experiment', label: '⚗️ experiment — 실험/벤치' },
];

const STATUSES: { value: ArticleStatus; label: string }[] = [
  { value: 'draft', label: '○ draft (작성 중)' },
  { value: 'published', label: '● published (공개)' },
  { value: 'archived', label: '× archived (보관)' },
];

export interface EditorInitial {
  parentId: string;
  slug: string;
  title: string;
  desc: string;
  kind: ArticleKind;
  status: ArticleStatus;
  lastReview: string;
  sortOrder: number;
  tocEnabled: boolean;
  body: string;
}

export function ArticleEditor({
  initial,
  mode,
  parents,
}: {
  initial: EditorInitial;
  mode: 'new' | 'edit';
  parents: { id: string; title: string }[];
}) {
  const [state, formAction, pending] = useActionState<SaveResult | null, FormData>(
    saveArticleAction,
    null
  );

  const [body, setBody] = useState(initial.body);
  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);

  /** 제목을 slug 로 자동 변환(영문/숫자/하이픈만) — 사용자가 직접 만지면 멈춤 */
  const slugTouched = useRef(initial.slug.length > 0);
  function onTitleChange(v: string) {
    setTitle(v);
    if (!slugTouched.current) setSlug(slugify(v));
  }

  const editing = mode === 'edit';


  return (
    <form action={formAction} className="editor">
      <div className="editor-head">
        <div>
          <div className="eyebrow">{editing ? 'Admin · Edit' : 'Admin · New article'}</div>
          <h1>{editing ? `편집 — ${initial.title || initial.slug}` : '새 글 작성'}</h1>
          <p className="admin-desc">
            저장하면 PostgreSQL의 <code>tb_article</code>에 기록되고, 직전 본문은{' '}
            <code>tb_revision</code>에 버전으로 남습니다.
            홈으로 돌아가면 곧바로 해당 탭에 노출됩니다.
          </p>
        </div>
        <div className="editor-actions">
          <Link href="/wiki/articles" className="btn">취소</Link>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? '저장 중…' : editing ? '변경 저장' : '저장 후 목록으로'}
          </button>
        </div>
      </div>

      {state?.error && (
        <div className="editor-error" role="alert">
          ⚠ {state.error}
        </div>
      )}

      {/* 메타 — frontmatter */}
      <div className="editor-meta">
        <Field label="제목" required>
          <input
            name="title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Redis — 캐시 메모리가 아니다"
            required
          />
        </Field>
        <Field label="slug" required hint="URL 식별자 · 영문 소문자/숫자/하이픈">
          {/* 편집 모드에선 변경 금지하되, disabled 대신 readOnly 로 둬야 값이 폼 전송됨
              (disabled 입력은 submit 에 포함 안 됨) */}
          <input
            name="slug"
            value={slug}
            onChange={(e) => {
                  slugTouched.current = true;
              setSlug(e.target.value);
            }}
            placeholder="redis"
            pattern="[a-z0-9][a-z0-9-_]*"
            required
            readOnly={editing}
          />
        </Field>
        <Field label="카테고리 (1차 탭)" required>
          {/* select 는 disabled 시 전송 안 되므로, 편집 모드에선 hidden 으로 값 보강 */}
          {editing && <input type="hidden" name="parentId" value={initial.parentId} />}
          <select name="parentId" defaultValue={initial.parentId} disabled={editing}>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </Field>
        <Field label="kind (문서 종류)" required>
          <select name="kind" defaultValue={initial.kind}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </Field>
        <Field label="status" required>
          <select name="status" defaultValue={initial.status}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>
        <Field label="정렬(sortOrder)" hint="목록은 최근 수정 순입니다. 이 값은 수정 시각이 같을 때만 갈라 줍니다.">
          <input
            name="sortOrder"
            type="number"
            defaultValue={initial.sortOrder}
          />
        </Field>
        <Field label="목차" hint="세 줄 요약 아래에 ##/### 목차를 그립니다">
          <label className="editor-check">
            <input name="tocEnabled" type="checkbox" defaultChecked={initial.tocEnabled} />
            <span>목차 노출</span>
          </label>
        </Field>
        <Field label="last_review" hint="90일 지나면 노란 배지 자동">
          <input
            name="lastReview"
            type="date"
            defaultValue={initial.lastReview}
          />
        </Field>
        <Field label="요약 (한 줄)" full>
          <input
            name="desc"
            defaultValue={initial.desc}
            placeholder="목록 카드와 페이지 상단에 함께 노출됩니다."
          />
        </Field>
      </div>

      <MarkdownBodyEditor name="body" value={body} onChange={setBody} />
    </form>
  );
}

function Field({
  label,
  hint,
  required,
  full,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`field${full ? ' field-full' : ''}`}>
      <span className="field-label">
        {label}
        {required && <em>*</em>}
        {hint && <small>{hint}</small>}
      </span>
      {children}
    </label>
  );
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}
