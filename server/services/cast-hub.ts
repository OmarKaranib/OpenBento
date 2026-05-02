// Cast Hub: HTTP + WebSocket relay backing the "Cast to TV" feature.
// Design (intentional, vs. spec's pairing_code/expires_at columns): pairing
// codes are kept in-memory only (60s TTL). They never need to outlive a single
// pair attempt and re-issuing on restart is harmless (the TV auto-fetches a
// fresh code). Persisted rooms still live in `cast_rooms`. A 30s sweeper
// deletes rooms whose pending code expired before pairing, so /codes spam
// can't bloat the DB.
// Anyone with a roomId can push to it (free-tier model — roomId is the secret).
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
const pendingRoomIds = new Set<string>();
const codeRateLimit = new Map<string, { count: number; resetAt: number }>();
// Last time *any* TV websocket for a room was confirmed alive (connect or pong).
// In-memory only — purely a UX hint for the laptop popover, so persistence is
// unnecessary and a server restart resetting it is acceptable.
const tvLastSeen = new Map<string, number>();

const CODE_TTL_MS = 60_000;
const SNAPSHOT_BYTES_LIMIT = 4 * 1024 * 1024;
const CODE_RATE_WINDOW_MS = 60_000;
const CODE_RATE_MAX = 10;
// Heartbeat: ping every 5s, terminate sockets that miss two consecutive pongs.
// This bounds the offline-detection lag to ~10s for unplugged-TV / dead-Wi-Fi
// scenarios where the OS-level socket close never fires.
const HEARTBEAT_INTERVAL_MS = 5_000;

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
    if (p.expiresAt <= now) expired.push(code);
  });
  for (const code of expired) {
    const p = pendingCodes.get(code);
    pendingCodes.delete(code);
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

function sendTo(ws: WebSocket, payload: unknown): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function tvCount(roomId: string): number {
  const set = roomConns.get(roomId);
  if (!set) return 0;
  let n = 0;
  set.forEach((c) => {
    if (c.role === "tv" && c.ws.readyState === WebSocket.OPEN) n++;
  });
  return n;
}

function broadcastPresenceToLaptops(roomId: string): void {
  const set = roomConns.get(roomId);
  if (!set) return;
  const count = tvCount(roomId);
  const lastSeenAt = tvLastSeen.get(roomId);
  const payload = JSON.stringify({
    type: "presence",
    tvOnline: count > 0,
    tvCount: count,
    lastSeenAt: lastSeenAt ?? null,
  });
  set.forEach((conn) => {
    if (conn.role !== "laptop") return;
    if (conn.ws.readyState === WebSocket.OPEN) {
      try {
        conn.ws.send(payload);
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
      broadcast(pending.roomId, { type: "paired", roomId: pending.roomId, label: room.label });
      res.json({ roomId: room.id, label: room.label });
    } catch (err: unknown) {
      console.error("[Cast] /pair failed:", err);
      res.status(500).json({ error: "Pairing failed" });
    }
  });

  app.post("/api/cast/rooms/:id/push", async (req: Request, res: Response) => {
    const roomId = String(req.params.id ?? "").trim();
    if (!roomId) return res.status(400).json({ error: "Missing room id" });

    const parsed = castSnapshotSchema.safeParse(req.body?.snapshot);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid snapshot shape" });
    }
    const snapshot: CastSnapshot = parsed.data;

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
      const tvOnline = tvCount(roomId) > 0;
      const lastSeenAt = tvLastSeen.get(roomId) ?? null;
      res.json({ ...room, tvOnline, lastSeenAt });
    } catch (err: unknown) {
      console.error("[Cast] /get failed:", err);
      res.status(500).json({ error: "Lookup failed" });
    }
  });

  app.delete("/api/cast/rooms/:id", async (req: Request, res: Response) => {
    const roomId = String(req.params.id ?? "").trim();
    if (!roomId) return res.status(400).json({ error: "Missing room id" });
    try {
      await db.delete(castRooms).where(eq(castRooms.id, roomId));
      closeRoomConns(roomId, "Room deleted");
      tvLastSeen.delete(roomId);
      res.json({ ok: true });
    } catch (err: unknown) {
      console.error("[Cast] /delete failed:", err);
      res.status(500).json({ error: "Delete failed" });
    }
  });

  // WebSocket hub at /ws/cast?roomId=XXX&role=tv|laptop
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

      if (role === "tv") {
        tvLastSeen.set(roomId, Date.now());
      }

      // Heartbeat — terminate the socket if two consecutive pings go
      // unanswered. ws's pong frame is automatic; we only need to track it.
      let isAlive = true;
      ws.on("pong", () => {
        isAlive = true;
        if (role === "tv") tvLastSeen.set(roomId, Date.now());
      });
      const heartbeat = setInterval(() => {
        if (!isAlive) {
          try {
            ws.terminate();
          } catch {
            /* ignore */
          }
          return;
        }
        isAlive = false;
        try {
          ws.ping();
        } catch {
          /* ignore */
        }
      }, HEARTBEAT_INTERVAL_MS);
      heartbeat.unref();

      sendTo(ws, { type: "hello", role });

      // Validate the room exists for *both* roles. Closes the socket with a
      // {type:'closed'} so the client can prune its local list immediately.
      db.select({ lastSnapshot: castRooms.lastSnapshot, label: castRooms.label })
        .from(castRooms)
        .where(eq(castRooms.id, roomId))
        .limit(1)
        .then((rows) => {
          const row = rows[0];
          if (!row) {
            sendTo(ws, { type: "closed", reason: "Room not found" });
            // Room no longer exists — drop any stale presence entry so the
            // map can't grow unbounded from abandoned/invalid roomIds.
            tvLastSeen.delete(roomId);
            try {
              ws.close(1000, "Room not found");
            } catch {
              /* ignore */
            }
            return;
          }
          if (row.label) sendTo(ws, { type: "renamed", label: row.label });
          if (role === "tv" && row.lastSnapshot) {
            sendTo(ws, { type: "snapshot", snapshot: row.lastSnapshot });
          }
          if (role === "laptop") {
            // Initial presence snapshot for this newly-connected laptop.
            sendTo(ws, {
              type: "presence",
              tvOnline: tvCount(roomId) > 0,
              tvCount: tvCount(roomId),
              lastSeenAt: tvLastSeen.get(roomId) ?? null,
            });
          } else {
            // TV connected — let any laptops in the room update their dots.
            broadcastPresenceToLaptops(roomId);
          }
        })
        .catch((err: unknown) => {
          console.error("[Cast] WS validate failed:", err);
        });

      ws.on("message", (data) => {
        try {
          const parsed = JSON.parse(String(data));
          if (parsed?.type === "ping") {
            sendTo(ws, { type: "pong", t: Date.now() });
          }
        } catch {
          /* ignore non-JSON */
        }
      });

      ws.on("close", () => {
        clearInterval(heartbeat);
        const s = roomConns.get(roomId);
        if (!s) return;
        s.delete(conn);
        if (role === "tv") {
          // Stamp final "last seen" at disconnect so the popover shows when
          // the TV was last actually alive, even after it goes dark.
          tvLastSeen.set(roomId, Date.now());
        }
        if (s.size === 0) {
          roomConns.delete(roomId);
        } else if (role === "tv") {
          broadcastPresenceToLaptops(roomId);
        }
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

  setInterval(() => {
    purgeExpiredCodes().catch((err: unknown) => {
      console.error("[Cast] purgeExpiredCodes failed:", err);
    });
  }, 30_000).unref();
}
