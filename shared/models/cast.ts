import { sql } from "drizzle-orm";
import { pgTable, varchar, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// cast_rooms holds both guest rooms (userId null, code null, ephemeral) and
// signed-in rooms (userId set, persistent BENTO-XXXX code). Adding columns is
// non-destructive — guest paths keep the existing 6-digit pairing flow.
export const castRooms = pgTable(
  "cast_rooms",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id"), // null for guest rooms
    code: varchar("code"), // BENTO-XXXX for persistent rooms; null for guest
    label: varchar("label").notNull().default("TV"),
    currentLayoutId: varchar("current_layout_id"),
    lastSnapshot: jsonb("last_snapshot"),
    lastPushedAt: timestamp("last_pushed_at"),
    lastSeenAt: timestamp("last_seen_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("idx_cast_rooms_user").on(t.userId), index("idx_cast_rooms_code").on(t.code)],
);

export const insertCastRoomSchema = createInsertSchema(castRooms).omit({
  id: true,
  createdAt: true,
  lastPushedAt: true,
  lastSeenAt: true,
});

export type CastRoom = typeof castRooms.$inferSelect;
export type InsertCastRoom = z.infer<typeof insertCastRoomSchema>;

// User-saved layouts (a snapshot of widgets the user named e.g. "Morning").
// These power the schedule engine without re-keying widget state into cron.
export const castLayouts = pgTable(
  "cast_layouts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    name: varchar("name").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("idx_cast_layouts_user").on(t.userId)],
);
export type CastLayout = typeof castLayouts.$inferSelect;

// cast_schedules: per-room weekly entries. dayOfWeek: 0-6 (Sun=0). hhmm: 0-1439.
export const castSchedules = pgTable(
  "cast_schedules",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    roomId: varchar("room_id").notNull(),
    userId: varchar("user_id").notNull(),
    layoutId: varchar("layout_id").notNull(),
    dayOfWeek: integer("day_of_week").notNull(), // 0..6
    minuteOfDay: integer("minute_of_day").notNull(), // 0..1439
    timeZone: varchar("time_zone").notNull().default("UTC"),
    lastFiredAt: timestamp("last_fired_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("idx_cast_schedules_room").on(t.roomId)],
);
export type CastSchedule = typeof castSchedules.$inferSelect;

export interface CastSnapshotWidget {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  [key: string]: unknown;
}

export interface CastSnapshot {
  v: 1;
  widgets: CastSnapshotWidget[];
  isDarkMode: boolean;
  masterMute: boolean;
  background: string;
  pushedAt: number;
  // Optional metadata added in this iteration. Older callers still parse fine
  // (passthrough), older TVs simply don't render the overlay strings.
  layoutId?: string | null;
  layoutName?: string | null;
}

export const castSnapshotSchema = z.object({
  v: z.literal(1),
  widgets: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    }).passthrough(),
  ),
  isDarkMode: z.boolean(),
  masterMute: z.boolean(),
  background: z.string().max(2048).default(""),
  pushedAt: z.number(),
  layoutId: z.string().max(64).nullable().optional(),
  layoutName: z.string().max(80).nullable().optional(),
});
