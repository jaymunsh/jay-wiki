'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatKoreanTime } from '@/lib/dateTime';

type Drill = {
  readonly kind: string;
  readonly label: string;
  readonly detail: string;
  readonly alerts: string;
  /** 그 규칙이 울리는 데 필요한 요청 수. 1이 아닌 것은 규칙이 단발을 무시하기 때문이다. */
  readonly repeats: number;
};

type View = {
  readonly drills: readonly Drill[];
  readonly recent: { readonly kind: string; readonly label: string; readonly at: string; readonly count: number } | null;
  readonly canRun: boolean;
};

export function AlertDrillPanel() {
  const [view, setView] = useState<View | null>(null);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/bff/alert-drills', { cache: 'no-store' });
      if (!response.ok) throw new Error('드릴 상태를 읽지 못했습니다.');
      setView(await response.json() as View);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '드릴 상태를 읽지 못했습니다.');
    }
  }, []);

  // effect 본문에서 바로 부르면 setState 가 동기로 걸려 lint 가 막는다.
  // HPA 패널이 쓰는 것과 같은 방식으로 한 틱 미룬다.
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function run(kind: string) {
    setPending(kind);
    setError('');
    try {
      // 오류 응답이 곧 성공이다. 이 드릴들은 500·400·403 을 내는 것이 목적이라
      // response.ok 로 판정하면 성공한 드릴을 실패로 읽는다.
      await fetch(`/api/bff/admin/alert-drills/${kind}`, { method: 'POST' });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '드릴을 돌리지 못했습니다.');
    } finally {
      setPending('');
    }
  }

  return (
    <section className="alert-drill" aria-labelledby="alert-drill-title">
      <header className="alert-drill-head">
        <div>
          <span>LIVE ALERT DRILL</span>
          <h3 id="alert-drill-title">오류를 일부러 내고 알림이 오는지 본다</h3>
        </div>
        {view?.recent ? (
          <p className="alert-drill-recent">
            마지막 <strong>{view.recent.label}</strong>
            {view.recent.count > 1 && <> · {view.recent.count}회 연속</>}
            {' · '}<time dateTime={view.recent.at}>{formatKoreanTime(view.recent.at)}</time>
          </p>
        ) : <p className="alert-drill-recent">아직 돌린 적이 없습니다.</p>}
      </header>

      <p className="alert-drill-note">
        {view?.canRun
          ? '실행하면 실제로 오류가 나고 텔레그램으로 알림이 갑니다. 되돌릴 수 없습니다.'
          : '실행은 관리자만 할 수 있습니다. 어떤 오류가 어떤 규칙을 울리는지는 아래에서 볼 수 있습니다.'}
      </p>

      <ul className="alert-drill-list">
        {(view?.drills ?? []).map((drill) => (
          <li key={drill.kind}>
            <div>
              <strong>{drill.label}</strong>
              <p>{drill.detail}</p>
              <span className="alert-drill-rule">
                {drill.alerts}
                {drill.repeats > 1 && <b> · {drill.repeats}회 필요</b>}
              </span>
            </div>
            {view?.canRun && (
              <button disabled={pending !== ''} onClick={() => void run(drill.kind)} type="button">
                {pending === drill.kind ? '실행 중' : '실행'}
              </button>
            )}
          </li>
        ))}
      </ul>

      {error && <p className="alert-drill-error">{error}</p>}
    </section>
  );
}
