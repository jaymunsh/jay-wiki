#!/usr/bin/env node
// 회의실 예약 API 서버.
// 실행: node server.mjs  (PORT 환경 변수가 있으면 그 포트, 없으면 3000)
// node: 내장 모듈만 사용. 외부 패키지는 없음.
//
// 엔드포인트:
//   GET    /rooms                    -> 회의실 목록
//   POST   /reservations             -> {room, from, to, by} 예약 생성 (201 + 예약)
//   GET    /reservations?room=A      -> 특정 방 예약 목록 (room 생략 시 전체)
//   DELETE /reservations/:id         -> 예약 취소 (204, 없으면 404)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const ROOMS = ['A', 'B', 'C'];
const DATA_FILE = path.join(__dirname, 'reservations.json');

// --- 영속 상태 -------------------------------------------------------------
// 서버 시작 시 기존 저장 파일을 읽고, 변경마다 동기적으로 저장한다.
// Node는 단일 스레드이고 fs가 동기이므로 잠금 없이도 손실 업데이트가 없다.
let reservations = [];

function load() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      reservations = parsed.filter(
        (r) => r && typeof r.id === 'string' && r.from && r.to && r.room,
      );
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // 깨진 파일은 초기 상태로 시작하고 새로 작성한다.
      reservations = [];
    }
  }
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(reservations, null, 2));
}

load();

// --- 유효성 검사 ------------------------------------------------------------
// ISO 8601 시각 문자열인지 검사 (날짜 + T + 시각, 선택적으로 초/소수/타임존).
const ISO_8601 =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

function parseIso(value) {
  if (typeof value !== 'string' || !ISO_8601.test(value)) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d;
}

function overlapMs(aFrom, aTo, bFrom, bTo) {
  // 끝점 접촉(한 쪽 to == 다른 쪽 from)은 겹침이 아니다.
  return aFrom < bTo && bFrom < aTo;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let tooLarge = false;
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        tooLarge = true;
        req.destroy();
      }
    });
    req.on('end', () => (tooLarge ? reject(new Error('too large')) : resolve(data)));
    req.on('error', reject);
  });
}

async function handleCreate(req, res) {
  let raw;
  try {
    raw = await readBody(req);
  } catch (err) {
    return sendJson(res, 400, { error: '요구 본문이 너무 깁니다.' });
  }

  let body;
  try {
    body = raw.trim() === '' ? {} : JSON.parse(raw);
  } catch (err) {
    return sendJson(res, 400, { error: '본문이 깨진 JSON입니다.' });
  }

  const { room, from, to, by } = body || {};
  if (!room || !from || !to || !by) {
    return sendJson(res, 400, {
      error: '필수 필드가 누락되었습니다. room, from, to, by가 필요합니다.',
    });
  }

  if (!ROOMS.includes(room)) {
    return sendJson(res, 400, { error: `존재하지 않는 회의실입니다. (A, B, C)` });
  }

  const fromDate = parseIso(from);
  const toDate = parseIso(to);
  if (!fromDate || !toDate) {
    return sendJson(res, 400, { error: 'from, to는 ISO 8601 시각 문자열이어야 합니다.' });
  }

  if (fromDate >= toDate) {
    return sendJson(res, 400, { error: 'from은 to보다 이전이어야 합니다.' });
  }

  const now = new Date();
  if (fromDate < now) {
    return sendJson(res, 400, { error: '예약 시작 시각이 과거입니다.' });
  }

  const conflict = reservations.some((r) => {
    if (r.room !== room) return false;
    return overlapMs(
      fromDate.getTime(),
      toDate.getTime(),
      new Date(r.from).getTime(),
      new Date(r.to).getTime(),
    );
  });
  if (conflict) {
    return sendJson(res, 409, { error: '같은 회의실에서 시간이 겹칩니다.' });
  }

  const reservation = {
    id: randomUUID(),
    room,
    from,
    to,
    by,
    createdAt: new Date().toISOString(),
  };
  reservations.push(reservation);
  save();
  return sendJson(res, 201, reservation);
}

function handleList(req, res, url) {
  const room = url.searchParams.get('room');
  let result = reservations;
  if (room) {
    if (!ROOMS.includes(room)) {
      return sendJson(res, 400, { error: `존재하지 않는 회의실입니다. (A, B, C)` });
    }
    result = reservations.filter((r) => r.room === room);
  }
  return sendJson(res, 200, { count: result.length, reservations: result });
}

function handleDelete(req, res, id) {
  const idx = reservations.findIndex((r) => r.id === id);
  if (idx === -1) {
    return sendJson(res, 404, { error: '해당 예약을 찾을 수 없습니다.' });
  }
  reservations.splice(idx, 1);
  save();
  res.writeHead(204);
  res.end();
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();

  try {
    if (pathname === '/rooms' && method === 'GET') {
      return sendJson(res, 200, { rooms: ROOMS });
    }

    if (pathname === '/reservations' && method === 'POST') {
      return await handleCreate(req, res);
    }

    if (pathname === '/reservations' && method === 'GET') {
      return handleList(req, res, parsed);
    }

    const del = pathname.match(/^\/reservations\/([^/]+)$/);
    if (del && method === 'DELETE') {
      return handleDelete(req, res, decodeURIComponent(del[1]));
    }

    return sendJson(res, 404, { error: '요청한 경로나 메서드를 찾을 수 없습니다.' });
  } catch (err) {
    return sendJson(res, 500, { error: '서버 내부 오류가 발생했습니다.' });
  }
});

server.listen(PORT, () => {
  console.log(`회의실 예약 API 서버 listening on port ${PORT} (rooms: ${ROOMS.join(', ')})`);
  console.log(`데이터 파일: ${DATA_FILE} (저장된 예약 ${reservations.length}건)`);
});
