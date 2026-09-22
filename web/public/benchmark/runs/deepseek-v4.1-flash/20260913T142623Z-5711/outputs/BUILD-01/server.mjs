#!/usr/bin/env node
/**
 * server.mjs — 회의실 예약 API 서버
 *
 * 과제: v0.5-character-1 / BUILD-01
 * 실행: `node server.mjs` (기본 3000번 포트, PORT 환경 변수가 있으면 그 포트)
 * 의존성: node: 내장 모듈만 사용한다. 외부 패키지 없음.
 *
 * 명세에 없어서 이 구현이 스스로 정한 지점은 RESULT.md에 정리했다.
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 예약 저장 파일. 명세가 파일명만 지정했으므로 스크립트와 같은 디렉터리에 둔다. */
const DATA_FILE = path.join(__dirname, 'reservations.json');

/** 회의실은 A, B, C 세 개로 고정한다(명세). */
const ROOMS = Object.freeze(['A', 'B', 'C']);

/** 필수 필드(명세: room, from, to, by). */
const REQUIRED_FIELDS = Object.freeze(['room', 'from', 'to', 'by']);

/** 요청 본문 최대 크기. 명세에 없어 DoS 방지를 위해 정한 값이다. */
const MAX_BODY_BYTES = 1_000_000;

/** ISO 8601 시각 문자열 판정용. 날짜+시각까지 요구하고 오프셋은 선택으로 둔다. */
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?$/;

// ---------------------------------------------------------------------------
// 포트 결정
// ---------------------------------------------------------------------------

function resolvePort() {
  const raw = process.env.PORT;
  if (raw === undefined || raw === '') return 3000;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    console.error(`[warn] PORT="${raw}" 값을 포트 번호로 쓸 수 없어 3000을 사용한다.`);
    return 3000;
  }
  return n;
}

// ---------------------------------------------------------------------------
// 저장소 — 메모리 배열이 원본이고, 변경 때마다 파일로 원자적 저장한다.
// ---------------------------------------------------------------------------

/** @type {Array<{id:string,room:string,from:string,to:string,by:string,createdAt:string}>} */
let reservations = [];

/** 파일 쓰기를 직렬화한다. 동시 요청이 겹쳐도 저장 순서가 뒤엉키지 않게 한다. */
let writeChain = Promise.resolve();

function loadReservations() {
  let raw;
  try {
    raw = fs.readFileSync(DATA_FILE, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return []; // 첫 실행
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // 조용히 빈 목록으로 덮어쓰면 기존 예약을 잃는다. 그래서 시작을 거부한다.
    throw new Error(
      `${DATA_FILE} 이(가) 올바른 JSON이 아니다. 기존 데이터를 지우지 않기 위해 시작하지 않는다.`
    );
  }

  const list = Array.isArray(parsed) ? parsed : parsed?.reservations;
  if (!Array.isArray(list)) {
    throw new Error(`${DATA_FILE} 에서 예약 배열을 찾지 못했다.`);
  }
  return list.filter((r) => r && typeof r === 'object' && typeof r.id === 'string');
}

/** 현재 메모리 상태를 파일에 반영한다. 임시 파일에 쓰고 rename 해서 반쪽 파일을 피한다. */
function persist() {
  const snapshot = JSON.stringify({ reservations }, null, 2);
  writeChain = writeChain.then(async () => {
    const tmp = `${DATA_FILE}.tmp`;
    await fsp.writeFile(tmp, snapshot, 'utf8');
    await fsp.rename(tmp, DATA_FILE);
  });
  return writeChain;
}

// ---------------------------------------------------------------------------
// 응답 도우미
// ---------------------------------------------------------------------------

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...extraHeaders,
  });
  res.end(payload);
}

function sendError(res, status, code, message, extraHeaders = {}) {
  sendJson(res, status, { error: code, message }, extraHeaders);
}

function sendNoContent(res) {
  res.writeHead(204);
  res.end();
}

/** 본문을 모아 문자열로 돌려준다. 상한을 넘으면 413으로 끊는다. */
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const err = new Error('요청 본문이 너무 크다.');
      err.status = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// ---------------------------------------------------------------------------
// 검증
// ---------------------------------------------------------------------------

/** ISO 8601 문자열을 epoch ms로. 형식이 아니면 null. */
function parseInstant(value) {
  if (typeof value !== 'string' || !ISO_8601.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * 두 구간이 겹치는지. [from, to) 반열림 구간으로 본다.
 * 따라서 14:00 종료와 14:00 시작은 겹치지 않는다.
 */
function overlaps(aFrom, aTo, bFrom, bTo) {
  return aFrom < bTo && bFrom < aTo;
}

/** 400으로 돌려보낼 검증 실패. */
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
    this.code = 'invalid_request';
  }
}

/**
 * POST /reservations 본문을 검증하고 정규화된 예약 후보를 만든다.
 * 명세에 적힌 400 사유(필수 필드 누락, 존재하지 않는 방, from >= to, 과거 시각)를
 * 모두 여기서 처리한다.
 */
