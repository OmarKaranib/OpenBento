// Daily Wordle — 5 letters, 6 guesses, one word per UTC day so every
// player gets the same answer. State (guesses + win/loss) is persisted
// per-day; opening the widget on a new UTC day resets the board.
import React, { useEffect, useRef, useState } from 'react';
import { Puzzle } from 'lucide-react';
import { MONO, Widget, isLightBg } from './shared';
import { evaluateWordleGuess, pickDailyWord, utcDateKey, WORDLE_ANSWERS } from './play-helpers';

interface Props { widget: Widget; onUpdate?: (id: string, patch: Partial<Widget>) => void; }

const ROWS = 6;
const COLS = 5;

// A small extra acceptance pool (loaned letters) so common guesses
// outside the answer set don't bounce. We accept any 5-letter alphabetic
// guess; we just don't validate it against a full dictionary — the goal
// here is a quick daily puzzle, not tournament-grade Wordle.
const isAcceptableGuess = (s: string) => /^[a-z]{5}$/.test(s);

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

  // Today's UTC date + answer. We don't memoise on mount — if the widget
  // is left open across UTC midnight the date must advance, the board
  // must clear, and the new daily word must be picked. Re-checking the
  // UTC date once a minute is plenty of resolution and costs nothing.
  const [today, setToday] = useState(() => utcDateKey(new Date()));
  useEffect(() => {
    const tick = () => {
      const k = utcDateKey(new Date());
      setToday(prev => (prev === k ? prev : k));
    };
    const id = window.setInterval(tick, 60_000);
    // Also fire when the tab regains focus / visibility — covers the
    // case where the laptop was asleep through midnight and `setInterval`
    // didn't fire on schedule.
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);
  const answer = pickDailyWord(today, WORDLE_ANSWERS);

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

  const submit = () => {
    if (finished) return;
    const g = draft.toLowerCase();
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

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
  };

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

  // Tile size — fit COLS × ROWS into available area with 4px gaps and
  // a header band reserved.
  const headerBand = 36;
  const inputBand = 36;
  const gridGap = 4;
  const usableH = Math.max(60, size.h - 24 - headerBand - inputBand - 12);
  const usableW = Math.max(60, size.w - 24);
  const tileFromH = Math.floor((usableH - gridGap * (ROWS - 1)) / ROWS);
  const tileFromW = Math.floor((usableW - gridGap * (COLS - 1)) / COLS);
  const tile = Math.max(20, Math.min(tileFromH, tileFromW, 56));

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {!finished && (
          <input
            type="text"
            value={draft}
            onChange={e => {
              const v = e.target.value.toLowerCase().replace(/[^a-z]/g, '').slice(0, COLS);
              setDraft(v);
            }}
            onKeyDown={onKeyDown}
            maxLength={COLS}
            placeholder="Type a 5-letter word…"
            style={{
              flex: 1, padding: '6px 8px',
              background: tileEmptyBg, border: `1px solid ${tileEmptyBd}`, borderRadius: 6,
              color: clrPrimary, fontFamily: MONO, fontSize: 12, letterSpacing: '0.08em',
              textTransform: 'uppercase',
              outline: 'none',
            }}
            data-testid={`wordle-input-${widget.id}`}
          />
        )}
        {!finished && (
          <button
            onClick={submit}
            disabled={!isAcceptableGuess(draft.toLowerCase())}
            style={{
              padding: '6px 10px', borderRadius: 6,
              background: isAcceptableGuess(draft.toLowerCase()) ? `${accent}33` : 'rgba(255,255,255,0.06)',
              border: `1px solid ${isAcceptableGuess(draft.toLowerCase()) ? accent : 'rgba(255,255,255,0.10)'}`,
              color: isAcceptableGuess(draft.toLowerCase()) ? accent : clrMuted,
              fontFamily: MONO, fontSize: 11, fontWeight: 700,
              cursor: isAcceptableGuess(draft.toLowerCase()) ? 'pointer' : 'default',
            }}
            data-testid={`wordle-submit-${widget.id}`}
          >
            ENTER
          </button>
        )}
        {finished && (
          <span
            style={{
              flex: 1,
              color: status === 'won' ? '#22c55e' : (status === 'lost' ? '#f87171' : clrSubtle),
              fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
              textAlign: 'center',
            }}
            data-testid={`wordle-result-${widget.id}`}
          >
            {status === 'won' ? `Solved in ${guesses.length}/${ROWS}!` : `Word was ${answer.toUpperCase()}`}
          </span>
        )}
      </div>
      <style>{`@keyframes wordleShake { 10%,90%{transform:translateX(-1px)} 20%,80%{transform:translateX(2px)} 30%,50%,70%{transform:translateX(-4px)} 40%,60%{transform:translateX(4px)} }`}</style>
    </div>
  );
};
