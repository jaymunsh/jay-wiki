'use client';

import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import {
  deleteWikiAssetAction,
  uploadWikiAssetAction,
  type WikiAssetUpload,
} from '@/lib/actions';
import { renderMarkdownPreview } from '@/lib/markdown';
import { MermaidDiagrams } from './MermaidDiagrams';

/**
 * 마크다운 본문 편집 코어. 위키 편집기와 블로그 편집기가 함께 쓴다.
 * 자산은 tb_article_asset 을 공유하므로 업로드 액션도 그대로 쓴다.
 *
 * 폼 메타 필드는 이 컴포넌트 밖에 둔다 — 위키와 블로그의 필드가 다르기 때문이다.
 * body 상태도 밖에 둔다. 폼 전송과 여기 양쪽이 쓴다.
 */
export function MarkdownBodyEditor({
  name,
  value,
  onChange,
}: {
  readonly name: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
}) {
  const [assetMessage, setAssetMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sessionAssets, setSessionAssets] = useState<readonly SessionAsset[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewHtml = useMemo(() => renderMarkdownPreview(value), [value]);

  async function uploadImage(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      setAssetMessage('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setAssetMessage('이미지는 10MB 이하여야 합니다.');
      return;
    }

    setUploading(true);
    setAssetMessage(null);
    const formData = new FormData();
    formData.set('file', file, file.name);
    try {
      const result = await uploadWikiAssetAction(formData);
      if (!result.ok) {
        setAssetMessage(result.error);
        return;
      }
      const alt = imageAlt(result.asset.originalName);
      const markdown = `![${alt}](${result.asset.url})`;
      insertAtCursor(markdown);
      setSessionAssets((current) => [...current, { asset: result.asset, markdown }]);
      setAssetMessage('이미지를 업로드하고 현재 커서에 삽입했습니다.');
    } finally {
      setUploading(false);
    }
  }

  function insertAtCursor(markdown: string): void {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? start;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const prefix = before.length > 0 && !before.endsWith('\n') ? '\n\n' : '';
    const suffix = after.length > 0 && !after.startsWith('\n') ? '\n\n' : '\n';
    const inserted = `${prefix}${markdown}${suffix}`;
    onChange(`${before}${inserted}${after}`);
    requestAnimationFrame(() => {
      const next = start + inserted.length;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(next, next);
    });
  }

  async function deleteSessionAsset(item: SessionAsset): Promise<void> {
    const result = await deleteWikiAssetAction(item.asset.id);
    if (!result.ok) {
      setAssetMessage(result.error ?? '이미지를 삭제하지 못했습니다.');
      return;
    }
    onChange(value.replaceAll(`${item.markdown}\n`, '').replaceAll(item.markdown, ''));
    setSessionAssets((current) => current.filter(({ asset }) => asset.id !== item.asset.id));
    setAssetMessage('저장 전 이미지를 삭제했습니다.');
  }

  return (
    <div className="editor-body">
      <div className="editor-pane">
        <div className="pane-head">
          <span>본문 · Markdown</span>
          <div className="pane-tools">
            <span className="pane-hint">
              {value.length} 글자 · 약 {Math.max(1, Math.round(value.length / 500))} 분
            </span>
            <input
              ref={fileInputRef}
              className="asset-file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void uploadImage(file);
                event.currentTarget.value = '';
              }}
            />
            <button
              className="asset-upload-button"
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <LoaderCircle aria-hidden="true" className="spin" /> : <ImagePlus aria-hidden="true" />}
              {uploading ? '업로드 중' : '이미지'}
            </button>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(event) => {
            const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith('image/'));
            if (!image) return;
            event.preventDefault();
            void uploadImage(image);
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const image = Array.from(event.dataTransfer.files).find((file) => file.type.startsWith('image/'));
            if (image) void uploadImage(image);
          }}
          data-dragging={dragging}
          placeholder={'## 🎯 목적\n\n한 줄로 무엇을 해결하는지...\n\n## 🛠️ 구성\n\n```yaml\nkey: value\n```'}
          spellCheck={false}
        />
        {(assetMessage || sessionAssets.length > 0) && (
          <div className="asset-upload-status" aria-live="polite">
            {assetMessage && <p>{assetMessage}</p>}
            {sessionAssets.map((item) => (
              <div className="asset-uploaded-item" key={item.asset.id}>
                <span>{item.asset.originalName}</span>
                <small>{formatBytes(item.asset.sizeBytes)}</small>
                <button
                  type="button"
                  title="저장 전 이미지 삭제"
                  aria-label={`${item.asset.originalName} 삭제`}
                  onClick={() => void deleteSessionAsset(item)}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="editor-pane">
        <div className="pane-head">
          <span>라이브 프리뷰</span>
          <span className="pane-hint">Markdown + 코드 하이라이트</span>
        </div>
        <div
          ref={previewRef}
          className="prose pane-preview"
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
        <MermaidDiagrams scopeRef={previewRef} signal={value} />
      </div>
    </div>
  );
}

type SessionAsset = {
  readonly asset: WikiAssetUpload;
  readonly markdown: string;
};

function imageAlt(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, '').trim();
  return (withoutExtension || '위키 이미지').replaceAll('[', '').replaceAll(']', '');
}

function formatBytes(size: number): string {
  return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
}
