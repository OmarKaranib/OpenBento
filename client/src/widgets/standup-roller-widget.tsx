// Standup Roller — roster + seeded shuffle for stable speaking order.
import React, { useEffect, useRef, useState } from 'react';
import { Plus as PlusIcon, RotateCcw, Settings as SettingsIcon, Shuffle, Trash2, Users, X as XIcon } from 'lucide-react';
import { MONO, Widget, isLightBg, qrIconBtnStyle, qrInputStyle, seededShuffle } from './shared';

interface StandupRollerProps {
  widget: Widget;
  onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
}

const REVEAL_INTERVAL_MS = 320;

export const StandupRollerWidget: React.FC<StandupRollerProps> = ({ widget, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(280);
  const [showSettings, setShowSettings] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [revealCount, setRevealCount] = useState<number>(Number.MAX_SAFE_INTEGER);
  const revealTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(es => { for (const e of es) setSize(Math.min(e.contentRect.width, e.contentRect.height)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => {
    mountedRef.current = false;
    if (revealTimer.current) { clearInterval(revealTimer.current); revealTimer.current = null; }
  }, []);

  const startReveal = (total: number) => {
    if (revealTimer.current) { clearInterval(revealTimer.current); revealTimer.current = null; }
    setRevealCount(0);
    let n = 0;
    revealTimer.current = setInterval(() => {
      if (!mountedRef.current) return;
      n += 1;
      setRevealCount(n);
      if (n >= total && revealTimer.current) {
        clearInterval(revealTimer.current);
        revealTimer.current = null;
      }
    }, REVEAL_INTERVAL_MS);
  };

  const names = widget.standupNames ?? [];
  // A roll is "active" only when standupOrder is non-empty. After Reset
  // we leave it empty so nothing is displayed until the next Roll.
  const stored = widget.standupOrder;
  const hasRoll = !!stored && stored.length > 0;
  const order: string[] = hasRoll
    ? stored.filter(n => names.includes(n))
    : [];

  const writeNames = (next: string[]) => {
    // Editing the roster clears any active roll so the displayed order
    // can never reference removed teammates.
    onUpdate?.(widget.id, { standupNames: next, standupOrder: [], standupSeed: undefined });
    setRevealCount(0);
  };

  const addName = () => {
    const n = draftName.trim();
    if (!n || names.length >= 30) return;
    if (names.includes(n)) { setDraftName(''); return; }
    writeNames([...names, n]);
    setDraftName('');
  };
  const removeName = (n: string) => writeNames(names.filter(x => x !== n));

  const roll = () => {
    if (names.length < 2) return;
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
    const next = seededShuffle(names, seed);
    onUpdate?.(widget.id, { standupOrder: next, standupSeed: seed });
    startReveal(next.length);
  };

  // Reset clears the current roll. Roster is preserved.
  const reset = () => {
    if (revealTimer.current) { clearInterval(revealTimer.current); revealTimer.current = null; }
    setRevealCount(0);
    onUpdate?.(widget.id, { standupOrder: [], standupSeed: undefined });
  };

  const bgColor    = widget.customColor ?? '#0d2818';
  const light      = isLightBg(bgColor);
  const accent     = light ? '#047857' : '#34d399';
  const clrPrimary = light ? '#0f172a' : '#e2e8f0';
  const clrSubtle  = light ? '#475569' : '#cbd5e1';
  const clrMuted   = light ? '#64748b' : '#64748b';
  const clrBorder  = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';
  const clrCellBg  = light ? 'rgba(0,0,0,0.05)' : 'rgba(15,23,42,0.55)';
  const clrCellBdr = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.3)';
  const clrInert   = light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const clrInertBd = light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)';

  const fs = Math.max(11, Math.min(14, size * 0.045));

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%', background: bgColor,
        borderRadius: 'var(--outer-radius)',
        display: 'flex', flexDirection: 'column',
        padding: 12, boxSizing: 'border-box', overflow: 'hidden',
        border: `1px solid ${clrBorder}`, position: 'relative',
      }}
      data-testid={`standup-roller-widget-${widget.id}`}
    >
      <div className="widget-hover-cog" style={{ position: 'absolute', top: 8, right: 8, zIndex: 5 }}>
        <button onClick={() => setShowSettings(s => !s)} style={qrIconBtnStyle()} title="Roster" data-testid={`standup-settings-toggle-${widget.id}`}>
          <SettingsIcon size={11} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexShrink: 0 }}>
        <Users size={14} color={accent} />
        <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
          STANDUP
        </span>
        <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 9 }}>
          {names.length} {names.length === 1 ? 'person' : 'people'}
        </span>
      </div>

      {showSettings && (
        <div
          style={{
            position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.97)', zIndex: 4,
            padding: 12, display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 'var(--outer-radius)',
          }}
          onKeyDown={e => e.stopPropagation()}
          data-testid={`standup-settings-panel-${widget.id}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>Roster</span>
            <button onClick={() => setShowSettings(false)} style={qrIconBtnStyle()} data-testid={`standup-settings-close-${widget.id}`}>
              <XIcon size={11} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addName(); }}
              placeholder="Add teammate…"
              maxLength={32}
              style={qrInputStyle(11)}
              data-testid={`standup-input-name-${widget.id}`}
            />
            <button
              onClick={addName}
              disabled={!draftName.trim() || names.length >= 30}
              style={{ ...qrIconBtnStyle(), opacity: !draftName.trim() || names.length >= 30 ? 0.4 : 1 }}
              data-testid={`standup-add-${widget.id}`}
            >
              <PlusIcon size={11} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {names.map(n => (
              <div key={n} style={{
                display: 'flex', gap: 6, alignItems: 'center',
                padding: '4px 8px', borderRadius: 6,
                background: clrCellBg, border: `1px solid ${clrCellBdr}`,
              }}>
                <span style={{ flex: 1, color: '#e2e8f0', fontFamily: MONO, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n}
                </span>
                <button onClick={() => removeName(n)} style={qrIconBtnStyle()} title="Remove" data-testid={`standup-remove-${n}-${widget.id}`}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {names.length === 0 && (
              <span style={{ color: '#94a3b8', fontFamily: MONO, fontSize: 10 }}>
                Add at least 2 teammates, then Roll.
              </span>
            )}
          </div>
        </div>
      )}

      {!showSettings && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={roll}
              disabled={names.length < 2}
              style={{
                flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 10px', borderRadius: 6,
                background: names.length < 2 ? clrInert : `${accent}22`,
                border: `1px solid ${names.length < 2 ? clrInertBd : accent}`,
                color: names.length < 2 ? clrMuted : accent,
                fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                cursor: names.length < 2 ? 'default' : 'pointer',
              }}
              data-testid={`standup-roll-${widget.id}`}
            >
              <Shuffle size={12} />
              ROLL ORDER
            </button>
            <button
              onClick={reset}
              disabled={!hasRoll}
              title="Clear the rolled order"
              style={{
                ...qrIconBtnStyle(),
                opacity: hasRoll ? 1 : 0.4,
              }}
              data-testid={`standup-reset-${widget.id}`}
            >
              <RotateCcw size={12} />
            </button>
          </div>

          {names.length === 0 && (
            <button
              onClick={() => setShowSettings(true)}
              style={{
                margin: 'auto', padding: '8px 12px', borderRadius: 6,
                background: clrInert, border: `1px dashed ${clrInertBd}`,
                color: clrSubtle, fontFamily: MONO, fontSize: 11, cursor: 'pointer',
              }}
              data-testid={`standup-empty-cta-${widget.id}`}
            >
              + Add teammates
            </button>
          )}

          <ol
            data-testid={`standup-order-${widget.id}`}
            style={{
              flex: 1, minHeight: 0, overflowY: 'auto', margin: 0, padding: 0,
              listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4,
            }}
          >
            {hasRoll && order.slice(0, revealCount).map((n, i) => (
              <li
                key={`${n}-${i}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', borderRadius: 6,
                  background: i === 0 ? `${accent}22` : clrCellBg,
                  border: `1px solid ${i === 0 ? accent : clrCellBdr}`,
                  animation: 'standupSlideIn 240ms ease both',
                }}
                data-testid={`standup-order-item-${i}-${widget.id}`}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: 4,
                  background: i === 0 ? accent : clrInert,
                  color: i === 0 ? bgColor : clrSubtle,
                  fontFamily: MONO, fontSize: 10, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <span style={{
                  flex: 1, color: clrPrimary, fontFamily: MONO, fontSize: fs, fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {n}
                </span>
              </li>
            ))}
            {hasRoll && revealCount < order.length && (
              <li
                aria-hidden
                style={{
                  padding: '6px 8px', color: clrMuted, fontFamily: MONO, fontSize: 10,
                  letterSpacing: '0.08em',
                }}
              >
                …revealing
              </li>
            )}
            <style>{`@keyframes standupSlideIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          </ol>
        </div>
      )}
    </div>
  );
};
