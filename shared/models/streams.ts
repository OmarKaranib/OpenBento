import { sql } from "drizzle-orm";
import { pgTable, varchar, text, timestamp, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const dashboards = pgTable("dashboards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: varchar("name").notNull().default("My Dashboard"),
  widgets: jsonb("widgets").notNull().default([]),
  bgColor: varchar("bg_color"),
  bgImage: text("bg_image"),
  isDefault: boolean("is_default").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_dashboards_user_id").on(table.userId),
]);

export const insertDashboardSchema = createInsertSchema(dashboards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Dashboard = typeof dashboards.$inferSelect;
export type InsertDashboard = z.infer<typeof insertDashboardSchema>;

export interface DashboardWidget {
  id: string;
  type: 'video' | 'note' | 'spacer' | 'image';
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  url?: string;
  content?: string;
  platform?: string;
  channelId?: string;
  videoId?: string;
  isLive?: boolean;
  customColor?: string;
  logoUrl?: string;
  name?: string;
}

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

export const channels = pgTable("channels", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  channelHandle: varchar("channel_handle"),
  platform: varchar("platform").notNull().default("youtube"),
  iconType: varchar("icon_type"),
  category: varchar("category"),
  videoId: varchar("video_id"),
  url: text("url"),
  isLive: boolean("is_live").default(true),
  isForced: boolean("is_forced").default(false),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_channels_platform").on(table.platform),
  index("idx_channels_category").on(table.category),
]);

export const insertChannelSchema = createInsertSchema(channels).omit({
  createdAt: true,
  updatedAt: true,
});

export type Channel = typeof channels.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;
