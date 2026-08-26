import { sql } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Legacy session table retained to avoid a destructive database migration.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// Legacy user table retained to avoid a destructive database migration.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Profiles table for additional user data.
// Links to Supabase auth.users via id.
// `isPremium` is retained for legacy compatibility — OpenBento is fully free
// and no code path reads it any more, but the column is kept to avoid a
// destructive schema change.
export const profiles = pgTable("profiles", {
  id: varchar("id").primaryKey(), // Matches Supabase auth.users.id
  email: varchar("email"),
  isPremium: boolean("is_premium").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type InsertProfile = typeof profiles.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
