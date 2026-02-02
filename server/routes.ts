import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { loadLinks, refreshAllLinks, getChannelUrl, startLinkRefresher } from "./link-refresher";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { initializePulseCache, getGlobalStreamStatus, getStreamStatus, registerChannel } from "./services/pulse-cache";
import { healStream, getVideoDetails, isMusicCategory } from "./services/youtube-api";
import { insertUserLibrarySchema, insertDashboardSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  startLinkRefresher();
  
  initializePulseCache();

  app.get("/api/links", (req, res) => {
    const origin = req.headers.origin || req.headers.referer || `${req.protocol}://${req.get('host')}`;
    const linksData = loadLinks();
    
    const channels = linksData.channels.map(channel => ({
      id: channel.id,
      name: channel.name,
      url: getChannelUrl(channel, origin),
      iconType: channel.iconType,
      category: channel.category,
      platform: channel.platform,
      channelId: channel.platform === 'youtube' ? channel.channelHandle : channel.channelHandle,
      videoId: channel.videoId,
      lastUpdated: channel.lastUpdated,
    }));

    res.json({
      channels,
      lastRefresh: linksData.lastRefresh,
      origin,
    });
  });

  app.post("/api/links/refresh", async (req, res) => {
    try {
      const data = await refreshAllLinks();
      res.json({ success: true, channelCount: data.channels.length, lastRefresh: data.lastRefresh });
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.get("/api/stream-status", (req, res) => {
    const globalStatus = getGlobalStreamStatus();
    res.json({
      status: globalStatus,
      count: Object.keys(globalStatus).length,
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/api/stream-status/:channelId", (req, res) => {
    const { channelId } = req.params;
    const status = getStreamStatus(channelId);
    
    if (!status) {
      return res.status(404).json({ error: "Channel not found in cache" });
    }
    
    res.json(status);
  });

  app.post("/api/stream/register", async (req, res) => {
    const { channelId, channelName, platform, videoId } = req.body;
    
    if (!channelId || !channelName || !platform) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    await registerChannel(channelId, channelName, platform, videoId);
    res.json({ success: true });
  });

  app.post("/api/stream/heal", async (req, res) => {
    const { channelId, channelName, currentVideoId } = req.body;
    const apiKey = process.env.YOUTUBE_API_KEY;
    
    if (!apiKey) {
      return res.status(503).json({ 
        success: false, 
        error: "YouTube API key not configured" 
      });
    }
    
    if (!channelId || !channelName) {
      return res.status(400).json({ error: "Missing channelId or channelName" });
    }
    
    try {
      const result = await healStream(channelName, channelId, apiKey);
      
      await storage.logHealing(
        channelId,
        currentVideoId || null,
        result.newVideoId || null,
        `${channelName} Live`,
        result.success,
        result.reason
      );
      
      if (result.success && result.newVideoId) {
        await registerChannel(channelId, channelName, 'youtube', result.newVideoId);
      }
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: String(error) 
      });
    }
  });

  app.get("/api/live-video", async (req, res) => {
    const { channelId } = req.query;
    const apiKey = process.env.YOUTUBE_API_KEY;
    
    if (!channelId || typeof channelId !== 'string') {
      return res.status(400).json({ error: "Missing channelId parameter" });
    }
    
    if (!apiKey) {
      return res.status(503).json({ 
        error: "YouTube API key not configured",
        videoId: null 
      });
    }
    
    try {
      console.log(`[LiveVideo] Fetching fresh videoId for channel: ${channelId}`);
      const result = await healStream(channelId, channelId, apiKey);
      
      if (result.success && result.newVideoId) {
        console.log(`[LiveVideo] Found videoId: ${result.newVideoId} for channel: ${channelId}`);
        res.json({ 
          videoId: result.newVideoId,
          channelId,
          isLive: true
        });
      } else {
        console.log(`[LiveVideo] No live stream found for channel: ${channelId} - ${result.reason}`);
        res.json({ 
          videoId: null,
          channelId,
          reason: result.reason || "No live stream found"
        });
      }
    } catch (error) {
      console.error(`[LiveVideo] Error fetching videoId for ${channelId}:`, error);
      res.status(500).json({ 
        error: String(error),
        videoId: null 
      });
    }
  });

  app.post("/api/stream/validate", async (req, res) => {
    const { videoId } = req.body;
    const apiKey = process.env.YOUTUBE_API_KEY;
    
    if (!apiKey) {
      return res.status(503).json({ valid: true, reason: "API key not configured - assuming valid" });
    }
    
    if (!videoId) {
      return res.status(400).json({ error: "Missing videoId" });
    }
    
    try {
      const details = await getVideoDetails(videoId, apiKey);
      
      if (!details) {
        return res.json({ valid: false, reason: "Video not found" });
      }
      
      if (isMusicCategory(details.categoryId)) {
        return res.json({ valid: false, reason: "Music category (filtered)" });
      }
      
      if (!details.isEmbeddable) {
        return res.json({ valid: false, reason: "Not embeddable" });
      }
      
      res.json({ 
        valid: true, 
        channelId: details.channelId,
        isLive: details.liveBroadcastContent === 'live'
      });
    } catch (error) {
      res.status(500).json({ valid: false, error: String(error) });
    }
  });

  app.get("/api/library", async (req: Request, res: Response) => {
    const userId = (req as any).userId || (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const library = await storage.getUserLibrary(userId);
      res.json({ items: library });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/library", async (req: Request, res: Response) => {
    const userId = (req as any).userId || (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const validation = insertUserLibrarySchema.safeParse({ ...req.body, userId });
      
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.message });
      }
      
      const item = await storage.addToLibrary(validation.data);
      res.json({ item });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.delete("/api/library/:id", async (req: Request, res: Response) => {
    const userId = (req as any).userId || (req as any).user?.id;
    const id = req.params.id as string;
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const deleted = await storage.removeFromLibrary(id, userId);
      res.json({ success: deleted });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.patch("/api/library/:id", async (req: Request, res: Response) => {
    const userId = (req as any).userId || (req as any).user?.id;
    const id = req.params.id as string;
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const updated = await storage.updateLibraryItem(id, userId, req.body);
      
      if (!updated) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      res.json({ item: updated });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/dashboard", async (req: Request, res: Response) => {
    const userId = (req as any).userId || (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const dashboard = await storage.getDashboard(userId);
      res.json({ dashboard });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/dashboard", async (req: Request, res: Response) => {
    const userId = (req as any).userId || (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const validation = insertDashboardSchema.safeParse({ ...req.body, userId });
      
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.message });
      }
      
      const dashboard = await storage.saveDashboard(validation.data);
      res.json({ dashboard });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.patch("/api/dashboard", async (req: Request, res: Response) => {
    const userId = (req as any).userId || (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    try {
      const dashboard = await storage.updateDashboard(userId, req.body);
      
      if (!dashboard) {
        return res.status(404).json({ error: "Dashboard not found" });
      }
      
      res.json({ dashboard });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  return httpServer;
}
