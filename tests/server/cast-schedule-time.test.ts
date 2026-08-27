import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidTimeZone,
  minutesUntilSchedule,
  scheduleMatches,
  zonedScheduleParts,
} from "../../server/services/cast-schedule-time";

test("Cast schedule reads the same moment in each user's time zone", () => {
  const moment = new Date("2026-08-31T05:00:00.000Z");

  assert.deepEqual(zonedScheduleParts(moment, "UTC"), {
    dayOfWeek: 1,
    minuteOfDay: 5 * 60,
  });
  assert.deepEqual(zonedScheduleParts(moment, "Asia/Dubai"), {
    dayOfWeek: 1,
    minuteOfDay: 9 * 60,
  });
});

test("Dubai 09:00 schedule matches 05:00 UTC", () => {
  const moment = new Date("2026-08-31T05:00:00.000Z");

  assert.equal(scheduleMatches(moment, 1, 9 * 60, "Asia/Dubai"), true);
  assert.equal(scheduleMatches(moment, 1, 9 * 60, "UTC"), false);
});

test("next scheduled time is calculated in the saved time zone", () => {
  const now = new Date("2026-08-31T04:55:00.000Z");

  assert.equal(minutesUntilSchedule(now, 1, 9 * 60, "Asia/Dubai"), 5);
  assert.equal(minutesUntilSchedule(now, 1, 9 * 60, "UTC"), 4 * 60 + 5);
});

test("invalid time zone names are rejected", () => {
  assert.equal(isValidTimeZone("Asia/Dubai"), true);
  assert.equal(isValidTimeZone("Not/A_Time_Zone"), false);
});
