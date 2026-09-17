'use client';

import { useEffect, useRef, useState } from 'react';

export type ScenarioRailItem = { readonly id: string; readonly label: string };

/**
 * 절 이동 줄. 링크 모음이 아니라 어디까지 읽었는지 보고하는 계기다.
 *
 * 전에는 카드 안에 링크 일곱을 담아 뒀는데, 본문 카드와 테두리·배경이 같아서
 * 내비게이션이 아니라 절 하나처럼 보였고, 3,000px 넘는 페이지에 sticky 로 붙어
 * 다니면서 "지금 어디"는 한 번도 알려주지 않았다. 있는 상태가 hover 뿐이었다.
 *
 * 이 사이트는 상태를 화면에서 읽게 만드는 것이 주제다. 같은 규칙을 내비에도 쓴다.
 */
export function ScenarioStoryRail({ items }: { readonly items: readonly ScenarioRailItem[] }) {
  const [active, setActive] = useState(0);
  // 방금 누른 절을 잠깐 지킨다. 페이지 끝 근처 절은 눌러도 스크롤이 바닥에서 멈춰서,
  // 아래 "바닥이면 마지막 절" 규칙이 누른 절을 곧바로 덮어썼다.
  const heldUntil = useRef(0);
  const key = items.map((item) => item.id).join(',');

  useEffect(() => {
    const ids = key.split(',');
    let frame = 0;

    const read = () => {
      frame = 0;
      if (performance.now() < heldUntil.current) return;
      /**
       * 기준선을 헤더 바로 아래(130px)에 두면 페이지가 바닥에서 멈출 때 끝쪽 절들이
       * 선을 못 넘어 한 번도 현재가 되지 못한다. 스물두 편에서 그런 절이 스물여섯 개였다.
       * 화면 40% 까지 내리면 0이 된다 — 마지막 절은 아래 바닥 규칙이 맡는다.
       */
      const LINE = Math.max(130, window.innerHeight * 0.4);
      let next = 0;
      ids.forEach((id, index) => {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= LINE) next = index;
      });
      // 맨 아래에 닿으면 마지막 절이 짧아 기준선을 못 넘어도 그걸 현재로 친다.
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) next = ids.length - 1;
      setActive(next);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };

    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [key]);

  return (
    <nav aria-label="이 사례의 구성" className="scenario-story-rail">
      {items.map((item, index) => (
        <a
          aria-current={index === active ? 'true' : undefined}
          href={`#${item.id}`}
          key={item.id}
          onClick={() => {
            setActive(index);
            heldUntil.current = performance.now() + 700;
          }}
        >
          {item.label}
        </a>
      ))}
      {/* 지나온 만큼 차오른다. 이 줄이 목차이자 진행 표시가 된다. */}
      <span aria-hidden="true" className="scenario-story-rail-track">
        <i style={{ width: `${((active + 1) / items.length) * 100}%` }} />
      </span>
    </nav>
  );
}
