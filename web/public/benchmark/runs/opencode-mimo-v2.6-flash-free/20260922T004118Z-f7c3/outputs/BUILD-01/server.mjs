import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOMS = ["A", "B", "C"];
const DIR = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(DIR, "reservations.json");
const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY = 1_000_000;

let seq = 0;
let reservations = [];

function loadStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      reservations = data;
      seq = data.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
      return;
    }
  } catch {
    // 저장 파일 없거나 깨진 경우: 빈 상태로 시작
  }
  reservations = [];
  seq = 0;
}

function saveStore() {
  const tmp = STORE_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(reservations, null, 2), "utf8");
  fs.renameSync(tmp, STORE_PATH);
}

// 읽기-수정-쓰기 직렬화로 동시 요청 시 상태 유실·중복 id 방지
let chain = Promise.resolve();
function withStore(fn) {
  const run = chain.then(fn, fn);
  chain = run.then(() => undefined, () => undefined);
  return run;
}

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    ...extraHeaders,
  });
  res.end(payload);
}

function sendEmpty(res, status) {
  res.writeHead(status);
  res.end();
}

function sendError(res, status, error, message) {
  sendJson(res, status, { error, message });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("body_too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function overlaps(a, b) {
  return (
    a.room === b.room &&
    Date.parse(a.from) < Date.parse(b.to) &&
    Date.parse(b.from) < Date.parse(a.to)
  );
}

async function handleGetRooms(res) {
  sendJson(res, 200, ROOMS);
}

async function handleGetReservations(res, query) {
  const room = query.get("room");
  let list = reservations;
  if (room !== null) {
    if (!ROOMS.includes(room)) {
      sendError(res, 400, "invalid_room", "존재하지 않는 방입니다");
      return;
    }
    list = reservations.filter((r) => r.room === room);
  }
  sendJson(res, 200, list);
}

async function handlePostReservations(req, res) {
  let raw;
  try {
    raw = await readBody(req);
  } catch {
    sendError(res, 413, "body_too_large", "요청 본문이 너무 깁니다");
    return;
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    sendError(res, 400, "invalid_json", "요청 본문이 올바른 JSON이 아닙니다");
    return;
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    sendError(res, 400, "invalid_body", "요청 본문은 JSON 객체여야 합니다");
    return;
  }
  const { room, from, to, by } = body;
  if (room === undefined || from === undefined || to === undefined || by === undefined || by === null || by === "") {
    sendError(res, 400, "missing_field", "room, from, to, by는 필수입니다");
    return;
  }
  if (typeof room !== "string" || !ROOMS.includes(room)) {
    sendError(res, 400, "invalid_room", "존재하지 않는 방입니다");
    return;
  }
  const fromMs = typeof from === "string" ? Date.parse(from) : NaN;
  const toMs = typeof to === "string" ? Date.parse(to) : NaN;
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    sendError(res, 400, "invalid_datetime", "from, to는 유효한 ISO 8601 시각이어야 합니다");
    return;
  }
  if (fromMs >= toMs) {
    sendError(res, 400, "invalid_range", "from는 to보다 앞서야 합니다");
    return;
  }
  if (fromMs < Date.now()) {
    sendError(res, 400, "past_datetime", "과거 시각으로 예약할 수 없습니다");
    return;
  }
  if (typeof by !== "string" || by.trim() === "") {
    sendError(res, 400, "missing_field", "by는 비어 있지 않은 문자열이어야 합니다");
    return;
  }

  const created = await withStore(() => {
    const candidate = { room, from, to, by };
    if (reservations.some((r) => overlaps(r, candidate))) {
      return null;
    }
    seq += 1;
    const record = { id: String(seq), room, from, to, by };
    reservations.push(record);
    saveStore();
    return record;
  });

  if (created === null) {
    sendError(res, 409, "conflict", "같은 방에서 시간이 겹치는 예약이 있습니다");
    return;
  }
  sendJson(res, 201, created);
}

async function handleDeleteReservation(res, id) {
  const removed = await withStore(() => {
    const idx = reservations.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    reservations.splice(idx, 1);
    saveStore();
    return true;
  });
  if (!removed) {
    sendError(res, 404, "not_found", "해당 예약이 없습니다");
    return;
  }
  sendEmpty(res, 204);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  const route = async () => {
    if (req.method === "GET" && pathname === "/rooms") {
      await handleGetRooms(res);
      return;
    }
    if (req.method === "POST" && pathname === "/reservations") {
      await handlePostReservations(req, res);
      return;
    }
    if (req.method === "GET" && pathname === "/reservations") {
      await handleGetReservations(res, url.searchParams);
      return;
    }
    const delMatch = pathname.match(/^\/reservations\/([^/]+)$/);
    if (req.method === "DELETE" && delMatch) {
      await handleDeleteReservation(res, decodeURIComponent(delMatch[1]));
      return;
    }
    sendError(res, 404, "not_found", "알 수 없는 경로입니다");
  };

  route().catch(() => {
    if (!res.headersSent) sendError(res, 500, "internal_error", "서버 오류");
  });
});

loadStore();
server.listen(PORT, () => {
  console.log(`listening on http://127.0.0.1:${PORT}`);
});
