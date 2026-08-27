import test from "node:test";
import assert from "node:assert/strict";
import { CastSocketTicketStore } from "../../server/services/cast-socket-tickets";

test("Cast socket ticket works once for its own room", () => {
  let tokenNumber = 0;
  const store = new CastSocketTicketStore({
    createToken: () => `ticket-${++tokenNumber}`,
  });
  const { ticket } = store.issue("room-a");

  assert.equal(store.consume(ticket, "room-a"), true);
  assert.equal(store.consume(ticket, "room-a"), false);
});

test("Cast socket ticket cannot be moved to another room", () => {
  const store = new CastSocketTicketStore({ createToken: () => "ticket-a" });
  const { ticket } = store.issue("room-a");

  assert.equal(store.consume(ticket, "room-b"), false);
  assert.equal(store.consume(ticket, "room-a"), false);
});

test("expired Cast socket ticket is rejected", () => {
  let now = 1_000;
  const store = new CastSocketTicketStore({
    ttlMs: 30_000,
    now: () => now,
    createToken: () => "ticket-a",
  });
  const { ticket, expiresAt } = store.issue("room-a");
  assert.equal(expiresAt, 31_000);

  now = expiresAt;
  assert.equal(store.consume(ticket, "room-a"), false);
});
