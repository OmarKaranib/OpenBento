import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Shield, Users, Tv, BarChart3, Loader2 } from 'lucide-react';

export const ADMIN_EMAIL = 'legionofoogabooga@gmail.com';

export default function Admin() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || user?.email !== ADMIN_EMAIL) {
        setLocation('/');
      }
    }
  }, [isLoading, isAuthenticated, user, setLocation]);

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

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Shield className="w-10 h-10 text-cyan-400" />
          <h1 className="text-4xl font-bold text-white" data-testid="text-admin-title">
            Admin Dashboard
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div 
            className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 min-h-[300px]"
            data-testid="card-user-list"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">User List</h2>
            </div>
            <div className="flex items-center justify-center h-48 border-2 border-dashed border-slate-600 rounded-lg">
              <p className="text-slate-500">Coming soon...</p>
            </div>
          </div>

          <div 
            className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 min-h-[300px]"
            data-testid="card-channel-manager"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Tv className="w-6 h-6 text-purple-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Channel Manager</h2>
            </div>
            <div className="flex items-center justify-center h-48 border-2 border-dashed border-slate-600 rounded-lg">
              <p className="text-slate-500">Coming soon...</p>
            </div>
          </div>

          <div 
            className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 min-h-[300px]"
            data-testid="card-system-stats"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <BarChart3 className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">System Stats</h2>
            </div>
            <div className="flex items-center justify-center h-48 border-2 border-dashed border-slate-600 rounded-lg">
              <p className="text-slate-500">Coming soon...</p>
            </div>
          </div>
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
