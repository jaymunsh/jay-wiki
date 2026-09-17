'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import './image-lightbox.css';

export function BlogImageLightbox({ scopeRef, signal }: { scopeRef: RefObject<HTMLDivElement | null>; signal: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [image, setImage] = useState<{ src: string; alt: string; kind: 'image' | 'diagram' } | null>(null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    const originals = new Map<HTMLElement, { role: string | null; tab: string | null; label: string | null }>();
    const registerTargets = () => {
      // Linked images retain their author's link behavior.
      const images = [...scope.querySelectorAll('img')].filter(img => !img.closest('a, button'));
      const diagrams = [...scope.querySelectorAll<HTMLElement>('.mermaid')];
      for (const target of [...images, ...diagrams]) {
        if (!originals.has(target)) {
          originals.set(target, {
            role: target.getAttribute('role'),
            tab: target.getAttribute('tabindex'),
            label: target.getAttribute('aria-label'),
          });
        }
      }
      for (const img of images) {
        img.setAttribute('role', 'button');
        img.tabIndex = 0;
        img.setAttribute('aria-label', `${img.alt || '본문 이미지'} 확대 보기`);
        img.classList.add('blog-image-expandable');
      }
      for (const diagram of diagrams) {
        diagram.setAttribute('role', 'button');
        diagram.tabIndex = 0;
        diagram.setAttribute('aria-label', '다이어그램 확대 보기');
        diagram.classList.add('blog-diagram-expandable');
      }
    };
    registerTargets();
    // Mermaid replaces its source asynchronously after this effect can run.
    const observer = new MutationObserver(registerTargets);
    observer.observe(scope, { childList: true, subtree: true });

    const open = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && !['Enter', ' '].includes(event.key)) return;
      const target = event.target;
      if (!(target instanceof Element)) return;

      const img = target instanceof HTMLImageElement ? target : null;
      const diagram = target.closest<HTMLElement>('.mermaid');
      const expandableImage = img && scope.contains(img) && !img.closest('a, button');
      const expandableDiagram = diagram && scope.contains(diagram);
      if (!expandableImage && !expandableDiagram) return;

      event.preventDefault();
      setZoomed(false);
      if (img) {
        opener.current = img;
        setImage({ src: img.currentSrc || img.src, alt: img.alt, kind: 'image' });
        return;
      }

      const svg = diagram?.querySelector('svg');
      if (!diagram || !svg) return;
      opener.current = diagram;
      const src = URL.createObjectURL(new Blob([svg.outerHTML], { type: 'image/svg+xml' }));
      setImage({ src, alt: '본문 Mermaid 다이어그램', kind: 'diagram' });
    };
    scope.addEventListener('click', open);
    scope.addEventListener('keydown', open);
    return () => {
      observer.disconnect();
      scope.removeEventListener('click', open);
      scope.removeEventListener('keydown', open);
      for (const [target, { role, tab, label }] of originals) {
        for (const [key, value] of [['role', role], ['tabindex', tab], ['aria-label', label]]) {
          if (value === null) target.removeAttribute(key!); else target.setAttribute(key!, value!);
        }
        target.classList.remove('blog-image-expandable', 'blog-diagram-expandable');
      }
    };
  }, [scopeRef, signal]);

  useEffect(() => {
    if (!image) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (image.src.startsWith('blob:')) URL.revokeObjectURL(image.src);
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    };
  }, [image]);

  return <dialog ref={dialogRef} className="blog-image-dialog" aria-label="본문 미디어 확대 보기"
    onCancel={() => setImage(null)} onClose={() => setImage(null)}
    onClick={event => { if (event.target === event.currentTarget) setImage(null); }}>
    {image && <div className="blog-image-viewer">
      <div className="blog-image-toolbar">
        <span>{image.kind === 'diagram' ? '다이어그램 보기' : '이미지 보기'}</span>
        <button type="button" aria-pressed={zoomed} onClick={() => setZoomed(!zoomed)}>{zoomed ? '화면에 맞추기' : '원본 크기'}</button>
        <a href={image.src} target="_blank" rel="noopener noreferrer">새 탭</a>
        <button type="button" autoFocus onClick={() => setImage(null)} aria-label="이미지 닫기">닫기 ×</button>
      </div>
      <div className={`blog-image-stage${zoomed ? ' is-zoomed' : ''}`}>
        {/* Preserve the exact source resolution; no thumbnail conversion. */}
        <img src={image.src} alt={image.alt} />
      </div>
      {image.alt && <p className="blog-image-caption">{image.alt}</p>}
    </div>}
  </dialog>;
}
