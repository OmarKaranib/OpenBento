// Trivia — single MC question from /api/trivia, reveal + score + cooldown.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle, RefreshCw, Settings as SettingsIcon, X as XIcon } from 'lucide-react';
import { MONO, Widget, isLightBg, qrIconBtnStyle, qrLabelStyle } from './shared';

interface Props { widget: Widget; onUpdate?: (id: string, patch: Partial<Widget>) => void; }

interface TriviaPayload {
  question: string; choices: string[]; answerIdx: number;
  category: string; difficulty: string;
}

const COOLDOWN_MS = 8_000;

export const TriviaWidget: React.FC<Props> = ({ widget, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 280, h: 240 });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [, setNowTick] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(es => { for (const e of es) setSize({ w: e.contentRect.width, h: e.contentRect.height }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowTick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const difficulty = widget.triviaDifficulty ?? 'any';
  const score = widget.triviaScore ?? { correct: 0, total: 0 };
  const current = widget.triviaCurrent ?? null;
  const answeredIdx = widget.triviaAnsweredIdx ?? null;
  const cooldownRemaining = Math.max(0, (widget.triviaCooldownUntil ?? 0) - Date.now());

  const fetchOne = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch(`/api/trivia?difficulty=${encodeURIComponent(difficulty)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json() as TriviaPayload;
      if (!j.question || !Array.isArray(j.choices)) throw new Error('Malformed payload');
      onUpdate?.(widget.id, {
        triviaCurrent: {
          question: j.question, choices: j.choices, answerIdx: j.answerIdx,
          category: j.category, difficulty: j.difficulty,
        },
        triviaAnsweredIdx: null,
        triviaCooldownUntil: Date.now() + COOLDOWN_MS,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!current && !loading) void fetchOne();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (idx: number) => {
    if (!current || answeredIdx != null) return;
    const correct = idx === current.answerIdx;
    onUpdate?.(widget.id, {
      triviaAnsweredIdx: idx,
      triviaScore: { correct: score.correct + (correct ? 1 : 0), total: score.total + 1 },
      triviaCooldownUntil: Date.now() + COOLDOWN_MS,
    });
  };

  const resetScore = () => {
    onUpdate?.(widget.id, { triviaScore: { correct: 0, total: 0 } });
  };

  const bgColor = widget.customColor ?? '#1f1430';
  const light = isLightBg(bgColor);
  const accent = light ? '#7e22ce' : '#c084fc';
  const clrPrimary = light ? '#0f172a' : '#e2e8f0';
  const clrSubtle = light ? '#475569' : '#cbd5e1';
  const clrMuted = light ? '#64748b' : '#94a3b8';
  const clrBorder = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';
  const choiceBg = light ? 'rgba(0,0,0,0.04)' : 'rgba(15,23,42,0.55)';
  const choiceBd = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';
  const fs = Math.max(11, Math.min(14, size.w * 0.034));

  const cooldownLeftSec = Math.ceil(cooldownRemaining / 1000);
  const canRefetch = !loading && cooldownRemaining === 0;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%', background: bgColor,
        borderRadius: 'var(--outer-radius)',
        padding: 12, boxSizing: 'border-box', overflow: 'hidden',
        border: `1px solid ${clrBorder}`, position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
      data-testid={`trivia-widget-${widget.id}`}
    >
      {/* Single toggle button: gear when closed, X when open */}
      <div
        className={showSettings ? undefined : 'widget-hover-cog'}
        style={{ position: 'absolute', top: 8, right: 8, zIndex: 6 }}
      >
        <button
          onClick={() => setShowSettings(s => !s)}
          style={qrIconBtnStyle()}
          title={showSettings ? 'Close settings' : 'Settings'}
          data-testid={`trivia-settings-toggle-${widget.id}`}
        >
          {showSettings ? <XIcon size={11} /> : <SettingsIcon size={11} />}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <HelpCircle size={14} color={accent} />
        <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
          TRIVIA · HOURLY
        </span>
        <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 9 }} data-testid={`trivia-score-${widget.id}`}>
          {score.correct}/{score.total}
        </span>
      </div>

      {/* Settings overlay — no X button inside; toggle button above handles close */}
      {showSettings && (
        <div
          style={{
            position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.97)', zIndex: 4,
            padding: 12, display: 'flex', flexDirection: 'column', gap: 10, borderRadius: 'var(--outer-radius)',
          }}
          onKeyDown={e => e.stopPropagation()}
          data-testid={`trivia-settings-panel-${widget.id}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 28 }}>
            <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>Settings</span>
          </div>
          <label style={qrLabelStyle()}>
            Difficulty
            <select
              value={difficulty}
              onChange={e => onUpdate?.(widget.id, { triviaDifficulty: e.target.value as Widget['triviaDifficulty'] })}
              style={{
                padding: '6px 8px', borderRadius: 6,
                background: 'rgba(15,23,42,0.65)', border: '1px solid rgba(71,85,105,0.5)',
                color: '#e2e8f0', fontFamily: MONO, fontSize: 11,
              }}
              data-testid={`trivia-difficulty-select-${widget.id}`}
            >
              <option value="any">Any</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <button
            onClick={resetScore}
            style={{
              padding: '6px 10px', borderRadius: 6,
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
              color: '#fca5a5', fontFamily: MONO, fontSize: 11, cursor: 'pointer',
            }}
            data-testid={`trivia-reset-score-${widget.id}`}
          >
            Reset score
          </button>
          <span style={{ color: '#94a3b8', fontFamily: MONO, fontSize: 10 }}>
            Source: opentdb.com (Open Trivia DB)
          </span>
        </div>
      )}

      {!showSettings && (
        <>
          {loading && !current && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: clrMuted, fontFamily: MONO, fontSize: 11 }}>
              Loading…
            </div>
          )}
          {err && !current && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ color: '#f87171', fontFamily: MONO, fontSize: 11 }}>{err}</span>
              <button onClick={() => void fetchOne()} style={qrIconBtnStyle()} data-testid={`trivia-retry-${widget.id}`}>
                <RefreshCw size={11} />
              </button>
            </div>
          )}
          {current && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flexShrink: 0 }}>
                <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 9, padding: '2px 6px', background: choiceBg, borderRadius: 4, border: `1px solid ${choiceBd}` }}>
                  {current.category}
                </span>
                <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 9, padding: '2px 6px', background: choiceBg, borderRadius: 4, border: `1px solid ${choiceBd}`, textTransform: 'capitalize' }}>
                  {current.difficulty}
                </span>
              </div>
              <div
                style={{
                  color: clrPrimary, fontFamily: 'Inter, system-ui, sans-serif',
                  fontSize: fs + 1, fontWeight: 600, lineHeight: 1.35, flexShrink: 0,
                }}
                data-testid={`trivia-question-${widget.id}`}
              >
                {current.question}
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {current.choices.map((c, i) => {
                  const revealed = answeredIdx != null;
                  const isCorrect = i === current.answerIdx;
                  const isPicked = i === answeredIdx;
                  let bg = choiceBg, bd = choiceBd, fg = clrPrimary;
                  if (revealed && isCorrect)        { bg = '#15803d22'; bd = '#15803d'; fg = light ? '#15803d' : '#86efac'; }
                  else if (revealed && isPicked)    { bg = '#b9112022'; bd = '#b91120'; fg = light ? '#b91120' : '#fca5a5'; }
                  return (
                    <button
                      key={i}
                      onClick={() => choose(i)}
                      disabled={revealed}
                      style={{
                        textAlign: 'left',
                        padding: '6px 10px', borderRadius: 6,
                        background: bg, border: `1px solid ${bd}`,
                        color: fg, fontFamily: 'Inter, system-ui, sans-serif',
                        fontSize: fs, lineHeight: 1.3,
                        cursor: revealed ? 'default' : 'pointer',
                      }}
                      data-testid={`trivia-choice-${i}-${widget.id}`}
                    >
                      {String.fromCharCode(65 + i)}. {c}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ flex: 1, color: clrSubtle, fontFamily: MONO, fontSize: 9 }}>
                  {answeredIdx == null
                    ? 'Tap a choice'
                    : (answeredIdx === current.answerIdx ? 'Correct!' : 'Not quite.')}
                </span>
                <button
                  onClick={() => void fetchOne()}
                  disabled={!canRefetch}
                  style={{
                    padding: '4px 10px', borderRadius: 6,
                    background: canRefetch ? `${accent}33` : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${canRefetch ? accent : 'rgba(255,255,255,0.10)'}`,
                    color: canRefetch ? accent : clrMuted,
                    fontFamily: MONO, fontSize: 10, fontWeight: 700,
                    cursor: canRefetch ? 'pointer' : 'default',
                  }}
                  data-testid={`trivia-next-${widget.id}`}
                >
                  {cooldownRemaining > 0 ? `Next ${cooldownLeftSec}s` : 'Next →'}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};