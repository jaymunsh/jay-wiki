import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { writeFile, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10);
const ROOMS = ['A', 'B', 'C'];
const DATA_FILE = join(dirname(fileURLToPath(import.meta.url)), 'reservations.json');

function loadReservations() {
  try {
    const parsed = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('reservations.json must contain an array');
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

let reservations = loadReservations();
let mutationQueue = Promise.resolve();

function persist() {
  const temp = `${DATA_FILE}.${process.pid}.tmp`;
  return writeFile(temp, `${JSON.stringify(reservations, null, 2)}\n`, 'utf8')
    .then(() => rename(temp, DATA_FILE))
    .catch(async (error) => {
      try { await unlink(temp); } catch {}
      throw error;
    });
}

function mutate(operation) {
  const run = mutationQueue.then(operation, operation);
  mutationQueue = run.catch(() => {});
  return run;
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(text);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function parseIso(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(Object.assign(new Error('request body too large'), { statusCode: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function validateReservation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'request body must be an object';
  const { room, from, to, by } = input;
  if (!ROOMS.includes(room)) return 'room must be A, B, or C';
  if (typeof by !== 'string' || by.trim() === '') return 'by is required';
  const fromDate = parseIso(from);
  const toDate = parseIso(to);
  if (!fromDate || !toDate) return 'from and to must be ISO 8601 times';
  if (fromDate.getTime() >= toDate.getTime()) return 'from must be before to';
  if (fromDate.getTime() < Date.now()) return 'from must not be in the past';
  return { room, from: fromDate.toISOString(), to: toDate.toISOString(), by };
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/rooms') {
    return sendJson(res, 200, ROOMS);
  }

  if (req.method === 'GET' && url.pathname === '/reservations') {
    const room = url.searchParams.get('room');
    if (room !== null && !ROOMS.includes(room)) return sendError(res, 400, 'room must be A, B, or C');
    const result = room === null ? reservations : reservations.filter((item) => item.room === room);
    return sendJson(res, 200, result);
  }

  if (req.method === 'POST' && url.pathname === '/reservations') {
    let input;
    try {
      const body = await readBody(req);
      input = JSON.parse(body);
    } catch (error) {
      return sendError(res, error.statusCode ?? 400, 'request body must be valid JSON');
    }
    const validated = validateReservation(input);
    if (typeof validated === 'string') return sendError(res, 400, validated);
    try {
      const created = await mutate(async () => {
        const conflict = reservations.some((item) => item.room === validated.room &&
          item.from < validated.to && validated.from < item.to);
        if (conflict) return null;
        const item = { id: randomUUID(), ...validated };
        reservations = [...reservations, item];
        await persist();
        return item;
      });
      if (!created) return sendError(res, 409, 'reservation overlaps an existing reservation');
      res.writeHead(201, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(created));
    } catch {
      return sendError(res, 500, 'could not persist reservation');
    }
  }

  const deleteMatch = req.method === 'DELETE' && url.pathname.match(/^\/reservations\/([^/]+)$/);
  if (deleteMatch) {
    const id = decodeURIComponent(deleteMatch[1]);
    try {
      const deleted = await mutate(async () => {
        const index = reservations.findIndex((item) => item.id === id);
        if (index < 0) return false;
        reservations = reservations.filter((item) => item.id !== id);
        await persist();
        return true;
      });
      if (!deleted) return sendError(res, 404, 'reservation not found');
      res.writeHead(204);
      return res.end();
    } catch {
      return sendError(res, 500, 'could not persist cancellation');
    }
  }

  return sendError(res, 404, 'not found');
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(() => sendError(res, 500, 'internal server error'));
});

server.listen(Number.isInteger(PORT) ? PORT : 3000, () => {
  console.log(`meeting-room server listening on ${Number.isInteger(PORT) ? PORT : 3000}`);
});
