import { useMemo, useState, useEffect, useRef } from 'react';
import { FileText, Eye, Pencil } from 'lucide-react';

interface NoteWidgetProps {
  widgetId: string;
  noteContent: string;
  isDarkMode: boolean;
  isEditMode: boolean;
  onChange: (widgetId: string, content: string) => void;
}

type ViewMode = 'preview' | 'edit';

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderInline = (raw: string): string => {
  let s = escapeHtml(raw);
  s = s.replace(/`([^`]+)`/g, '<code class="ob-md-code">$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="ob-md-link">$1</a>'
  );
  return s;
};

interface ParsedBlock {
  kind: 'h1' | 'h2' | 'h3' | 'p' | 'ul' | 'task' | 'pre' | 'hr' | 'blank';
  html?: string;
  items?: string[];
  tasks?: { lineIndex: number; checked: boolean; html: string }[];
}

const parseMarkdown = (src: string): ParsedBlock[] => {
  const lines = src.split('\n');
  const blocks: ParsedBlock[] = [];
  let i = 0;

  const flushList = (items: string[]) => {
    if (items.length) blocks.push({ kind: 'ul', items: items.map(renderInline) });
  };
  const flushTasks = (tasks: ParsedBlock['tasks']) => {
    if (tasks && tasks.length) blocks.push({ kind: 'task', tasks });
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ kind: 'pre', html: escapeHtml(buf.join('\n')) });
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      blocks.push({ kind: 'hr' });
      i++;
      continue;
    }

    const taskMatch = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      const tasks: ParsedBlock['tasks'] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
        if (!m) break;
        tasks.push({
          lineIndex: i,
          checked: m[1] !== ' ',
          html: renderInline(m[2]),
        });
        i++;
      }
      flushTasks(tasks);
      continue;
    }

    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (bulletMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const taskCheck = lines[i].match(/^\s*[-*]\s+\[([ xX])\]/);
        if (taskCheck) break;
        const m = lines[i].match(/^\s*[-*]\s+(.*)$/);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      flushList(items);
      continue;
    }

    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) {
      blocks.push({ kind: 'h3', html: renderInline(h3[1]) });
      i++;
      continue;
    }
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      blocks.push({ kind: 'h2', html: renderInline(h2[1]) });
      i++;
      continue;
    }
    const h1 = line.match(/^#\s+(.*)$/);
    if (h1) {
      blocks.push({ kind: 'h1', html: renderInline(h1[1]) });
      i++;
      continue;
    }

    if (line.trim() === '') {
      blocks.push({ kind: 'blank' });
      i++;
      continue;
    }

    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !/^---+\s*$/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ kind: 'p', html: renderInline(buf.join(' ')) });
  }

  return blocks;
};

const toggleTaskAtLine = (src: string, lineIndex: number): string => {
  const lines = src.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return src;
  const m = lines[lineIndex].match(/^(\s*[-*]\s+\[)([ xX])(\]\s+.*)$/);
  if (!m) return src;
  const newMark = m[2] === ' ' ? 'x' : ' ';
  lines[lineIndex] = `${m[1]}${newMark}${m[3]}`;
  return lines.join('\n');
};

export function NoteWidget({
  widgetId,
  noteContent,
  isDarkMode,
  isEditMode,
  onChange,
}: NoteWidgetProps) {
  const [mode, setMode] = useState<ViewMode>(() =>
    noteContent && noteContent.trim().length > 0 ? 'preview' : 'edit'
  );
  const initialisedRef = useRef(false);

  useEffect(() => {
    if (initialisedRef.current) return;
    initialisedRef.current = true;
  }, []);

  const blocks = useMemo(() => parseMarkdown(noteContent || ''), [noteContent]);

  const effectiveMode: ViewMode = isEditMode ? 'preview' : mode;

  const handleToggleTask = (lineIndex: number) => {
    if (isEditMode) return;
    onChange(widgetId, toggleTaskAtLine(noteContent || '', lineIndex));
  };

  const containerClass = `w-full h-full p-[1.2rem] flex flex-col rounded-[var(--outer-radius)] ${
    isDarkMode ? 'bg-[#1a1b1e]' : 'bg-gray-50 border border-slate-200'
  }`;

  const headerClass = `flex items-center gap-[0.6rem] mb-[0.8rem] pb-[0.6rem] border-b ${
    isDarkMode ? 'text-yellow-400 border-slate-700/50' : 'text-yellow-600 border-slate-200'
  }`;

  const toggleBtnClass = `ml-auto flex items-center gap-[0.4rem] px-[0.6rem] py-[0.3rem] rounded-md text-[0.85rem] font-medium transition-colors ${
    isDarkMode
      ? 'text-slate-300 hover:bg-slate-700/60'
      : 'text-slate-600 hover:bg-slate-200/70'
  }`;

  const previewTextClass = isDarkMode ? 'text-slate-200' : 'text-slate-900';

  return (
    <div className={containerClass} data-testid={`note-widget-${widgetId}`}>
      <style>{`
        .ob-md-body { font-size: 1.15rem; line-height: 1.55; }
        .ob-md-body h1 { font-size: 1.7rem; font-weight: 700; margin: 0.6rem 0 0.4rem; }
        .ob-md-body h2 { font-size: 1.45rem; font-weight: 700; margin: 0.55rem 0 0.35rem; }
        .ob-md-body h3 { font-size: 1.25rem; font-weight: 700; margin: 0.5rem 0 0.3rem; }
        .ob-md-body p  { margin: 0.3rem 0; }
        .ob-md-body ul { margin: 0.3rem 0 0.3rem 1.4rem; padding: 0; list-style: disc; }
        .ob-md-body hr { border: none; border-top: 1px solid currentColor; opacity: 0.25; margin: 0.6rem 0; }
        .ob-md-body pre { background: rgba(127,127,127,0.18); padding: 0.6rem 0.8rem; border-radius: 0.4rem; overflow-x: auto; font-family: ui-monospace, Menlo, monospace; font-size: 1rem; margin: 0.4rem 0; white-space: pre-wrap; }
        .ob-md-code    { background: rgba(127,127,127,0.22); padding: 0.05rem 0.35rem; border-radius: 0.25rem; font-family: ui-monospace, Menlo, monospace; font-size: 0.95em; }
        .ob-md-link    { color: #38bdf8; text-decoration: underline; text-underline-offset: 2px; }
        .ob-md-tasks   { list-style: none; margin: 0.3rem 0; padding: 0; }
        .ob-md-tasks li { display: flex; align-items: flex-start; gap: 0.55rem; padding: 0.15rem 0; }
        .ob-md-tasks input[type="checkbox"] { width: 1.1rem; height: 1.1rem; margin-top: 0.18rem; cursor: pointer; accent-color: #facc15; flex-shrink: 0; }
        .ob-md-tasks .ob-md-task-text.checked { opacity: 0.55; text-decoration: line-through; }
        .ob-md-empty   { opacity: 0.55; font-style: italic; }
      `}</style>

      <div className={headerClass}>
        <FileText className="w-[1.4rem] h-[1.4rem]" />
        <span className="text-[1.1rem] font-semibold">Note</span>
        {!isEditMode && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMode((m) => (m === 'preview' ? 'edit' : 'preview'));
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className={toggleBtnClass}
            title={mode === 'preview' ? 'Switch to edit mode' : 'Preview markdown'}
            data-testid={`button-note-toggle-${widgetId}`}
          >
            {mode === 'preview' ? (
              <>
                <Pencil className="w-[1rem] h-[1rem]" /> Edit
              </>
            ) : (
              <>
                <Eye className="w-[1rem] h-[1rem]" /> Preview
              </>
            )}
          </button>
        )}
      </div>

      {effectiveMode === 'edit' ? (
        <textarea
          value={noteContent || ''}
          onChange={(e) => onChange(widgetId, e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          placeholder={'Type your note here…\n\nMarkdown supported: # headings, **bold**, *italic*, `code`, [links](https://), - bullets, - [ ] tasks'}
          className={`flex-1 w-full bg-transparent border-none outline-none resize-none text-[1.15rem] pt-[0.4rem] ${
            isDarkMode ? 'text-slate-200 placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
          }`}
          data-testid={`textarea-note-${widgetId}`}
        />
      ) : (
        <div
          className={`ob-md-body flex-1 overflow-y-auto pt-[0.2rem] pr-[0.2rem] ${previewTextClass}`}
          style={isEditMode ? { pointerEvents: 'none', userSelect: 'none' } : undefined}
          data-testid={`markdown-note-${widgetId}`}
        >
          {blocks.length === 0 || (blocks.length === 1 && blocks[0].kind === 'blank') ? (
            <p className="ob-md-empty">Empty note. Tap Edit to add content.</p>
          ) : (
            blocks.map((b, idx) => {
              switch (b.kind) {
                case 'h1':
                  return <h1 key={idx} dangerouslySetInnerHTML={{ __html: b.html! }} />;
                case 'h2':
                  return <h2 key={idx} dangerouslySetInnerHTML={{ __html: b.html! }} />;
                case 'h3':
                  return <h3 key={idx} dangerouslySetInnerHTML={{ __html: b.html! }} />;
                case 'p':
                  return <p key={idx} dangerouslySetInnerHTML={{ __html: b.html! }} />;
                case 'pre':
                  return <pre key={idx} dangerouslySetInnerHTML={{ __html: b.html! }} />;
                case 'hr':
                  return <hr key={idx} />;
                case 'ul':
                  return (
                    <ul key={idx}>
                      {b.items!.map((it, j) => (
                        <li key={j} dangerouslySetInnerHTML={{ __html: it }} />
                      ))}
                    </ul>
                  );
                case 'task':
                  return (
                    <ul key={idx} className="ob-md-tasks">
                      {b.tasks!.map((t, j) => (
                        <li key={j}>
                          <input
                            type="checkbox"
                            checked={t.checked}
                            disabled={isEditMode}
                            onChange={() => handleToggleTask(t.lineIndex)}
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            data-testid={`checkbox-note-task-${widgetId}-${t.lineIndex}`}
                          />
                          <span
                            className={`ob-md-task-text ${t.checked ? 'checked' : ''}`}
                            dangerouslySetInnerHTML={{ __html: t.html }}
                          />
                        </li>
                      ))}
                    </ul>
                  );
                case 'blank':
                  return null;
                default:
                  return null;
              }
            })
          )}
        </div>
      )}
    </div>
  );
}
