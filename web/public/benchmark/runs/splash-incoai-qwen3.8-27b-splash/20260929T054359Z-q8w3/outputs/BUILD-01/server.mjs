import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const DB_PATH = process.env.DB
  ? process.env.DB
  : join(__dirname, 'reservations.json');
const ROOMS = ['A', 'B', 'C'];

let reservations = load();

function load() {
  try {
    if (!existsSync(DB_PATH)) return [];
    const data = JSON.parse(readFileSync(DB_PATH, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function save() {
  writeFileSync(DB_PATH, JSON.stringify(reservations, null, 2));
}

function send(res, status, body) {
  if (body === undefined) {
    res.writeHead(status);
    res.end();
  } else {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  }
}

function parseTime(value) {
  if (typeof value !== 'string') return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

// half-open intervals [from, to): touching at an endpoint is not a conflict
function overlaps(aFrom, aTo, bFrom, bTo) {
  return aFrom < bTo && bFrom < aTo;
}

function handleCreate(body, res) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return send(res, 400, { error: 'body must be a JSON object' });
  }
  const { room, from, to, by } = body;
  const missing = [room, from, to, by].some((v) => v === undefined || v === null || v === '');
  if (missing) {
    return send(res, 400, { error: 'missing required field (room, from, to, by)' });
  }
  if (!ROOMS.includes(room)) {
    return send(res, 400, { error: `room must be one of: ${ROOMS.join(', ')}` });
  }
  const fromMs = parseTime(from);
  const toMs = parseTime(to);
  if (fromMs === null || toMs === null) {
    return send(res, 400, { error: 'from/to must be valid ISO 8601 timestamps' });
  }
  if (fromMs >= toMs) {
    return send(res, 400, { error: 'from must be strictly before to' });
  }
  if (fromMs < Date.now()) {
    return send(res, 400, { error: 'from must not be in the past' });
  }
  for (const r of reservations) {
    if (r.room !== room) continue;
    if (overlaps(fromMs, toMs, Date.parse(r.from), Date.parse(r.to))) {
      return send(res, 409, { error: 'conflicting reservation in the same room', conflict_id: r.id });
    }
  }
  const reservation = { id: randomUUID(), room, from, to, by };
  reservations.push(reservation);
  save();
  return send(res, 201, reservation);
}

const server = createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    return send(res, 400, { error: 'bad request url' });
  }
  const { pathname, searchParams } = url;
  const method = req.method;

  try {
    if (method === 'GET' && pathname === '/rooms') {
      return send(res, 200, { rooms: ROOMS });
    }

    if (method === 'GET' && pathname === '/reservations') {
      const room = searchParams.get('room');
      if (room === null) return send(res, 200, reservations);
      if (!ROOMS.includes(room)) {
        return send(res, 400, { error: `room must be one of: ${ROOMS.join(', ')}` });
      }
      return send(res, 200, reservations.filter((r) => r.room === room));
    }

    if (method === 'POST' && pathname === '/reservations') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        let body;
        try {
          body = raw ? JSON.parse(raw) : null;
        } catch {
          return send(res, 400, { error: 'invalid JSON body' });
        }
        handleCreate(body, res);
      });
      req.on('error', () => send(res, 400, { error: 'request error' }));
      return;
    }

    if (method === 'DELETE' && pathname.startsWith('/reservations/')) {
      const id = decodeURIComponent(pathname.slice('/reservations/'.length));
      const idx = reservations.findIndex((r) => r.id === id);
      if (idx === -1) return send(res, 404, { error: 'reservation not found' });
      reservations.splice(idx, 1);
      save();
      return send(res, 204);
    }

    return send(res, 404, { error: 'not found' });
  } catch {
    return send(res, 500, { error: 'internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(JSON.stringify({ ready: true, port: PORT, db: DB_PATH, rooms: ROOMS }));
});
