import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import {
  STARTER_PACKS,
  buildWidgetsFromPack,
  type StarterPack,
} from '@/data/starter-packs';
import type { TrendingChannel } from '@/components/widget-sidebar';

export const ONBOARDING_FLAG = 'openBentoOnboarded';
export const REPLAY_EVENT = 'openbento:replay-onboarding';

type Phase = 'hidden' | 'welcome' | 'coach-block' | 'coach-edit';

interface OnboardingFlowProps {
  setWidgets: (widgets: any[]) => void;
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
      .catch(() => {/* offline / API down — empty array, video packs skip */});
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

  // Escape key closes the flow at any phase
  useEffect(() => {
    if (phase === 'hidden') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, finish]);

  const handlePickPack = useCallback((pack: StarterPack) => {
    if (pack.tiles.length === 0) {
      // Empty Canvas — skip straight to coachmarks so user knows where to start
      setPhase('coach-block');
      return;
    }
    const widgets = buildWidgetsFromPack(pack, channels);
    if (widgets.length === 0) {
      // All channels missing from live data — still advance the flow
      setPhase('coach-block');
      return;
    }
    setWidgets(widgets);
    setPhase('coach-block');
  }, [channels, setWidgets]);

  if (phase === 'hidden') return null;

  if (phase === 'welcome') {
    return <WelcomeModal onPick={handlePickPack} onSkip={finish} />;
  }

  if (phase === 'coach-block') {
    return (
      <Coachmark
        targetSelector='[data-testid="button-add-block"]'
        title="Add a Block"
        body="Click here to open the Block Library — drop in news, weather, notes, or anything else."
        step={1}
        total={2}
        onNext={() => setPhase('coach-edit')}
        onSkip={finish}
      />
    );
  }

  if (phase === 'coach-edit') {
    return (
      <Coachmark
        targetSelector='[data-testid="button-edit-layout"]'
        title="Arrange Your Layout"
        body="Toggle Edit to drag, resize, or remove blocks. Click Save when you're done."
        step={2}
        total={2}
        onNext={finish}
        nextLabel="Got it"
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
}: {
  onPick: (pack: StarterPack) => void;
  onSkip: () => void;
}) {
  return (
    <div
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
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/40 mb-[0.8rem]">
            <Sparkles className="w-6 h-6 text-cyan-400" />
          </div>
          <h2
            id="onboarding-title"
            className="text-[1.8rem] md:text-[2rem] font-bold text-white mb-[0.4rem]"
            data-testid="text-onboarding-title"
          >
            Welcome to OpenBento
          </h2>
          <p className="text-[0.95rem] md:text-[1rem] text-slate-400">
            Pick a starter pack to load some blocks — or start from scratch.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[1rem]">
          {STARTER_PACKS.map(pack => (
            <button
              key={pack.id}
              onClick={() => onPick(pack)}
              className="group relative text-left bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/60 rounded-xl p-[1.2rem] transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-cyan-500/10"
              data-testid={`button-pack-${pack.id}`}
            >
              <div className="flex items-start gap-[0.8rem]">
                <span className="text-[2rem] leading-none" aria-hidden="true">{pack.emoji}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[1.1rem] font-bold text-white mb-[0.2rem]">{pack.label}</h3>
                  <p className="text-[0.85rem] text-slate-400 leading-snug">{pack.description}</p>
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
          ))}
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
  body: string;
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
  body: string;
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
