// Command Palette (⌘K / Ctrl+K) — Spotlight-style modal that lets the
// user fuzzy-search across "Add widget", "Pages", and "Actions" without
// hunting through the menu bar or sidebar. Recents pin to the top when
// the query is empty.
//
// All matching / command-building logic lives in
// `@/lib/command-palette-helpers` so it can be unit-tested headlessly.
// This file is the React surface: kbd shortcut, modal markup, keyboard
// navigation (arrows / Enter / Esc), and recents persistence.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, Layers, Zap, Clock } from 'lucide-react';
import {
  buildCommands,
  filterAndGroup,
  loadRecents,
  pushRecent,
  saveRecents,
  isTypingTarget,
  SECTION_LABELS,
  type Command,
  type CommandHostBag,
} from '@/lib/command-palette-helpers';

interface CommandPaletteProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  host: CommandHostBag;
}

const SECTION_ICONS = {
  add: Plus,
  pages: Layers,
  actions: Zap,
} as const;

export function CommandPalette({ isOpen, onOpen, onClose, host }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<string[]>(() => loadRecents());
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Build commands fresh on each open so page list / toggle labels stay current.
  const commands = useMemo(() => buildCommands(host), [host]);

  const { recents: recentCmds, groups } = useMemo(
    () => filterAndGroup(commands, query, recents),
    [commands, query, recents],
  );

  // Flat list used for keyboard navigation. Order matches what's rendered:
  // recents (when empty query) followed by each group in order.
  const flat: Command[] = useMemo(() => {
    const out: Command[] = [];
    for (const c of recentCmds) out.push(c);
    for (const g of groups) for (const c of g.items) out.push(c);
    return out;
  }, [recentCmds, groups]);

  // Reset when re-opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIdx(0);
      // Refresh recents in case another tab wrote them
      setRecents(loadRecents());
      // Defer focus until after modal mounts
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Clamp activeIdx to current flat-list length.
  useEffect(() => {
    if (activeIdx >= flat.length) setActiveIdx(Math.max(0, flat.length - 1));
  }, [flat.length, activeIdx]);

  // Keep the active row scrolled into view.
  useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-command-idx="${activeIdx}"]`,
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, isOpen]);

  // Track the element that had focus when the palette opened so we can
  // restore it on close (a11y: focus return to the invoking control).
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (isOpen) {
      openerRef.current =
        (document.activeElement as HTMLElement | null) ?? null;
    } else if (openerRef.current) {
      try { openerRef.current.focus(); } catch { /* noop */ }
      openerRef.current = null;
    }
  }, [isOpen]);

  // Global ⌘K / Ctrl+K to toggle. Palette only mounts on the dashboard
  // route, so route guarding is implicit. Input guarding is handled here:
  // we never intercept the shortcut while the user is typing in a widget's
  // input/textarea/contenteditable — except when the focused element IS
  // the palette's own input (closing the palette via ⌘K must still work).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && (e.key === 'k' || e.key === 'K')) {
        const target = e.target as HTMLElement | null;
        const isPaletteInput = target === inputRef.current;
        if (!isPaletteInput && isTypingTarget(target)) return;
        e.preventDefault();
        if (isOpen) onClose();
        else onOpen();
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onOpen, onClose]);

  const runCommand = useCallback(
    (cmd: Command) => {
      const next = pushRecent(recents, cmd.id);
      setRecents(next);
      saveRecents(next);
      onClose();
      // Run after close so any state changes the command triggers (like
      // entering edit mode) don't fight the modal's exit transition.
      try {
        cmd.run();
      } catch (err) {
        // Swallow — commands shouldn't throw, but never let the palette crash.
        console.error('[CommandPalette] command failed:', err);
      }
    },
    [recents, onClose],
  );

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = flat[activeIdx];
      if (cmd) runCommand(cmd);
    }
  };

  if (!isOpen) return null;

  // Build flat→idx lookup so each row knows its global index for keyboard nav.
  const indexOf = (cmd: Command) => flat.indexOf(cmd);

  return (
    <div
      className="fixed inset-0 z-[10300] flex items-start justify-center pt-[10vh] px-[1rem]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      aria-activedescendant={flat[activeIdx] ? `command-row-${flat[activeIdx].id}` : undefined}
      data-testid="command-palette"
    >
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        onClick={onClose}
        data-testid="command-palette-backdrop"
      />
      <div className="relative w-full max-w-[40rem] bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-500/20 overflow-hidden flex flex-col max-h-[70vh]">
        {/* Search input */}
        <div className="flex items-center gap-[0.8rem] px-[1.2rem] py-[1rem] border-b border-slate-700/60">
          <Search className="w-[1.4rem] h-[1.4rem] text-cyan-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={onInputKey}
            placeholder="Type a command, widget, or page…"
            className="flex-1 bg-transparent text-white text-[1.1rem] placeholder-slate-500 focus:outline-none"
            data-testid="input-command-palette"
            aria-label="Command search"
          />
          <kbd className="hidden sm:inline-block text-[0.75rem] text-slate-400 border border-slate-700 px-[0.4rem] py-[0.1rem] rounded">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto py-[0.4rem]"
          data-testid="command-palette-results"
        >
          {flat.length === 0 ? (
            <div className="px-[1.2rem] py-[2rem] text-center text-slate-500 text-[0.95rem]">
              No commands match "{query}".
            </div>
          ) : (
            <>
              {recentCmds.length > 0 && (
                <Section
                  title="Recent"
                  Icon={Clock}
                  items={recentCmds}
                  activeIdx={activeIdx}
                  indexOf={indexOf}
                  onPick={runCommand}
                  onHover={setActiveIdx}
                  testIdPrefix="recent"
                />
              )}
              {groups.map((g) => (
                <Section
                  key={g.section}
                  title={SECTION_LABELS[g.section]}
                  Icon={SECTION_ICONS[g.section]}
                  items={g.items}
                  activeIdx={activeIdx}
                  indexOf={indexOf}
                  onPick={runCommand}
                  onHover={setActiveIdx}
                  testIdPrefix={g.section}
                />
              ))}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between gap-[0.8rem] px-[1.2rem] py-[0.6rem] border-t border-slate-700/60 text-[0.75rem] text-slate-500">
          <span>↑↓ navigate · Enter select · Esc close</span>
          <span className="hidden sm:inline">⌘K</span>
        </div>
      </div>
    </div>
  );
}

// ─── Section (presentational) ────────────────────────────────────────────

interface SectionProps {
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  items: Command[];
  activeIdx: number;
  indexOf: (cmd: Command) => number;
  onPick: (cmd: Command) => void;
  onHover: (idx: number) => void;
  testIdPrefix: string;
}

function Section({ title, Icon, items, activeIdx, indexOf, onPick, onHover, testIdPrefix }: SectionProps) {
  return (
    <div className="mb-[0.4rem]" data-testid={`section-${testIdPrefix}`}>
      <div className="flex items-center gap-[0.5rem] px-[1.2rem] py-[0.4rem] text-[0.7rem] font-bold text-slate-500 uppercase tracking-wider">
        <Icon className="w-[0.9rem] h-[0.9rem]" />
        {title}
      </div>
      {items.map((cmd) => {
        const idx = indexOf(cmd);
        const active = idx === activeIdx;
        return (
          <button
            key={`${testIdPrefix}-${cmd.id}`}
            id={`command-row-${cmd.id}`}
            role="option"
            aria-selected={active}
            data-command-idx={idx}
            onClick={() => onPick(cmd)}
            onMouseEnter={() => onHover(idx)}
            className={`w-full flex items-center justify-between gap-[0.8rem] px-[1.2rem] py-[0.6rem] text-left text-[0.95rem] transition-colors ${
              active
                ? 'bg-cyan-600/20 text-white'
                : 'text-slate-300 hover:bg-slate-800/60'
            }`}
            data-testid={`command-${cmd.id}`}
          >
            <span className="flex-1 truncate">{cmd.label}</span>
            {cmd.hint && (
              <span className="flex-shrink-0 text-[0.75rem] text-slate-500">{cmd.hint}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Re-export the typing guard so callers can apply it to their own
// keyboard listeners if they want palette-aware behavior.
export { isTypingTarget };
