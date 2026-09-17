// 운영 클러스터 안의 내부 문에 붙는다. publish-blog-post.mjs 와 blog-assets.mjs 가 같이 쓴다.
//
// 왜 ssh 인가: 내부 문은 클러스터 밖에 열려 있지 않다. 토큰을 이 맥에 복사해 두면 노트북이
// 관리자 권한과 맞먹는 열쇠를 들고 다니게 되므로, ssh 로 들어가 그 자리에서 읽고 나온다.
// 토큰은 파일로 안 남기고 이 프로세스의 메모리에만 둔다.
import { execFileSync, spawn } from 'node:child_process';

const SSH_HOST = process.env.JAYWIKI_SSH_HOST ?? 'miniPC';
const PORT = Number(process.env.JAYWIKI_TUNNEL_PORT ?? 18080);

export const BASE = `http://127.0.0.1:${PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForTunnel(tunnel) {
  for (let i = 0; i < 40; i += 1) {
    // ssh 가 이미 죽었으면 20초를 더 기다릴 이유가 없다. 그리고 그 stderr 가 진짜 이유를
    // 들고 있다 -- 앞 실행의 터널이 포트를 아직 잡고 있으면 "Address already in use" 다.
    // 그걸 안 보여 주면 ssh 나 cloudflared 를 헛짚게 된다(2026-09-02 에 그랬다).
    if (tunnel.exitCode !== null) {
      throw new Error(`터널이 바로 죽었다 (ssh 종료 ${tunnel.exitCode}).\n${tunnel.stderrText.trim()}\n`
        + `포트가 물려 있으면: lsof -ti :${PORT} | xargs kill`);
    }
    try {
      const r = await fetch(`${BASE}/actuator/health`);
      if (r.ok) return;
    } catch {
      // 아직 안 열렸다
    }
    await sleep(500);
  }
  throw new Error(`터널이 안 열린다: ${BASE}. ssh ${SSH_HOST} 가 되는지 먼저 본다.\n`
    + '안 되면 cloudflared access login https://ssh.leneu.cloud 를 먼저 친다.');
}

/**
 * 터널을 열고 토큰을 읽어 fn 에 넘긴다. 끝나면 터널을 닫는다.
 * fn(token) 안에서는 BASE 로 내부 경로를 부르면 된다.
 */
export async function withProdTunnel(fn) {
  const tunnel = spawn('ssh', [
    '-o', 'ExitOnForwardFailure=yes',
    '-L', `${PORT}:localhost:${PORT}`,
    SSH_HOST,
    `kubectl -n backend port-forward svc/jaywiki ${PORT}:8080`,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  tunnel.stderrText = '';
  tunnel.stderr.on('data', (chunk) => { tunnel.stderrText += chunk; });
  const stop = () => { try { tunnel.kill(); } catch { /* 이미 죽었다 */ } };
  process.on('exit', stop);

  try {
    await waitForTunnel(tunnel);
    const token = execFileSync('ssh', [
      '-T', SSH_HOST,
      'kubectl -n backend get secret jaywiki-secrets -o jsonpath={.data.APP_CONTENT_SYNC_TOKEN} | base64 -d',
    ], { encoding: 'utf8' }).trim();
    if (!token) throw new Error('내부 싱크 토큰을 못 읽었다.');
    return await fn(token);
  } finally {
    stop();
  }
}
