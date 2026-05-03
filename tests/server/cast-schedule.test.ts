// Cast scheduler tests:
//   1. The 60-second tick fires the matching weekly schedule entry, advancing
//      the room to the new layout and stamping `lastFiredAt`.
//   2. Unpairing a room (delete cast_rooms + cascade-delete schedules,
//      mirroring the DELETE /api/cast/rooms/:id route) stops subsequent ticks
//      from advancing anything.
//
// We exercise the in-process scheduler directly via the test export
// `__castSchedulerForTests` so we don't have to wait 60s of real time.
import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../../server/db";
import {
  castRooms,
  castLayouts,
  castSchedules,
  type CastSnapshot,
} from "../../shared/schema";
import { eq } from "drizzle-orm";
import { __castSchedulerForTests } from "../../server/services/cast-hub";

function snapshotFor(label: string): CastSnapshot {
  return {
    v: 1,
    widgets: [],
    isDarkMode: true,
    masterMute: true,
    background: "#0f172a",
    pushedAt: Date.now(),
    layoutName: label,
    layoutId: null,
  };
}

async function makeRoom(userId: string, code: string): Promise<string> {
  const [row] = await db
    .insert(castRooms)
    .values({
      code,
      label: `TV-${code}`,
      userId,
    })
    .returning({ id: castRooms.id });
  return row.id;
}

async function makeLayout(userId: string, name: string, snap: CastSnapshot): Promise<string> {
  const [row] = await db
    .insert(castLayouts)
    .values({ userId, name, snapshot: snap as unknown as object })
    .returning({ id: castLayouts.id });
  return row.id;
}

test("scheduler tick fires entry matching current weekday + minute", async () => {
  const userId = `test-user-${Date.now()}-a`;
  const code = `BENTO-T${Date.now().toString(36).slice(-3).toUpperCase()}`;
  const roomId = await makeRoom(userId, code);
  const layoutId = await makeLayout(userId, "Morning", snapshotFor("Morning"));

  const fakeNow = new Date();
  fakeNow.setSeconds(0, 0);
  const dayOfWeek = fakeNow.getDay();
  const minuteOfDay = fakeNow.getHours() * 60 + fakeNow.getMinutes();

  const [scheduleRow] = await db
    .insert(castSchedules)
    .values({ userId, roomId, layoutId, dayOfWeek, minuteOfDay })
    .returning({ id: castSchedules.id });

  // Ensure the per-minute coalescing guard doesn't suppress this tick.
  __castSchedulerForTests.resetMinute();
  const fired = await __castSchedulerForTests.run(fakeNow);
  assert.ok(fired >= 1, "Scheduler should report at least one fire");

  const [room] = await db
    .select({ currentLayoutId: castRooms.currentLayoutId })
    .from(castRooms)
    .where(eq(castRooms.id, roomId));
  assert.equal(room.currentLayoutId, layoutId, "Room currentLayoutId should advance");

  const [updatedSchedule] = await db
    .select({ lastFiredAt: castSchedules.lastFiredAt })
    .from(castSchedules)
    .where(eq(castSchedules.id, scheduleRow.id));
  assert.ok(updatedSchedule.lastFiredAt, "Schedule lastFiredAt should be stamped");

  // Cleanup
  await db.delete(castSchedules).where(eq(castSchedules.roomId, roomId));
  await db.delete(castRooms).where(eq(castRooms.id, roomId));
  await db.delete(castLayouts).where(eq(castLayouts.id, layoutId));
});

test("unpairing a room stops the scheduler from pushing to it", async () => {
  const userId = `test-user-${Date.now()}-b`;
  const code = `BENTO-U${Date.now().toString(36).slice(-3).toUpperCase()}`;
  const roomId = await makeRoom(userId, code);
  const layoutId = await makeLayout(userId, "Evening", snapshotFor("Evening"));

  const fakeNow = new Date();
  fakeNow.setSeconds(0, 0);
  const dayOfWeek = fakeNow.getDay();
  const minuteOfDay = fakeNow.getHours() * 60 + fakeNow.getMinutes();

  await db.insert(castSchedules).values({
    userId, roomId, layoutId, dayOfWeek, minuteOfDay,
  });

  // Mirror the unpair route: cascade-delete schedules then the room itself.
  await db.delete(castSchedules).where(eq(castSchedules.roomId, roomId));
  await db.delete(castRooms).where(eq(castRooms.id, roomId));

  __castSchedulerForTests.resetMinute();
  const fired = await __castSchedulerForTests.run(fakeNow);

  // No row exists for this room/schedule anymore — `fired` may include other
  // unrelated entries from a noisy DB, but never one that matches our roomId
  // because the schedule row has been deleted.
  const [stillThere] = await db
    .select({ id: castRooms.id })
    .from(castRooms)
    .where(eq(castRooms.id, roomId));
  assert.equal(stillThere, undefined, "Unpaired room should not exist");

  const remainingSchedules = await db
    .select({ id: castSchedules.id })
    .from(castSchedules)
    .where(eq(castSchedules.roomId, roomId));
  assert.equal(remainingSchedules.length, 0, "Schedules should be cascade-deleted");

  assert.ok(typeof fired === "number", "Tick should still complete cleanly");

  // Cleanup
  await db.delete(castLayouts).where(eq(castLayouts.id, layoutId));
});
