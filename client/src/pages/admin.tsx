import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Users, Tv, BarChart3, Loader2, Edit2, Trash2, RefreshCw, Home, Plus, X, Save, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

export const ADMIN_EMAIL = 'legionofoogabooga@gmail.com';

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
  lastUpdated: string | null;
}

export default function Admin() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
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

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || user?.email !== ADMIN_EMAIL) {
        setLocation('/');
      }
    }
  }, [isLoading, isAuthenticated, user, setLocation]);

  const { data: channelsData, isLoading: channelsLoading, error: channelsError } = useQuery<{ channels: Channel[] }>({
    queryKey: ['/api/admin/channels'],
    enabled: isAuthenticated && user?.email === ADMIN_EMAIL,
  });

  const migrateMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/admin/migrate-channels'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/channels'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/admin/channels'] });
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

  if (!isAuthenticated || user?.email !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-slate-400">Redirecting to home...</p>
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
              <h2 className="text-xl font-semibold text-white">User List</h2>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-4">
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
                Full user list requires Supabase service role key
              </p>
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
            <div className="flex gap-2">
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
            </div>
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
                            <input
                              type="text"
                              value={editingChannel.videoId || ''}
                              onChange={(e) => setEditingChannel({ ...editingChannel, videoId: e.target.value })}
                              className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                            />
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
