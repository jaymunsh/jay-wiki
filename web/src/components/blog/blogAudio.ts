'use client';

import { createContext, useContext, useEffect } from 'react';

/**
 * 블로그 배경음악의 계약. **컴포넌트가 없는 파일이다** — provider 와 한 파일에 두면
 * fast refresh 가 이 파일을 컴포넌트 파일로 보고 갱신 때마다 상태를 버린다.
 * 실체(audio 엘리먼트)는 BlogAudioProvider 에 있다.
 */
export const TRACK = {
  title: 'Lost in the Neon Wave',
  src: '/assets/projects/lost-in-the-neon-wave-local-ai-music/lost-in-the-neon-wave.mp3',
  album: '/assets/projects/lost-in-the-neon-wave-local-ai-music/album-neonwave.png',
  /** 메타데이터가 오기 전에도 바 길이가 안 흔들리게 하는 값이다. */
  seconds: 120,
} as const;

export type BlogAudio = {
  readonly playing: boolean;
  readonly current: number;
  readonly duration: number;
  readonly volume: number;
  readonly loop: boolean;
  /**
   * 지금 재생 위치를 엘리먼트에서 바로 읽는다. current 는 timeupdate 로만 갱신돼 최대
   * 250ms 낡는데, 원반의 시작 각도는 그 오차만큼 뒤로 튄다.
   */
  readonly readCurrent: () => number;
  readonly toggle: () => void;
  readonly seek: (seconds: number) => void;
  readonly changeVolume: (value: number) => void;
  readonly toggleLoop: () => void;
};

export const BlogAudioContext = createContext<BlogAudio | null>(null);

/**
 * provider 밖에서 부르면 null 이다. 화면을 지우지 않고 조용히 비활성으로 두려고
 * 던지지 않는다 — 관리자 화면처럼 provider 가 없는 자리에서도 이 조각이 쓰일 수 있다.
 */
export function useBlogAudio(): BlogAudio | null {
  return useContext(BlogAudioContext);
}

/** 팝업이 바깥 클릭·Esc 로 닫히게 한다. 열려 있을 때만 듣는다. */
export function useDismiss(
  open: boolean,
  ref: React.RefObject<HTMLElement | null>,
  close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    function onEvent(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event instanceof MouseEvent && ref.current?.contains(event.target as Node)) return;
      close();
    }
    document.addEventListener('pointerdown', onEvent);
    document.addEventListener('keydown', onEvent);
    return () => {
      document.removeEventListener('pointerdown', onEvent);
      document.removeEventListener('keydown', onEvent);
    };
  }, [open, ref, close]);
}
