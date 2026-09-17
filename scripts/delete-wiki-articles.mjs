#!/usr/bin/env node
// 위키 글과 탭을 관리자 API 로 지운다. 기본은 dry-run.
// SQL 로 직접 지우지 않는 이유: ArticleService.delete 가 ArticleIndexEvent.DELETE 를
// 발행해 OpenSearch 색인까지 정리한다. SQL 은 색인에 지운 글을 남긴다.
//
//   scripts/delete-wiki-articles.sh a-slug b-slug tab:ops
//   scripts/delete-wiki-articles.sh --write a-slug tab:ops
import { cloudflareAccessHeaders } from './lib/cloudflare-access.mjs';

const API_BASE = (process.env.JAYWIKI_API_BASE ?? 'http://localhost:8080').replace(/\/+$/, '');
const ACCESS_HEADERS = cloudflareAccessHeaders(API_BASE);
const USERNAME = process.env.JAYWIKI_ADMIN_USERNAME ?? 'admin';
const PASSWORD = process.env.JAYWIKI_ADMIN_PASSWORD;
const OTP = process.env.JAYWIKI_ADMIN_OTP;
const WRITE = process.argv.includes('--write');
const targets = process.argv.slice(2).filter((a) => a !== '--write');

if (targets.length === 0) {
  console.error('지울 대상을 인자로 준다. slug 또는 tab:tabId');
  process.exit(1);
}

let cookie = '';

function apiUrl(path) {
  if (API_BASE.endsWith('/api/bff') && path.startsWith('/api/')) {
    return `${API_BASE}/${path.slice('/api/'.length)}`;
  }
  return `${API_BASE}${path}`;
}

async function api(pathname, init = {}) {
  const res = await fetch(apiUrl(pathname), {
    ...init,
    headers: { 'Content-Type': 'application/json', Origin: new URL(API_BASE).origin, 'X-Jaywiki-Request': 'server', ...ACCESS_HEADERS, ...(cookie ? { cookie } : {}), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${init.method ?? 'GET'} ${pathname} -> ${res.status} ${body}`);
  }
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  return res.status === 204 ? null : res.json().catch(() => null);
}

async function login() {
  if (!PASSWORD) throw new Error('JAYWIKI_ADMIN_PASSWORD 가 없다. scripts/delete-wiki-articles.sh 로 실행한다.');
  if (!OTP) throw new Error('TOTP 가 없다. scripts/delete-wiki-articles.sh 로 실행한다.');
  try {
    await api('/api/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ username: USERNAME, password: PASSWORD, otp: OTP }),
    });
  } catch (e) {
    throw new Error(`관리자 로그인 실패: ${e.message}`);
  }
  if (!cookie) throw new Error('관리자 로그인 후 Set-Cookie 를 받지 못했다. 계정이 잠겼는지 확인한다.');
}

async function main() {
  if (!WRITE) {
    for (const t of targets) console.log(`would delete ${t}`);
    console.log(`\n${targets.length}건. --write 를 붙이면 실제로 지운다.`);
    return;
  }

  await login();
  for (const target of targets) {
    const isTab = target.startsWith('tab:');
    const pathname = isTab
      ? `/api/tabs/${encodeURIComponent(target.slice(4))}`
      : `/api/articles/${encodeURIComponent(target)}`;
    await api(pathname, { method: 'DELETE' });
    console.log(`deleted ${target}`);
  }
  console.log(`\n${targets.length}건 지웠다.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
