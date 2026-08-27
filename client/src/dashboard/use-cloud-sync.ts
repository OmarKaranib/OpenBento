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
// Failed cloud writes retry twice before falling back to localStorage.
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
export const DASHBOARD_OWNER_STORAGE_KEY = 'openBentoDashboardOwnerId';

export function canWriteCloudDashboard(status: CloudHydrationStatus): boolean {
  return status === 'ready';
}

const CLOUD_WRITE_RETRY_DELAYS = [1000, 2000] as const;
const CLOUD_READ_RETRY_DELAYS = [500, 1500] as const;

export function cloudWriteRetryDelay(failedAttempt: number): number | null {
  return CLOUD_WRITE_RETRY_DELAYS[failedAttempt] ?? null;
}

export function cloudReadRetryDelay(failedAttempt: number): number | null {
  return CLOUD_READ_RETRY_DELAYS[failedAttempt] ?? null;
}

export function shouldRetryCloudRead(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export function canAdoptLocalDashboard(
  localOwnerId: string | null,
  currentUserId: string,
): boolean {
  return !localOwnerId || localOwnerId === currentUserId;
}

function getLocalDashboardOwner(): string | null {
  try {
    return localStorage.getItem(DASHBOARD_OWNER_STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberLocalDashboardOwner(userId: string): void {
  try {
    localStorage.setItem(DASHBOARD_OWNER_STORAGE_KEY, userId);
  } catch {
    // Private browsing can disable localStorage. Cloud sync still works.
  }
}

export async function saveCloudDashboard(
  pagesState: DashboardPagesState,
  token: string,
  request: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const active = getActivePage(pagesState);
    const res = await request('/api/dashboard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'My Dashboard',
        widgets: active.widgets,
        pages: pagesState.pages,
        activePageId: pagesState.activePageId,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
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

    const retryHydration = (attempt: number): boolean => {
      const delay = cloudReadRetryDelay(attempt);
      if (delay === null) return false;
      retryTimer = setTimeout(() => void runHydration(attempt + 1), delay);
      return true;
    };

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
          if (shouldRetryCloudRead(res.status) && retryHydration(attempt)) return;
          setHydrationStatus('failed');
          return;
        }

        const body = await res.json();
        if (!body || !Object.prototype.hasOwnProperty.call(body, 'dashboard')) {
          setHydrationStatus('failed');
          return;
        }

        const remote = body.dashboard;
        const localOwnerId = getLocalDashboardOwner();
        const mayAdoptLocal = canAdoptLocalDashboard(localOwnerId, userId);
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
          if (!(remoteEmpty && localHasContent && mayAdoptLocal)) {
            setPagesState(resolved);
            lastCloudPayloadRef.current = JSON.stringify(resolved);
          }
        } else if (!remote && !mayAdoptLocal) {
          // This browser still contains another account's dashboard and the
          // current account has no cloud row. Start clean instead of copying
          // the previous account's private layout into this one.
          const empty = migrateLegacyWidgets([]);
          setPagesState(empty);
          lastCloudPayloadRef.current = JSON.stringify(empty);
        }

        rememberLocalDashboardOwner(userId);
        setHydrationStatus('ready');
      } catch {
        // Network/API error — keep local state.
        if (!cancelled && !retryHydration(attempt)) setHydrationStatus('failed');
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
    let cancelled = false;

    const runCloudWrite = async (attempt = 0) => {
      const token = await getSupabaseAccessToken();
      if (cancelled) return;

      const saved = token
        ? await saveCloudDashboard(pagesState, token)
        : false;
      if (cancelled) return;

      if (saved) {
        lastCloudPayloadRef.current = payload;
        return;
      }

      const retryDelay = cloudWriteRetryDelay(attempt);
      if (retryDelay !== null) {
        cloudSyncTimerRef.current = setTimeout(
          () => void runCloudWrite(attempt + 1),
          retryDelay,
        );
      }
    };

    cloudSyncTimerRef.current = setTimeout(() => void runCloudWrite(), 1500);
    return () => {
      cancelled = true;
      if (cloudSyncTimerRef.current) clearTimeout(cloudSyncTimerRef.current);
    };
  }, [pagesState, isAuthenticated, userId, hydrationStatus, getSupabaseAccessToken]);
}
