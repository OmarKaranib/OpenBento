// Multi-Page Dashboards — scrollable tab strip rendered between the
// menu bar and the dashboard canvas. Hidden when there's only one
// page (the "+" button alone is rendered so users can create a 2nd
// page from any starting state).
import { useEffect, useRef, useState } from 'react';
import { Plus, Star, Copy, Trash2, Check, X, Pencil } from 'lucide-react';
import type { DashboardPage } from '@shared/dashboard-pages';

interface PageTabsStripProps {
  pages: DashboardPage[];
  activePageId: string;
  onActivate: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  isDarkMode: boolean;
}

export function PageTabsStrip({
  pages,
  activePageId,
  onActivate,
  onAdd,
  onRename,
  onDuplicate,
  onDelete,
  onSetDefault,
  isDarkMode,
}: PageTabsStripProps) {
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  // Hide the strip entirely until a 2nd page is created — but always
  // keep a "+" affordance so users can grow into the feature.
  const showStrip = pages.length >= 2;

  useEffect(() => {
    if (renameId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameId]);

  function startRename(p: DashboardPage) {
    setRenameId(p.id);
    setRenameValue(p.name);
  }
  function commitRename() {
    if (renameId && renameValue.trim()) onRename(renameId, renameValue.trim());
    setRenameId(null);
  }

  return (
    <div
      className={`flex items-center gap-[0.4rem] px-[1rem] py-[0.5rem] overflow-x-auto scrollbar-thin ${
        showStrip
          ? isDarkMode
            ? 'bg-slate-900/40 border-b border-slate-700/60'
            : 'bg-white/40 border-b border-slate-300/60'
          : ''
      }`}
      data-testid="page-tabs-strip"
    >
      {showStrip && pages.map((p) => {
        const active = p.id === activePageId;
        const isRenaming = renameId === p.id;
        const isConfirmingDelete = confirmDeleteId === p.id;
        return (
          <div
            key={p.id}
            className={`group flex items-center gap-[0.3rem] h-[2.4rem] px-[0.8rem] rounded-[0.6rem] text-[1rem] font-medium transition-colors shrink-0 ${
              active
                ? isDarkMode
                  ? 'bg-cyan-600/80 text-white shadow-md'
                  : 'bg-cyan-500 text-white shadow-md'
                : isDarkMode
                  ? 'bg-slate-800/60 hover:bg-slate-700/70 text-slate-200'
                  : 'bg-slate-200/70 hover:bg-slate-300/80 text-slate-800'
            }`}
            data-testid={`page-tab-${p.id}`}
          >
            {p.isDefault && (
              <Star
                className="w-[0.9rem] h-[0.9rem] text-amber-400 fill-amber-400"
                aria-label="default page"
                data-testid={`page-default-marker-${p.id}`}
              />
            )}
            {isRenaming ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  else if (e.key === 'Escape') setRenameId(null);
                }}
                className="bg-transparent border-b border-white/60 outline-none w-[8rem] text-[1rem]"
                data-testid={`page-rename-input-${p.id}`}
              />
            ) : (
              <button
                onClick={() => onActivate(p.id)}
                onDoubleClick={() => startRename(p)}
                className="text-left max-w-[12rem] truncate"
                title={`${p.name} — double-click to rename`}
                data-testid={`button-page-activate-${p.id}`}
              >
                {p.name}
              </button>
            )}
            {active && !isRenaming && (
              <div className="flex items-center gap-[0.2rem] ml-[0.3rem]">
                <button
                  onClick={() => startRename(p)}
                  className="p-[0.2rem] rounded hover:bg-white/20"
                  title="Rename"
                  data-testid={`button-page-rename-${p.id}`}
                >
                  <Pencil className="w-[0.85rem] h-[0.85rem]" />
                </button>
                <button
                  onClick={() => onSetDefault(p.id)}
                  className={`p-[0.2rem] rounded hover:bg-white/20 ${p.isDefault ? 'opacity-50 cursor-default' : ''}`}
                  title={p.isDefault ? 'Already default' : 'Set as default'}
                  disabled={p.isDefault}
                  data-testid={`button-page-default-${p.id}`}
                >
                  <Star className={`w-[0.85rem] h-[0.85rem] ${p.isDefault ? 'fill-amber-400 text-amber-400' : ''}`} />
                </button>
                <button
                  onClick={() => onDuplicate(p.id)}
                  className="p-[0.2rem] rounded hover:bg-white/20"
                  title="Duplicate page"
                  data-testid={`button-page-duplicate-${p.id}`}
                >
                  <Copy className="w-[0.85rem] h-[0.85rem]" />
                </button>
                {pages.length > 1 && (
                  isConfirmingDelete ? (
                    <>
                      <button
                        onClick={() => { onDelete(p.id); setConfirmDeleteId(null); }}
                        className="p-[0.2rem] rounded bg-red-600 hover:bg-red-500"
                        title="Confirm delete"
                        data-testid={`button-page-delete-confirm-${p.id}`}
                      >
                        <Check className="w-[0.85rem] h-[0.85rem]" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="p-[0.2rem] rounded hover:bg-white/20"
                        title="Cancel"
                        data-testid={`button-page-delete-cancel-${p.id}`}
                      >
                        <X className="w-[0.85rem] h-[0.85rem]" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(p.id)}
                      className="p-[0.2rem] rounded hover:bg-red-500/40"
                      title="Delete page"
                      data-testid={`button-page-delete-${p.id}`}
                    >
                      <Trash2 className="w-[0.85rem] h-[0.85rem]" />
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}
      <button
        onClick={onAdd}
        className={`flex items-center gap-[0.3rem] h-[2.4rem] px-[0.8rem] rounded-[0.6rem] text-[1rem] font-medium shrink-0 transition-colors ${
          isDarkMode
            ? 'bg-emerald-700/70 hover:bg-emerald-600/80 text-white'
            : 'bg-emerald-500/80 hover:bg-emerald-500 text-white'
        }`}
        data-testid="button-page-add"
        title="Add page"
      >
        <Plus className="w-[1rem] h-[1rem]" />
        {showStrip ? '' : 'New page'}
      </button>
    </div>
  );
}
