// Auto-extracted from App.tsx during widget modularization.
  // Mirrors a logged-in user's widget layout to the `dashboards` table
  // via /api/dashboard:
  //   1. On sign-in, GET once. If a remote layout exists, replace local
  //      widgets with it (unless remote is empty and we already have
  //      local widgets — first sign-in from an existing guest, in which
  //      case the next debounced upload promotes them).
  //   2. After every widget change (debounced 1.5s), POST with a Bearer
  //      access token from the live Supabase session.
  // Guests are unaffected — localStorage stays the only source of truth.
  // Network failures silently fall back to localStorage.
  import { useCallback, useEffect, useRef, useState } from 'react';
  import type { Widget } from '@/widgets/shared';

  type SupabaseLike = {
    auth: {
      getSession: () => Promise<{ data: { session: { access_token?: string } | null } }>;
    };
  } | null | undefined;

  interface UseCloudSyncArgs {
    isAuthenticated: boolean;
    userId: string | undefined;
    supabaseClient: SupabaseLike;
    widgets: Widget[];
    setWidgets: (widgets: Widget[]) => void;
    widgetsRef: React.MutableRefObject<Widget[]>;
  }

  export function useCloudSync({
    isAuthenticated,
    userId,
    supabaseClient,
    widgets,
    setWidgets,
    widgetsRef,
  }: UseCloudSyncArgs): void {
    // Hydration state machine. Uploads are blocked until hydration
    // for the *current* sign-in finishes (success OR failure), so we
    // can never POST a stale local layout that overwrites the remote
    // copy. A unique session id (`user.id` + `signInToken`) ensures
    // a re-login retries hydration even if the previous attempt was
    // skipped because the access token wasn't ready yet.
    const [hydrationStatus, setHydrationStatus] = useState<'idle' | 'loading' | 'done'>('idle');
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

    // Reset hydration when the user signs out.
    useEffect(() => {
      if (!isAuthenticated || !userId) {
        setHydrationStatus('idle');
        hydrationAttemptIdRef.current = '';
        lastCloudPayloadRef.current = '';
      }
    }, [isAuthenticated, userId]);

    // Hydrate widgets from the cloud once per sign-in. Retries with
    // backoff while no token is available so a slow Supabase init
    // can't permanently strand us in `idle`.
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
          // Session may not be primed yet — retry up to ~5x with
          // exponential backoff (300ms, 600ms, 1.2s, 2.4s, 4.8s).
          if (attempt < 5) {
            retryTimer = setTimeout(() => runHydration(attempt + 1), 300 * Math.pow(2, attempt));
            return;
          }
          if (!cancelled) setHydrationStatus('done');
          return;
        }
        try {
          const res = await fetch('/api/dashboard', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (cancelled) return;
          if (res.ok) {
            const body = await res.json();
            const remote = body?.dashboard;
            if (remote && Array.isArray(remote.widgets)) {
              // Remote layout wins on sign-in. Exception: if the
              // remote slot is empty and we already have local
              // widgets, keep local and let the upload effect push
              // them up (first sign-in from an existing guest).
              if (!(remote.widgets.length === 0 && widgetsRef.current.length > 0)) {
                setWidgets(remote.widgets);
                lastCloudPayloadRef.current = JSON.stringify(remote.widgets);
              }
            }
          }
        } catch {
          // Network/API error — keep local widgets, uploads will
          // overwrite stale remote next time they fire.
        }
        if (!cancelled) setHydrationStatus('done');
      };

      runHydration();
      return () => {
        cancelled = true;
        if (retryTimer) clearTimeout(retryTimer);
      };
    }, [isAuthenticated, userId, getSupabaseAccessToken, setWidgets, widgetsRef]);

    // Debounced upload of widget layout for signed-in users. Held
    // back until hydration finishes so we never overwrite the
    // remote copy with stale local widgets.
    useEffect(() => {
      if (!isAuthenticated || !userId) return;
      if (hydrationStatus !== 'done') return;
      const payload = JSON.stringify(widgets);
      if (payload === lastCloudPayloadRef.current) return;
      if (cloudSyncTimerRef.current) clearTimeout(cloudSyncTimerRef.current);
      cloudSyncTimerRef.current = setTimeout(async () => {
        const token = await getSupabaseAccessToken();
        if (!token) return;
        try {
          const res = await fetch('/api/dashboard', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name: 'My Dashboard', widgets }),
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
    }, [widgets, isAuthenticated, userId, hydrationStatus, getSupabaseAccessToken]);
  }
  