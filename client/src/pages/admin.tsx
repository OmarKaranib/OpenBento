import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useReplitAuth } from '@/hooks/use-replit-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Users, Tv, BarChart3, Loader2, Edit2, Trash2, RefreshCw, Home, Plus, X, Save, AlertCircle, Crown, LogIn, Rocket, Link as LinkIcon } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { searchChannelLiveStream } from '@/lib/stream-api';

export const ADMIN_EMAILS = [
  'legionofoogabooga@gmail.com',
  'omar.karanib@anculabs.com',
];

export const ADMIN_EMAIL = ADMIN_EMAILS[0]; // For backwards compatibility

interface Channel {
  id: string;
  name: string;
  channelHandle: string | null;
  platform: string;
  iconType: string | null;
  category: string | null;
  videoId: string | null;
  url: string | null;
  isLive: boolean | null;
  isManualOverride: boolean | null;
  lastUpdated: string | null;
}

function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export default function Admin() {
  const { user, isLoading, isAuthenticated, login } = useReplitAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isGlobalScraping, setIsGlobalScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState<{current: number; total: number; currentChannel: string} | null>(null);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeProgress, setPurgeProgress] = useState<{current: number; total: number; currentChannel: string; deleted: number} | null>(null);
  const [newChannel, setNewChannel] = useState({
    id: '',
    name: '',
    channelHandle: '',
    platform: 'youtube',
    iconType: 'news',
    category: 'News',
    videoId: '',
    isLive: true
  });

  const handleGlobalScrape = async () => {
    if (!channels.length) return;
    
    setIsGlobalScraping(true);
    // SYNC ALL STREAMS: Only scrape channels that are NOT marked as manual override
    const youtubeChannels = channels.filter(c => 
      c.platform === 'youtube' && 
      c.channelHandle && 
      !c.isManualOverride // Skip manual override channels
    );
    
    console.log(`[SYNC ALL] Starting scrape for ${youtubeChannels.length} non-override channels`);
    
    for (let i = 0; i < youtubeChannels.length; i++) {
      const channel = youtubeChannels[i];
      setScrapeProgress({ current: i + 1, total: youtubeChannels.length, currentChannel: channel.name });
      
      try {
        if (channel.channelHandle) {
          const result = await searchChannelLiveStream(channel.channelHandle, true);
          if (result.liveVideoId) {
            await apiRequest('PATCH', `/api/admin/channels/${channel.id}`, { 
              videoId: result.liveVideoId,
              isLive: true 
            });
          }
        }
      } catch (err) {
        console.error(`[SYNC ALL] Failed for ${channel.name}:`, err);
      }
      
      await new Promise(r => setTimeout(r, 500));
    }
    
    setIsGlobalScraping(false);
    setScrapeProgress(null);
    // Invalidate all channel-related queries for instant refresh
    queryClient.invalidateQueries({ queryKey: ['/api/admin/channels'] });
    queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
  };

  const handleScrapeUrl = () => {
    if (!scrapeUrl || !editingChannel) return;
    const extractedId = extractYouTubeVideoId(scrapeUrl);
    if (extractedId) {
      setEditingChannel({ ...editingChannel, videoId: extractedId, isManualOverride: true });
      setScrapeUrl('');
    }
  };

  const handlePurgeBrokenStreams = async () => {
    if (!channels.length) return;
    
    setIsPurging(true);
    let deletedCount = 0;
    
    const youtubeChannels = channels.filter(c => 
      c.platform === 'youtube' && 
      c.videoId && 
      !c.isManualOverride
    );
    
    console.log(`[PURGE] Starting purge check for ${youtubeChannels.length} YouTube channels`);
    
    for (let i = 0; i < youtubeChannels.length; i++) {
      const channel = youtubeChannels[i];
      setPurgeProgress({ 
        current: i + 1, 
        total: youtubeChannels.length, 
        currentChannel: channel.name,
        deleted: deletedCount 
      });
      
      try {
        const response = await fetch(`/api/youtube/validate-video/${channel.videoId}`);
        const result = await response.json();
        
        if (!result.valid) {
          console.log(`[PURGE] Broken stream detected: ${channel.name} - ${result.reason}`);
          
          if (channel.channelHandle) {
            const searchResponse = await fetch(`/api/youtube/search-live/${channel.channelHandle}`);
            const searchResult = await searchResponse.json();
            
            if (searchResult.latestVideoId) {
              const fallbackResponse = await fetch(`/api/youtube/validate-video/${searchResult.latestVideoId}`);
              const fallbackResult = await fallbackResponse.json();
              
              if (!fallbackResult.valid) {
                console.log(`[PURGE] Fallback also broken for ${channel.name}, deleting...`);
                await apiRequest('DELETE', `/api/admin/channels/${channel.id}`);
                deletedCount++;
              } else {
                console.log(`[PURGE] Fallback works for ${channel.name}, updating videoId`);
                await apiRequest('PATCH', `/api/admin/channels/${channel.id}`, { 
                  videoId: searchResult.latestVideoId,
                  isLive: false 
                });
              }
            } else {
              console.log(`[PURGE] No fallback available for ${channel.name}, deleting...`);
              await apiRequest('DELETE', `/api/admin/channels/${channel.id}`);
              deletedCount++;
            }
          } else {
            console.log(`[PURGE] No channel handle for ${channel.name}, deleting broken channel...`);
            await apiRequest('DELETE', `/api/admin/channels/${channel.id}`);
            deletedCount++;
          }
        }
      } catch (err) {
        console.error(`[PURGE] Failed to check ${channel.name}:`, err);
      }
      
      await new Promise(r => setTimeout(r, 300));
    }
    
    setIsPurging(false);
    setPurgeProgress(null);
    queryClient.invalidateQueries({ queryKey: ['/api/admin/channels'] });
    queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
    
    alert(`Purge complete! Deleted ${deletedCount} broken channels.`);
  };

  const isAdmin = isAuthenticated && ADMIN_EMAILS.includes(user?.email?.toLowerCase() || '');

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isAdmin) {
      setLocation('/');
    }
  }, [isLoading, isAuthenticated, isAdmin, setLocation]);

  const { data: channelsData, isLoading: channelsLoading, error: channelsError } = useQuery<{ channels: Channel[] }>({
    queryKey: ['/api/admin/channels'],
    enabled: isAdmin,
  });

  interface AdminUser {
    id: string;
    email: string;
    createdAt: string;
    lastSignIn: string | null;
    emailConfirmed: boolean;
    provider: string;
    isPremium: boolean;
  }

  const { data: usersData, isLoading: usersLoading } = useQuery<{ users: AdminUser[], total: number }>({
    queryKey: ['/api/admin/users'],
    enabled: isAdmin,
  });

  const migrateMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/migrate-channels'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/channels'] });
    },
  });

  const togglePremiumMutation = useMutation({
    mutationFn: ({ userId, isPremium }: { userId: string; isPremium: boolean }) => 
      apiRequest('PATCH', `/api/admin/users/${userId}/premium`, { isPremium }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/admin/channels/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/channels'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (channel: Partial<Channel> & { id: string }) => 
      apiRequest('PATCH', `/api/admin/channels/${channel.id}`, channel),
    onSuccess: () => {
      // INSTANT ADMIN REFRESH: Invalidate all channel queries so entire app sees new ID immediately
      queryClient.invalidateQueries({ queryKey: ['/api/admin/channels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
      setEditingChannel(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: (channel: typeof newChannel) => 
      apiRequest('POST', '/api/admin/channels', channel),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/channels'] });
      setShowAddForm(false);
      setNewChannel({
        id: '',
        name: '',
        channelHandle: '',
        platform: 'youtube',
        iconType: 'news',
        category: 'News',
        videoId: '',
        isLive: true
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-cyan-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Admin Login Required</h1>
          <p className="text-slate-400 mb-6">Please log in with your admin account to access this page.</p>
          <button
            onClick={login}
            className="flex items-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white font-medium transition-colors mx-auto"
            data-testid="button-admin-login"
          >
            <LogIn className="w-5 h-5" />
            Login with Replit
          </button>
          <Link href="/">
            <a className="text-slate-400 hover:text-slate-300 text-sm mt-4 inline-block">
              Back to Dashboard
            </a>
          </Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-slate-400">You don't have admin privileges.</p>
          <Link href="/">
            <a className="text-cyan-400 hover:text-cyan-300 text-sm mt-4 inline-block">
              Back to Dashboard
            </a>
          </Link>
        </div>
      </div>
    );
  }

  const channels = channelsData?.channels || [];

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Shield className="w-10 h-10 text-cyan-400" />
            <h1 className="text-4xl font-bold text-white" data-testid="text-admin-title">
              Admin Dashboard
            </h1>
          </div>
          <Link href="/">
            <a className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors">
              <Home className="w-5 h-5" />
              Back to Dashboard
            </a>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div 
            className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6"
            data-testid="card-user-list"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">
                User List {usersData?.total ? `(${usersData.total})` : ''}
              </h2>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4 max-h-[400px] overflow-y-auto">
              {usersLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                </div>
              ) : usersData?.users && usersData.users.length > 0 ? (
                <div className="space-y-2">
                  {usersData.users.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        ADMIN_EMAILS.includes(u.email?.toLowerCase() || '') ? 'bg-cyan-500/20' : 'bg-slate-700'
                      }`}>
                        <Users className={`w-5 h-5 ${ADMIN_EMAILS.includes(u.email?.toLowerCase() || '') ? 'text-cyan-400' : 'text-slate-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{u.email}</p>
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            u.provider === 'google' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {u.provider}
                          </span>
                          {ADMIN_EMAILS.includes(u.email?.toLowerCase() || '') && (
                            <span className="px-2 py-0.5 rounded text-xs bg-cyan-500/20 text-cyan-400">Admin</span>
                          )}
                          {u.isPremium && (
                            <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">Premium</span>
                          )}
                          {u.emailConfirmed && (
                            <span className="text-emerald-400 text-xs">Verified</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => togglePremiumMutation.mutate({ userId: u.id, isPremium: !u.isPremium })}
                          disabled={togglePremiumMutation.isPending}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                            u.isPremium
                              ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                          }`}
                          data-testid={`button-toggle-premium-${u.id}`}
                          title={u.isPremium ? 'Remove Premium' : 'Make Premium'}
                        >
                          <Crown className="w-3 h-3" />
                          {u.isPremium ? 'Premium' : 'Free'}
                        </button>
                        <div className="text-right text-xs text-slate-500">
                          {u.lastSignIn && (
                            <p>Last: {new Date(u.lastSignIn).toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                    <div className="w-10 h-10 bg-cyan-500/20 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">{user?.email}</p>
                      <p className="text-slate-400 text-sm">Admin (You)</p>
                    </div>
                  </div>
                  <p className="text-slate-500 text-sm mt-4 text-center">
                    No additional users found
                  </p>
                </>
              )}
            </div>
          </div>

          <div 
            className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6"
            data-testid="card-system-stats"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <BarChart3 className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">System Stats</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-cyan-400">{channels.length}</p>
                <p className="text-slate-400 text-sm">Total Channels</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-emerald-400">
                  {channels.filter(c => c.isLive).length}
                </p>
                <p className="text-slate-400 text-sm">Live Channels</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-purple-400">
                  {channels.filter(c => c.platform === 'youtube').length}
                </p>
                <p className="text-slate-400 text-sm">YouTube</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-orange-400">
                  {channels.filter(c => c.platform !== 'youtube').length}
                </p>
                <p className="text-slate-400 text-sm">Other Platforms</p>
              </div>
            </div>
          </div>
        </div>

        <div 
          className="mt-6 bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6"
          data-testid="card-channel-manager"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Tv className="w-6 h-6 text-purple-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Channel Manager</h2>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleGlobalScrape}
                disabled={isGlobalScraping}
                className="flex items-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-white text-sm transition-colors disabled:opacity-50"
                data-testid="button-global-scrape"
              >
                {isGlobalScraping ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {scrapeProgress ? `${scrapeProgress.current}/${scrapeProgress.total}` : 'Scraping...'}
                  </>
                ) : (
                  <>
                    <Rocket className="w-5 h-5" />
                    SYNC ALL STREAMS
                  </>
                )}
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white text-sm transition-colors"
                data-testid="button-add-channel"
              >
                <Plus className="w-4 h-4" />
                Add Channel
              </button>
              <button
                onClick={() => migrateMutation.mutate()}
                disabled={migrateMutation.isPending}
                className="flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white text-sm transition-colors disabled:opacity-50"
                data-testid="button-migrate-channels"
              >
                <RefreshCw className={`w-4 h-4 ${migrateMutation.isPending ? 'animate-spin' : ''}`} />
                Import from JSON
              </button>
              <button
                onClick={handlePurgeBrokenStreams}
                disabled={isPurging || isGlobalScraping}
                className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white text-sm transition-colors disabled:opacity-50"
                data-testid="button-purge-broken"
              >
                {isPurging ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {purgeProgress ? `${purgeProgress.current}/${purgeProgress.total} (${purgeProgress.deleted} deleted)` : 'Purging...'}
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    🧹 Purge Broken Streams
                  </>
                )}
              </button>
            </div>
            {scrapeProgress && (
              <div className="mt-2 text-sm text-slate-400">
                Currently scraping: <span className="text-cyan-400">{scrapeProgress.currentChannel}</span>
              </div>
            )}
            {purgeProgress && (
              <div className="mt-2 text-sm text-slate-400">
                Checking: <span className="text-red-400">{purgeProgress.currentChannel}</span> | Deleted: <span className="text-red-400">{purgeProgress.deleted}</span>
              </div>
            )}
          </div>

          {showAddForm && (
            <div className="mb-4 p-4 bg-slate-900/50 rounded-lg border border-slate-600">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium">Add New Channel</h3>
                <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="ID (e.g., my-channel)"
                  value={newChannel.id}
                  onChange={(e) => setNewChannel({ ...newChannel, id: e.target.value })}
                  className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                />
                <input
                  type="text"
                  placeholder="Name"
                  value={newChannel.name}
                  onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                  className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                />
                <input
                  type="text"
                  placeholder="Channel Handle"
                  value={newChannel.channelHandle}
                  onChange={(e) => setNewChannel({ ...newChannel, channelHandle: e.target.value })}
                  className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                />
                <input
                  type="text"
                  placeholder="Video ID"
                  value={newChannel.videoId}
                  onChange={(e) => setNewChannel({ ...newChannel, videoId: e.target.value })}
                  className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                />
                <select
                  value={newChannel.platform}
                  onChange={(e) => setNewChannel({ ...newChannel, platform: e.target.value })}
                  className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                >
                  <option value="youtube">YouTube</option>
                  <option value="twitch">Twitch</option>
                  <option value="kick">Kick</option>
                </select>
                <select
                  value={newChannel.category}
                  onChange={(e) => setNewChannel({ ...newChannel, category: e.target.value })}
                  className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
                >
                  <option value="News">News</option>
                  <option value="Science">Science</option>
                  <option value="Gaming">Gaming</option>
                  <option value="Finance">Finance</option>
                  <option value="Music">Music</option>
                </select>
                <button
                  onClick={() => createMutation.mutate(newChannel)}
                  disabled={createMutation.isPending || !newChannel.id || !newChannel.name}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white text-sm transition-colors disabled:opacity-50 col-span-2"
                >
                  <Save className="w-4 h-4" />
                  {createMutation.isPending ? 'Creating...' : 'Create Channel'}
                </button>
              </div>
            </div>
          )}

          {channelsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          ) : channelsError ? (
            <div className="flex items-center justify-center h-32 text-red-400">
              <AlertCircle className="w-6 h-6 mr-2" />
              Error loading channels
            </div>
          ) : channels.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Tv className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No channels in database. Click "Import from JSON" to migrate existing channels.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="pb-3 pr-4">Name</th>
                    <th className="pb-3 pr-4">Platform</th>
                    <th className="pb-3 pr-4">Category</th>
                    <th className="pb-3 pr-4">Video ID</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((channel) => (
                    <tr key={channel.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      {editingChannel?.id === channel.id ? (
                        <>
                          <td className="py-3 pr-4">
                            <input
                              type="text"
                              value={editingChannel.name}
                              onChange={(e) => setEditingChannel({ ...editingChannel, name: e.target.value })}
                              className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                            />
                          </td>
                          <td className="py-3 pr-4">
                            <select
                              value={editingChannel.platform}
                              onChange={(e) => setEditingChannel({ ...editingChannel, platform: e.target.value })}
                              className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                            >
                              <option value="youtube">YouTube</option>
                              <option value="twitch">Twitch</option>
                              <option value="kick">Kick</option>
                            </select>
                          </td>
                          <td className="py-3 pr-4">
                            <input
                              type="text"
                              value={editingChannel.category || ''}
                              onChange={(e) => setEditingChannel({ ...editingChannel, category: e.target.value })}
                              className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                            />
                          </td>
                          <td className="py-3 pr-4">
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={editingChannel.videoId || ''}
                                onChange={(e) => setEditingChannel({ ...editingChannel, videoId: e.target.value, isManualOverride: true })}
                                className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                                placeholder="Video ID"
                              />
                              <div className="flex gap-1">
                                <input
                                  type="text"
                                  value={scrapeUrl}
                                  onChange={(e) => setScrapeUrl(e.target.value)}
                                  className="flex-1 px-2 py-1 bg-slate-700 border border-slate-500 rounded text-white text-xs"
                                  placeholder="Paste YouTube URL..."
                                />
                                <button
                                  onClick={handleScrapeUrl}
                                  className="px-2 py-1 bg-purple-600 hover:bg-purple-500 rounded text-white text-xs"
                                  title="Extract ID from URL"
                                >
                                  <LinkIcon className="w-3 h-3" />
                                </button>
                              </div>
                              <label className="flex items-center gap-1 text-xs text-slate-400">
                                <input
                                  type="checkbox"
                                  checked={editingChannel.isManualOverride || false}
                                  onChange={(e) => setEditingChannel({ ...editingChannel, isManualOverride: e.target.checked })}
                                  className="w-3 h-3"
                                />
                                Manual Override (locked)
                              </label>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <select
                              value={editingChannel.isLive ? 'live' : 'offline'}
                              onChange={(e) => setEditingChannel({ ...editingChannel, isLive: e.target.value === 'live' })}
                              className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                            >
                              <option value="live">Live</option>
                              <option value="offline">Offline</option>
                            </select>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => updateMutation.mutate(editingChannel)}
                                disabled={updateMutation.isPending}
                                className="p-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white transition-colors"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingChannel(null)}
                                className="p-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-white transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 pr-4 text-white font-medium">{channel.name}</td>
                          <td className="py-3 pr-4">
                            <span className={`px-2 py-1 rounded text-xs ${
                              channel.platform === 'youtube' ? 'bg-red-500/20 text-red-400' :
                              channel.platform === 'twitch' ? 'bg-purple-500/20 text-purple-400' :
                              'bg-green-500/20 text-green-400'
                            }`}>
                              {channel.platform}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-slate-300">{channel.category || '-'}</td>
                          <td className="py-3 pr-4 text-slate-400 font-mono text-xs">{channel.videoId || '-'}</td>
                          <td className="py-3 pr-4">
                            <span className={`px-2 py-1 rounded text-xs ${
                              channel.isLive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'
                            }`}>
                              {channel.isLive ? 'Live' : 'Offline'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setEditingChannel(channel)}
                                className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-colors"
                                data-testid={`button-edit-${channel.id}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete "${channel.name}"?`)) {
                                    deleteMutation.mutate(channel.id);
                                  }
                                }}
                                disabled={deleteMutation.isPending}
                                className="p-2 bg-red-600 hover:bg-red-500 rounded-lg text-white transition-colors"
                                data-testid={`button-delete-${channel.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-8 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
          <p className="text-slate-400 text-sm">
            Logged in as: <span className="text-cyan-400 font-medium">{user?.email}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
