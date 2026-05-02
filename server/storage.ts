import { db } from './db';
import { 
  userLibrary, 
  streamStatusCache, 
  healingLog,
  dashboards,
  channels,
  profiles,
  feedback,
  type UserLibraryItem,
  type InsertUserLibraryItem,
  type StreamStatus,
  type Dashboard,
  type InsertDashboard,
  type Channel,
  type InsertChannel,
  type Profile,
  type InsertProfile,
  type Feedback,
  type InsertFeedback,
} from "@shared/schema";
import { eq, and, inArray, desc } from "drizzle-orm";

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
  
  // Profile methods. The `profiles.is_premium` column is retained for legacy
  // compatibility but no code path reads or writes it — OpenBento is fully free.
  getProfile(id: string): Promise<Profile | null>;
  getProfilesByIds(ids: string[]): Promise<Profile[]>;
  upsertProfile(data: InsertProfile): Promise<Profile>;

  // Feedback methods
  createFeedback(data: InsertFeedback): Promise<Feedback>;
  getAllFeedback(): Promise<Feedback[]>;
  checkFeedbackCooldown(clientIp: string, cooldownMinutes: number): Promise<{ allowed: boolean; minutesRemaining?: number }>;
  updateFeedbackCooldown(clientIp: string): Promise<void>;
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

  // Profile methods
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

  async createFeedback(data: InsertFeedback): Promise<Feedback> {
    const [inserted] = await db.insert(feedback)
      .values(data)
      .returning();
    return inserted;
  }

  async getAllFeedback(): Promise<Feedback[]> {
    return await db.select()
      .from(feedback)
      .orderBy(desc(feedback.createdAt));
  }

  private feedbackCooldowns = new Map<string, number>();

  async checkFeedbackCooldown(clientIp: string, cooldownMinutes: number): Promise<{ allowed: boolean; minutesRemaining?: number }> {
    const lastSubmission = this.feedbackCooldowns.get(clientIp);
    if (!lastSubmission) return { allowed: true };
    const elapsed = (Date.now() - lastSubmission) / 60000;
    if (elapsed >= cooldownMinutes) return { allowed: true };
    return { allowed: false, minutesRemaining: cooldownMinutes - elapsed };
  }

  async updateFeedbackCooldown(clientIp: string): Promise<void> {
    this.feedbackCooldowns.set(clientIp, Date.now());
    if (this.feedbackCooldowns.size > 10000) {
      const cutoff = Date.now() - 3600000;
      for (const [ip, ts] of this.feedbackCooldowns) {
        if (ts < cutoff) this.feedbackCooldowns.delete(ip);
      }
    }
  }
}

export const storage = new DatabaseStorage();
