import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { loadLinks, refreshAllLinks, getChannelUrl, startLinkRefresher } from "./link-refresher";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { initializePulseCache, getGlobalStreamStatus, getStreamStatus, registerChannel } from "./services/pulse-cache";
import { healStream, getVideoDetails, isMusicCategory, checkChannelLiveStatus, verifyVideoIsLive, searchChannelLiveStream } from "./services/youtube-api";
import { insertUserLibrarySchema, insertDashboardSchema, insertChannelSchema } from "@shared/schema";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";

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
      });
    } catch (error) {
      console.error('[YouTube Live Check] Error:', error);
      res.status(500).json({ 
        channelId,
        isLive: null,
        error: String(error) 
      });
    }
  });

  // True Live Filter: Verify if a specific video is currently live
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
      const result = await verifyVideoIsLive(videoId, apiKey);
      res.json({
        videoId,
        isLive: result.isLive,
        liveBroadcastContent: result.liveBroadcastContent,
      });
    } catch (error) {
      console.error('[YouTube Video Live Check] Error:', error);
      res.status(500).json({ 
        videoId,
        isLive: null,
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
        title: result.title,
      });
    } catch (error) {
      console.error('[YouTube Search Live] Error:', error);
      res.status(500).json({ 
        channelHandle,
        isLive: false,
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
      const id = req.params.id as string;
      const channel = await storage.updateChannel(id, req.body);
      
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
      const id = req.params.id as string;
      const deleted = await storage.deleteChannel(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Channel not found" });
      }
      
      res.json({ success: true });
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
      
      // Use Supabase Admin API to fetch users
      const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json'
        }
      });
      
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
  app.post("/api/stripe/create-checkout-session", async (req, res) => {
    try {
      const { priceId, billingPeriod } = req.body;
      
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
      
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        allow_promotion_codes: true,
        success_url: `${origin}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?canceled=true`,
      });
      
      res.json({ url: session.url });
    } catch (error: any) {
      console.error('[Stripe] Checkout error:', error);
      res.status(500).json({ error: error.message || 'Failed to create checkout session' });
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
