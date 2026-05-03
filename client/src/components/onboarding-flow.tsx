import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ArrowRight } from 'lucide-react';
import {
  STARTER_PACKS,
  buildWidgetsFromPack,
  type StarterPack,
} from '@/data/starter-packs';
import type { TrendingChannel } from '@/components/widget-sidebar';
import type { Widget } from '@/App';

export const ONBOARDING_FLAG = 'openBentoOnboarded';
export const REPLAY_EVENT = 'openbento:replay-onboarding';

type Phase = 'hidden' | 'welcome' | 'coach-block' | 'coach-edit' | 'coach-cast' | 'coach-themes';

interface OnboardingFlowProps {
  setWidgets: (widgets: Widget[]) => void;
  hasWidgets: boolean;
  isAuthenticated: boolean;
  authIsLoading: boolean;
  isDashboardRoute: boolean;
}

/**
 * First-time visitor onboarding. Auto-opens once for fresh guests with no
 * widgets, then never again unless replayed via the global `REPLAY_EVENT`.
 *
 * Triggers (all must be true):
 *   - localStorage[ONBOARDING_FLAG] !== 'true'
 *   - !isAuthenticated  (logged-in users skip — they likely have a saved layout)
 *   - widgets.length === 0
 *   - auth has finished loading (avoid flashing during auth bootstrap)
 *   - on a dashboard route (don't auto-fire on /terms, /privacy, /admin, etc.)
 */
