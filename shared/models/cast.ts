import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const castRooms = pgTable("cast_rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  label: varchar("label").notNull().default("TV"),
  lastSnapshot: jsonb("last_snapshot"),
  lastPushedAt: timestamp("last_pushed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCastRoomSchema = createInsertSchema(castRooms).omit({
  id: true,
  createdAt: true,
  lastPushedAt: true,
});

export type CastRoom = typeof castRooms.$inferSelect;
export type InsertCastRoom = z.infer<typeof insertCastRoomSchema>;

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
});
