'use client';

import { useState } from 'react';

/**
 * 로컬 전용 글 반영판. 코드가 안 바뀌고 글만 고쳤을 때, 배포 한 판을 다 돌리지 않고
 * 운영의 글만 갱신한다. 서버 배포(develop → main)와는 별개다.
 *
 * 화면의 주제는 «방향» 이다. 이 판의 사고는 늘 «어느 쪽이 어느 쪽을 덮는지 몰라서» 난다.
 * 그래서 동작마다 화살표와 경로를 먼저 적고, 색을 겹쳐 둔다.
 *
 * **블로그 버튼은 blog-sync.mjs 를 부른다** (2026-09-03부터). 그 전에는 publish-blog-drafts.mjs
 * 를 불러서 TOTP 를 묻고 새 그림을 못 올렸고, 그래서 칸을 통째로 접어 두고 터미널로 보냈다.
 * 지금은 이 판에서 눌러도 같은 길이다 -- ssh 로 내부 문을 쓰므로 TOTP 칸이 필요 없다.
 *
 * 블로그는 «맞추기» 다. 한 방향이 아니라 편마다 방향을 정하고, 운영이 더 새것이면 내린다 --
 * 관리 화면에서 고친 글을 오래된 초안이 덮는 사고가 그렇게 막힌다. 그래서 누르기 전에
 * «무엇이 어느 쪽으로 갈지 본다» 를 위에 두었다.
 *
 * 개발 서버에서만 열린다. /api/sync 가 운영 빌드에서 404 라 버튼을 눌러도 아무 일도 안 난다.
 */
type Direction = 'up' | 'down' | 'both' | 'read';

type Action = {
  id: string;
  label: string;
  path: string;
  detail: string;
  dir: Direction;
  /** 운영에 쓰는지가 아니라 «TOTP 를 묻는지» 다. ssh 로 가는 블로그 쪽은 쓰면서도 안 묻는다. */
  otp: boolean;
};

const ARROW: Record<Direction, string> = { up: '↑', down: '↓', both: '↕', read: '·' };
const DIR_TEXT: Record<Direction, string> = {
  up: '운영에 쓴다',
  down: '이 맥에 받는다',
  both: '편마다 방향을 정한다',
  read: '읽기만 한다',
};

const WIKI: Action[] = [
  {
    id: 'sync-wiki',
    label: '위키 내려받기',
    path: '시드 파일 → 이 맥',
    detail: '저장소의 시드를 로컬 DB 에 다시 심는다. 운영은 건드리지 않는다.',
    dir: 'down',
    otp: false,
  },
  {
    id: 'publish-wiki',
    label: '위키 반영',
    path: '이 맥 → 운영',
    detail: '로컬 시드를 운영에 올린다. 새 이미지가 있으면 막고 배포를 시킨다.',
    dir: 'up',
    otp: true,
  },
];

const CHECK: Action = {
  id: 'check',
  label: '무엇이 다른지 본다',
  path: '이 맥 ↔ 운영',
  detail: '양쪽을 대조만 한다. 여기서 시작하면 아래 중 무엇을 누를지 정해진다. 30초쯤 걸린다.',
  dir: 'read',
  otp: false,
};

const BOTH: Action[] = [
  {
    id: 'publish-all',
    label: '글 전체 반영',
    path: '이 맥 → 운영',
    detail: '위키를 올리고 이어서 블로그를 올린다. 블로그 몫은 접어 둔 옛 경로라, 블로그는 위 칸에서 따로 하는 편이 낫다.',
    dir: 'up',
    otp: true,
  },
];

