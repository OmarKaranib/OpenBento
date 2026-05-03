// Auto-extracted from App.tsx during widget modularization.
import React, { useEffect, useRef, useState } from 'react';
import { GitCommit, GitPullRequest, Github, Settings as SettingsIcon, Star, Tag } from 'lucide-react';
import { MONO, RefreshIndicator, Widget, qrIconBtnStyle, qrInputStyle, timeAgo } from './shared';

interface GitHubPulseProps {
  widget: Widget;
  onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
}

interface GitHubPulseData {
  fullName: string;
  htmlUrl: string;
  description: string | null;
  stars: number;
  openPRs: number;
  lastCommit: { sha: string; message: string; authoredAt: string; url: string } | null;
  latestRelease: { tagName: string; name: string; publishedAt: string; url: string } | null;
  fetchedAt: number;
}

interface GitHubUserData {
  login: string;
  name: string | null;
  htmlUrl: string;
  avatarUrl: string;
  bio: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  topRepos: { name: string; stars: number; htmlUrl: string; description: string | null }[];
  fetchedAt: number;
}

// Discriminated union so the widget can render either repo stats or
// an owner-profile card without juggling two parallel state slots.
type GitHubPayload =
  | { kind: 'repo'; data: GitHubPulseData }
  | { kind: 'user'; data: GitHubUserData };



