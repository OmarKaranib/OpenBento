import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userLibrary = pgTable("user_library", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: varchar("name").notNull(),
  url: text("url").notNull(),
  platform: varchar("platform").notNull(),
  channelId: varchar("channel_id"),
  videoId: varchar("video_id"),
  logoUrl: text("logo_url"),
  category: varchar("category"),
  isLive: boolean("is_live").default(false),
  customColor: varchar("custom_color"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_library_user_id").on(table.userId),
]);

export const streamStatusCache = pgTable("stream_status_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id").notNull().unique(),
  channelName: varchar("channel_name").notNull(),
  platform: varchar("platform").notNull(),
  currentVideoId: varchar("current_video_id"),
  isLive: boolean("is_live").default(false),
  isHealthy: boolean("is_healthy").default(true),
  lastChecked: timestamp("last_checked").defaultNow(),
  lastHealedAt: timestamp("last_healed_at"),
  errorCode: varchar("error_code"),
  errorCount: integer("error_count").default(0),
  metadata: jsonb("metadata"),
}, (table) => [
  index("idx_stream_cache_channel").on(table.channelId),
  index("idx_stream_cache_platform").on(table.platform),
]);

export const healingLog = pgTable("healing_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id").notNull(),
  oldVideoId: varchar("old_video_id"),
  newVideoId: varchar("new_video_id"),
  healedAt: timestamp("healed_at").defaultNow(),
  searchQuery: text("search_query"),
  success: boolean("success").default(false),
  failureReason: text("failure_reason"),
});

export const insertUserLibrarySchema = createInsertSchema(userLibrary).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStreamStatusSchema = createInsertSchema(streamStatusCache).omit({
  id: true,
  lastChecked: true,
  lastHealedAt: true,
});

export type UserLibraryItem = typeof userLibrary.$inferSelect;
export type InsertUserLibraryItem = z.infer<typeof insertUserLibrarySchema>;
export type StreamStatus = typeof streamStatusCache.$inferSelect;
export type InsertStreamStatus = z.infer<typeof insertStreamStatusSchema>;
export type HealingLogEntry = typeof healingLog.$inferSelect;
