// server.mjs — 회의실 예약 API 서버 (v0.5-character-1 / BUILD-01)
// node 내장 모듈만 사용. 외부 패키지 없음.
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { URL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';

const __dirname = dirname(new URL(import.meta.url).pathname);
const DATA_FILE = join(__dirname, 'reservations.json');
const ROOMS = ['A', 'B', 'C'];
const DEFAULT_PORT = 3000;

// --- 영속화: 서버 시작 시 기존 데이터를 로드한다. ---
let reservations = [];

function loadData() {
  try {
    const raw = readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) reservations = parsed;
  } catch (err) {
    // 파일이 없거나 깨져 있어도 서버는 시작한다(빈 목록).
    reservations = [];
  }
}

// 동기 저장: 읽기-수정-쓰기 간 이벤트 루프 교차로 인한 데이터 손실을 막기 위함.
function saveData() {
  try {
    writeFileSync(DATA_FILE, JSON.stringify(reservations, null, 2), 'utf8');
  } catch (err) {
    // 저장 실패는 500으로 노출한다.
    throw err;
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function sendError(res, status, message, reason) {
  sendJson(res, status, { error: message, reason });
}

function parseIso(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) return null;
  return t;
}

// 반개방구간 [from, to) 기준 겹침 판단. 14:00 종료 / 14:00 시작은 겹치지 않는다.
function overlaps(aFrom, aTo, bFrom, bTo) {
  return aFrom < bTo && bFrom < aTo;
}

async function handleCreate(body, res) {
  let data;
  try {
    data = JSON.parse(body);
  } catch (err) {
    return sendError(res, 400, 'invalid_json', '요청 본문이 유효한 JSON이 아닙니다.');
  }

  const { room, from, to, by } = data || {};
  if (!room || !from || !to || !by) {
    return sendError(res, 400, 'missing_fields', '필수 필드(room, from, to, by)가 필요합니다.');
  }
  if (!ROOMS.includes(room)) {
    return sendError(res, 400, 'invalid_room', `존재하지 않는 회의실입니다. 가능한 방: ${ROOMS.join(', ')}`);
  }

  const fromD = parseIso(from);
  const toD = parseIso(to);
  if (!fromD || !toD) {
    return sendError(res, 400, 'invalid_datetime', 'from, to는 ISO 8601 시각 문자열이어야 합니다.');
  }
  if (!(fromD < toD)) {
    return sendError(res, 400, 'invalid_range', 'from은 to보다 빠른 시각이어야 합니다.');
  }
  const now = new Date();
  if (fromD < now) {
    return sendError(res, 400, 'past_time', '예약 시작 시각(from)은 현재 이후여야 합니다.');
  }

  const conflict = reservations.some(
    (r) => r.room === room && overlaps(fromD, toD, new Date(r.from), new Date(r.to))
  );
  if (conflict) {
    return sendError(res, 409, 'conflict', '같은 회의실에서 시간이 겹치는 예약이 있습니다.');
  }

  const record = {
    id: randomUUID(),
    room,
    from: fromD.toISOString(),
    to: toD.toISOString(),
    by,
  };
  reservations.push(record);
  saveData();
  return sendJson(res, 201, record);
}

function handleList(query, res) {
  const room = query.get('room');
  let list = reservations;
  if (room) list = reservations.filter((r) => r.room === room);
  return sendJson(res, 200, { reservations: list });
}

function handleDelete(id, res) {
  const idx = reservations.findIndex((r) => r.id === id);
  if (idx === -1) {
    return sendError(res, 404, 'not_found', '해 예약을 찾을 수 없습니다.');
  }
  reservations.splice(idx, 1);
  saveData();
  res.writeHead(204);
  res.end();
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/rooms') {
    return sendJson(res, 200, { rooms: ROOMS });
  }

  if (pathname === '/reservations') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 1e6) req.destroy();
      });
      req.on('end', () => {
        handleCreate(body, res).catch((err) => sendError(res, 500, 'internal', '저장에 실패했습니다.'));
      });
      req.on('error', () => sendError(res, 400, 'bad_request', 'RequestBody를 읽을 수 없습니다.'));
      return;
    }
    if (req.method === 'GET') {
      handleList(url.searchParams, res);
      return;
    }
  }

  if (req.method === 'DELETE' && pathname.startsWith('/reservations/')) {
    const id = decodeURIComponent(pathname.slice('/reservations/'.length));
    if (id) {
      handleDelete(id, res);
      return;
    }
  }

  sendError(res, 404, 'not_found', '요청한 경로/메서드를 찾을 수 없습니다.');
});

loadData();
const port = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;
server.listen(port, () => {
  console.log(`meeting-room-reservation API listening on port ${port}`);
});
