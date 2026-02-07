import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { loadLinks, refreshAllLinks, getChannelUrl, startLinkRefresher } from "./link-refresher";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { initializePulseCache, getGlobalStreamStatus, getStreamStatus, registerChannel } from "./services/pulse-cache";
import { healStream, getVideoDetails, isMusicCategory, checkChannelLiveStatus, verifyVideoIsLive, searchChannelLiveStream, checkVideoLiveStatusById } from "./services/youtube-api";
import { insertUserLibrarySchema, insertDashboardSchema, insertChannelSchema, insertFeedbackSchema } from "@shared/schema";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { getUncachableResendClient } from "./services/resend-client";

// Admin email list - used for admin access and auto-premium
const ADMIN_EMAILS = [
  'legionofoogabooga@gmail.com',
  'omar.karanib@anculabs.com',
];

const isAdminEmail = (email: string): boolean => {
  return ADMIN_EMAILS.includes(email?.toLowerCase() || '');
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  // Custom signup route with timeout and proper error handling
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    console.log('[Signup Debug] Attempting signup for:', email);

    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceRoleKey) {
        console.error('[Signup Debug] Error details: Supabase credentials not configured');
        return res.status(500).json({ error: "Server configuration error - missing Supabase credentials" });
      }

      // Create AbortController with strict 10-second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        console.log('[Signup Debug] Making Supabase signup request...');

        // Use Supabase Admin API with service role key (admin) to bypass rate limits
        const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const data = await response.json();
        console.log('[Signup Debug] Supabase response status:', response.status);

        if (!response.ok) {
          // Handle specific error cases
          if (data.error_description?.includes('already registered') || data.msg?.includes('already registered')) {
            console.error('[Signup Debug] Error details: User already exists -', email);
            return res.status(409).json({ error: 'User already exists' });
          }

          const errorMessage = data.error_description || data.msg || data.error || 'Signup failed';
          console.error('[Signup Debug] Error details:', {
            status: response.status,
            error: data.error,
            message: errorMessage,
            email: email,
            fullResponse: data
          });

          return res.status(response.status).json({ error: errorMessage });
        }

        console.log('[Signup Debug] User created successfully:', email);
        res.json({ 
          user: data.user,
          session: data.session,
          message: 'Signup successful'
        });

      } catch (fetchError: any) {
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          console.error('[Signup Debug] Error details: Request timeout after 10 seconds for:', email);
          return res.status(504).json({ error: 'Signup timed out - please try again' });
        }

        console.error('[Signup Debug] Error details:', fetchError);
        return res.status(500).json({ 
          error: fetchError.message || 'Network error during signup' 
        });
      }

    } catch (error: any) {
      console.error('[Signup Debug] Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        email: email
      });
      return res.status(500).json({ 
        error: error.message || 'An unexpected error occurred during signup' 
      });
    }
  });

  startLinkRefresher();

  initializePulseCache();

  app.get("/api/links", async (req, res) => {
    const origin = req.headers.origin || req.headers.referer || `${req.protocol}://${req.get('host')}`;
    const linksData = loadLinks();

    const jsonChannels = linksData.channels.map(channel => ({
      id: channel.id,
      name: channel.name,
      url: getChannelUrl(channel, origin),
      iconType: channel.iconType,
      category: channel.category,
      platform: channel.platform,
      channelId: channel.platform === 'youtube' ? channel.channelHandle : channel.channelHandle,
      videoId: channel.videoId,
      lastUpdated: channel.lastUpdated,
      isManualOverride: false,
      rank: 999,
    }));

    try {
      const allDbChannels = await storage.getAllChannels();
      const dbChannels = allDbChannels.filter(ch => ch.isVisible !== false);

      if (dbChannels.length > 0) {
        const dbOnly = dbChannels.map(dbCh => {
          let url = '';
          if (dbCh.platform === 'youtube' && dbCh.videoId) {
            url = `https://www.youtube.com/watch?v=${dbCh.videoId}`;
          } else if (dbCh.platform === 'youtube' && dbCh.channelHandle) {
            url = `https://www.youtube.com/@${dbCh.channelHandle}/live`;
          } else if (dbCh.platform === 'twitch') {
            url = `https://www.twitch.tv/${dbCh.channelHandle}`;
          } else if (dbCh.platform === 'kick') {
            url = `https://kick.com/${dbCh.channelHandle}`;
          }
          return {
            id: dbCh.id,
            name: dbCh.name,
            url,
            iconType: (dbCh.iconType as any) || 'default',
            category: dbCh.category || 'General',
            platform: dbCh.platform as any,
            channelId: dbCh.channelHandle || '',
            videoId: dbCh.videoId || null,
            lastUpdated: dbCh.lastUpdated ? new Date(dbCh.lastUpdated).getTime() : Date.now(),
            isManualOverride: dbCh.isManualOverride || false,
            rank: dbCh.rank ?? 999,
            isLive: dbCh.isLive ?? true,
            logoUrl: dbCh.logoUrl || null,
          };
        });

        res.json({
          channels: dbOnly,
          lastRefresh: linksData.lastRefresh,
          origin,
        });
        return;
      }

      res.json({
        channels: jsonChannels,
        lastRefresh: linksData.lastRefresh,
        origin,
      });
    } catch (error) {
      res.json({
        channels: jsonChannels,
        lastRefresh: linksData.lastRefresh,
        origin,
      });
    }
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

  // True Live Filter: Check if a YouTube channel is currently live
  app.get("/api/youtube/channel-live/:channelId", async (req, res) => {
    const { channelId } = req.params;
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return res.status(503).json({ 
        isLive: null,
        error: "YouTube API key not configured" 
      });
    }

    try {
      const result = await checkChannelLiveStatus(channelId, apiKey);
      res.json({
        channelId,
        isLive: result.isLive,
        liveVideoId: result.liveVideoId,
        title: result.title,
        apiError: result.apiError || false,
      });
    } catch (error) {
      console.error('[YouTube Live Check] Error:', error);
      res.status(500).json({ 
        channelId,
        isLive: null,
        apiError: true,
        error: String(error) 
      });
    }
  });

  // QUOTA OPTIMIZATION: Uses videos.list (1 unit) instead of search.list (100 units)
  // This is the preferred endpoint for checking live status when videoId is known
  app.get("/api/youtube/video-live/:videoId", async (req, res) => {
    const { videoId } = req.params;
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return res.status(503).json({ 
        isLive: null,
        error: "YouTube API key not configured" 
      });
    }

    try {
      // Use checkVideoLiveStatusById which uses videos.list (1 unit)
      const result = await checkVideoLiveStatusById(videoId, apiKey);
      res.json({
        videoId,
        isLive: result.isLive,
        liveVideoId: result.liveVideoId,
        title: result.title,
        apiError: result.apiError || false,
      });
    } catch (error) {
      console.error('[YouTube Video Live Check] Error:', error);
      res.status(500).json({ 
        videoId,
        isLive: null,
        apiError: true,
        error: String(error) 
      });
    }
  });

  // Search for current live stream by channel handle - returns new live video ID
  app.get("/api/youtube/search-live/:channelHandle", async (req, res) => {
    const { channelHandle } = req.params;
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return res.status(503).json({ 
        isLive: false,
        error: "YouTube API key not configured" 
      });
    }

    try {
      const result = await searchChannelLiveStream(channelHandle, apiKey);
      res.json({
        channelHandle,
        channelId: result.channelId,
        isLive: result.isLive,
        liveVideoId: result.liveVideoId,
        latestVideoId: result.latestVideoId, // LATEST-VIDEO FALLBACK: Returns latest video when not live
        title: result.title,
        apiError: result.apiError || false,
      });
    } catch (error) {
      console.error('[YouTube Search Live] Error:', error);
      res.status(500).json({ 
        channelHandle,
        isLive: false,
        latestVideoId: null,
        apiError: true,
        error: String(error) 
      });
    }
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
      const result = await healStream(channelId, channelId, apiKey);

      if (result.success && result.newVideoId) {
        res.json({ 
          videoId: result.newVideoId,
          channelId,
          isLive: true
        });
      } else {
        res.json({ 
          videoId: null,
          channelId,
          reason: result.reason || "No live stream found"
        });
      }
    } catch (error) {
      res.status(500).json({ 
        error: String(error),
        videoId: null 
      });
    }
  });

  // Kick API proxy (browser CORS blocked)
  app.get("/api/kick/channel/:channelId", async (req, res) => {
    const { channelId } = req.params;

    if (!channelId) {
      return res.status(400).json({ error: "Missing channelId" });
    }

    try {
      // Try v2 API with full browser headers
      const response = await fetch(`https://kick.com/api/v2/channels/${channelId}`, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': `https://kick.com/${channelId}`,
          'Origin': 'https://kick.com',
          'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin'
        }
      });

      if (!response.ok) {
        // Kick blocks server requests - return unknown status, player will show actual state
        return res.json({ 
          isLive: null,
          viewerCount: 0,
          channelId: channelId,
          status: 'unknown'
        });
      }

      const data = await response.json();
      res.json({
        isLive: data?.livestream !== null && data?.livestream !== undefined,
        viewerCount: data?.livestream?.viewer_count || 0,
        channelId: data?.slug || channelId,
        status: 'ok'
      });
    } catch (error) {
      // Return unknown rather than false - let the player show actual state
      res.json({ isLive: null, viewerCount: 0, channelId, status: 'unknown' });
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

  // Premium status endpoint
  app.get("/api/user/premium-status", async (req: Request, res: Response) => {
    const userId = (req as any).userId || (req as any).user?.id;
    const user = (req as any).user;
    const email = user?.claims?.email || user?.email;

    if (!userId) {
      return res.json({ isPremium: false, userId: null, isAdmin: false });
    }

    try {
      // Admin users automatically get premium
      const userIsAdmin = isAdminEmail(email || '');

      const profile = await storage.getProfile(userId);
      const isPremium = userIsAdmin || (profile?.isPremium ?? false);

      res.json({ 
        isPremium, 
        userId,
        isAdmin: userIsAdmin
      });
    } catch (error) {
      console.error('[Premium] Error checking status:', error);
      res.json({ isPremium: false, userId, isAdmin: false });
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
    const user = (req as any).user;
    const email = user?.claims?.email || user?.email;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      // Check premium status before saving (admins are automatically premium)
      const userIsAdmin = isAdminEmail(email || '');
      const profile = await storage.getProfile(userId);
      const hasPremiumAccess = userIsAdmin || (profile?.isPremium ?? false);

      if (!hasPremiumAccess) {
        return res.status(403).json({ 
          error: "Premium required", 
          message: "Save Layout is a Pro feature. Upgrade to save your dashboard." 
        });
      }

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
    const user = (req as any).user;
    const email = user?.claims?.email || user?.email;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      // Check premium status before updating (admins are automatically premium)
      const userIsAdmin = isAdminEmail(email || '');
      const profile = await storage.getProfile(userId);
      const hasPremiumAccess = userIsAdmin || (profile?.isPremium ?? false);

      if (!hasPremiumAccess) {
        return res.status(403).json({ 
          error: "Premium required", 
          message: "Save Layout is a Pro feature. Upgrade to save your dashboard." 
        });
      }

      const dashboard = await storage.updateDashboard(userId, req.body);

      if (!dashboard) {
        return res.status(404).json({ error: "Dashboard not found" });
      }

      res.json({ dashboard });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Admin Channel Management Routes
  const isAdmin = (req: Request): boolean => {
    const user = (req as any).user;
    // Replit Auth stores email in claims.email, Supabase stores directly on user
    const email = user?.claims?.email || user?.email;
    const isAdminUser = isAdminEmail(email || '');
    console.log('[Admin] Auth check - user:', user?.claims?.sub, 'email:', email, 'isAdmin:', isAdminUser);
    return isAdminUser;
  };

  app.get("/api/admin/channels", async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const channels = await storage.getAllChannels();
      res.json({ channels });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/admin/channels", async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const validation = insertChannelSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({ error: validation.error.message });
      }

      const channel = await storage.createChannel(validation.data);
      res.json({ channel });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.patch("/api/admin/channels/:id", async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const id = decodeURIComponent(req.params.id as string);
      if (/[\/\\]/.test(id)) {
        return res.status(400).json({ error: "Channel ID must not contain slashes" });
      }
      const body = req.body;
      const sanitized: Record<string, any> = {};
      if (body.name !== undefined) sanitized.name = body.name;
      if (body.channelHandle !== undefined) sanitized.channelHandle = body.channelHandle;
      if (body.platform !== undefined) sanitized.platform = body.platform;
      if (body.iconType !== undefined) sanitized.iconType = body.iconType;
      if (body.category !== undefined) sanitized.category = body.category;
      if (body.videoId !== undefined) sanitized.videoId = body.videoId;
      if (body.url !== undefined) sanitized.url = body.url;
      if (body.logoUrl !== undefined) sanitized.logoUrl = body.logoUrl;
      if (body.isLive !== undefined) sanitized.isLive = body.isLive;
      if (body.isManualOverride !== undefined) sanitized.isManualOverride = body.isManualOverride;
      if (body.isVisible !== undefined) sanitized.isVisible = body.isVisible;
      if (body.rank !== undefined) sanitized.rank = body.rank;

      const channel = await storage.updateChannel(id, sanitized);

      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }

      res.json({ channel });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.delete("/api/admin/channels/:id", async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const id = decodeURIComponent(req.params.id as string);
      if (/[\/\\]/.test(id)) {
        return res.status(400).json({ error: "Channel ID must not contain slashes" });
      }
      const deleted = await storage.deleteChannel(id);

      if (!deleted) {
        return res.status(404).json({ error: "Channel not found" });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/admin/channels/reorder", async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const { updates } = req.body;
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ error: "updates must be a non-empty array of { id, rank }" });
      }
      for (const item of updates) {
        if (!item || typeof item.id !== 'string' || typeof item.rank !== 'number' || !Number.isInteger(item.rank) || item.rank < 1) {
          return res.status(400).json({ error: `Invalid update entry: each must have string id and integer rank >= 1` });
        }
      }
      for (const { id, rank } of updates) {
        await storage.updateChannel(id, { rank });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Feedback routes - saves to DB and sends email notification
  app.post("/api/feedback", async (req: Request, res: Response) => {
    try {
      const { category, description, email, type, message, userEmail, screenshot } = req.body;
      const normalizedBody: Record<string, unknown> = {
        type: type || category,
        message: message || description,
        userEmail: userEmail || email || null,
      };

      if (screenshot && typeof screenshot === 'string') {
        if (!screenshot.startsWith('data:image/')) {
          return res.status(400).json({ error: "Invalid screenshot format. Must be a base64 data URL." });
        }
        if (screenshot.length > 7 * 1024 * 1024) {
          return res.status(400).json({ error: "Screenshot too large. Must be under 5MB." });
        }
        normalizedBody.screenshot = screenshot;
      }

      const validation = insertFeedbackSchema.safeParse(normalizedBody);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.message });
      }

      const feedbackType = validation.data.type;
      if (feedbackType && !['bug', 'idea'].includes(feedbackType)) {
        return res.status(400).json({ error: "Type must be 'bug' or 'idea'" });
      }

      const item = await storage.createFeedback(validation.data);
      const feedbackMessage = validation.data.message;
      const feedbackEmail = validation.data.userEmail;

      try {
        const { client, fromEmail } = await getUncachableResendClient();
        const categoryLabel = feedbackType === 'idea' ? 'New Idea' : 'Bug Report';
        const escapeHtml = (str: string) => str
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        const safeDescription = escapeHtml(feedbackMessage).replace(/\n/g, '<br />');
        const safeEmail = escapeHtml(feedbackEmail || 'Anonymous');

        await client.emails.send({
          from: fromEmail,
          to: 'support@openbento.tv',
          subject: `[OpenBento ${categoryLabel}] Feedback Received`,
          html: `
            <h2>OpenBento Feedback - ${categoryLabel}</h2>
            <p><strong>Category:</strong> ${categoryLabel}</p>
            <p><strong>From:</strong> ${safeEmail}</p>
            <hr />
            <p><strong>Description:</strong></p>
            <p>${safeDescription}</p>
            <hr />
            <p style="color: #666; font-size: 12px;">Sent from OpenBento Feedback Form</p>
          `,
        });
        console.log(`[Feedback] Saved to DB + sent email for ${feedbackType} feedback`);
      } catch (emailError) {
        console.warn('[Feedback] Saved to DB but email failed:', emailError);
      }

      res.json({ success: true, feedback: item });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/admin/feedback", async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const items = await storage.getAllFeedback();
      res.json({ feedback: items });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Migration endpoint - import channels from links.json to database
  app.post("/api/admin/migrate-channels", async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    try {
      const linksData = loadLinks();
      let imported = 0;

      for (const channel of linksData.channels) {
        const existing = await storage.getChannel(channel.id);
        if (!existing) {
          await storage.createChannel({
            id: channel.id,
            name: channel.name,
            channelHandle: channel.channelHandle,
            platform: channel.platform,
            iconType: channel.iconType,
            category: channel.category,
            videoId: channel.videoId,
            isLive: channel.isLive,
            lastUpdated: channel.lastUpdated ? new Date(channel.lastUpdated) : new Date(),
          });
          imported++;
        }
      }

      res.json({ success: true, imported, total: linksData.channels.length });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Admin Users API - Fetch all users from Supabase
  app.get("/api/admin/users", async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceRoleKey) {
        return res.status(500).json({ error: "Supabase credentials not configured" });
      }

      // Create AbortController with 10-second timeout to prevent 504 errors
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        // Use Supabase Admin API to fetch users with timeout
        const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Admin] Supabase user fetch error:', errorText);
          return res.status(response.status).json({ error: 'Failed to fetch users from Supabase' });
        }

        const data = await response.json();

        // Get user IDs to fetch premium status from profiles
        const userIds = (data.users || []).map((u: any) => u.id);
        const profilesData = await storage.getProfilesByIds(userIds);
        const profilesMap = new Map(profilesData.map(p => [p.id, p]));

        // Map to simplified user objects for the admin panel
        const users = (data.users || []).map((user: any) => ({
          id: user.id,
          email: user.email,
          createdAt: user.created_at,
          lastSignIn: user.last_sign_in_at,
          emailConfirmed: user.email_confirmed_at ? true : false,
          provider: user.app_metadata?.provider || 'email',
          isPremium: profilesMap.get(user.id)?.isPremium || false
        }));

        res.json({ users, total: users.length });
      } catch (fetchError: any) {
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          console.error('[Admin] Supabase fetch timeout after 10 seconds');
          return res.status(504).json({ error: 'Request timeout - Supabase took too long to respond' });
        }
        throw fetchError;
      }
    } catch (error) {
      console.error('[Admin] Error fetching users:', error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Admin endpoint to toggle user premium status
  app.patch("/api/admin/users/:id/premium", async (req: Request, res: Response) => {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const userId = req.params.id as string;
      const { isPremium } = req.body;

      if (typeof isPremium !== 'boolean') {
        return res.status(400).json({ error: "isPremium must be a boolean" });
      }

      // Upsert profile with the premium status
      const profile = await storage.upsertProfile({
        id: userId,
        email: '', // Will be updated with actual email if available
        isPremium,
      });

      console.log('[Admin] Updated premium status for user:', userId, 'isPremium:', isPremium);
      res.json({ success: true, profile });
    } catch (error) {
      console.error('[Admin] Error updating premium status:', error);
      res.status(500).json({ error: String(error) });
    }
  });

  // Stripe Publishable Key
  app.get("/api/stripe/publishable-key", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error('[Stripe] Error getting publishable key:', error);
      res.status(500).json({ error: 'Failed to get Stripe config' });
    }
  });

  // Valid Stripe price IDs for OpenBento Pro subscription
  const VALID_PRICE_IDS: Record<string, string> = {
    monthly: 'price_1Sx7AnC4mj6LbUjWpXwTb7Gi',
    yearly: 'price_1Sx7B5C4mj6LbUjWnIFhehZl',
  };

  // Create Stripe Checkout Session for Pro subscription
  app.post("/api/stripe/create-checkout-session", async (req: Request, res: Response) => {
    try {
      const { priceId, billingPeriod } = req.body;
      const user = (req as any).user;

      // Extract userId - try multiple sources for maximum reliability
      const userId = (req as any).userId || (req as any).user?.id || user?.claims?.sub;
      const email = user?.claims?.email || user?.email;

      if (!email) {
        console.error('[Stripe] No email found for user:', userId);
        return res.status(401).json({ error: 'User email not found. Please log in again.' });
      }

      if (!userId) {
        console.error('[Stripe] No userId found for email:', email);
        return res.status(401).json({ error: 'User ID not found. Please log in again.' });
      }

      console.log('[Stripe] Creating checkout session - userId:', userId, 'email:', email);

      // Validate billingPeriod
      if (!billingPeriod || !['monthly', 'yearly'].includes(billingPeriod)) {
        return res.status(400).json({ error: 'Invalid billing period. Must be "monthly" or "yearly".' });
      }

      // Validate priceId against allowlist
      const expectedPriceId = VALID_PRICE_IDS[billingPeriod];
      if (!priceId || priceId !== expectedPriceId) {
        console.warn('[Stripe] Invalid priceId attempted:', priceId, 'expected:', expectedPriceId);
        return res.status(400).json({ error: 'Invalid price configuration.' });
      }

      const stripe = await getUncachableStripeClient();

      // Use production domain if available, otherwise fallback to request origin
      const productionDomain = 'https://openbento.tv';
      const origin = process.env.NODE_ENV === 'production' 
        ? productionDomain 
        : (req.headers.origin || `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`);

      // Create checkout session - allow user to enter their own billing email
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        // REMOVED customer_email to allow users to enter their own billing email on Stripe page
        metadata: {
          userId: userId, // Critical: webhook uses this to identify which user to upgrade
          accountEmail: email, // Store account email for reference only
        },
        allow_promotion_codes: true,
        success_url: `${origin}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?canceled=true`,
      });

      console.log('[Stripe] Created checkout session for:', email, 'userId:', userId);
      res.json({ url: session.url });
    } catch (error: any) {
      console.error('[Stripe] Checkout error:', error);
      res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
  });

  // Stripe Webhook Handler
  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('[Stripe] Webhook secret not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    if (!sig) {
      console.error('[Stripe] Missing stripe-signature header');
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    let event: any;

    try {
      const stripe = await getUncachableStripeClient();
      // req.body should be raw buffer for webhook signature verification
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error('[Stripe] Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const userId = session.metadata?.userId;
          const accountEmail = session.metadata?.accountEmail; // User's account email (for reference)
          const billingEmail = session.customer_email; // Billing email entered on Stripe page

          console.log('[Stripe] Checkout completed - userId:', userId, 'accountEmail:', accountEmail, 'billingEmail:', billingEmail);

          // Priority 1: Use userId from metadata (most reliable - always works regardless of billing email)
          if (userId) {
            try {
              await storage.upsertProfile({
                id: userId,
                email: accountEmail || billingEmail || '',
                isPremium: true,
              });
              console.log('[Stripe] ✅ Granted premium via metadata userId:', userId, accountEmail);
              break;
            } catch (upsertError) {
              console.error('[Stripe] Error upserting profile for userId:', userId, upsertError);
              // Continue to email fallback if userId upsert fails
            }
          } else {
            console.warn('[Stripe] ⚠️ No userId in checkout session metadata');
          }

          // Priority 2: Fallback to billing email lookup if userId not in metadata or upsert failed
          // (This will only work if the billing email matches an account in the database)
          if (billingEmail) {
            try {
              const profile = await storage.getProfileByEmail(billingEmail);

              if (profile) {
                await storage.upsertProfile({
                  id: profile.id,
                  email: billingEmail,
                  isPremium: true,
                });
                console.log('[Stripe] ✅ Granted premium via billing email lookup:', profile.id, billingEmail);
              } else {
                console.error('[Stripe] ❌ No user profile found for billing email:', billingEmail);
              }
            } catch (emailError) {
              console.error('[Stripe] Error in email fallback:', emailError);
            }
          } else {
            console.error('[Stripe] ❌ No userId or billing email in checkout session:', session.id);
          }

          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const stripe = await getUncachableStripeClient();

          // Get customer email from Stripe
          const customer = await stripe.customers.retrieve(subscription.customer);
          const customerEmail = (customer as any).email;

          if (!customerEmail) {
            console.error('[Stripe] No customer email for subscription:', subscription.id);
            break;
          }

          console.log('[Stripe] Subscription cancelled for:', customerEmail);

          // Find user by email and revoke premium
          const profile = await storage.getProfileByEmail(customerEmail);

          if (profile) {
            await storage.upsertProfile({
              id: profile.id,
              email: customerEmail,
              isPremium: false,
            });
            console.log('[Stripe] Revoked premium from user:', profile.id, customerEmail);
          } else {
            console.warn('[Stripe] No user found with email:', customerEmail);
          }

          break;
        }

        default:
          console.log('[Stripe] Unhandled event type:', event.type);
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error('[Stripe] Error handling webhook event:', err);
      res.status(500).json({ error: 'Error processing webhook' });
    }
  });


  // Auto-import channels on startup (runs once)
  async function autoImportChannels() {
    try {
      const existingChannels = await storage.getAllChannels();
      if (existingChannels.length === 0) {
        console.log('[Startup] No channels found in database, auto-importing from links.json...');
        const linksData = loadLinks();
        let imported = 0;

        for (const channel of linksData.channels) {
          try {
            await storage.createChannel({
              id: channel.id,
              name: channel.name,
              channelHandle: channel.channelHandle,
              platform: channel.platform,
              iconType: channel.iconType,
              category: channel.category,
              videoId: channel.videoId,
              isLive: channel.isLive,
              lastUpdated: channel.lastUpdated ? new Date(channel.lastUpdated) : new Date(),
            });
            imported++;
          } catch (err) {
            // Skip duplicates silently
          }
        }

        console.log(`[Startup] Auto-imported ${imported} channels from links.json`);
      } else {
        console.log(`[Startup] Found ${existingChannels.length} channels in database, skipping auto-import`);
      }
    } catch (error) {
      console.error('[Startup] Error during auto-import:', error);
    }
  }

  // Run auto-import
  autoImportChannels();

  return httpServer;
}