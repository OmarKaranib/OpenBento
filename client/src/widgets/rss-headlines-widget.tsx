// Auto-extracted from App.tsx during widget modularization.
import React, { useEffect, useState } from 'react';
import { Rss, Settings as SettingsIcon } from 'lucide-react';
import { MONO, RefreshIndicator, Widget, qrIconBtnStyle, qrInputStyle, timeAgo } from './shared';


  interface RSSHeadlinesProps {
    widget: Widget;
    onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
  }

  interface RSSPayload {
    title: string;
    link: string;
    items: { title: string; url: string; pubDate: string; isoDate: string }[];
    fetchedAt: number;
  }

  export const RSSHeadlinesWidget: React.FC<RSSHeadlinesProps> = ({ widget, onUpdate }) => {
  const [editing, setEditing] = useState<boolean>(!widget.rssUrl);
  const [draftUrl, setDraftUrl] = useState(widget.rssUrl || '');
  const [data, setData] = useState<RSSPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = widget.rssUrl;

  // Stale-while-revalidate: keep the previous feed visible during
  // background refreshes; only the first load shows a spinner.
  useEffect(() => {
    if (!url) { setData(null); setError(null); return; }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/rss?url=${encodeURIComponent(url)}`);
        const body = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          // Preserve stale items on background failure.
          setError(body?.error || `Error ${r.status}`);
        } else {
          setData(body);
          setError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Network error';
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    const id = setInterval(run, 12 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [url]);

  const submitUrl = () => {
    const u = draftUrl.trim();
    if (!u) return;
    onUpdate?.(widget.id, { rssUrl: u });
    setEditing(false);
  };

  return (
    <div
      style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        borderRadius: 'var(--outer-radius)',
        display: 'flex', flexDirection: 'column',
        padding: 12, boxSizing: 'border-box', overflow: 'hidden',
        border: '1px solid rgba(71,85,105,0.4)',
      }}
      data-testid={`rss-headlines-widget-${widget.id}`}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexShrink: 0 }}>
        <Rss size={14} color="#fb923c" />
        {!editing && url ? (
          <>
            <span style={{
              flex: 1, color: '#fb923c', fontFamily: MONO,
              fontSize: 11, fontWeight: 700,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }} title={data?.title || url}>
              {data?.title || 'RSS Feed'}
            </span>
            <RefreshIndicator
              active={loading && data !== null}
              fetchedAt={data?.fetchedAt}
              error={error}
              color="#fb923c"
            />
            <button
              onClick={() => { setDraftUrl(url); setEditing(true); }}
              style={qrIconBtnStyle()}
              title="Change feed"
            >
              <SettingsIcon size={11} />
            </button>
          </>
        ) : (
          <span style={{ flex: 1, color: '#fb923c', fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>
            RSS Headlines
          </span>
        )}
      </div>

      {/* Editor */}
      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onKeyDown={e => e.stopPropagation()}>
          <input
            type="text"
            value={draftUrl}
            onChange={e => setDraftUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitUrl(); }}
            placeholder="https://example.com/feed.xml"
            style={qrInputStyle(11)}
            data-testid={`rss-input-url-${widget.id}`}
          />
          <button
            onClick={submitUrl}
            disabled={!draftUrl.trim()}
            style={{
              padding: '6px 8px', borderRadius: 6,
              background: 'rgba(251,146,60,0.2)',
              border: '1px solid rgba(251,146,60,0.5)',
              color: '#fb923c', cursor: 'pointer',
              fontFamily: MONO, fontSize: 11, fontWeight: 600,
            }}
            data-testid={`rss-submit-${widget.id}`}
          >
            Load feed
          </button>
          <p style={{ color: '#64748b', fontFamily: MONO, fontSize: 10, margin: 0 }}>
            Paste any RSS or Atom feed URL.
          </p>
        </div>
      )}

      {/* Body */}
      {!editing && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {loading && !data && (
            <span style={{ color: '#64748b', fontFamily: MONO, fontSize: 11 }}>Loading…</span>
          )}
          {error && !data && (
            <span style={{ color: '#f87171', fontFamily: MONO, fontSize: 11 }}>{error}</span>
          )}
          {data && data.items.length === 0 && !loading && (
            <span style={{ color: '#64748b', fontFamily: MONO, fontSize: 11 }}>Feed has no items.</span>
          )}
          {data && data.items.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.items.map((it, i) => (
                <li key={`${it.url}-${i}`}>
                  <a
                    href={it.url || '#'}
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'block',
                      padding: '6px 8px', borderRadius: 6,
                      background: 'rgba(15,23,42,0.55)',
                      border: '1px solid rgba(71,85,105,0.3)',
                      textDecoration: 'none',
                      color: '#e2e8f0', fontFamily: MONO, fontSize: 10.5,
                      lineHeight: 1.4,
                    }}
                    data-testid={`rss-item-${i}-${widget.id}`}
                  >
                    <span style={{
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {it.title}
                    </span>
                    {it.isoDate && (
                      <span style={{ color: '#64748b', fontSize: 9, marginTop: 2, display: 'block' }}>
                        {timeAgo(it.isoDate)}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  HabitTrackerWidget — daily check-ins with 7-day streak strip.
//  Storage: widget.habits[] = { id, name, days: ['YYYY-MM-DD', ...] }.
//  Persists via the dashboard's existing widget blob; payload is a
//  rolling 30-day window so even 8 habits stay well under 1 KB.
// ─────────────────────────────────────────────────────────────────────────────

