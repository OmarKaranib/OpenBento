import { db } from './db';
import { 
  userLibrary, 
  streamStatusCache, 
  healingLog,
  dashboards,
  channels,
  profiles,
  type UserLibraryItem,
  type InsertUserLibraryItem,
  type StreamStatus,
  type Dashboard,
  type InsertDashboard,
  type Channel,
  type InsertChannel,
  type Profile,
  type InsertProfile,
} from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";

export interface IStorage {
  getUserLibrary(userId: string): Promise<UserLibraryItem[]>;
  addToLibrary(item: InsertUserLibraryItem): Promise<UserLibraryItem>;
  removeFromLibrary(id: string, userId: string): Promise<boolean>;
  updateLibraryItem(id: string, userId: string, updates: Partial<InsertUserLibraryItem>): Promise<UserLibraryItem | null>;
  
  getStreamStatus(channelId: string): Promise<StreamStatus | null>;
  getAllStreamStatuses(): Promise<StreamStatus[]>;
  updateStreamStatus(channelId: string, updates: Partial<StreamStatus>): Promise<void>;
  
  logHealing(channelId: string, oldVideoId: string | null, newVideoId: string | null, searchQuery: string, success: boolean, failureReason?: string): Promise<void>;
  
  getDashboard(userId: string): Promise<Dashboard | null>;
  saveDashboard(data: InsertDashboard): Promise<Dashboard>;
  updateDashboard(userId: string, updates: Partial<InsertDashboard>): Promise<Dashboard | null>;
  
  getAllChannels(): Promise<Channel[]>;
  getChannel(id: string): Promise<Channel | null>;
  createChannel(data: InsertChannel): Promise<Channel>;
  updateChannel(id: string, updates: Partial<InsertChannel>): Promise<Channel | null>;
  deleteChannel(id: string): Promise<boolean>;
  
  // Profile methods for premium/paywall
  getProfile(id: string): Promise<Profile | null>;
  getProfilesByIds(ids: string[]): Promise<Profile[]>;
  upsertProfile(data: InsertProfile): Promise<Profile>;
  updateProfilePremium(id: string, isPremium: boolean): Promise<Profile | null>;
}

export class DatabaseStorage implements IStorage {
  async getUserLibrary(userId: string): Promise<UserLibraryItem[]> {
    return await db.select()
      .from(userLibrary)
      .where(eq(userLibrary.userId, userId));
  }

  async addToLibrary(item: InsertUserLibraryItem): Promise<UserLibraryItem> {
    const [inserted] = await db.insert(userLibrary)
      .values(item)
      .returning();
    return inserted;
  }

  async removeFromLibrary(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(userLibrary)
      .where(and(eq(userLibrary.id, id), eq(userLibrary.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async updateLibraryItem(id: string, userId: string, updates: Partial<InsertUserLibraryItem>): Promise<UserLibraryItem | null> {
    const [updated] = await db.update(userLibrary)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(userLibrary.id, id), eq(userLibrary.userId, userId)))
      .returning();
    return updated || null;
  }

  async getStreamStatus(channelId: string): Promise<StreamStatus | null> {
    const [status] = await db.select()
      .from(streamStatusCache)
      .where(eq(streamStatusCache.channelId, channelId))
      .limit(1);
    return status || null;
  }

  async getAllStreamStatuses(): Promise<StreamStatus[]> {
    return await db.select().from(streamStatusCache);
  }

  async updateStreamStatus(channelId: string, updates: Partial<StreamStatus>): Promise<void> {
    await db.update(streamStatusCache)
      .set({ ...updates, lastChecked: new Date() })
      .where(eq(streamStatusCache.channelId, channelId));
  }

  async logHealing(
    channelId: string,
    oldVideoId: string | null,
    newVideoId: string | null,
    searchQuery: string,
    success: boolean,
    failureReason?: string
  ): Promise<void> {
    await db.insert(healingLog).values({
      channelId,
      oldVideoId,
      newVideoId,
      searchQuery,
      success,
      failureReason,
    });
  }

  async getDashboard(userId: string): Promise<Dashboard | null> {
    const [dashboard] = await db.select()
      .from(dashboards)
      .where(eq(dashboards.userId, userId))
      .limit(1);
    return dashboard || null;
  }

  async saveDashboard(data: InsertDashboard): Promise<Dashboard> {
    const existing = await this.getDashboard(data.userId);
    
    if (existing) {
      const [updated] = await db.update(dashboards)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(dashboards.userId, data.userId))
        .returning();
      return updated;
    }
    
    const [inserted] = await db.insert(dashboards)
      .values(data)
      .returning();
    return inserted;
  }

  async updateDashboard(userId: string, updates: Partial<InsertDashboard>): Promise<Dashboard | null> {
    const [updated] = await db.update(dashboards)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(dashboards.userId, userId))
      .returning();
    return updated || null;
  }

  async getAllChannels(): Promise<Channel[]> {
    return await db.select().from(channels);
  }

  async getChannel(id: string): Promise<Channel | null> {
    const [channel] = await db.select()
      .from(channels)
      .where(eq(channels.id, id))
      .limit(1);
    return channel || null;
  }

  async createChannel(data: InsertChannel): Promise<Channel> {
    const [inserted] = await db.insert(channels)
      .values(data)
      .returning();
    return inserted;
  }

  async updateChannel(id: string, updates: Partial<InsertChannel>): Promise<Channel | null> {
    const [updated] = await db.update(channels)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(channels.id, id))
      .returning();
    return updated || null;
  }

  async deleteChannel(id: string): Promise<boolean> {
    const result = await db.delete(channels)
      .where(eq(channels.id, id))
      .returning();
    return result.length > 0;
  }

  // Profile methods for premium/paywall
  async getProfile(id: string): Promise<Profile | null> {
    const [profile] = await db.select()
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);
    return profile || null;
  }

  async getProfilesByIds(ids: string[]): Promise<Profile[]> {
    if (ids.length === 0) return [];
    return await db.select()
      .from(profiles)
      .where(inArray(profiles.id, ids));
  }

  async upsertProfile(data: InsertProfile): Promise<Profile> {
    const [inserted] = await db.insert(profiles)
      .values(data)
      .onConflictDoUpdate({
        target: profiles.id,
        set: { email: data.email, isPremium: data.isPremium, updatedAt: new Date() }
      })
      .returning();
    return inserted;
  }

  async updateProfilePremium(id: string, isPremium: boolean): Promise<Profile | null> {
    const [updated] = await db.update(profiles)
      .set({ isPremium, updatedAt: new Date() })
      .where(eq(profiles.id, id))
      .returning();
    return updated || null;
  }
}

export const storage = new DatabaseStorage();
