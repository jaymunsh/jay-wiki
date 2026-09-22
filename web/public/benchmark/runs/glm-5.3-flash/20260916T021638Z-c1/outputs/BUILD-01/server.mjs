// 회의실 예약 API 서버 (node: 내장 모듈만 사용)
// 실행: node server.mjs  (PORT 환경 변수로 포트 변경, 기본 3000)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ROOMS = ["A", "B", "C"];
const STORE = path.join(path.dirname(fileURLToPath(import.meta.url)), "reservations.json");

function load() {
  try { return JSON.parse(fs.readFileSync(STORE, "utf8")); }
  catch { return []; }
}
function save(list) { fs.writeFileSync(STORE, JSON.stringify(list, null, 2)); }
let reservations = load();
let nextId = reservations.reduce((m, r) => Math.max(m, r.id), 0) + 1;

function json(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(data);
}
// ISO 8601 파싱: 유효하지 않거나 날짜가 아닌 문자열 거부
function parseIso(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(s)) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}
function overlap(aFrom, aTo, bFrom, bTo) { return aFrom < bTo && aTo > bFrom; }

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const send = (code, body) => json(res, code, body);

  if (req.method === "GET" && url.pathname === "/rooms") {
    return send(200, { rooms: ROOMS });
  }

  if (req.method === "GET" && url.pathname === "/reservations") {
    const room = url.searchParams.get("room");
    const list = room ? reservations.filter(r => r.room === room) : reservations;
    return send(200, { reservations: list });
  }

  if (req.method === "POST" && url.pathname === "/reservations") {
    let raw = "";
    req.on("data", c => { raw += c; });
    req.on("end", () => {
      let body;
      try { body = JSON.parse(raw); }
      catch { return send(400, { error: "broken JSON body" }); }
      const { room, from, to, by } = body ?? {};
      if (!ROOMS.includes(room)) return send(400, { error: `room must be one of ${ROOMS.join(", ")}` });
      if (!by || typeof by !== "string") return send(400, { error: "missing field: by" });
      const f = parseIso(from), t = parseIso(to);
      if (f === null || t === null) return send(400, { error: "from/to must be valid ISO 8601 timestamps" });
      if (f >= t) return send(400, { error: "from must be earlier than to" });
      if (t <= Date.now()) return send(400, { error: "reservation must be in the future" });
      const clash = reservations.some(r => r.room === room && overlap(f, t, r.fromMs, r.toMs));
      if (clash) return send(409, { error: "room already reserved for overlapping time" });
      const reservation = { id: nextId++, room, from, to, by, fromMs: f, toMs: t };
      reservations.push(reservation);
      try { save(reservations); } catch (e) { return send(500, { error: "failed to persist: " + e.message }); }
      const { fromMs, toMs, ...pub } = reservation;
      send(201, pub);
    });
    return;
  }

  const del = req.method === "DELETE" && url.pathname.match(/^\/reservations\/(\d+)$/);
  if (del) {
    const id = Number(del[1]);
    const idx = reservations.findIndex(r => r.id === id);
    if (idx === -1) return send(404, { error: "reservation not found" });
    reservations.splice(idx, 1);
    try { save(reservations); } catch (e) { return send(500, { error: "failed to persist: " + e.message }); }
    res.writeHead(204); res.end();
    return;
  }

  send(404, { error: "not found" });
});

server.listen(PORT, () => console.log(`meeting room reservation API listening on :${PORT}`));
