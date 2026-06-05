// Auto-extracted from App.tsx during widget modularization.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckSquare, Flame, Plus as PlusIcon, Settings as SettingsIcon, Square as SquareIcon, Trash2, X as XIcon } from 'lucide-react';
import { MONO, Widget, isLightBg, qrIconBtnStyle, qrInputStyle } from './shared';

interface HabitTrackerProps {
  widget: Widget;
  onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
}

// ISO date `YYYY-MM-DD` in local time — we deliberately avoid UTC so
// a habit checked at 11pm doesn't roll into "tomorrow" for the user.
function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}
function offsetDayKey(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

export const HabitTrackerWidget: React.FC<HabitTrackerProps> = ({ widget, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(280);
  const [showSettings, setShowSettings] = useState(false);
  const [draftName, setDraftName] = useState('');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setSize(Math.min(e.contentRect.width, e.contentRect.height));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const habits = widget.habits ?? [];
  const today = todayKey();
  const last7 = useMemo(
    () => Array.from({ length: 7 }, (_, i) => offsetDayKey(-(6 - i))),
    [],
  );

  const setHabits = useCallback(
    (next: NonNullable<Widget['habits']>) => {
      // Trim each habit's day list to the rolling 30-day window so
      // the persisted blob never grows unbounded.
      const cutoff = offsetDayKey(-29);
      const trimmed = next.map(h => ({
        ...h,
        days: Array.from(new Set(h.days)).filter(d => d >= cutoff).sort(),
      }));
      onUpdate?.(widget.id, { habits: trimmed });
    },
    [onUpdate, widget.id],
  );

  const toggle = (habitId: string, dayKey: string) => {
    const next = habits.map(h => {
      if (h.id !== habitId) return h;
      const has = h.days.includes(dayKey);
      return { ...h, days: has ? h.days.filter(d => d !== dayKey) : [...h.days, dayKey] };
    });
    setHabits(next);
  };

  const addHabit = () => {
    const name = draftName.trim();
    if (!name) return;
    if (habits.length >= 8) return;
    setHabits([...habits, { id: `habit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name, days: [] }]);
    setDraftName('');
  };

  const removeHabit = (id: string) => {
    setHabits(habits.filter(h => h.id !== id));
  };

  const renameHabit = (id: string, name: string) => {
    setHabits(habits.map(h => h.id === id ? { ...h, name } : h));
  };

  const bgColor    = widget.customColor ?? '#0f172a';
  const light      = isLightBg(bgColor);
  const accent     = light ? '#dc2626' : '#fb7185';
  const clrPrimary = light ? '#0f172a' : '#e2e8f0';
  const clrSubtle  = light ? '#475569' : '#cbd5e1';
  const clrMuted   = light ? '#64748b' : '#64748b';
  const clrBorder  = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.4)';
  const clrCellBg  = light ? 'rgba(0,0,0,0.04)' : 'rgba(15,23,42,0.55)';
  const clrCellBdr = light ? 'rgba(0,0,0,0.10)' : 'rgba(71,85,105,0.3)';
  const clrInert   = light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const clrInertBd = light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)';
  const fs = Math.max(10, Math.min(13, size * 0.04));

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        background: bgColor,
        borderRadius: 'var(--outer-radius)',
        display: 'flex', flexDirection: 'column',
        padding: 12, boxSizing: 'border-box', overflow: 'hidden',
        border: `1px solid ${clrBorder}`,
        position: 'relative',
      }}
      data-testid={`habit-tracker-widget-${widget.id}`}
    >
      {/* Single toggle button: gear when closed, X when open */}
      <div
        className={showSettings ? undefined : 'widget-hover-cog'}
        style={{
          position: 'absolute', top: 8, right: 8,
          transition: 'opacity 0.15s', zIndex: 6,
        }}
      >
        <button
          onClick={() => setShowSettings(s => !s)}
          style={qrIconBtnStyle()}
          title={showSettings ? 'Close settings' : 'Habit settings'}
          data-testid={`habit-settings-toggle-${widget.id}`}
        >
          {showSettings ? <XIcon size={11} /> : <SettingsIcon size={11} />}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexShrink: 0 }}>
        <Flame size={14} color={accent} />
        <span style={{
          flex: 1, color: accent, fontFamily: MONO,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
        }}>
          HABITS
        </span>
        <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 9 }}>
          {habits.filter(h => h.days.includes(today)).length}/{habits.length} today
        </span>
      </div>

      {/* Settings overlay — no X button inside; toggle button above handles close */}
      {showSettings && (
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(15,23,42,0.97)', zIndex: 4,
            padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
            borderRadius: 'var(--outer-radius)',
          }}
          onKeyDown={e => e.stopPropagation()}
          data-testid={`habit-settings-panel-${widget.id}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 28 }}>
            <span style={{ flex: 1, color: accent, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
              Edit habits
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addHabit(); }}
              placeholder="New habit name…"
              maxLength={40}
              style={qrInputStyle(11)}
              data-testid={`habit-input-name-${widget.id}`}
            />
            <button
              onClick={addHabit}
              disabled={!draftName.trim() || habits.length >= 8}
              style={{
                ...qrIconBtnStyle(),
                opacity: !draftName.trim() || habits.length >= 8 ? 0.4 : 1,
              }}
              data-testid={`habit-add-${widget.id}`}
            >
              <PlusIcon size={11} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {habits.map(h => (
              <div key={h.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  type="text"
                  value={h.name}
                  onChange={e => renameHabit(h.id, e.target.value)}
                  maxLength={40}
                  style={qrInputStyle(10)}
                  data-testid={`habit-rename-${h.id}-${widget.id}`}
                />
                <button
                  onClick={() => removeHabit(h.id)}
                  style={qrIconBtnStyle()}
                  title="Delete"
                  data-testid={`habit-remove-${h.id}-${widget.id}`}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {habits.length === 0 && (
              <span style={{ color: clrMuted, fontFamily: MONO, fontSize: 10 }}>
                Add your first habit above.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      {!showSettings && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {habits.length === 0 && (
            <button
              onClick={() => setShowSettings(true)}
              style={{
                margin: 'auto', padding: '8px 12px', borderRadius: 6,
                background: clrInert,
                border: `1px dashed ${clrInertBd}`,
                color: clrSubtle, fontFamily: MONO, fontSize: 11, cursor: 'pointer',
              }}
              data-testid={`habit-empty-cta-${widget.id}`}
            >
              + Add a habit
            </button>
          )}
          {habits.map(h => {
            const checkedToday = h.days.includes(today);
            let streak = 0;
            for (let i = 0; i < 60; i++) {
              const k = offsetDayKey(-i);
              if (h.days.includes(k)) streak++;
              else if (i === 0) continue;
              else break;
            }
            return (
              <div
                key={h.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', borderRadius: 6,
                  background: clrCellBg,
                  border: `1px solid ${clrCellBdr}`,
                }}
              >
                <button
                  onClick={() => toggle(h.id, today)}
                  style={{
                    ...qrIconBtnStyle(),
                    background: checkedToday ? `${accent}33` : clrInert,
                    borderColor: checkedToday ? accent : clrInertBd,
                    color: checkedToday ? accent : clrSubtle,
                  }}
                  title={checkedToday ? 'Uncheck today' : 'Check off today'}
                  data-testid={`habit-toggle-today-${h.id}-${widget.id}`}
                >
                  {checkedToday ? <CheckSquare size={12} /> : <SquareIcon size={12} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: clrPrimary, fontFamily: MONO, fontSize: fs, fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {h.name}
                  </div>
                  <div style={{ display: 'flex', gap: 2, marginTop: 3 }}>
                    {last7.map(k => {
                      const has = h.days.includes(k);
                      const isToday = k === today;
                      return (
                        <button
                          key={k}
                          onClick={() => toggle(h.id, k)}
                          title={k}
                          style={{
                            width: 10, height: 10, borderRadius: 2,
                            background: has ? accent : clrInert,
                            border: isToday ? `1px solid ${accent}` : `1px solid ${clrInertBd}`,
                            cursor: 'pointer', padding: 0,
                          }}
                          data-testid={`habit-day-${h.id}-${k}-${widget.id}`}
                        />
                      );
                    })}
                  </div>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 2,
                  color: streak > 0 ? accent : clrMuted,
                  fontFamily: MONO, fontSize: 10, fontWeight: 700,
                }}>
                  <Flame size={10} />
                  {streak}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};