export function OnboardingFlow({
  setWidgets,
  hasWidgets,
  isAuthenticated,
  authIsLoading,
  isDashboardRoute,
}: OnboardingFlowProps) {
  const [phase, setPhase] = useState<Phase>('hidden');
  const [channels, setChannels] = useState<TrendingChannel[]>([]);
  const hasAutoOpenedRef = useRef(false);

  // Pre-fetch live channel data so video starter packs get fresh videoIds
  useEffect(() => {
    let cancelled = false;
    fetch('/api/links')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled) return;
        const list: TrendingChannel[] = data?.channels ?? [];
        setChannels(list);
      })
      .catch(() => {/* offline / API down — empty array, video packs skip */})
      .finally(() => {
        if (!cancelled) setChannelsReady(true);
      });
    return () => { cancelled = true; };
  }, []);

  // Auto-open for first-time guests
  useEffect(() => {
    if (hasAutoOpenedRef.current) return;
    if (authIsLoading) return;
    if (isAuthenticated) return;
    if (hasWidgets) return;
    if (!isDashboardRoute) return;
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(ONBOARDING_FLAG) === 'true') return;

    hasAutoOpenedRef.current = true;
    // Slight delay so the dashboard renders behind the modal first
    const t = setTimeout(() => setPhase('welcome'), 400);
    return () => clearTimeout(t);
  }, [authIsLoading, isAuthenticated, hasWidgets, isDashboardRoute]);

  // Replay event listener (from FloatingTutorial)
  useEffect(() => {
    const handler = () => {
      hasAutoOpenedRef.current = true;
      setPhase('welcome');
    };
    window.addEventListener(REPLAY_EVENT, handler);
    return () => window.removeEventListener(REPLAY_EVENT, handler);
  }, []);

  const finish = useCallback(() => {
    try { localStorage.setItem(ONBOARDING_FLAG, 'true'); } catch {/* private mode */}
    setPhase('hidden');
  }, []);

  // The welcome modal and the Block coachmark always advance to the next step;
  // only dismissing the *Edit* coachmark persists the onboarded flag.
  const skipWelcome     = useCallback(() => setPhase('coach-block'),  []);
  const advanceToEdit   = useCallback(() => setPhase('coach-edit'),   []);
  const advanceToCast   = useCallback(() => setPhase('coach-cast'),   []);
  const advanceToThemes = useCallback(() => setPhase('coach-themes'), []);

  useEffect(() => {
    if (phase === 'hidden') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (phase === 'welcome')         skipWelcome();
      else if (phase === 'coach-block') advanceToEdit();
      else if (phase === 'coach-edit')  advanceToCast();
      else if (phase === 'coach-cast')  advanceToThemes();
      else                              finish();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, finish, skipWelcome, advanceToEdit, advanceToCast, advanceToThemes]);

  // Track whether the channels response has resolved (success OR failure). We
  // can't simply check `channels.length > 0` because a failed fetch leaves it
  // at [], which is indistinguishable from "still loading".
  const [channelsReady, setChannelsReady] = useState(false);

  // Pack picks are queued if the user clicks before /api/links resolves, so
  // News (and other video-heavy packs) never silently load 0 tiles.
  const [pendingPick, setPendingPick] = useState<StarterPack | null>(null);

  const buildAndAdvance = useCallback((pack: StarterPack) => {
    if (pack.tiles.length === 0) {
      setPhase('coach-block');
      return;
    }
    const widgets = buildWidgetsFromPack(pack, channels);
    // Only call setWidgets when there's actually something to load — this
    // avoids wiping a populated grid if the response shape changes upstream.
    if (widgets.length > 0) setWidgets(widgets);
    setPhase('coach-block');
  }, [channels, setWidgets]);

  // Fulfil the queued pick once channels arrive.
  useEffect(() => {
    if (!channelsReady || !pendingPick) return;
    const queued = pendingPick;
    setPendingPick(null);
    buildAndAdvance(queued);
  }, [channelsReady, pendingPick, buildAndAdvance]);

  const handlePickPack = useCallback((pack: StarterPack) => {
    // Empty Canvas can advance immediately — it has no video tiles to hydrate.
    if (pack.tiles.length === 0) {
      setPhase('coach-block');
      return;
    }
    if (!channelsReady) {
      // Defer until the live channel data arrives. The pack button shows a
      // "Loading channels…" state while queued (see WelcomeModal).
      setPendingPick(pack);
      return;
    }
    buildAndAdvance(pack);
  }, [channelsReady, buildAndAdvance]);

  if (phase === 'hidden') return null;

  if (phase === 'welcome') {
    return (
      <WelcomeModal
        onPick={handlePickPack}
        onSkip={skipWelcome}
        channelsReady={channelsReady}
        pendingPackId={pendingPick?.id ?? null}
      />
    );
  }

  if (phase === 'coach-block') {
    return (
      <Coachmark
        targetSelector='[data-testid="button-add-block"]'
        title="Add tiles to your grid"
        body={<>Tap <strong className="text-cyan-300">Block</strong> anytime to add or swap tiles.</>}
        step={1}
        total={3}
        onNext={advanceToEdit}
        nextLabel="Got it"
        // Backdrop click / skip on Step 1 must still advance to Step 2 — the
        // spec requires both coachmarks to be shown before persisting the flag.
        onSkip={advanceToEdit}
      />
    );
  }

  if (phase === 'coach-edit') {
    return (
      <Coachmark
        targetSelector='[data-testid="button-edit-layout"]'
        title="Rearrange your dashboard"
        body={<>Hit <strong className="text-cyan-300">Edit</strong> to drag, resize, or remove tiles.</>}
        step={2}
        total={3}
        onNext={advanceToCast}
        nextLabel="Next"
        onSkip={advanceToCast}
      />
    );
  }

  if (phase === 'coach-cast') {
    return (
      <Coachmark
        targetSelector='[data-testid="button-cast"]'
        title="Cast to any TV"
        body={<>Tap <strong className="text-cyan-300">Cast</strong> to mirror this dashboard onto any TV — sign in to schedule layouts across the week.</>}
        step={3}
        total={4}
        onNext={advanceToThemes}
        nextLabel="Next"
        onSkip={advanceToThemes}
      />
    );
  }

  if (phase === 'coach-themes') {
    return (
      <Coachmark
        targetSelector='[data-testid="button-themes"]'
        title="Make it yours with themes"
        body={<>Tap <strong className="text-violet-300">Themes</strong> to swap the whole look — eight built-in styles, or save your current look as a personal theme.</>}
        step={4}
        total={4}
        onNext={finish}
        nextLabel="Done"
        onSkip={finish}
      />
    );
  }

  return null;
}

// ─── Welcome Modal ──────────────────────────────────────────────────────────