const BLOG: Action[] = [
  {
    id: 'blog-diff',
    label: '무엇이 어느 쪽으로 갈지 본다',
    path: '이 맥 ↔ 운영',
    detail: '편마다 방향만 정해서 보여 준다. 아무것도 안 옮긴다. 여기서 목록을 보고 아래를 누른다.',
    dir: 'read',
    otp: false,
  },
  {
    id: 'blog-match',
    label: '블로그 맞추기',
    path: '이 맥 ↕ 운영',
    detail:
      '편마다 방향을 정해 옮긴다. 운영이 더 새것이면 올리지 않고 내린다 — 관리 화면에서 고친 글을 지킨다. ' +
      '그림도 같이 옮기고, 덮이는 글의 운영 사본을 먼저 받아 둔다. TOTP 를 안 쓴다.',
    dir: 'both',
    otp: false,
  },
];

const BLOG_OLD: Action[] = [
  {
    id: 'sync-blog',
    label: '블로그 내려받기',
    path: '운영 → 이 맥',
    detail: '운영 글을 로컬 DB 와 저장소 사본으로 받고 id 까지 맞춘다.',
    dir: 'down',
    otp: false,
  },
  {
    id: 'publish-blog',
    label: '블로그 반영',
    path: '이 맥 → 운영',
    detail: '초안 전체를 운영에 올린다. TOTP 를 묻고 새 그림은 못 올린다.',
    dir: 'up',
    otp: true,
  },
];

const BLOG_COMMANDS: [string, string][] = [
  ['어느 방향으로 갈지 먼저 본다', 'node scripts/blog-sync.mjs'],
  ['실제로 맞춘다', 'node scripts/blog-sync.mjs --write'],
  ['한 편만 올린다', 'node scripts/publish-blog-post.mjs posts/jay-blog/drafts/<slug>.md --write'],
  ['그림이 제자리에 있는지 본다', 'node scripts/blog-assets.mjs'],
];

const BLOG_RULES: [string, string][] = [
  ['초안만 있다', '↑ 올린다'],
  ['운영에만 있다', '↓ 내린다'],
  ['본문이 같다', '그대로 둔다'],
  ['본문이 다르고 운영이 더 최신', '↓ 내린다'],
  ['본문이 다르고 그 외', '↑ 올린다'],
];

