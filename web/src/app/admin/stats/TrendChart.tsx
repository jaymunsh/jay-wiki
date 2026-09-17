'use client';

import { useState } from 'react';
import type { AnalyticsReport } from '@/lib/blogAdmin';

export default function TrendChart({ daily }: { daily: AnalyticsReport['daily'] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const width = 640, height = 250, left = 48, right = 18, top = 18, bottom = 32;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const peak = Math.max(1, ...daily.map(d => Math.max(d.views, d.sessions)));
  const step = Math.max(1, Math.ceil(peak / 4));
  const maximum = step * 4;
  const x = (i: number) => left + i / Math.max(1, daily.length - 1) * plotWidth;
  const y = (value: number) => top + (1 - value / maximum) * plotHeight;
  const points = (metric: 'views' | 'sessions') => daily.map((d, i) => `${x(i)},${y(d[metric])}`).join(' ');
  const index = selected ?? daily.length - 1;
  const current = daily[index];
  if (!current) return null;
  const ticks = [...new Set(Array.from({ length: 4 }, (_, i) => Math.round(i * (daily.length - 1) / 3)))];
  return <div className="stats-trend">
    <div className="stats-trend-readout" aria-live="polite"><time>{current.date}</time><span><i className="stats-dot"/>조회 <b>{current.views.toLocaleString('ko-KR')}</b></span><span><i className="stats-dot visits"/>방문 <b>{current.sessions.toLocaleString('ko-KR')}</b></span></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${daily.length}일간 조회와 방문 꺾은선그래프. 아래 날짜 선택과 날짜별 표에서 정확한 수치를 확인할 수 있습니다.`}
      onPointerMove={event => { const rect = event.currentTarget.getBoundingClientRect(); const position = (event.clientX - rect.left) / rect.width * width; setSelected(Math.max(0, Math.min(daily.length - 1, Math.round((position - left) / plotWidth * (daily.length - 1))))); }}>
      {[0,1,2,3,4].map(i => <g key={i}><line className="stats-trend-grid" x1={left} x2={width-right} y1={y(i*step)} y2={y(i*step)}/><text x={left-10} y={y(i*step)+4} textAnchor="end">{(i*step).toLocaleString('ko-KR')}</text></g>)}
      <polygon points={`${left},${y(0)} ${points('views')} ${x(daily.length-1)},${y(0)}`} fill="var(--stats-accent)" opacity=".07"/>
      <polyline points={points('views')} className="stats-trend-line" stroke="var(--stats-accent)"/>
      <polyline points={points('sessions')} className="stats-trend-line" stroke="var(--stats-teal)" strokeDasharray="5 4"/>
      {ticks.map(i => <text key={i} x={x(i)} y={height-7} textAnchor={i===0?'start':i===daily.length-1?'end':'middle'}>{daily[i].date.slice(5).replace('-','/')}</text>)}
      <line x1={x(index)} x2={x(index)} y1={top} y2={y(0)} className="stats-trend-cursor"/>
      <circle cx={x(index)} cy={y(current.views)} r="4" fill="var(--stats-accent)"/>
      <circle cx={x(index)} cy={y(current.sessions)} r="4" fill="var(--stats-teal)"/>
    </svg>
    <label className="stats-trend-selector">날짜 선택<input type="range" min="0" max={daily.length-1} value={index} onChange={e=>setSelected(Number(e.target.value))} aria-valuetext={`${current.date}, 조회 ${current.views}회, 방문 ${current.sessions}회`}/></label>
    <p className="stats-trend-hint">일별 추이 · 그래프를 가리키거나 날짜 선택을 움직여 수치를 확인하세요.</p>
  </div>;
}
