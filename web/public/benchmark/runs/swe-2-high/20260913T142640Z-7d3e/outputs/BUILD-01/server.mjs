// 회의실 예약 API 서버 — node: 내장 모듈만 사용, 외부 패키지 없음.
// 실행: node server.mjs  (PORT 환경 변수로 포트 변경, 기본 3000)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOMS = ['A', 'B', 'C'];
const STORE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'reservations.json');

// ---------- 영속 저장소 ----------
// 단일 프로세스 서버이므로 동기 쓰기로 원자적 갱신을 보장한다.
function loadReservations() {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e; // 손상된 저장 파일은 무시하지 않고 시작 실패로 드러낸다.
  }
}

function saveReservations(list) {
  const tmp = STORE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, STORE_PATH); // rename은 원자적 — 도중 종료 시 이전 파일 보존
}

let reservations = loadReservations();

// ---------- 유효성 ----------
function parseIso(s) {
  if (typeof s !== 'string') return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

function overlaps(aFrom, aTo, bFrom, bTo) {
  // 반열린 구간 [from, to): 끝과 시작이 맞닿는 예약은 겹치지 않는다.
  return aFrom < bTo && aTo > bFrom;
}

function validateReservation(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return 'body must be a JSON object';
  }
  const { room, from, to, by } = body;
  for (const [k, v] of Object.entries({ room, from, to, by })) {
    if (v === undefined || v === null || v === '') return `missing required field: ${k}`;
  }
  if (!ROOMS.includes(room)) return `unknown room: ${JSON.stringify(room)} (allowed: ${ROOMS.join(', ')})`;
  const fromT = parseIso(from);
  const toT = parseIso(to);
  if (fromT === null) return 'invalid "from": expected ISO 8601 datetime';
  if (toT === null) return 'invalid "to": expected ISO 8601 datetime';
  if (fromT >= toT) return '"from" must be earlier than "to"';
  if (fromT < Date.now()) return '"from" must not be in the past';
  return null;
}

// ---------- 응답 헬퍼 ----------
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 1_000_000) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ---------- 서버 ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  try {
    if (req.method === 'GET' && pathname === '/rooms') {
      return sendJson(res, 200, { rooms: ROOMS });
    }

    if (req.method === 'GET' && pathname === '/reservations') {
      const room = url.searchParams.get('room');
      const list = room === null ? reservations : reservations.filter((r) => r.room === room);
      return sendJson(res, 200, { reservations: list });
    }

    if (req.method === 'POST' && pathname === '/reservations') {
      let body;
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        return sendJson(res, 400, { error: 'malformed JSON body' });
      }
      const err = validateReservation(body);
      if (err) return sendJson(res, 400, { error: err });

      const fromT = Date.parse(body.from);
      const toT = Date.parse(body.to);
      const conflict = reservations.find(
        (r) => r.room === body.room && overlaps(fromT, toT, Date.parse(r.from), Date.parse(r.to)),
      );
      if (conflict) {
        return sendJson(res, 409, { error: 'time conflict', conflicts_with: conflict.id });
      }

      const created = {
        id: crypto.randomUUID(),
        room: body.room,
        from: body.from,
        to: body.to,
        by: body.by,
      };
      reservations.push(created);
      saveReservations(reservations);
      return sendJson(res, 201, created);
    }

    const delMatch = pathname.match(/^\/reservations\/([^/]+)$/);
    if (req.method === 'DELETE' && delMatch) {
      const id = decodeURIComponent(delMatch[1]);
      const idx = reservations.findIndex((r) => r.id === id);
      if (idx === -1) return sendJson(res, 404, { error: 'reservation not found' });
      reservations.splice(idx, 1);
      saveReservations(reservations);
      res.writeHead(204);
      return res.end();
    }

    return sendJson(res, 404, { error: 'not found' });
  } catch (e) {
    return sendJson(res, 500, { error: 'internal error' });
  }
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  console.log(`meeting-room API listening on :${port}`);
});
