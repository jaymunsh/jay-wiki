import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STORE = path.join(HERE, "reservations.json");
const ROOMS = ["A", "B", "C"];
const PORT = Number(process.env.PORT) || 3000;

function load() {
  try {
    const d = JSON.parse(fs.readFileSync(STORE, "utf8"));
    if (!Array.isArray(d.reservations)) throw new Error("bad store");
    return { reservations: d.reservations, nextId: Number(d.nextId) || 1 };
  } catch (e) {
    if (e.code !== "ENOENT") console.error("store reset:", e.message);
    return { reservations: [], nextId: 1 };
  }
}

let { reservations, nextId } = load();

function save() {
  fs.writeFileSync(STORE, JSON.stringify({ reservations, nextId }, null, 2));
}

function send(res, code, obj) {
  const body = obj === null ? "" : JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(body);
}

function overlaps(aFrom, aTo, bFrom, bTo) {
  return aFrom < bTo && bFrom < aTo;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && url.pathname === "/rooms") {
    return send(res, 200, { rooms: ROOMS });
  }

  if (req.method === "GET" && parts[0] === "reservations" && parts.length === 1) {
    const room = url.searchParams.get("room");
    if (room !== null && !ROOMS.includes(room)) {
      return send(res, 400, { error: "unknown room" });
    }
    const list = room === null ? reservations : reservations.filter((r) => r.room === room);
    return send(res, 200, { reservations: list });
  }

  if (req.method === "POST" && url.pathname === "/reservations") {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return send(res, 400, { error: "malformed JSON" });
      }
      const { room, from, to, by } = body ?? {};
      if (!room || !from || !to || !by) {
        return send(res, 400, { error: "missing required field: room, from, to, by" });
      }
      if (!ROOMS.includes(room)) return send(res, 400, { error: "unknown room" });
      const f = Date.parse(from), t = Date.parse(to);
      if (Number.isNaN(f) || Number.isNaN(t)) {
        return send(res, 400, { error: "from/to must be ISO 8601 date-time strings" });
      }
      if (f >= t) return send(res, 400, { error: "from must be earlier than to" });
      if (t <= Date.now()) return send(res, 400, { error: "cannot book in the past" });
      const conflict = reservations.some(
        (r) => r.room === room && overlaps(f, t, Date.parse(r.from), Date.parse(r.to))
      );
      if (conflict) return send(res, 409, { error: "time conflict in room " + room });
      const r = { id: nextId++, room, from: new Date(f).toISOString(), to: new Date(t).toISOString(), by };
      reservations.push(r);
      try { save(); } catch (e) { return send(res, 500, { error: "persistence failed" }); }
      return send(res, 201, r);
    });
    req.on("error", () => send(res, 400, { error: "unreadable body" }));
    return;
  }

  if (req.method === "DELETE" && parts[0] === "reservations" && parts.length === 2) {
    const id = Number(parts[1]);
    const i = reservations.findIndex((r) => r.id === id);
    if (i === -1) return send(res, 404, { error: "reservation not found" });
    reservations.splice(i, 1);
    try { save(); } catch (e) { return send(res, 500, { error: "persistence failed" }); }
    res.writeHead(204);
    return res.end();
  }

  return send(res, 404, { error: "not found" });
});

server.listen(PORT, () => console.log("listening on " + PORT));
