// ─── Cast Hub ────────────────────────────────────────────────────────────────
//  Server-side relay for the "Cast to TV" feature.
//
//  Flow:
//    1. TV opens /cast and POSTs /api/cast/codes → server creates a fresh
//       cast_rooms row and a 6-digit pairing code (in-memory, 60s TTL) that
//       points at the new room_id.
//    2. Laptop POSTs /api/cast/pair { code } → server consumes the code and
//       returns the room_id + label.
//    3. Both sides open ws://.../ws/cast?roomId=XXX&role=tv|laptop. The hub
//       keeps an in-memory broadcast set per room.
//    4. Laptop POSTs /api/cast/rooms/:id/push { snapshot } → server stores
//       in DB and broadcasts { type: 'snapshot', snapshot } to every
//       connected TV in that room.
//    5. Either side can DELETE /api/cast/rooms/:id to unpair; server
//       broadcasts { type: 'closed' } and removes the room.
//
//  Notes:
//    - No auth. Free for everyone. Room_id is the secret.
//    - Pairing codes never persist to disk — only room_ids do, so a server
//       restart drops pending codes but every paired room survives.
//    - WS is mounted at `/ws/cast` to avoid colliding with Vite's HMR ws.
// ────────────────────────────────────────────────────────────────────────────

import type { Express, Request, Response } from "express";
import type { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { db } from "../db";
import { castRooms, castSnapshotSchema, type CastSnapshot } from "@shared/schema";
import { eq } from "drizzle-orm";

interface PendingCode {
  code: string;
  roomId: string;
  expiresAt: number;
}

interface RoomConn {
  ws: WebSocket;
  role: "tv" | "laptop";
}

const pendingCodes = new Map<string, PendingCode>();
const roomConns = new Map<string, Set<RoomConn>>();
// Rooms that were created via /codes but never paired. If their code expires
// we tear the row back out of the DB so spamming /codes can't bloat storage.
const pendingRoomIds = new Set<string>();
// Per-IP code-creation throttle: max 10 codes per 60s window.
const codeRateLimit = new Map<string, { count: number; resetAt: number }>();

const CODE_TTL_MS = 60_000;
const SNAPSHOT_BYTES_LIMIT = 4 * 1024 * 1024;
const CODE_RATE_WINDOW_MS = 60_000;
const CODE_RATE_MAX = 10;

function generateCode(): string {
  let code: string;
  do {
    code = String(Math.floor(100_000 + Math.random() * 900_000));
  } while (pendingCodes.has(code));
  return code;
}

async function purgeExpiredCodes(): Promise<void> {
  const now = Date.now();
  const expired: string[] = [];
  pendingCodes.forEach((p, code) => {
    if (p.expiresAt <= now) {
      expired.push(code);
    }
  });
  for (const code of expired) {
    const p = pendingCodes.get(code);
    pendingCodes.delete(code);
    // If this room was never paired, drop the DB row too.
    if (p && pendingRoomIds.has(p.roomId)) {
      pendingRoomIds.delete(p.roomId);
      try {
        await db.delete(castRooms).where(eq(castRooms.id, p.roomId));
      } catch (err: unknown) {
        console.error("[Cast] failed to GC unpaired room:", err);
      }
    }
  }
}

function checkCodeRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = codeRateLimit.get(ip);
  if (!entry || entry.resetAt <= now) {
    codeRateLimit.set(ip, { count: 1, resetAt: now + CODE_RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= CODE_RATE_MAX;
}

function broadcast(roomId: string, payload: unknown, exclude?: WebSocket): void {
  const set = roomConns.get(roomId);
  if (!set) return;
  const msg = JSON.stringify(payload);
  set.forEach((conn) => {
    if (conn.ws === exclude) return;
    if (conn.ws.readyState === WebSocket.OPEN) {
      try {
        conn.ws.send(msg);
      } catch {
        /* ignore */
      }
    }
  });
}

function closeRoomConns(roomId: string, reason: string): void {
  const set = roomConns.get(roomId);
  if (!set) return;
  const msg = JSON.stringify({ type: "closed", reason });
  set.forEach((conn) => {
    if (conn.ws.readyState === WebSocket.OPEN) {
      try {
        conn.ws.send(msg);
        conn.ws.close(1000, reason);
      } catch {
        /* ignore */
      }
    }
  });
  roomConns.delete(roomId);
}

export function setupCastHub(httpServer: HttpServer, app: Express): void {
  // ─── HTTP: TV requests a fresh pairing code + new room ─────────────────
  app.post("/api/cast/codes", async (req: Request, res: Response): Promise<void | Response> => {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";
    if (!checkCodeRateLimit(ip)) {
      return res.status(429).json({ error: "Too many pairing requests, slow down" });
    }
    await purgeExpiredCodes();
    try {
      const [room] = await db
        .insert(castRooms)
        .values({ label: "TV" })
        .returning({ id: castRooms.id, label: castRooms.label });
      if (!room?.id) {
        return res.status(500).json({ error: "Failed to create room" });
      }
      pendingRoomIds.add(room.id);
      const code = generateCode();
      pendingCodes.set(code, {
        code,
        roomId: room.id,
        expiresAt: Date.now() + CODE_TTL_MS,
      });
      res.json({
        code,
        roomId: room.id,
        label: room.label,
        expiresAt: Date.now() + CODE_TTL_MS,
      });
    } catch (err: unknown) {
      console.error("[Cast] /codes failed:", err);
      res.status(500).json({ error: "Failed to create cast room" });
    }
  });

  // ─── HTTP: Laptop pairs by submitting the code ─────────────────────────
  app.post("/api/cast/pair", async (req: Request, res: Response) => {
    await purgeExpiredCodes();
    const code = String(req.body?.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: "Code must be 6 digits" });
    }
    const pending = pendingCodes.get(code);
    if (!pending) {
      return res.status(404).json({ error: "Code expired or invalid" });
    }
    pendingCodes.delete(code);
    // Pairing succeeded — this room is now "real" and should survive
    // until the user explicitly unpairs.
    pendingRoomIds.delete(pending.roomId);
    try {
      const [room] = await db
        .select({ id: castRooms.id, label: castRooms.label })
        .from(castRooms)
        .where(eq(castRooms.id, pending.roomId))
        .limit(1);
      if (!room) {
        return res.status(404).json({ error: "Room no longer exists" });
      }
      // Notify TVs in this room that pairing succeeded so they can swap UI.
      broadcast(pending.roomId, { type: "paired", roomId: pending.roomId, label: room.label });
      res.json({ roomId: room.id, label: room.label });
    } catch (err: unknown) {
      console.error("[Cast] /pair failed:", err);
      res.status(500).json({ error: "Pairing failed" });
    }
  });

  // ─── HTTP: Laptop pushes a snapshot to a room ──────────────────────────
  app.post("/api/cast/rooms/:id/push", async (req: Request, res: Response) => {
    const roomId = String(req.params.id ?? "").trim();
    if (!roomId) return res.status(400).json({ error: "Missing room id" });

    const parsed = castSnapshotSchema.safeParse(req.body?.snapshot);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid snapshot shape" });
    }
    const snapshot: CastSnapshot = parsed.data;

    // Reject anything obviously oversized so a runaway dashboard can't OOM us.
    const approxBytes = Buffer.byteLength(JSON.stringify(snapshot), "utf8");
    if (approxBytes > SNAPSHOT_BYTES_LIMIT) {
      return res.status(413).json({ error: "Snapshot too large" });
    }

    try {
      const [updated] = await db
        .update(castRooms)
        .set({ lastSnapshot: snapshot, lastPushedAt: new Date() })
        .where(eq(castRooms.id, roomId))
        .returning({ id: castRooms.id });
      if (!updated) {
        return res.status(404).json({ error: "Room not found" });
      }
      broadcast(roomId, { type: "snapshot", snapshot });
      res.json({ ok: true, pushedAt: snapshot.pushedAt });
    } catch (err: unknown) {
      console.error("[Cast] /push failed:", err);
      res.status(500).json({ error: "Push failed" });
    }
  });

  // ─── HTTP: Either side renames the TV ──────────────────────────────────
  app.patch("/api/cast/rooms/:id", async (req: Request, res: Response) => {
    const roomId = String(req.params.id ?? "").trim();
    const label = String(req.body?.label ?? "").trim().slice(0, 40);
    if (!roomId) return res.status(400).json({ error: "Missing room id" });
    if (!label) return res.status(400).json({ error: "Label required" });
    try {
      const [updated] = await db
        .update(castRooms)
        .set({ label })
        .where(eq(castRooms.id, roomId))
        .returning({ id: castRooms.id, label: castRooms.label });
      if (!updated) return res.status(404).json({ error: "Room not found" });
      broadcast(roomId, { type: "renamed", label: updated.label });
      res.json({ roomId: updated.id, label: updated.label });
    } catch (err: unknown) {
      console.error("[Cast] /rename failed:", err);
      res.status(500).json({ error: "Rename failed" });
    }
  });

  // ─── HTTP: Either side fetches room metadata (label + lastPushedAt) ────
  app.get("/api/cast/rooms/:id", async (req: Request, res: Response) => {
    const roomId = String(req.params.id ?? "").trim();
    if (!roomId) return res.status(400).json({ error: "Missing room id" });
    try {
      const [room] = await db
        .select({
          id: castRooms.id,
          label: castRooms.label,
          lastPushedAt: castRooms.lastPushedAt,
        })
        .from(castRooms)
        .where(eq(castRooms.id, roomId))
        .limit(1);
      if (!room) return res.status(404).json({ error: "Room not found" });
      res.json(room);
    } catch (err: unknown) {
      console.error("[Cast] /get failed:", err);
      res.status(500).json({ error: "Lookup failed" });
    }
  });

  // ─── HTTP: Unpair / delete a room ──────────────────────────────────────
  app.delete("/api/cast/rooms/:id", async (req: Request, res: Response) => {
    const roomId = String(req.params.id ?? "").trim();
    if (!roomId) return res.status(400).json({ error: "Missing room id" });
    try {
      await db.delete(castRooms).where(eq(castRooms.id, roomId));
      closeRoomConns(roomId, "Room deleted");
      res.json({ ok: true });
    } catch (err: unknown) {
      console.error("[Cast] /delete failed:", err);
      res.status(500).json({ error: "Delete failed" });
    }
  });

  // ─── WebSocket hub at /ws/cast?roomId=XXX&role=tv|laptop ───────────────
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    if (!request.url) return;
    const url = new URL(request.url, "http://localhost");
    if (!url.pathname.startsWith("/ws/cast")) return;

    const roomId = url.searchParams.get("roomId");
    const role = url.searchParams.get("role");
    if (!roomId || (role !== "tv" && role !== "laptop")) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, { roomId, role });
    });
  });

  wss.on(
    "connection",
    (ws: WebSocket, _req: unknown, ctx: { roomId: string; role: "tv" | "laptop" }) => {
      const { roomId, role } = ctx;
      let set = roomConns.get(roomId);
      if (!set) {
        set = new Set();
        roomConns.set(roomId, set);
      }
      const conn: RoomConn = { ws, role };
      set.add(conn);

      ws.send(JSON.stringify({ type: "hello", role }));

      // If a TV (re)connects and we already have a stored snapshot, replay
      // it immediately so the screen isn't blank.
      if (role === "tv") {
        db.select({ lastSnapshot: castRooms.lastSnapshot, label: castRooms.label })
          .from(castRooms)
          .where(eq(castRooms.id, roomId))
          .limit(1)
          .then((rows) => {
            const row = rows[0];
            if (!row) {
              ws.send(JSON.stringify({ type: "closed", reason: "Room not found" }));
              ws.close(1000, "Room not found");
              return;
            }
            if (row.label) {
              ws.send(JSON.stringify({ type: "renamed", label: row.label }));
            }
            if (row.lastSnapshot) {
              ws.send(JSON.stringify({ type: "snapshot", snapshot: row.lastSnapshot }));
            }
          })
          .catch((err: unknown) => {
            console.error("[Cast] WS replay failed:", err);
          });
      }

      ws.on("message", (data) => {
        // Forward laptop-originated messages to TVs. Used for lightweight
        // ping-style health checks. Snapshot pushes go through HTTP, not WS.
        try {
          const parsed = JSON.parse(String(data));
          if (parsed?.type === "ping") {
            ws.send(JSON.stringify({ type: "pong", t: Date.now() }));
          }
        } catch {
          /* ignore non-JSON */
        }
      });

      ws.on("close", () => {
        const s = roomConns.get(roomId);
        if (!s) return;
        s.delete(conn);
        if (s.size === 0) roomConns.delete(roomId);
      });

      ws.on("error", () => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      });
    },
  );

  // Periodic code purge so an idle TV doesn't leave dangling rooms forever.
  setInterval(() => {
    purgeExpiredCodes().catch((err: unknown) => {
      console.error("[Cast] purgeExpiredCodes failed:", err);
    });
  }, 30_000).unref();
}