function validateNewReservation(body, nowMs) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('요청 본문은 JSON 객체여야 한다.');
  }

  for (const field of REQUIRED_FIELDS) {
    const value = body[field];
    if (value === undefined || value === null || value === '') {
      throw new ValidationError(`필수 필드 '${field}'가 없다.`);
    }
    if (typeof value !== 'string') {
      throw new ValidationError(`필드 '${field}'는 문자열이어야 한다.`);
    }
  }

  const room = body.room;
  if (!ROOMS.includes(room)) {
    throw new ValidationError(`존재하지 않는 회의실이다: '${room}'. 사용 가능: ${ROOMS.join(', ')}`);
  }

  const fromMs = parseInstant(body.from);
  if (fromMs === null) throw new ValidationError(`'from'이 ISO 8601 시각 형식이 아니다: '${body.from}'`);

  const toMs = parseInstant(body.to);
  if (toMs === null) throw new ValidationError(`'to'가 ISO 8601 시각 형식이 아니다: '${body.to}'`);

  if (fromMs >= toMs) throw new ValidationError("'from'은 'to'보다 빨라야 한다.");
  if (fromMs < nowMs) throw new ValidationError('과거 시각으로는 예약할 수 없다.');

  return { room, from: body.from, to: body.to, by: body.by, fromMs, toMs };
}

// ---------------------------------------------------------------------------
// 라우팅
// ---------------------------------------------------------------------------

function listReservations(roomFilter) {
  const list = roomFilter === null ? reservations : reservations.filter((r) => r.room === roomFilter);
  return { reservations: list, count: list.length };
}

async function handleCreate(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (err) {
    if (err.status === 413) throw err;
    throw new ValidationError('요청 본문이 올바른 JSON이 아니다.');
  }

  const nowMs = Date.now();
  const candidate = validateNewReservation(body, nowMs);

  // 겹침 검사와 push 사이에 await가 없다. Node는 단일 스레드이므로
  // 이 구간은 원자적으로 실행되어 동시 요청끼리 새치기할 수 없다.
  const conflict = reservations.find(
    (r) =>
      r.room === candidate.room &&
      overlaps(candidate.fromMs, candidate.toMs, Date.parse(r.from), Date.parse(r.to))
  );
  if (conflict) {
    sendError(
      res,
      409,
      'room_conflict',
      `${candidate.room}호는 해당 시간에 이미 예약(${conflict.id})이 있다.`
    );
    return;
  }

  const created = {
    id: randomUUID(),
    room: candidate.room,
    from: candidate.from,
    to: candidate.to,
    by: candidate.by,
    createdAt: new Date(nowMs).toISOString(),
  };
  reservations.push(created);
  await persist();

  sendJson(res, 201, created, { Location: `/reservations/${created.id}` });
}

async function handleDelete(res, id) {
  const index = reservations.findIndex((r) => r.id === id);
  if (index === -1) {
    sendError(res, 404, 'not_found', `해당 id의 예약이 없다: '${id}'`);
    return;
  }
  reservations.splice(index, 1);
  await persist();
  sendNoContent(res);
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const segments = url.pathname.split('/').filter(Boolean);
  const method = req.method ?? 'GET';

  // GET /rooms
  if (segments.length === 1 && segments[0] === 'rooms') {
    if (method !== 'GET') return sendError(res, 405, 'method_not_allowed', 'GET만 허용된다.', { Allow: 'GET' });
    return sendJson(res, 200, { rooms: [...ROOMS] });
  }

  if (segments.length >= 1 && segments[0] === 'reservations') {
    // /reservations
    if (segments.length === 1) {
      if (method === 'POST') return handleCreate(req, res);
      if (method === 'GET') {
        const room = url.searchParams.get('room');
        if (room !== null && !ROOMS.includes(room)) {
          return sendError(res, 400, 'invalid_request', `존재하지 않는 회의실이다: '${room}'.`);
        }
        return sendJson(res, 200, listReservations(room));
      }
      return sendError(res, 405, 'method_not_allowed', 'GET 또는 POST만 허용된다.', { Allow: 'GET, POST' });
    }

    // /reservations/:id
    if (segments.length === 2) {
      if (method !== 'DELETE') {
        return sendError(res, 405, 'method_not_allowed', 'DELETE만 허용된다.', { Allow: 'DELETE' });
      }
      return handleDelete(res, decodeURIComponent(segments[1]));
    }
  }

  return sendError(res, 404, 'not_found', `알 수 없는 경로다: ${method} ${url.pathname}`);
}

// ---------------------------------------------------------------------------
// 서버 기동
// ---------------------------------------------------------------------------

function start() {
  reservations = loadReservations();

  const server = http.createServer((req, res) => {
    route(req, res).catch((err) => {
      const status = err?.status ?? 500;
      const code = err?.code ?? 'internal_error';
      if (status >= 500) console.error('[error]', err);
      if (!res.headersSent) sendError(res, status, code, err?.message ?? '서버 내부 오류');
      else res.end();
    });
  });

  const port = resolvePort();
  server.listen(port, () => {
    console.log(`회의실 예약 API 서버가 ${port}번 포트에서 대기 중이다.`);
    console.log(`저장 파일: ${DATA_FILE}`);
  });

  return server;
}

start();

export { start, ROOMS };
