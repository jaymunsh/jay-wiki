'use client';

import { Check, EyeOff, MoreVertical, Music, Pause, Play, Repeat, Volume2, VolumeX } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import { TRACK, useBlogAudio, useDismiss } from './blogAudio';

/**
 * 화면 우측 아래에 떠 있는 음악 플레이어. **layout 이 그린다** — 레일에 두면 화면을 옮길
 * 때마다 새로 태어나고, audio 도 조작 상태도 같이 버려진다.
 *
 * 원반이 판의 왼쪽 모서리를 걸치고, 제목 옆 점 셋에 반복과 숨기기가 들어 있다.
 * 숨기면 원반만 남는다 — 재생 중이면 계속 도니까 어디로 갔는지 알 수 있다.
 */
export function BlogPlayer() {
  const audio = useBlogAudio();
  const volumeRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  /** 처음에는 화면 폭과 관계없이 작은 음표 아이콘만 보인다. 누르면 전체 판을 연다. */
  const [opened, setOpened] = useState(false);
  const closeVolume = useCallback(() => setVolumeOpen(false), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useDismiss(volumeOpen, volumeRef, closeVolume);
  useDismiss(menuOpen, menuRef, closeMenu);
  /**
   * 원반이 어느 각도에서 시작할지. **처음 그릴 때 한 번만 읽는다.**
   * 매 프레임 다시 넣으면 그때마다 애니메이션이 되감긴다.
   * current 가 아니라 readCurrent 를 쓴다 — 상태 값은 최대 250ms 낡아 그만큼 뒤로 튄다.
   */
  const [spinFrom] = useState(() => audio?.readCurrent() ?? 0);
  if (!audio) return null;

  const hidden = !opened;

  const { playing, current, duration, volume, loop } = audio;
  const muted = volume === 0;
  /* 지나온 구간만 강조색으로 칠한다. range 는 진행률을 스스로 안 그린다. */
  const progress = duration > 0 ? (current / duration) * 100 : 0;

  /* 원반도 누르면 재생·정지한다. 가장 큰 과녁이라 여기부터 누르게 된다. */
  const disc = (
    <button
      className="blog-player-disc"
      type="button"
      data-spin={playing}
      style={{ '--spin-from': `-${spinFrom.toFixed(2)}s` } as React.CSSProperties}
      onClick={audio.toggle}
      aria-label={playing ? `${TRACK.title} 일시정지` : `${TRACK.title} 재생`}
    >
      <Image src={TRACK.album} alt="" width={55} height={55} />
      <i aria-hidden />
    </button>
  );

  /*
   * 숨기면 음표 하나만 남긴다. 원반을 그대로 두면 숨긴 것 같지가 않다.
   * 자리는 그대로 우측 아래다 — 레일 안에 두면 스크롤에 밀리고 모바일에서는 드로어를 열어야 보인다.
   */
  if (hidden) {
    return (
      <button
        className="blog-player blog-player--peek"
        type="button"
        data-playing={playing}
        onClick={() => setOpened(true)}
        aria-label={`${TRACK.title} 플레이어 열기`}
        title={playing ? `${TRACK.title} 재생 중 · 눌러서 열기` : `${TRACK.title} 플레이어 열기`}
      >
        <Music aria-hidden />
      </button>
    );
  }

  return (
    <div className="blog-player">
      <div className="blog-player-front">
        <div className="blog-player-name">
          <strong>{TRACK.title}</strong>

          <div className="blog-player-menu" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="플레이어 설정"
              aria-expanded={menuOpen}
            >
              <MoreVertical aria-hidden />
            </button>
            {menuOpen && (
              <div className="blog-player-sheet" role="menu">
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={loop}
                  onClick={audio.toggleLoop}
                >
                  <Repeat aria-hidden />
                  <span>무한 반복</span>
                  {loop && <Check className="tick" aria-hidden />}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setOpened(false);
                  }}
                >
                  <EyeOff aria-hidden />
                  <span>숨기기</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="blog-player-keys">
          <button
            className="blog-player-toggle"
            type="button"
            onClick={audio.toggle}
            aria-label={playing ? `${TRACK.title} 일시정지` : `${TRACK.title} 재생`}
          >
            {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
          </button>
          <input
            className="blog-player-seek"
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={current}
            onChange={(event) => audio.seek(Number(event.target.value))}
            style={{ '--played': `${progress}%` } as React.CSSProperties}
            aria-label={`${TRACK.title} 재생 위치`}
          />

          <div className="blog-player-vol" ref={volumeRef}>
            <button
              type="button"
              onClick={() => setVolumeOpen((open) => !open)}
              aria-label="음량"
              aria-expanded={volumeOpen}
            >
              {muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
            </button>
            {volumeOpen && (
              <div className="blog-player-pop" role="group" aria-label="음량 조절">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(event) => audio.changeVolume(Number(event.target.value))}
                  style={{ '--played': `${volume * 100}%` } as React.CSSProperties}
                  aria-label="음량"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {disc}
    </div>
  );
}