function WelcomeModal({
  onPick,
  onSkip,
  channelsReady,
  pendingPackId,
}: {
  onPick: (pack: StarterPack) => void;
  onSkip: () => void;
  channelsReady: boolean;
  pendingPackId: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus trap: focus the first interactive element on mount, restore prior
  // focus on unmount, and cycle Tab/Shift+Tab within the modal.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusable = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(el => el.offsetParent !== null);

    // Focus the first starter pack tile (skip the close X for friendlier UX)
    const firstPackBtn = root.querySelector<HTMLElement>('[data-testid^="button-pack-"]');
    firstPackBtn?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !root.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[10100] flex items-center justify-center p-6"
      data-testid="onboarding-welcome"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      {/* Frosted backdrop */}
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />

      <div className="relative w-full max-w-[58rem] bg-slate-900/95 border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-500/20 p-[2rem] md:p-[2.5rem]">
        <button
          onClick={onSkip}
          className="absolute top-[1rem] right-[1rem] w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-colors"
          aria-label="Skip onboarding"
          data-testid="button-onboarding-skip"
        >
          <X className="w-4 h-4 text-slate-300" />
        </button>

        <div className="text-center mb-[1.5rem]">
          <img
            src="/t.png"
            alt="OpenBento logo"
            className="w-14 h-14 mx-auto mb-[0.8rem] rounded-xl object-contain"
            data-testid="img-onboarding-logo"
          />
          <h2
            id="onboarding-title"
            className="text-[1.8rem] md:text-[2rem] font-bold text-white mb-[0.4rem]"
            data-testid="text-onboarding-title"
          >
            Welcome to OpenBento
          </h2>
          <p
            className="text-[0.95rem] md:text-[1rem] text-slate-400"
            data-testid="text-onboarding-tagline"
          >
            Your live mission control for streams, news &amp; signals.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[1rem]">
          {STARTER_PACKS.map(pack => {
            // Video-bearing packs need /api/links to have resolved before we
            // can populate fresh videoIds. Empty Canvas always works.
            const needsChannels = pack.tiles.some(t => t.type === 'video');
            const isLoading     = needsChannels && !channelsReady;
            const isQueued      = pendingPackId === pack.id;
            return (
            <button
              key={pack.id}
              onClick={() => onPick(pack)}
              className={`group relative text-left bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/60 rounded-xl p-[1.2rem] transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-cyan-500/10 ${isQueued ? 'cursor-wait opacity-70' : ''}`}
              data-testid={`button-pack-${pack.id}`}
              aria-busy={isQueued}
              aria-disabled={isLoading || isQueued}
            >
              <div className="flex items-start gap-[0.8rem]">
                <span className="text-[2rem] leading-none" aria-hidden="true">{pack.emoji}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[1.1rem] font-bold text-white mb-[0.2rem]">{pack.label}</h3>
                  <p className="text-[0.85rem] text-slate-400 leading-snug">
                    {isQueued ? 'Loading channels…' : pack.description}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 mt-[0.4rem] flex-shrink-0 transition-colors" />
              </div>

              {pack.tiles.length > 0 && (
                <div
                  className="mt-[1rem] grid gap-[2px] bg-slate-950/40 rounded-md p-[4px]"
                  style={{
                    gridTemplateColumns: 'repeat(12, 1fr)',
                    gridTemplateRows: 'repeat(6, 8px)',
                  }}
                  aria-hidden="true"
                >
                  {pack.tiles.map((t, i) => (
                    <div
                      key={i}
                      className="bg-cyan-500/30 rounded-[2px]"
                      style={{
                        gridColumn: `${t.x + 1} / span ${t.w}`,
                        gridRow: `${t.y + 1} / span ${t.h}`,
                      }}
                    />
                  ))}
                </div>
              )}
              {pack.tiles.length === 0 && (
                <div className="mt-[1rem] h-[3rem] flex items-center justify-center bg-slate-950/40 rounded-md border border-dashed border-slate-700">
                  <span className="text-[0.75rem] text-slate-500 uppercase tracking-wide">Blank</span>
                </div>
              )}
            </button>
            );
          })}
        </div>

        <div className="mt-[1.5rem] flex items-center justify-between">
          <p className="text-[0.8rem] text-slate-500">
            You can replay this anytime from the <span className="text-cyan-400">?</span> menu.
          </p>
          <button
            onClick={onSkip}
            className="text-[0.85rem] text-slate-400 hover:text-white underline-offset-2 hover:underline transition-colors"
            data-testid="button-onboarding-skip-bottom"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Coachmark ──────────────────────────────────────────────────────────────

interface CoachmarkProps {
  targetSelector: string;
  title: string;
  body: React.ReactNode;
  step: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
  nextLabel?: string;
}

function Coachmark({
  targetSelector,
  title,
  body,
  step,
  total,
  onNext,
  onSkip,
  nextLabel = 'Next',
}: CoachmarkProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    let lastRect: DOMRect | null = null;
    let mounted = true;

    const rectsEqual = (a: DOMRect | null, b: DOMRect | null) => {
      if (a === b) return true;
      if (!a || !b) return false;
      return (
        a.top === b.top && a.left === b.left &&
        a.width === b.width && a.height === b.height
      );
    };

    const recompute = () => {
      if (!mounted) return;
      const el = document.querySelector(targetSelector);
      const next = el ? el.getBoundingClientRect() : null;
      if (!rectsEqual(next, lastRect)) {
        lastRect = next;
        setRect(next);
      }
    };

    // Initial measure (deferred so target has time to mount/lay out)
    recompute();
    const initialPoll = window.setTimeout(recompute, 60);
    const settlePoll  = window.setTimeout(recompute, 300);

    // Track layout shifts: window resize/scroll + DOM mutations + ResizeObserver on body
    const onResize = () => recompute();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);

    const mo = new MutationObserver(recompute);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(recompute);
      ro.observe(document.body);
    }

    return () => {
      mounted = false;
      window.clearTimeout(initialPoll);
      window.clearTimeout(settlePoll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      mo.disconnect();
      ro?.disconnect();
    };
  }, [targetSelector]);

  if (!rect) {
    // Target missing — gracefully show floating tooltip in the center so the
    // user can still finish the flow.
    return (
      <div className="fixed inset-0 z-[10100] flex items-center justify-center p-6 pointer-events-none">
        <div className="absolute inset-0 bg-slate-950/60 pointer-events-auto" onClick={onSkip} />
        <CoachTooltip
          title={title} body={body} step={step} total={total}
          onNext={onNext} onSkip={onSkip} nextLabel={nextLabel}
        />
      </div>
    );
  }

  const tooltipTop = rect.bottom + 14;
  const tooltipLeft = Math.max(16, Math.min(window.innerWidth - 320 - 16, rect.left + rect.width / 2 - 160));

  return (
    <div className="fixed inset-0 z-[10100]" data-testid={`coachmark-${step}`}>
      {/* Click-anywhere-to-skip backdrop (transparent so user sees their layout) */}
      <div
        className="absolute inset-0 bg-slate-950/55"
        onClick={onSkip}
        data-testid="coachmark-backdrop"
      />

      {/* Pulsing ring around target */}
      <div
        className="absolute pointer-events-none rounded-lg"
        style={{
          top: rect.top - 6,
          left: rect.left - 6,
          width: rect.width + 12,
          height: rect.height + 12,
          boxShadow: '0 0 0 3px rgba(34, 211, 238, 0.9), 0 0 24px 4px rgba(34, 211, 238, 0.5)',
          animation: 'onboardingPulse 1.6s ease-in-out infinite',
        }}
      />

      {/* Cutout that lets the actual button shine through with no overlay */}
      <div
        className="absolute bg-transparent pointer-events-none"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }}
      />

      <CoachTooltip
        style={{ top: tooltipTop, left: tooltipLeft }}
        title={title} body={body} step={step} total={total}
        onNext={onNext} onSkip={onSkip} nextLabel={nextLabel}
      />

      <style>{`
        @keyframes onboardingPulse {
          0%, 100% {
            box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.9), 0 0 24px 4px rgba(34, 211, 238, 0.5);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(34, 211, 238, 0.4), 0 0 36px 8px rgba(34, 211, 238, 0.7);
          }
        }
      `}</style>
    </div>
  );
}

