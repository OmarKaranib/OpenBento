// Themes Marketplace — modal with Built-in / My Themes tabs, hover-preview,
// "Apply" buttons, and the "Save current look" capture flow.
//
// Pure presentational component; all the state-machine bits (apply,
// preview, revert, save, delete, rename) are owned by useTheme().

import { useEffect, useRef, useState } from 'react';
import { X, Palette, Check, Trash2, Pencil, Plus } from 'lucide-react';
import {
  type Theme,
  BUILT_IN_THEMES,
  THEME_FONT_STACKS,
  themeToCssVars,
} from '@shared/themes';
import type { UseThemeApi } from '@/dashboard/use-theme';

interface ThemesModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeApi: UseThemeApi;
}

const PREVIEW_HOLD_MS = 2000;

export function ThemesModal({ isOpen, onClose, themeApi }: ThemesModalProps) {
  const [tab, setTab]                  = useState<'builtin' | 'personal'>('builtin');
  const [saveDialogOpen, setSaveOpen]  = useState(false);
  const previewTimerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveringIdRef                  = useRef<string | null>(null);

  // Cancel any in-flight preview when the modal unmounts so a stuck
  // hover can't strand the dashboard on a non-applied theme.
  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      themeApi.revertPreview();
    };
  // We only want this on unmount — themeApi changes shouldn't re-run it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc closes the modal. Mirrors the onboarding modal pattern.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (saveDialogOpen) setSaveOpen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, saveDialogOpen, onClose]);

  if (!isOpen) return null;

  const startPreview = (theme: Theme) => {
    hoveringIdRef.current = theme.id;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    themeApi.previewTheme(theme);
    // Auto-revert after PREVIEW_HOLD_MS so users can hover without
    // committing — clicking Apply takes over.
    previewTimerRef.current = setTimeout(() => {
      if (hoveringIdRef.current === theme.id) {
        themeApi.revertPreview();
        hoveringIdRef.current = null;
      }
    }, PREVIEW_HOLD_MS);
  };

  const stopPreview = () => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    hoveringIdRef.current = null;
    themeApi.revertPreview();
  };

  const themesToShow: Theme[] = tab === 'builtin'
    ? [...BUILT_IN_THEMES]
    : themeApi.personalThemes;

  return (
    <div
      className="fixed inset-0 z-[10200] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="themes-modal-title"
      data-testid="themes-modal"
    >
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        onClick={onClose}
        data-testid="themes-modal-backdrop"
      />
      <div className="relative w-full max-w-[64rem] max-h-[85vh] flex flex-col bg-slate-900/95 border border-violet-500/40 rounded-2xl shadow-2xl shadow-violet-500/20 p-[2rem]">
        <button
          onClick={onClose}
          className="absolute top-[1rem] right-[1rem] w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-colors"
          aria-label="Close themes"
          data-testid="button-themes-close"
        >
          <X className="w-4 h-4 text-slate-300" />
        </button>

        <div className="flex items-center gap-[0.8rem] mb-[1rem]">
          <Palette className="w-6 h-6 text-violet-400" />
          <h2
            id="themes-modal-title"
            className="text-[1.8rem] font-bold text-white"
            data-testid="text-themes-title"
          >
            Themes Marketplace
          </h2>
        </div>
        <p className="text-[0.95rem] text-slate-400 mb-[1.2rem]">
          One-click visual identities for your dashboard. Hover any card to preview for 2 seconds.
        </p>

        {/* Tabs + save button */}
        <div className="flex items-center justify-between gap-[1rem] mb-[1.2rem]">
          <div className="flex gap-[0.4rem] bg-slate-800/60 p-[0.3rem] rounded-lg border border-slate-700">
            <button
              onClick={() => setTab('builtin')}
              className={`px-[1rem] py-[0.5rem] rounded-md text-[0.9rem] font-semibold transition-colors ${
                tab === 'builtin'
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
              data-testid="tab-themes-builtin"
            >
              Built-in
            </button>
            <button
              onClick={() => setTab('personal')}
              className={`px-[1rem] py-[0.5rem] rounded-md text-[0.9rem] font-semibold transition-colors ${
                tab === 'personal'
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
              data-testid="tab-themes-personal"
            >
              My Themes ({themeApi.personalThemes.length})
            </button>
          </div>
          <button
            onClick={() => setSaveOpen(true)}
            className="flex items-center gap-[0.5rem] px-[1rem] py-[0.6rem] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[0.9rem] font-semibold transition-colors"
            data-testid="button-themes-save-current"
          >
            <Plus className="w-4 h-4" />
            Save current look
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto pr-[0.5rem]" data-testid="themes-grid">
          {themesToShow.length === 0 ? (
            <div className="flex items-center justify-center h-[20rem] text-slate-500 text-[1rem]">
              No personal themes yet. Click "Save current look" to capture your first one.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[1rem]">
              {themesToShow.map(theme => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  isActive={themeApi.activeThemeId === theme.id}
                  onApply={() => { stopPreview(); themeApi.applyTheme(theme); }}
                  onPreviewStart={() => startPreview(theme)}
                  onPreviewEnd={stopPreview}
                  onDelete={!theme.builtIn ? () => themeApi.deletePersonalTheme(theme.id) : undefined}
                  onRename={!theme.builtIn ? (n) => themeApi.renamePersonalTheme(theme.id, n) : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {saveDialogOpen && (
          <SaveLookDialog
            onCancel={() => setSaveOpen(false)}
            onSave={(name) => {
              themeApi.saveCurrentLook(name);
              setSaveOpen(false);
              setTab('personal');
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Theme card ────────────────────────────────────────────────────────────

interface ThemeCardProps {
  theme: Theme;
  isActive: boolean;
  onApply: () => void;
  onPreviewStart: () => void;
  onPreviewEnd: () => void;
  onDelete?: () => void;
  onRename?: (newName: string) => void;
}

function ThemeCard({ theme, isActive, onApply, onPreviewStart, onPreviewEnd, onDelete, onRename }: ThemeCardProps) {
  const [isRenaming, setIsRenaming]   = useState(false);
  const [draftName, setDraftName]     = useState(theme.name);

  return (
    <div
      onMouseEnter={onPreviewStart}
      onMouseLeave={onPreviewEnd}
      className={`group relative bg-slate-800/60 border rounded-xl p-[1rem] transition-all duration-200 hover:border-violet-500/60 hover:shadow-lg hover:shadow-violet-500/10 ${
        isActive ? 'border-emerald-500/70 ring-2 ring-emerald-500/30' : 'border-slate-700'
      }`}
      data-testid={`theme-card-${theme.id}`}
    >
      {/* SVG mock thumbnail */}
      <ThemeThumbnail theme={theme} />

      <div className="mt-[0.8rem] flex items-start justify-between gap-[0.6rem]">
        <div className="flex-1 min-w-0">
          {isRenaming && onRename ? (
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={() => { if (draftName.trim()) onRename(draftName); setIsRenaming(false); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { if (draftName.trim()) onRename(draftName); setIsRenaming(false); }
                if (e.key === 'Escape') { setDraftName(theme.name); setIsRenaming(false); }
              }}
              className="w-full bg-slate-900 border border-violet-500 rounded px-[0.5rem] py-[0.2rem] text-white text-[1rem]"
              data-testid={`input-rename-${theme.id}`}
            />
          ) : (
            <h3
              className="text-[1.05rem] font-bold text-white truncate"
              style={{ fontFamily: THEME_FONT_STACKS[theme.font] }}
              data-testid={`text-theme-name-${theme.id}`}
            >
              {theme.name}
            </h3>
          )}
          <p className="text-[0.8rem] text-slate-400 line-clamp-2">{theme.description}</p>
        </div>
        {isActive && (
          <span
            className="flex-shrink-0 flex items-center gap-[0.3rem] px-[0.5rem] py-[0.2rem] bg-emerald-500/20 border border-emerald-500/50 rounded-full text-[0.7rem] font-bold text-emerald-400 uppercase"
            data-testid={`badge-active-${theme.id}`}
          >
            <Check className="w-3 h-3" /> Active
          </span>
        )}
      </div>

      <div className="mt-[0.8rem] flex items-center gap-[0.4rem]">
        <button
          onClick={onApply}
          disabled={isActive}
          className={`flex-1 px-[0.8rem] py-[0.5rem] rounded-md text-[0.85rem] font-semibold transition-colors ${
            isActive
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-violet-600 hover:bg-violet-500 text-white'
          }`}
          data-testid={`button-apply-${theme.id}`}
        >
          {isActive ? 'Applied' : 'Apply'}
        </button>
        {onRename && (
          <button
            onClick={() => { setDraftName(theme.name); setIsRenaming(true); }}
            className="p-[0.5rem] rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300"
            title="Rename"
            data-testid={`button-rename-${theme.id}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-[0.5rem] rounded-md bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white"
            title="Delete"
            data-testid={`button-delete-${theme.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── SVG mock thumbnail ────────────────────────────────────────────────────

function ThemeThumbnail({ theme }: { theme: Theme }) {
  const vars = themeToCssVars(theme);
  const bgFill = theme.background.kind === 'color'
    ? theme.background.value
    : undefined;
  // For gradient/image we render a clipped <foreignObject> div with the
  // CSS expression so the same string drives both the live dashboard
  // and the thumbnail (no second source of truth to maintain).
  return (
    <div
      className="relative w-full h-[7rem] rounded-lg overflow-hidden border border-slate-700"
      style={{
        background: bgFill ?? 'transparent',
        backgroundImage: bgFill ? undefined : (theme.background.kind === 'image'
          ? `url("${theme.background.value}")`
          : theme.background.value),
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* 3 sample widget tiles */}
      <div className="absolute inset-[0.6rem] grid grid-cols-3 gap-[0.4rem]">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="rounded-md border"
            style={{
              backgroundColor: vars['--ob-widget-tint'],
              borderColor:     vars['--ob-accent-soft'],
              opacity:         0.92,
            }}
          />
        ))}
      </div>
      {/* Accent dot — visible signature */}
      <div
        className="absolute bottom-[0.5rem] right-[0.5rem] w-[0.9rem] h-[0.9rem] rounded-full border-2 border-white/80"
        style={{ backgroundColor: vars['--ob-accent'] }}
      />
    </div>
  );
}

// ─── Save-look dialog ─────────────────────────────────────────────────────

interface SaveDialogProps {
  onCancel: () => void;
  onSave:  (name: string) => void;
}

function SaveLookDialog({ onCancel, onSave }: SaveDialogProps) {
  const [name, setName] = useState('My Theme');
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm rounded-2xl"
      data-testid="dialog-save-look"
    >
      <div className="w-full max-w-[28rem] bg-slate-900 border border-emerald-500/40 rounded-xl p-[1.5rem] shadow-2xl">
        <h3 className="text-[1.2rem] font-bold text-white mb-[0.4rem]">Save current look</h3>
        <p className="text-[0.85rem] text-slate-400 mb-[1rem]">
          Captures the active background, accent color, font, and widget tint as a personal theme.
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Theme name"
          maxLength={60}
          className="w-full bg-slate-800 border border-slate-700 rounded-md px-[0.8rem] py-[0.6rem] text-white text-[1rem] focus:border-emerald-500 focus:outline-none"
          data-testid="input-save-theme-name"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) onSave(name.trim());
          }}
        />
        <div className="mt-[1rem] flex gap-[0.5rem] justify-end">
          <button
            onClick={onCancel}
            className="px-[1rem] py-[0.5rem] rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-[0.9rem] font-semibold"
            data-testid="button-save-theme-cancel"
          >
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onSave(name.trim())}
            disabled={!name.trim()}
            className="px-[1rem] py-[0.5rem] rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-[0.9rem] font-semibold"
            data-testid="button-save-theme-confirm"
          >
            Save theme
          </button>
        </div>
      </div>
    </div>
  );
}

