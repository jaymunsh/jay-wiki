'use client';

import { useEffect, useId } from 'react';
import type { RefObject } from 'react';

type MermaidDiagramsProps = {
  readonly signal: string;
  readonly scopeRef: RefObject<HTMLElement | null>;
};

function hideDiagram(node: HTMLElement): void {
  node.replaceChildren();
  node.hidden = true;
  node.dataset.mermaidError = 'true';
}

export function MermaidDiagrams({ signal, scopeRef }: MermaidDiagramsProps) {
  const instanceId = useId().replaceAll(':', '-');

  useEffect(() => {
    let disposed = false;
    let retryTimeout: number | undefined;

    async function renderDiagrams(retryAllowed: boolean): Promise<void> {
      if (disposed) return;

      const scope = scopeRef.current;
      const diagrams = scope
        ? Array.from(scope.querySelectorAll<HTMLElement>('.mermaid'))
            .filter((node) => node.isConnected)
            .map((node) => ({ node, source: node.dataset.mermaidSource ?? node.textContent ?? '' }))
            .filter((diagram) => diagram.source.trim().length > 0)
        : [];
      if (diagrams.length === 0) {
        if (retryAllowed) {
          retryTimeout = window.setTimeout(() => {
            void renderDiagrams(false);
          }, 50);
        }
        return;
      }

      let mermaid: Awaited<typeof import('mermaid')>['default'];
      try {
        mermaid = (await import('mermaid')).default;
      } catch {
        for (const { node } of diagrams) {
          if (disposed || !node.isConnected) return;
          hideDiagram(node);
        }
        return;
      }
      if (disposed) return;

      const theme = document.documentElement.dataset.theme === 'light' ? 'default' : 'dark';
      mermaid.initialize({ startOnLoad: false, theme, securityLevel: 'strict', suppressErrorRendering: true });

      for (const [index, diagram] of diagrams.entries()) {
        const { node, source } = diagram;
        try {
          node.dataset.mermaidSource = source;
          const parsed = await mermaid.parse(source, { suppressErrors: true });
          if (!parsed) {
            hideDiagram(node);
            continue;
          }
          const { svg, bindFunctions } = await mermaid.render(`mermaid-${instanceId}-${index}`, source);
          if (disposed || !node.isConnected) return;

          node.innerHTML = svg;
          node.dataset.mermaidRendered = signal;
          delete node.dataset.mermaidError;
          bindFunctions?.(node);
        } catch {
          if (disposed || !node.isConnected) return;
          hideDiagram(node);
        }
      }
    }

    void renderDiagrams(true);
    return () => {
      disposed = true;
      if (retryTimeout !== undefined) {
        window.clearTimeout(retryTimeout);
      }
    };
  }, [instanceId, scopeRef, signal]);

  return null;
}