function CoachTooltip({
  title,
  body,
  step,
  total,
  onNext,
  onSkip,
  nextLabel,
  style,
}: {
  title: string;
  body: React.ReactNode;
  step: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
  nextLabel: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="absolute w-[20rem] bg-slate-900/98 border border-cyan-500/60 rounded-xl shadow-2xl shadow-cyan-500/20 p-[1.2rem] pointer-events-auto"
      style={style}
      data-testid="coachmark-tooltip"
    >
      <div className="flex items-center justify-between mb-[0.5rem]">
        <span className="text-[0.7rem] uppercase tracking-wider text-cyan-400 font-semibold">
          Step {step} of {total}
        </span>
        <button
          onClick={onSkip}
          className="text-[0.75rem] text-slate-400 hover:text-white transition-colors"
          data-testid="button-coachmark-skip"
        >
          Skip
        </button>
      </div>
      <h3 className="text-[1.05rem] font-bold text-white mb-[0.3rem]" data-testid="text-coachmark-title">
        {title}
      </h3>
      <p className="text-[0.85rem] text-slate-300 leading-snug mb-[1rem]">{body}</p>
      <button
        onClick={onNext}
        className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-[0.9rem] font-semibold rounded-lg transition-colors flex items-center justify-center gap-[0.4rem]"
        data-testid="button-coachmark-next"
      >
        {nextLabel}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
