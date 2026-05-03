// Widget Marketplace — public catalog of installable Custom Widgets at /widgets.
//
// - Loads /marketplace/widgets.json (Zod-validated entry-by-entry — see
//   shared/marketplace-manifest.ts).
// - Search box (name/description/author/tag) + category chips filter.
// - Each card renders a sandboxed thumbnail iframe of the widget itself
//   (sandbox="allow-scripts" only — same security model as the host).
// - "Add to dashboard" hands off the URL to "/" via ?install=<url>;
//   DashboardShell consumes the param, opens the existing Custom Widget
//   modal pre-filled, and the user gets the standard trust banner.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, Search, Plus, Mail, Code2, ShieldAlert, Github } from 'lucide-react';
import {
  parseMarketplaceManifest,
  MARKETPLACE_CATEGORIES,
  type MarketplaceCategory,
  type MarketplaceWidget,
} from '@shared/marketplace-manifest';

type Filter = 'all' | MarketplaceCategory;

const CATEGORY_LABELS: Record<Filter, string> = {
  all: 'All',
  productivity: 'Productivity',
  fun: 'Fun',
  utility: 'Utility',
  data: 'Data',
  social: 'Social',
};

export default function MarketplacePage() {
  const [, navigate] = useLocation();
  const [widgets, setWidgets] = useState<MarketplaceWidget[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const cancelledRef = useRef(false);

  // ── SEO ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Widget Marketplace — OpenBento';
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    const prevDesc = meta.content;
    meta.content =
      'Browse and install sandboxed Custom Widgets for your OpenBento dashboard — productivity timers, counters, quotes, and more.';
    return () => {
      document.title = prevTitle;
      if (created) meta?.remove();
      else if (meta) meta.content = prevDesc;
    };
  }, []);

  // ── Load manifest ─────────────────────────────────────────────────────
  useEffect(() => {
    cancelledRef.current = false;
    fetch('/marketplace/widgets.json', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      })
      .then((raw) => {
        if (cancelledRef.current) return;
        const { widgets: parsed } = parseMarketplaceManifest(raw);
        setWidgets(parsed);
      })
      .catch((e) => {
        if (cancelledRef.current) return;
        console.error('[Marketplace] manifest load failed', e);
        setLoadError('Could not load the marketplace catalog. Please try again.');
        setWidgets([]);
      });
    return () => { cancelledRef.current = true; };
  }, []);

  const visible = useMemo(() => {
    if (!widgets) return [];
    const q = search.trim().toLowerCase();
    return widgets.filter((w) => {
      if (filter !== 'all' && w.category !== filter) return false;
      if (!q) return true;
      const hay = [
        w.name, w.author, w.description, w.category,
        ...(w.tags ?? []),
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [widgets, search, filter]);

  const handleInstall = (w: MarketplaceWidget) => {
    navigate('/?install=' + encodeURIComponent(w.url));
  };

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#e2e8f0', padding: '40px 20px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Link
          href="/"
          data-testid="link-marketplace-back-home"
          style={{ color: '#22d3ee', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24, textDecoration: 'none' }}
        >
          <ArrowLeft size={16} /> Back to dashboard
        </Link>

        <header style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <Code2 size={30} color="#22d3ee" /> Widget Marketplace
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 15, marginTop: 8, maxWidth: 720 }}>
            Browse sandboxed Custom Widgets you can drop into your dashboard.
            Every widget runs in an isolated iframe — see the{' '}
            <Link href="/dev/widgets" style={{ color: '#22d3ee' }} data-testid="link-marketplace-dev-docs">SDK docs</Link>
            {' '}for the security model.
          </p>
        </header>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={16} color="#64748b" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search widgets, authors, tags…"
            aria-label="Search widgets"
            data-testid="input-marketplace-search"
            style={{
              width: '100%', padding: '12px 14px 12px 36px',
              background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10,
              color: '#e2e8f0', fontSize: 14, outline: 'none',
            }}
          />
        </div>

        {/* Category chips */}
        <div role="tablist" aria-label="Widget categories" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
          {(['all', ...MARKETPLACE_CATEGORIES] as Filter[]).map((cat) => {
            const active = filter === cat;
            return (
              <button
                key={cat}
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(cat)}
                data-testid={`chip-marketplace-${cat}`}
                style={{
                  padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', transition: 'background 120ms',
                  background: active ? '#22d3ee' : 'rgba(255,255,255,0.04)',
                  color: active ? '#0f172a' : '#cbd5e1',
                  border: '1px solid ' + (active ? 'transparent' : 'rgba(255,255,255,0.08)'),
                }}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {widgets === null && (
          <div
            data-testid="marketplace-skeleton"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12,
                  padding: 16, height: 280,
                }}
              >
                <div style={{ width: '100%', height: 140, background: '#1e293b', borderRadius: 8, marginBottom: 12 }} />
                <div style={{ width: '60%', height: 14, background: '#1e293b', borderRadius: 4, marginBottom: 8 }} />
                <div style={{ width: '90%', height: 10, background: '#1e293b', borderRadius: 4 }} />
              </div>
            ))}
          </div>
        )}

        {widgets !== null && visible.length === 0 && (
          <div
            data-testid="marketplace-empty"
            style={{
              padding: '48px 20px', textAlign: 'center', color: '#94a3b8',
              background: '#0f172a', border: '1px dashed #1e293b', borderRadius: 12,
            }}
          >
            {loadError ? (
              <>
                <ShieldAlert size={28} color="#f87171" style={{ marginBottom: 8 }} />
                <p style={{ color: '#f87171', fontWeight: 600 }}>{loadError}</p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>No widgets match your search.</p>
                <p style={{ fontSize: 13 }}>Try a different keyword or category chip.</p>
              </>
            )}
          </div>
        )}

        {widgets !== null && visible.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {visible.map((w) => (
              <MarketplaceCard key={w.id} widget={w} onInstall={() => handleInstall(w)} />
            ))}
          </div>
        )}

        {/* Submit footer */}
        <footer
          style={{
            marginTop: 48, padding: '24px 20px', borderRadius: 12,
            background: '#0f172a', border: '1px solid #1e293b',
            display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
          }}
          data-testid="marketplace-submit-footer"
        >
          <div style={{ flex: '1 1 320px', minWidth: 260 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Built a widget?</h2>
            <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>
              Open a pull request adding your entry to{' '}
              <code style={{ background: '#020617', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>
                client/public/marketplace/widgets.json
              </code>
              , or email us a link. Each entry must include{' '}
              <code style={{ background: '#020617', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>
                id, name, author, description, category, version, url
              </code>
              {' '}— see the{' '}
              <Link href="/dev/widgets" style={{ color: '#22d3ee' }} data-testid="link-marketplace-schema-docs">
                SDK docs
              </Link>
              {' '}for the manifest schema and the trust/sandbox model.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <a
              href="https://github.com/openbento/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-marketplace-github"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', background: 'rgba(255,255,255,0.06)', color: '#e2e8f0',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none',
              }}
            >
              <Github size={14} /> GitHub repo
            </a>
            <a
              href={'mailto:hello@openbento.dev?subject=' + encodeURIComponent('Widget Marketplace Submission')
                + '&body=' + encodeURIComponent(
                  'Hi OpenBento team!\n\nI built a Custom Widget I would like added to the marketplace.\n\n'
                  + 'Manifest entry (paste into client/public/marketplace/widgets.json under "widgets"):\n\n'
                  + '{\n  "id": "my-widget",\n  "name": "My Widget",\n  "author": "Your Name",\n'
                  + '  "description": "What it does in one line.",\n  "category": "productivity",\n'
                  + '  "version": "1.0.0",\n  "url": "https://example.com/my-widget/index.html",\n'
                  + '  "tags": ["optional"]\n}\n\n'
                  + 'My widget loads /sdk/widget-sdk.v1.js and only uses postMessage (no eval, no top-nav).\n\n'
                  + 'Live preview URL: \nGitHub source: \n')}
              data-testid="link-marketplace-submit"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', background: '#22d3ee', color: '#0f172a',
                borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none',
              }}
            >
              <Mail size={14} /> Submit your widget
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

interface CardProps {
  widget: MarketplaceWidget;
  onInstall: () => void;
}

function MarketplaceCard({ widget, onInstall }: CardProps) {
  return (
    <article
      data-testid={`card-marketplace-${widget.id}`}
      style={{
        background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12,
        padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div
        style={{
          width: '100%', height: 150, borderRadius: 8, overflow: 'hidden',
          background: '#020617', border: '1px solid #1e293b', position: 'relative',
        }}
      >
        <iframe
          src={widget.url}
          title={`${widget.name} preview`}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          loading="lazy"
          style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none', display: 'block' }}
          data-testid={`thumb-marketplace-${widget.id}`}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>{widget.name}</h3>
        <span
          style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 999,
            background: 'rgba(34,211,238,0.12)', color: '#22d3ee',
            border: '1px solid rgba(34,211,238,0.25)', textTransform: 'uppercase', letterSpacing: 0.5,
          }}
          data-testid={`badge-category-${widget.id}`}
        >
          {widget.category}
        </span>
        <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>v{widget.version}</span>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.45, minHeight: 34 }}>
        {widget.description}
      </p>
      <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>by {widget.author}</p>

      <button
        onClick={onInstall}
        data-testid={`button-add-marketplace-${widget.id}`}
        style={{
          marginTop: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '9px 12px', background: '#22d3ee', color: '#0f172a',
          border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}
      >
        <Plus size={14} /> Add to dashboard
      </button>
    </article>
  );
}
