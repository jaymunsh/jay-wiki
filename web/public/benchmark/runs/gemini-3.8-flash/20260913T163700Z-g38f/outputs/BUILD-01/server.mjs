import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'reservations.json');
const VALID_ROOMS = ['A', 'B', 'C'];

// State management with file persistence
let reservations = [];

function loadReservations() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      reservations = JSON.parse(raw);
      if (!Array.isArray(reservations)) {
        reservations = [];
      }
    } else {
      reservations = [];
      saveReservations();
    }
  } catch (err) {
    console.error('Failed to load reservations:', err);
    reservations = [];
  }
}

function saveReservations() {
  const tmpFile = `${DATA_FILE}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(reservations, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DATA_FILE);
}

loadReservations();

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw || raw.trim() === '') {
        return resolve({});
      }
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', err => reject(err));
  });
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;
  const method = req.method.toUpperCase();

  // 1. GET /rooms
  if (method === 'GET' && pathname === '/rooms') {
    return sendJson(res, 200, VALID_ROOMS);
  }

  // 2. GET /reservations
  if (method === 'GET' && pathname === '/reservations') {
    const roomQuery = reqUrl.searchParams.get('room');
    if (roomQuery) {
      const filtered = reservations.filter(r => r.room === roomQuery);
      return sendJson(res, 200, filtered);
    }
    return sendJson(res, 200, reservations);
  }

  // 3. POST /reservations
  if (method === 'POST' && pathname === '/reservations') {
    let body;
    try {
      body = await parseBody(req);
    } catch (err) {
      return sendError(res, 400, 'Invalid JSON payload');
    }

    const { room, from, to, by } = body;

    // Validate required fields
    if (!room || !from || !to || !by || typeof room !== 'string' || typeof by !== 'string') {
      return sendError(res, 400, 'Missing or invalid required fields: room, from, to, by');
    }

    // Validate room
    if (!VALID_ROOMS.includes(room)) {
      return sendError(res, 400, `Invalid room: ${room}. Must be one of ${VALID_ROOMS.join(', ')}`);
    }

    // Validate ISO 8601 date strings
    const fromTime = Date.parse(from);
    const toTime = Date.parse(to);

    if (isNaN(fromTime) || isNaN(toTime)) {
      return sendError(res, 400, 'Invalid ISO 8601 date format for from or to');
    }

    // Validate time sequence
    if (fromTime >= toTime) {
      return sendError(res, 400, 'from time must be strictly earlier than to time');
    }

    // Validate past time
    const now = Date.now();
    if (fromTime < now) {
      return sendError(res, 400, 'Cannot create reservation in the past');
    }

    // Check conflict (overlap in the same room)
    const hasOverlap = reservations.some(existing => {
      if (existing.room !== room) return false;
      const exFrom = Date.parse(existing.from);
      const exTo = Date.parse(existing.to);
      return Math.max(fromTime, exFrom) < Math.min(toTime, exTo);
    });

    if (hasOverlap) {
      return sendError(res, 409, 'Reservation time conflict with an existing reservation in this room');
    }

    const newReservation = {
      id: crypto.randomUUID(),
      room,
      from,
      to,
      by,
      createdAt: new Date().toISOString()
    };

    reservations.push(newReservation);
    try {
      saveReservations();
    } catch (err) {
      return sendError(res, 500, 'Failed to persist reservation');
    }

    return sendJson(res, 201, newReservation);
  }

  // 4. DELETE /reservations/:id
  if (method === 'DELETE' && pathname.startsWith('/reservations/')) {
    const id = pathname.slice('/reservations/'.length);
    if (!id) {
      return sendError(res, 400, 'Missing reservation ID');
    }

    const index = reservations.findIndex(r => r.id === id);
    if (index === -1) {
      return sendError(res, 404, 'Reservation not found');
    }

    reservations.splice(index, 1);
    try {
      saveReservations();
    } catch (err) {
      return sendError(res, 500, 'Failed to update reservations storage');
    }

    res.writeHead(204);
    return res.end();
  }

  // Default 404
  return sendError(res, 404, 'Endpoint not found');
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
server.listen(port, () => {
  console.log(`Reservation server listening on port ${port}`);
});

export default server;
