import { randomBytes } from "node:crypto";

interface SocketTicket {
  roomId: string;
  expiresAt: number;
}

interface SocketTicketStoreOptions {
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
  createToken?: () => string;
}

/** Short-lived, one-use credentials for laptop Cast sockets. */
export class CastSocketTicketStore {
  private readonly tickets = new Map<string, SocketTicket>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly createToken: () => string;

  constructor(options: SocketTicketStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? 30_000;
    this.maxEntries = options.maxEntries ?? 1_000;
    this.now = options.now ?? Date.now;
    this.createToken = options.createToken ?? (() => randomBytes(32).toString("base64url"));
  }

  issue(roomId: string): { ticket: string; expiresAt: number } {
    this.purgeExpired();
    while (this.tickets.size >= this.maxEntries) {
      const oldest = this.tickets.keys().next().value;
      if (oldest === undefined) break;
      this.tickets.delete(oldest);
    }

    const ticket = this.createToken();
    const expiresAt = this.now() + this.ttlMs;
    this.tickets.set(ticket, { roomId, expiresAt });
    return { ticket, expiresAt };
  }

  consume(ticket: string, roomId: string): boolean {
    const stored = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    if (!stored) return false;
    return stored.roomId === roomId && stored.expiresAt > this.now();
  }

  private purgeExpired(): void {
    const now = this.now();
    this.tickets.forEach((stored, ticket) => {
      if (stored.expiresAt <= now) this.tickets.delete(ticket);
    });
  }
}
