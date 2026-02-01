import { db } from './db';
import { 
  userLibrary, 
  streamStatusCache, 
  healingLog,
  type UserLibraryItem,
  type InsertUserLibraryItem,
  type StreamStatus,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  getUserLibrary(userId: string): Promise<UserLibraryItem[]>;
  addToLibrary(item: InsertUserLibraryItem): Promise<UserLibraryItem>;
  removeFromLibrary(id: string, userId: string): Promise<boolean>;
  updateLibraryItem(id: string, userId: string, updates: Partial<InsertUserLibraryItem>): Promise<UserLibraryItem | null>;
  
  getStreamStatus(channelId: string): Promise<StreamStatus | null>;
  getAllStreamStatuses(): Promise<StreamStatus[]>;
  updateStreamStatus(channelId: string, updates: Partial<StreamStatus>): Promise<void>;
  
  logHealing(channelId: string, oldVideoId: string | null, newVideoId: string | null, searchQuery: string, success: boolean, failureReason?: string): Promise<void>;
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
}

export const storage = new DatabaseStorage();
