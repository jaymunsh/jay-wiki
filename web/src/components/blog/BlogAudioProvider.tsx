'use client';

import { useMemo, useRef, useState } from 'react';
import { BlogAudioContext, TRACK, type BlogAudio } from './blogAudio';

/**
 * 블로그 배경음악의 실체. **audio 엘리먼트가 여기 있고, 이 provider 는 layout 이 그린다.**
 * layout 은 블로그 안에서 화면을 옮겨도 안 사라지므로 재생이 끊기지 않는다. 플레이어는
 * 화면만 그리고 여기서 상태를 읽는다.
 *
 * **위키로 나가면 끊긴다.** host 가 달라 브라우저가 문서를 통째로 버린다. 기법으로 넘을 수 없다.
 *
 * 자동 재생하지 않는다. preload 도 걸지 않는다 — 누르기 전에는 1.9MB 를 안 받는다.
 *
 * ponytail: 한 곡 전용이다. 곡이 둘 이상 되면 목록과 곡 이동을 여기에 붙인다.
 */
export function BlogAudioProvider({ children }: { readonly children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState<number>(TRACK.seconds);
  const [volume, setVolume] = useState(0.7);
  const [loop, setLoop] = useState(false);

  /* 매 렌더마다 새 객체를 주면 값이 안 바뀌어도 모든 소비자가 다시 그린다. */
  const value = useMemo<BlogAudio>(() => ({
    playing,
    current,
    duration,
    volume,
    loop,
    readCurrent: () => audioRef.current?.currentTime ?? 0,
    toggle() {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) void audio.play().catch(() => setPlaying(false));
      else audio.pause();
    },
    seek(seconds) {
      const audio = audioRef.current;
      if (!audio) return;
      if (Number.isFinite(audio.duration)) audio.currentTime = seconds;
      setCurrent(seconds);
    },
    changeVolume(next) {
      setVolume(next);
      if (audioRef.current) audioRef.current.volume = next;
    },
    toggleLoop: () => setLoop((on) => !on),
  }), [playing, current, duration, volume, loop]);

  return (
    <BlogAudioContext.Provider value={value}>
      <audio
        ref={audioRef}
        src={TRACK.src}
        preload="none"
        loop={loop}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setCurrent(0)}
      />
      {children}
    </BlogAudioContext.Provider>
  );
}