export const GitHubPulseWidget: React.FC<GitHubPulseProps> = ({ widget, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(280);
  // Editing is derived (no owner ⇒ edit) + a manual override.
  const [forceEdit, setForceEdit] = useState(false);
  const editing = forceEdit || !widget.githubOwner;
  const [draftOwner, setDraftOwner] = useState(widget.githubOwner || '');
  const [draftRepo,  setDraftRepo]  = useState(widget.githubRepo  || '');
  const [payload, setPayload] = useState<GitHubPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect;
      if (r) setSize(Math.min(r.width, r.height));
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const owner = widget.githubOwner;
  const repo  = widget.githubRepo;

  // Stale-while-revalidate: keep showing the previous payload while
  // a background refresh is in flight. The spinner and error text
  // only appear on the very first fetch (when there's no data yet).
  // Subsequent failures leave stale data intact and surface the
  // problem only via the subtle "refreshing" dot tooltip.
  const hasPayload = payload !== null;
  useEffect(() => {
    if (!owner) { setPayload(null); setError(null); return; }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        // Branch on whether a repo was supplied: repo stats vs.
        // owner profile. Both routes share the 5-min cache window.
        const url = repo
          ? `/api/github/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
          : `/api/github/user/${encodeURIComponent(owner)}`;
        const r = await fetch(url);
        const body = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          // Preserve stale data on background-refresh failure so the
          // widget doesn't flash an error in place of good content.
          setError(body?.error || `Error ${r.status}`);
        } else if (repo) {
          setPayload({ kind: 'repo', data: body as GitHubPulseData });
          setError(null);
        } else {
          setPayload({ kind: 'user', data: body as GitHubUserData });
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
    const id = setInterval(run, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [owner, repo]);

  const compact = size < 240;
  const repoData: GitHubPulseData | null = payload?.kind === 'repo' ? payload.data : null;
  const userData: GitHubUserData  | null = payload?.kind === 'user' ? payload.data : null;

  const submitRepo = () => {
    const o = draftOwner.trim();
    const r = draftRepo.trim();
    if (!o) return;
    // Repo is optional — empty repo means "show owner profile".
    onUpdate?.(widget.id, { githubOwner: o, githubRepo: r || undefined });
    setForceEdit(false);
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
        borderRadius: 'var(--outer-radius)',
        display: 'flex', flexDirection: 'column',
        padding: compact ? 10 : 14,
        boxSizing: 'border-box', overflow: 'hidden', position: 'relative',
        border: '1px solid rgba(48,54,61,0.6)',
      }}
      data-testid={`github-pulse-widget-${widget.id}`}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexShrink: 0 }}>
        <Github size={compact ? 14 : 16} color="#c9d1d9" />
        {!editing && owner ? (
          <>
            <a
              href={
                repoData?.htmlUrl
                || userData?.htmlUrl
                || (repo ? `https://github.com/${owner}/${repo}` : `https://github.com/${owner}`)
              }
              target="_blank" rel="noopener noreferrer"
              style={{
                flex: 1, color: '#58a6ff', fontFamily: MONO,
                fontSize: compact ? 11 : 12, fontWeight: 600,
                textDecoration: 'none', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
              data-testid={`github-link-${widget.id}`}
            >
              {repo ? `${owner}/${repo}` : `@${owner}`}
            </a>
            <RefreshIndicator
              active={loading && hasPayload}
              fetchedAt={repoData?.fetchedAt ?? userData?.fetchedAt}
              error={error}
              color="#58a6ff"
            />
            <button
              onClick={() => { setDraftOwner(owner); setDraftRepo(repo || ''); setForceEdit(true); }}
              style={qrIconBtnStyle()}
              title={repo ? 'Change repo' : 'Change profile'}
            >
              <SettingsIcon size={11} />
            </button>
          </>
        ) : (
          <span style={{ flex: 1, color: '#7d8590', fontFamily: MONO, fontSize: 11, fontWeight: 600 }}>
            GitHub Pulse
          </span>
        )}
      </div>

      {/* Editor */}
      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onKeyDown={e => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={draftOwner}
              onChange={e => setDraftOwner(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { submitRepo(); } }}
              placeholder="owner"
              style={{ ...qrInputStyle(11), flex: 1 }}
              data-testid={`github-input-owner-${widget.id}`}
            />
            <span style={{ color: '#7d8590', alignSelf: 'center', fontFamily: MONO, fontSize: 12 }}>/</span>
            <input
              type="text"
              value={draftRepo}
              onChange={e => setDraftRepo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { submitRepo(); } }}
              placeholder="repo (optional)"
              style={{ ...qrInputStyle(11), flex: 1 }}
              data-testid={`github-input-repo-${widget.id}`}
            />
          </div>
          <button
            onClick={submitRepo}
            disabled={!draftOwner.trim()}
            style={{
              padding: '6px 8px', borderRadius: 6,
              background: 'rgba(56,139,253,0.2)',
              border: '1px solid rgba(56,139,253,0.5)',
              color: '#58a6ff', cursor: 'pointer',
              fontFamily: MONO, fontSize: 11, fontWeight: 600,
            }}
            data-testid={`github-submit-${widget.id}`}
          >
            {draftRepo.trim() ? 'Load repository' : 'Load profile'}
          </button>
          <p style={{ color: '#7d8590', fontFamily: MONO, fontSize: 10, margin: 0 }}>
            Leave repo blank to show the owner's profile and top repos.
          </p>
        </div>
      )}

      {/* Body */}
      {!editing && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading && !payload && (
            <span style={{ color: '#7d8590', fontFamily: MONO, fontSize: 11 }}>Loading…</span>
          )}
          {error && !payload && (
            <span style={{ color: '#f85149', fontFamily: MONO, fontSize: 11 }}>{error}</span>
          )}

          {/* ── Repo mode ────────────────────────────────────────── */}
          {repoData && (
            <>
              {repoData.description && !compact && (
                <p style={{
                  color: '#8b949e', fontFamily: MONO, fontSize: 10.5,
                  margin: 0, lineHeight: 1.4, display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {repoData.description}
                </p>
              )}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
                flexShrink: 0,
              }}>
                <GitHubStat icon={<Star size={11} />} label="Stars" value={repoData.stars.toLocaleString()} color="#d29922" />
                <GitHubStat icon={<GitPullRequest size={11} />} label="Open PRs" value={repoData.openPRs.toLocaleString()} color="#3fb950" />
              </div>
              {repoData.lastCommit && (
                <a
                  href={repoData.lastCommit.url}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 2,
                    padding: 8, borderRadius: 6,
                    background: 'rgba(13,17,23,0.6)',
                    border: '1px solid rgba(48,54,61,0.6)',
                    textDecoration: 'none',
                  }}
                  data-testid={`github-commit-${widget.id}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <GitCommit size={11} color="#58a6ff" />
                    <span style={{ color: '#58a6ff', fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>
                      {repoData.lastCommit.sha}
                    </span>
                    <span style={{ color: '#7d8590', fontFamily: MONO, fontSize: 9.5, marginLeft: 'auto' }}>
                      {timeAgo(repoData.lastCommit.authoredAt)}
                    </span>
                  </div>
                  <span style={{
                    color: '#c9d1d9', fontFamily: MONO, fontSize: 10.5,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {repoData.lastCommit.message}
                  </span>
                </a>
              )}
              {repoData.latestRelease && (
                <a
                  href={repoData.latestRelease.url}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 8px', borderRadius: 6,
                    background: 'rgba(63,185,80,0.08)',
                    border: '1px solid rgba(63,185,80,0.3)',
                    textDecoration: 'none',
                  }}
                >
                  <Tag size={11} color="#3fb950" />
                  <span style={{ color: '#3fb950', fontFamily: MONO, fontSize: 10.5, fontWeight: 700 }}>
                    {repoData.latestRelease.tagName}
                  </span>
                  <span style={{ color: '#7d8590', fontFamily: MONO, fontSize: 9.5, marginLeft: 'auto' }}>
                    {timeAgo(repoData.latestRelease.publishedAt)}
                  </span>
                </a>
              )}
            </>
          )}

          {/* ── Owner / profile mode ─────────────────────────────── */}
          {userData && (
            <div data-testid={`github-profile-${widget.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {userData.avatarUrl && (
                  <img
                    src={userData.avatarUrl}
                    alt={`${userData.login} avatar`}
                    width={compact ? 28 : 36}
                    height={compact ? 28 : 36}
                    style={{ borderRadius: '50%', flexShrink: 0, border: '1px solid rgba(48,54,61,0.6)' }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: '#c9d1d9', fontFamily: MONO,
                    fontSize: compact ? 11 : 12, fontWeight: 700,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {userData.name || userData.login}
                  </div>
                  {userData.name && (
                    <div style={{
                      color: '#7d8590', fontFamily: MONO, fontSize: 10,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      @{userData.login}
                    </div>
                  )}
                </div>
              </div>
              {userData.bio && !compact && (
                <p style={{
                  color: '#8b949e', fontFamily: MONO, fontSize: 10.5,
                  margin: 0, lineHeight: 1.4, display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {userData.bio}
                </p>
              )}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 6, flexShrink: 0,
              }}>
                <GitHubStat icon={<Star size={11} />}    label="Repos"     value={userData.publicRepos.toLocaleString()} color="#d29922" />
                <GitHubStat icon={<Github size={11} />}  label="Followers" value={userData.followers.toLocaleString()}   color="#58a6ff" />
                <GitHubStat icon={<Github size={11} />}  label="Following" value={userData.following.toLocaleString()}   color="#3fb950" />
              </div>
              {userData.topRepos.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{
                    color: '#7d8590', fontFamily: MONO, fontSize: 9,
                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    Top repos
                  </span>
                  {userData.topRepos.map(r => (
                    <a
                      key={r.htmlUrl}
                      href={r.htmlUrl}
                      target="_blank" rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 8px', borderRadius: 6,
                        background: 'rgba(13,17,23,0.6)',
                        border: '1px solid rgba(48,54,61,0.6)',
                        textDecoration: 'none',
                      }}
                      data-testid={`github-toprepo-${r.name}-${widget.id}`}
                    >
                      <span style={{
                        flex: 1, color: '#58a6ff', fontFamily: MONO,
                        fontSize: 10.5, fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {r.name}
                      </span>
                      <Star size={10} color="#d29922" />
                      <span style={{ color: '#d29922', fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>
                        {r.stars.toLocaleString()}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const GitHubStat: React.FC<{ icon: React.ReactNode; label: string; value: string; color: string }> = ({ icon, label, value, color }) => (
  <div style={{
    padding: '6px 8px', borderRadius: 6,
    background: 'rgba(13,17,23,0.6)',
    border: '1px solid rgba(48,54,61,0.6)',
    display: 'flex', flexDirection: 'column', gap: 2,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color }}>
      {icon}
      <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
    </div>
    <span style={{ color: '#c9d1d9', fontFamily: MONO, fontSize: 14, fontWeight: 700 }}>
      {value}
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  RSSHeadlinesWidget — feed URL + scrolling list of headlines.
//  Backed by /api/rss?url= (12 min cache).
// ─────────────────────────────────────────────────────────────────────────────

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

