'use client';

import { useId } from 'react';

/**
 * 요청률 추이 스파크라인. /monitoring 의 '요청 흐름'이 쓴다.
 *
 * 축도 눈금도 없다 — 값은 옆의 숫자가 말하고 이 그림은 모양만 말한다.
 * y 는 0 이 바닥이고 구간 최대값이 천장이다. 위아래 8% 는 선이 잘리지 않게 비워 둔다.
 */
export function Sparkline({
  points,
  label,
  emptyText = '최근 30분 트래픽이 아직 없습니다.',
}: {
  readonly points: readonly number[];
  readonly label: string;
  readonly emptyText?: string;
}) {
  const id = useId().replace(/:/g, '');
  if (points.length < 2) {
    return <div className="operations-plot"><div className="operations-spark-empty">{emptyText}</div></div>;
  }

  const maximum = Math.max(...points, 0.001);
  const coordinates = points.map((point, index) => {
    const x = (index / (points.length - 1)) * 100;
    const y = 100 - (point / maximum) * 84 - 8;
    return `${x},${y}`;
  });

  return (
    <div className="operations-plot">
      <svg className="operations-spark" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={label}>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-2)" stopOpacity=".34" />
            <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M 0,100 L ${coordinates.join(' L ')} L 100,100 Z`} fill={`url(#${id})`} />
        <polyline points={coordinates.join(' ')} fill="none" stroke="var(--accent-2)" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