export default function SyncConsole() {
  const [otp, setOtp] = useState('');
  const [running, setRunning] = useState('');
  const [log, setLog] = useState('');
  const [folded, setFolded] = useState(false);
  const [last, setLast] = useState('');

  async function runAction(action: Action) {
    if (action.otp && !/^\d{6}$/.test(otp)) {
      setLog('운영에 쓰려면 TOTP 6자리가 필요하다. 아래 칸에 넣고 다시 누른다.');
      return;
    }
    setRunning(action.id);
    setLast(action.label);
    setFolded(false);
    setLog(`$ node scripts/content-ops.mjs ${action.id}\n`);
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: action.id, otp: action.otp ? otp : undefined }),
      });
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        setLog((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (error) {
      setLog((prev) => `${prev}\n끊겼다: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRunning('');
      if (action.otp) setOtp('');
    }
  }

  const row = (action: Action) => (
    <ActionRow key={action.id} action={action} running={running} onRun={runAction} />
  );

  return (
    <main className="sync-page" data-dock={folded ? 'folded' : 'open'}>
      <header className="sync-head">
        <h1>글 반영</h1>
        <p>
          이 맥과 운영 사이에서 <strong>글만</strong> 옮긴다. 서버 배포는 여기가 아니라{' '}
          <code>develop</code> → <code>main</code> 머지다. 이 판은 개발 서버에서만 열린다.
        </p>
      </header>

      <div className="sync-start">{row(CHECK)}</div>

      <section className="sync-sec">
        <div className="sync-sec-head">
          <h2>블로그</h2>
          <span>한 방향이 아니라 맞추기다</span>
        </div>
        {BLOG.map(row)}
        <div className="sync-cmd-card">
          <p className="sync-cmd-lead">
            <strong>방향은 초안 머리말의 <code>updatedAt</code> 하나로 갈린다.</strong> 그 값은
            「이 초안이 운영과 마지막으로 맞춰진 시각」이라, 운영이 더 새 값을 들고 있으면 그 사이
            관리 화면에서 고쳤다는 뜻이라 올리지 않고 내린다.
          </p>
          <div className="sync-rules-wrap">
          <table className="sync-rules">
            <thead>
              <tr><th>글의 상태</th><th>방향</th></tr>
            </thead>
            <tbody>
              {BLOG_RULES.map(([state, dir]) => (
                <tr key={state}><td>{state}</td><td>{dir}</td></tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
        <details className="sync-old">
          <summary>터미널에서 같은 일을 하는 명령</summary>
          <dl className="sync-cmd-card" style={{ border: 0, background: 'transparent' }}>
            {BLOG_COMMANDS.map(([label, command]) => (
              <div className="sync-cmd" key={command}>
                <dt>{label}</dt>
                <dd><code>{command}</code></dd>
              </div>
            ))}
          </dl>
        </details>
        <details className="sync-old">
          <summary>이 판의 옛 블로그 버튼 — TOTP 를 묻고 새 그림을 못 올린다</summary>
          <div>{BLOG_OLD.map(row)}</div>
        </details>
      </section>

      <section className="sync-sec">
        <div className="sync-sec-head">
          <h2>위키</h2>
          <span>이 판이 정본이다</span>
        </div>
        {WIKI.map(row)}
      </section>

      <section className="sync-sec">
        <div className="sync-sec-head">
          <h2>한 번에</h2>
          <span>위키 + 블로그</span>
        </div>
        {BOTH.map(row)}
      </section>

      <div className="sync-otp">
        <label htmlFor="sync-otp-input">TOTP</label>
        <input
          id="sync-otp-input"
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="off"
          placeholder="6자리"
        />
        <span>
          위키와 접어 둔 옛 블로그 버튼에만 필요하다. 블로그 맞추기는 ssh 로 가므로 안 묻는다.
          쓰고 나면 지운다 — 비밀번호는 Keychain 에서 그 순간에만 읽는다
        </span>
      </div>

      {/* 처음부터 자리를 잡고 있어야 «결과가 어디에 나오는지»를 누르기 전에 안다. */}
      <section className="sync-dock" data-busy={running !== ''} aria-label="실행 로그">
        <div className="sync-dock-bar">
          <strong>실행 로그</strong>
          <span className="sync-dock-state">
            {running ? `${last} · 도는 중` : last ? `${last} · 끝났다` : '아직 실행한 것이 없다'}
          </span>
          <span className="sync-spacer" />
          <button type="button" onClick={() => setFolded((v) => !v)} aria-expanded={!folded}>
            {folded ? '펼치기' : '접기'}
          </button>
          {/* 도는 중에 치우면 남은 출력을 못 본다. 끝난 뒤에만 치울 수 있다. */}
          <button type="button" onClick={() => { setLog(''); setLast(''); }} disabled={running !== '' || !log}>
            치우기
          </button>
        </div>
        {!folded && (
          <div className="sync-dock-inner">
            <pre className="sync-log" aria-live="polite">
              {log || '위에서 하나를 누르면 그 명령의 출력이 여기에 그대로 흐른다.'}
            </pre>
          </div>
        )}
      </section>
    </main>
  );
}

function ActionRow({
  action,
  running,
  onRun,
}: {
  action: Action;
  running: string;
  onRun: (action: Action) => void;
}) {
  const busy = running === action.id;
  return (
    <button
      type="button"
      className="sync-row"
      data-dir={action.dir}
      data-busy={busy}
      onClick={() => onRun(action)}
      disabled={running !== ''}
    >
      <span className="sync-arrow" aria-hidden="true">{ARROW[action.dir]}</span>
      <span>
        <span className="sync-row-title">{busy ? `${action.label}… 도는 중` : action.label}</span>
        <span className="sync-row-path">{action.path} · {DIR_TEXT[action.dir]}</span>
        <span className="sync-row-detail">{action.detail}</span>
      </span>
    </button>
  );
}
