// Auto-extracted from App.tsx during widget modularization, then
// updated for Multi-Page Dashboards. Mirrors a logged-in user's full
// pages collection (active page widgets included) to the `dashboards`
// table via /api/dashboard:
//   1. On sign-in, GET once. If a remote pages collection exists,
//      replace local state with it. If only the legacy `widgets`
//      array is present, wrap it as a one-page Home for backwards
//      compatibility.
//   2. After every pages-state change (debounced 1.5s), POST with a
//      Bearer access token from the live Supabase session.
// Guests are unaffected — localStorage stays the only source of truth.
// Network failures silently fall back to localStorage.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type DashboardPagesState,
  migrateLegacyWidgets,
  sanitizePages,
  getActivePage,
} from '@shared/dashboard-pages';

type SupabaseLike = {
  auth: {
    getSession: () => Promise<{ data: { session: { access_token?: string } | null } }>;
  };
} | null | undefined;

interface UseCloudSyncArgs {
  isAuthenticated: boolean;
  userId: string | undefined;
  supabaseClient: SupabaseLike;
  pagesState: DashboardPagesState;
  setPagesState: (next: DashboardPagesState) => void;
  pagesStateRef: React.MutableRefObject<DashboardPagesState>;
}

export type CloudHydrationStatus = 'idle' | 'loading' | 'ready' | 'failed';

export function canWriteCloudDashboard(status: CloudHydrationStatus): boolean {
  return status === 'ready';
}

export function useCloudSync({
  isAuthenticated,
  userId,
  supabaseClient,
  pagesState,
  setPagesState,
  pagesStateRef,
}: UseCloudSyncArgs): void {
  const [hydrationStatus, setHydrationStatus] = useState<CloudHydrationStatus>('idle');
  const cloudSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCloudPayloadRef = useRef<string>('');
  const hydrationAttemptIdRef = useRef<string>('');

  const getSupabaseAccessToken = useCallback(async (): Promise<string | null> => {
    if (!supabaseClient) return null;
    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      return session?.access_token ?? null;
    } catch {
      return null;
    }
  }, [supabaseClient]);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setHydrationStatus('idle');
      hydrationAttemptIdRef.current = '';
      lastCloudPayloadRef.current = '';
    }
  }, [isAuthenticated, userId]);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    const attemptId = userId;
    if (hydrationAttemptIdRef.current === attemptId) return;
    hydrationAttemptIdRef.current = attemptId;
    setHydrationStatus('loading');
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const runHydration = async (attempt = 0) => {
      if (cancelled) return;
      const token = await getSupabaseAccessToken();
      if (!token) {
        if (attempt < 5) {
          retryTimer = setTimeout(() => runHydration(attempt + 1), 300 * Math.pow(2, attempt));
          return;
        }
        if (!cancelled) setHydrationStatus('failed');
        return;
      }
      try {
        const res = await fetch('/api/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          setHydrationStatus('failed');
          return;
        }

        const body = await res.json();
        if (!body || !Object.prototype.hasOwnProperty.call(body, 'dashboard')) {
          setHydrationStatus('failed');
          return;
        }

        const remote = body.dashboard;
        // Prefer the remote `pages` collection. Fall back to the legacy
        // single `widgets` array when the user has not synced post-migration.
        let resolved: DashboardPagesState | null = null;
        if (remote && Array.isArray(remote.pages) && remote.pages.length > 0) {
          resolved = sanitizePages({
            pages: remote.pages,
            activePageId: remote.activePageId,
          });
        }
        if (!resolved && remote && Array.isArray(remote.widgets) && remote.widgets.length > 0) {
          resolved = migrateLegacyWidgets(remote.widgets);
        }
        if (
          !resolved
          && remote
          && Array.isArray(remote.pages)
          && remote.pages.length === 0
          && Array.isArray(remote.widgets)
          && remote.widgets.length === 0
        ) {
          resolved = migrateLegacyWidgets([]);
        }

        // A malformed cloud row must never unlock writes. Otherwise stale
        // local data could replace the only good server copy.
        if (remote && !resolved) {
          setHydrationStatus('failed');
          return;
        }

        if (resolved) {
          const localActive = getActivePage(pagesStateRef.current);
          const localHasContent =
            pagesStateRef.current.pages.length > 1 || localActive.widgets.length > 0;
          // First sign-in from an existing guest: keep local content
          // when remote is genuinely empty (no widgets across pages).
          const remoteEmpty = resolved.pages.every(p => p.widgets.length === 0)
            && resolved.pages.length === 1;
          if (!(remoteEmpty && localHasContent)) {
            setPagesState(resolved);
            lastCloudPayloadRef.current = JSON.stringify(resolved);
          }
        }

        setHydrationStatus('ready');
      } catch {
        // Network/API error — keep local state.
        if (!cancelled) setHydrationStatus('failed');
      }
    };

    runHydration();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [isAuthenticated, userId, getSupabaseAccessToken, setPagesState, pagesStateRef]);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    if (!canWriteCloudDashboard(hydrationStatus)) return;
    const payload = JSON.stringify(pagesState);
    if (payload === lastCloudPayloadRef.current) return;
    if (cloudSyncTimerRef.current) clearTimeout(cloudSyncTimerRef.current);
    cloudSyncTimerRef.current = setTimeout(async () => {
      const token = await getSupabaseAccessToken();
      if (!token) return;
      try {
        const active = getActivePage(pagesState);
        const res = await fetch('/api/dashboard', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          // Mirror the active page's widgets into the legacy `widgets`
          // column so older clients (and the existing /api/cast push
          // path) keep functioning during the rollout.
          body: JSON.stringify({
            name: 'My Dashboard',
            widgets: active.widgets,
            pages: pagesState.pages,
            activePageId: pagesState.activePageId,
          }),
        });
        if (res.ok) {
          lastCloudPayloadRef.current = payload;
        }
      } catch {
        // Silent fail — localStorage is still the ground truth.
      }
    }, 1500);
    return () => {
      if (cloudSyncTimerRef.current) clearTimeout(cloudSyncTimerRef.current);
    };
  }, [pagesState, isAuthenticated, userId, hydrationStatus, getSupabaseAccessToken]);
}
