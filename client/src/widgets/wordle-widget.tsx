// Daily Wordle — 5 letters, 6 guesses, one word per UTC day.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Delete, Puzzle } from 'lucide-react';
import { MONO, Widget, isLightBg } from './shared';
import { evaluateWordleGuess, pickDailyWord, utcDateKey, WORDLE_ANSWERS } from './play-helpers';

interface WordleTodayResp { date: string; answer: string; }

interface Props { widget: Widget; onUpdate?: (id: string, patch: Partial<Widget>) => void; }

const ROWS = 6;
const COLS = 5;

const isAcceptableGuess = (s: string) => /^[a-z]{5}$/.test(s);

const KEY_ROWS: readonly (readonly string[])[] = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['ENTER','z','x','c','v','b','n','m','BACK'],
];

type Verdict = 'correct' | 'present' | 'absent';
const RANK: Record<Verdict, number> = { absent: 0, present: 1, correct: 2 };

export const WordleWidget: React.FC<Props> = ({ widget, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 280, h: 240 });
  const [draft, setDraft] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(es => { for (const e of es) setSize({ w: e.contentRect.width, h: e.contentRect.height }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Polled rather than memoised so a tab left open across UTC midnight
  // advances the date and resets the board.
  const [today, setToday] = useState(() => utcDateKey(new Date()));
  useEffect(() => {
    const tick = () => {
      const k = utcDateKey(new Date());
      setToday(prev => (prev === k ? prev : k));
    };
    const id = window.setInterval(tick, 60_000);
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  // Canonical answer is server-owned; client pool is the offline fallback.
  const [serverAnswer, setServerAnswer] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/wordle/today');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json() as WordleTodayResp;
        if (cancelled) return;
        if (typeof j.answer === 'string' && /^[a-z]{5}$/i.test(j.answer)) {
          setServerAnswer(j.answer.toLowerCase());
        } else {
          setServerAnswer(null);
        }
      } catch {
        if (!cancelled) setServerAnswer(null);
      }
    })();
    return () => { cancelled = true; };
  }, [today]);
  const answer = serverAnswer ?? pickDailyWord(today, WORDLE_ANSWERS);

  // Roll over guesses if the persisted date is stale.
  useEffect(() => {
    if (widget.wordleDate !== today) {
      onUpdate?.(widget.id, { wordleDate: today, wordleGuesses: [], wordleStatus: 'playing' });
      setDraft('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const guesses = widget.wordleGuesses ?? [];
  const status = widget.wordleStatus ?? 'playing';
  const finished = status !== 'playing' || guesses.length >= ROWS;

  const submitGuess = (g: string) => {
    if (finished) return;
    if (!isAcceptableGuess(g)) {
      setShake(true);
      window.setTimeout(() => setShake(false), 380);
      return;
    }
    const next = [...guesses, g];
    let nextStatus: 'playing' | 'won' | 'lost' = 'playing';
    if (g === answer) nextStatus = 'won';
    else if (next.length >= ROWS) nextStatus = 'lost';
    onUpdate?.(widget.id, { wordleGuesses: next, wordleStatus: nextStatus, wordleDate: today });
    setDraft('');
  };

  const onKeyTap = (k: string) => {
    if (finished) return;
    if (k === 'ENTER') { submitGuess(draft.toLowerCase()); return; }
    if (k === 'BACK')  { setDraft(d => d.slice(0, -1)); return; }
    if (draft.length >= COLS) return;
    setDraft(d => (d + k).slice(0, COLS));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (finished) return;
    if (e.key === 'Enter')      { e.preventDefault(); submitGuess(draft.toLowerCase()); return; }
    if (e.key === 'Backspace')  { e.preventDefault(); setDraft(d => d.slice(0, -1)); return; }
    if (/^[a-zA-Z]$/.test(e.key) && draft.length < COLS) {
      e.preventDefault();
      setDraft(d => (d + e.key.toLowerCase()).slice(0, COLS));
    }
  };

  // Per-key best-known status across all submitted guesses.
  const keyStatus = useMemo(() => {
    const m: Record<string, Verdict> = {};
    for (const g of guesses) {
      const verdicts = evaluateWordleGuess(g, answer);
      for (let i = 0; i < g.length; i++) {
        const ch = g[i];
        const v = verdicts[i];
        if (!m[ch] || RANK[v] > RANK[m[ch]]) m[ch] = v;
      }
    }
    return m;
  }, [guesses, answer]);

  // Theming
  const bgColor = widget.customColor ?? '#0f172a';
  const light = isLightBg(bgColor);
  const accent = light ? '#0f766e' : '#5eead4';
  const clrPrimary = light ? '#0f172a' : '#e2e8f0';
  const clrSubtle = light ? '#475569' : '#cbd5e1';
  const clrMuted = light ? '#64748b' : '#94a3b8';
  const clrBorder = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';
  const tileEmptyBg = light ? 'rgba(0,0,0,0.04)' : 'rgba(15,23,42,0.55)';
  const tileEmptyBd = light ? 'rgba(0,0,0,0.15)' : 'rgba(71,85,105,0.45)';

  // Verdict colours match Wordle convention.
  const tileColor = (v: 'correct' | 'present' | 'absent'): { bg: string; bd: string; fg: string } => {
    if (v === 'correct') return { bg: '#15803d', bd: '#15803d', fg: '#ffffff' };
    if (v === 'present') return { bg: '#b45309', bd: '#b45309', fg: '#ffffff' };
    return { bg: light ? '#475569' : '#334155', bd: light ? '#475569' : '#334155', fg: '#ffffff' };
  };

  const headerBand = 28;
  const keyboardBand = 96;
  const gridGap = 4;
  const usableH = Math.max(60, size.h - 24 - headerBand - keyboardBand - 16);
  const usableW = Math.max(60, size.w - 24);
  const tileFromH = Math.floor((usableH - gridGap * (ROWS - 1)) / ROWS);
  const tileFromW = Math.floor((usableW - gridGap * (COLS - 1)) / COLS);
  const tile = Math.max(20, Math.min(tileFromH, tileFromW, 50));

  const keyColor = (k: string): { bg: string; bd: string; fg: string } => {
    if (k === 'ENTER' || k === 'BACK') {
      return { bg: light ? 'rgba(0,0,0,0.06)' : 'rgba(71,85,105,0.5)', bd: tileEmptyBd, fg: clrPrimary };
    }
    const v = keyStatus[k];
    if (v) return tileColor(v);
    return { bg: light ? 'rgba(0,0,0,0.04)' : 'rgba(71,85,105,0.35)', bd: tileEmptyBd, fg: clrPrimary };
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{
        width: '100%', height: '100%', background: bgColor,
        borderRadius: 'var(--outer-radius)',
        padding: 12, boxSizing: 'border-box', overflow: 'hidden',
        border: `1px solid ${clrBorder}`, position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 8, outline: 'none',
      }}
      data-testid={`wordle-widget-${widget.id}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <Puzzle size={14} color={accent} />
        <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
          DAILY WORDLE
        </span>
        <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 9 }}>
          {today}
        </span>
      </div>

      <div
        style={{
          flex: 1, minHeight: 0,
          display: 'grid',
          gridTemplateRows: `repeat(${ROWS}, ${tile}px)`,
          gridTemplateColumns: `repeat(${COLS}, ${tile}px)`,
          gap: gridGap, justifyContent: 'center', alignContent: 'center',
          animation: shake ? 'wordleShake 380ms ease' : undefined,
        }}
        data-testid={`wordle-grid-${widget.id}`}
      >
        {Array.from({ length: ROWS }).map((_, r) => {
          const guess = guesses[r];
          const verdicts = guess ? evaluateWordleGuess(guess, answer) : null;
          const isCurrentRow = !guess && r === guesses.length;
          const cells = Array.from({ length: COLS }).map((__, c) => {
            const ch = guess ? guess[c] : (isCurrentRow ? draft[c] ?? '' : '');
            const v = verdicts ? verdicts[c] : null;
            const colors = v ? tileColor(v) : { bg: tileEmptyBg, bd: tileEmptyBd, fg: clrPrimary };
            return (
              <div
                key={c}
                style={{
                  width: tile, height: tile,
                  background: colors.bg,
                  border: `1.5px solid ${colors.bd}`,
                  borderRadius: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: MONO, fontWeight: 800,
                  fontSize: Math.max(14, tile * 0.5),
                  color: colors.fg,
                  textTransform: 'uppercase',
                  transition: 'background 120ms, border-color 120ms',
                }}
                data-testid={`wordle-cell-${r}-${c}-${widget.id}`}
              >
                {ch ?? ''}
              </div>
            );
          });
          return cells;
        })}
      </div>

      {finished && (
        <div
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            flexShrink: 0,
          }}
          data-testid={`wordle-result-${widget.id}`}
        >
          <span style={{
            color: status === 'won' ? '#22c55e' : '#f87171',
            fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
          }}>
            {status === 'won' ? `Solved in ${guesses.length}/${ROWS}!` : `Word was ${answer.toUpperCase()}`}
          </span>
          <span
            style={{ color: clrMuted, fontFamily: MONO, fontSize: 10 }}
            data-testid={`wordle-come-back-${widget.id}`}
          >
            Come back tomorrow for a new word.
          </span>
        </div>
      )}

      {!finished && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }} data-testid={`wordle-keyboard-${widget.id}`}>
          {KEY_ROWS.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
              {row.map(k => {
                const wide = k === 'ENTER' || k === 'BACK';
                const c = keyColor(k);
                return (
                  <button
                    key={k}
                    onClick={() => onKeyTap(k)}
                    style={{
                      flex: wide ? '1.6 1 0' : '1 1 0',
                      minWidth: 0,
                      height: 28,
                      padding: 0,
                      background: c.bg, border: `1px solid ${c.bd}`, color: c.fg,
                      borderRadius: 4,
                      fontFamily: MONO, fontWeight: 700,
                      fontSize: wide ? 9 : 11,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    data-testid={`wordle-key-${k.toLowerCase()}-${widget.id}`}
                  >
                    {k === 'BACK' ? <Delete size={12} /> : k}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes wordleShake { 10%,90%{transform:translateX(-1px)} 20%,80%{transform:translateX(2px)} 30%,50%,70%{transform:translateX(-4px)} 40%,60%{transform:translateX(4px)} }`}</style>
    </div>
  );
};
