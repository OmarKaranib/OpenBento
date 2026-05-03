import { useEffect, useMemo, useRef, useState } from "react";
import {
  Cast, Plus, X, Send, Pencil, Check, Trash2, Loader2, Calendar, Save,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import {
  buildCastSnapshot,
  loadPairedTVs,
  savePairedTVs,
  type PairedTV,
} from "@/lib/cast-snapshot";
import type { Widget } from "@/App";
import type { CastSnapshot } from "@shared/schema";

interface CastPopoverProps {
  widgets: Widget[];
  isDarkMode: boolean;
  masterMute: boolean;
  isAuthenticated?: boolean;
}

interface RoomMeta {
  online: boolean;
  lastPushedAt?: number;
  lastSeenAt?: number;
  code?: string | null;
}

interface SavedLayout {
  id: string;
  name: string;
  snapshot: CastSnapshot;
}

interface ScheduleEntry {
  id: string;
  roomId: string;
  layoutId: string;
  dayOfWeek: number;
  minuteOfDay: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function authedFetch(method: string, url: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    } catch { /* ignore */ }
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  return res;
}

export function CastPopover({
  widgets,
  isDarkMode,
  masterMute,
  isAuthenticated = false,
}: CastPopoverProps) {
  const [open, setOpen] = useState(false);
  const [tvs, setTVs] = useState<PairedTV[]>(() => loadPairedTVs());
  const [code, setCode] = useState("");
  const [pairing, setPairing] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [pushingRoom, setPushingRoom] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [meta, setMeta] = useState<Record<string, RoomMeta>>({});
  const [scheduleRoom, setScheduleRoom] = useState<PairedTV | null>(null);
  const [layouts, setLayouts] = useState<SavedLayout[]>([]);
  const [savingLayout, setSavingLayout] = useState(false);
  const [layoutName, setLayoutName] = useState("");
  const popRef = useRef<HTMLDivElement | null>(null);
  const socketsRef = useRef<Map<string, WebSocket>>(new Map());
  const reconnectTimersRef = useRef<Map<string, number>>(new Map());
  const { toast } = useToast();

  function clearReconnect(roomId: string): void {
    const t = reconnectTimersRef.current.get(roomId);
    if (t !== undefined) {
      window.clearTimeout(t);
      reconnectTimersRef.current.delete(roomId);
    }
  }

  useEffect(() => {
    savePairedTVs(tvs);
  }, [tvs]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // When the popover opens for a signed-in user, fetch persistent rooms from
  // the server and merge any not-yet-known ones into the local paired list.
  // Persistent rooms survive cross-device — that's the whole point.
  useEffect(() => {
    if (!open || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await authedFetch("GET", "/api/cast/rooms");
        const data = await r.json();
        if (cancelled) return;
        const remote: Array<{
          id: string; label: string; code: string | null;
          tvOnline?: boolean; lastPushedAt?: string | null; lastSeenAt?: number | null;
        }> = data?.rooms ?? [];
        if (remote.length === 0) return;
        setTVs((prev) => {
          const known = new Set(prev.map((p) => p.roomId));
          const additions = remote
            .filter((r) => !known.has(r.id))
            .map((r) => ({
              roomId: r.id, label: r.label, pairedAt: Date.now(), code: r.code,
            }));
          return additions.length === 0 ? prev : [...prev, ...additions];
        });
        setMeta((m) => {
          const next = { ...m };
          for (const r of remote) {
            next[r.id] = {
              ...(next[r.id] ?? { online: false }),
              online: !!r.tvOnline,
              code: r.code,
              lastPushedAt: r.lastPushedAt
                ? new Date(r.lastPushedAt).getTime()
                : next[r.id]?.lastPushedAt,
              lastSeenAt: typeof r.lastSeenAt === "number"
                ? r.lastSeenAt
                : next[r.id]?.lastSeenAt,
            };
          }
          return next;
        });
      } catch {
        /* ignore — UX still works locally */
      }
    })();
    return () => { cancelled = true; };
  }, [open, isAuthenticated]);

  // Fetch saved layouts whenever the popover opens for a signed-in user.
  useEffect(() => {
    if (!open || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await authedFetch("GET", "/api/cast/layouts");
        const data = await r.json();
        if (cancelled) return;
        setLayouts(data?.layouts ?? []);
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [open, isAuthenticated]);

  useEffect(() => {
    const sockets = socketsRef.current;
    const known = new Set(tvs.map((tv) => tv.roomId));
    sockets.forEach((ws, roomId) => {
      if (!known.has(roomId)) {
        clearReconnect(roomId);
        try { ws.onclose = null; ws.close(); } catch { /* ignore */ }
        sockets.delete(roomId);
      }
    });
    tvs.forEach((tv) => {
      if (sockets.has(tv.roomId)) return;
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${proto}://${window.location.host}/ws/cast?roomId=${encodeURIComponent(
        tv.roomId,
      )}&role=laptop`;
      const ws = new WebSocket(url);
      sockets.set(tv.roomId, ws);
      ws.onopen = () => clearReconnect(tv.roomId);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data));
          if (msg.type === "renamed" && typeof msg.label === "string") {
            setTVs((prev) =>
              prev.map((p) => (p.roomId === tv.roomId ? { ...p, label: msg.label } : p)),
            );
          } else if (msg.type === "presence") {
            setMeta((m) => ({
              ...m,
              [tv.roomId]: {
                ...(m[tv.roomId] ?? { online: false }),
                online: !!msg.tvOnline,
                lastSeenAt: typeof msg.lastSeenAt === "number"
                  ? msg.lastSeenAt
                  : m[tv.roomId]?.lastSeenAt,
              },
            }));
          } else if (msg.type === "closed") {
            setTVs((prev) => prev.filter((p) => p.roomId !== tv.roomId));
          }
        } catch { /* ignore */ }
      };
      ws.onclose = () => {
        setMeta((m) => ({
          ...m,
          [tv.roomId]: { ...(m[tv.roomId] ?? {}), online: false },
        }));
        sockets.delete(tv.roomId);
        clearReconnect(tv.roomId);
        const timerId = window.setTimeout(() => {
          reconnectTimersRef.current.delete(tv.roomId);
          if (loadPairedTVs().some((p) => p.roomId === tv.roomId)) {
            setTVs((prev) => [...prev]);
          }
        }, 3000);
        reconnectTimersRef.current.set(tv.roomId, timerId);
      };
      ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
    });
  }, [tvs]);

  // Push diff mute control to all TVs whenever effective mute changes.
  const prevMutesRef = useRef<Record<string, boolean> | null>(null);
  useEffect(() => {
    const videoMutes: Record<string, boolean> = {};
    widgets.forEach((w) => {
      if (w.type === "video") videoMutes[w.id] = !!(masterMute || w.isMuted);
    });
    const prev = prevMutesRef.current;
    prevMutesRef.current = videoMutes;
    if (prev === null) return;
    const changed: Record<string, boolean> = {};
    let any = false;
    for (const id in videoMutes) {
      if (prev[id] !== videoMutes[id]) { changed[id] = videoMutes[id]; any = true; }
    }
    if (!any) return;
    const payload = JSON.stringify({ type: "control", videoMutes: changed });
    socketsRef.current.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(payload); } catch { /* ignore */ }
      }
    });
  }, [widgets, masterMute]);

  useEffect(() => {
    return () => {
      reconnectTimersRef.current.forEach((id) => window.clearTimeout(id));
      reconnectTimersRef.current.clear();
      socketsRef.current.forEach((ws) => {
        try { ws.onclose = null; ws.close(); } catch { /* ignore */ }
      });
      socketsRef.current.clear();
    };
  }, []);

  async function handlePair(): Promise<void> {
    const upper = code.trim().toUpperCase();
    const isBento = /^BENTO-[A-Z0-9]{4}$/.test(upper);
    const digits = code.replace(/\D/g, "").slice(0, 6);
    const payload = isBento ? upper : digits;
    if (!isBento && digits.length !== 6) {
      setPairError("Enter a 6-digit code or BENTO-XXXX.");
      return;
    }
    setPairError(null);
    setPairing(true);
    try {
      const res = await authedFetch("POST", "/api/cast/pair", { code: payload });
      const data = await res.json();
      if (!data?.roomId) throw new Error("No room returned");
      setTVs((prev) => {
        if (prev.some((p) => p.roomId === data.roomId)) return prev;
        return [
          ...prev,
          {
            roomId: data.roomId,
            label: data.label || "TV",
            pairedAt: Date.now(),
            code: data.code ?? null,
          },
        ];
      });
      if (data.code) {
        setMeta((m) => ({ ...m, [data.roomId]: { ...(m[data.roomId] ?? { online: false }), code: data.code } }));
      }
      setCode("");
      toast({ title: "TV paired", description: data.label || "TV" });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message.replace(/^\d+:\s*/, "").replace(/^\{.*"error":"([^"]+)".*\}$/, "$1")
          : "Code expired or invalid.";
      setPairError(msg || "Code expired or invalid.");
    } finally {
      setPairing(false);
    }
  }

  async function handlePush(roomId: string): Promise<void> {
    setPushingRoom(roomId);
    try {
      const snapshot = buildCastSnapshot({ widgets, isDarkMode, masterMute });
      // Use authedFetch (sends Bearer token) — persistent BENTO rooms now run
      // through attachSupabaseUser + ownership check, so cookie-only requests
      // would 403 even for the owner.
      await authedFetch("POST", `/api/cast/rooms/${roomId}/push`, { snapshot });
      setMeta((m) => ({
        ...m,
        [roomId]: { ...(m[roomId] ?? { online: true }), lastPushedAt: snapshot.pushedAt },
      }));
      toast({ title: "Pushed to TV" });
    } catch (err) {
      toast({
        title: "Push failed",
        description: err instanceof Error ? err.message : "Check the TV connection",
        variant: "destructive",
      });
    } finally {
      setPushingRoom(null);
    }
  }

  async function handlePushAll(): Promise<void> {
    if (tvs.length === 0) return;
    const snapshot = buildCastSnapshot({ widgets, isDarkMode, masterMute });
    let ok = 0, fail = 0;
    await Promise.all(
      tvs.map(async (tv) => {
        try {
          await authedFetch("POST", `/api/cast/rooms/${tv.roomId}/push`, { snapshot });
          ok++;
          setMeta((m) => ({
            ...m,
            [tv.roomId]: {
              ...(m[tv.roomId] ?? { online: true }),
              lastPushedAt: snapshot.pushedAt,
            },
          }));
        } catch { fail++; }
      }),
    );
    toast({
      title: `Pushed to ${ok}/${tvs.length} TV${tvs.length === 1 ? "" : "s"}`,
      description: fail > 0 ? `${fail} failed` : undefined,
      variant: fail === tvs.length ? "destructive" : undefined,
    });
  }

  async function handleUnpair(roomId: string): Promise<void> {
    try {
      await authedFetch("DELETE", `/api/cast/rooms/${roomId}`);
    } catch { /* local removal still happens below */ }
    setTVs((prev) => prev.filter((p) => p.roomId !== roomId));
    toast({ title: "TV unpaired" });
  }

  async function handleRename(roomId: string): Promise<void> {
    const label = editLabel.trim().slice(0, 40);
    if (!label) { setEditingRoom(null); return; }
    try {
      await authedFetch("PATCH", `/api/cast/rooms/${roomId}`, { label });
      setTVs((prev) => prev.map((p) => (p.roomId === roomId ? { ...p, label } : p)));
    } catch (err) {
      toast({
        title: "Rename failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setEditingRoom(null);
    }
  }

  async function handleSaveLayout(): Promise<void> {
    const name = layoutName.trim().slice(0, 80);
    if (!name) { toast({ title: "Layout needs a name", variant: "destructive" }); return; }
    setSavingLayout(true);
    try {
      const snapshot = buildCastSnapshot({ widgets, isDarkMode, masterMute });
      const r = await authedFetch("POST", "/api/cast/layouts", { name, snapshot });
      const data = await r.json();
      setLayouts((prev) => [...prev, data.layout]);
      setLayoutName("");
      toast({ title: "Layout saved", description: name });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setSavingLayout(false);
    }
  }

  async function handleDeleteLayout(id: string): Promise<void> {
    try {
      await authedFetch("DELETE", `/api/cast/layouts/${id}`);
      setLayouts((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      toast({ title: "Delete failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    }
  }

  function timeAgo(ts: number | undefined): string {
    if (!ts) return "never";
    const d = Math.max(0, Date.now() - ts);
    if (d < 5_000) return "just now";
    if (d < 60_000) return `${Math.floor(d / 1000)}s ago`;
    if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
    return `${Math.floor(d / 3_600_000)}h ago`;
  }

  return (
    <div className="relative" ref={popRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`menu-btn h-[3.2rem] px-[1.2rem] slot-button font-semibold flex items-center gap-[0.6rem] transition-all duration-300 transform hover:scale-105 text-[1.2rem] leading-[3.2rem] shadow-md ${
          tvs.length > 0
            ? "bg-fuchsia-600/70 hover:bg-fuchsia-500/80 text-white"
            : "bg-slate-600/60 hover:bg-slate-500/70 text-white"
        }`}
        title={tvs.length === 0 ? "Cast to a TV" : `${tvs.length} TV(s) paired`}
        data-testid="button-cast"
      >
        <Cast className="w-[1.4rem] h-[1.4rem]" />
        Cast
        {tvs.length > 0 && (
          <span className="ml-[0.2rem] inline-flex items-center justify-center min-w-[1.6rem] h-[1.6rem] px-[0.4rem] text-[0.85rem] font-bold rounded-full bg-white/25">
            {tvs.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute right-0 top-full mt-[0.4rem] w-[30rem] rounded-lg shadow-2xl border z-[10010] max-h-[80vh] overflow-y-auto ${
            isDarkMode
              ? "bg-slate-900 border-slate-700 text-slate-100"
              : "bg-white border-gray-200 text-gray-900"
          }`}
          data-testid="popover-cast"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="p-[1.2rem] border-b border-slate-700/40">
            <div className="flex items-center justify-between mb-[0.6rem]">
              <h3 className="text-[1.15rem] font-bold flex items-center gap-[0.5rem]">
                <Cast className="w-[1.2rem] h-[1.2rem]" /> Cast to TV
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="p-[0.3rem] rounded hover:bg-slate-700/30"
                data-testid="button-cast-close"
              >
                <X className="w-[1.1rem] h-[1.1rem]" />
              </button>
            </div>
            <p className={`text-[0.85rem] mb-[0.6rem] ${isDarkMode ? "text-slate-400" : "text-gray-600"}`}>
              On your TV, open <span className="font-mono">openbento.tv/cast</span> and enter the code shown.
              {isAuthenticated && (
                <> Signed-in users can also re-enter a saved <span className="font-mono">BENTO-XXXX</span> code.</>
              )}
            </p>
            <div className="flex gap-[0.5rem]">
              <input
                value={code}
                onChange={(e) => {
                  // Allow digits + uppercase A-Z + dash for BENTO codes.
                  const clean = e.target.value.replace(/[^0-9A-Za-z\-]/g, "").slice(0, 11);
                  setCode(clean);
                  if (pairError) setPairError(null);
                }}
                placeholder={isAuthenticated ? "123456 or BENTO-XXXX" : "123 456"}
                inputMode="text"
                maxLength={11}
                className={`flex-1 h-[2.6rem] px-[0.8rem] rounded-md border text-[1.05rem] tracking-[0.2em] font-mono text-center ${
                  pairError
                    ? "border-red-500 ring-1 ring-red-500/40"
                    : isDarkMode
                      ? "border-slate-600"
                      : "border-gray-300"
                } ${
                  isDarkMode ? "bg-slate-800 text-white" : "bg-gray-50 text-gray-900"
                }`}
                data-testid="input-cast-code"
                onKeyDown={(e) => { if (e.key === "Enter") handlePair(); }}
              />
              <button
                onClick={handlePair}
                disabled={pairing || code.length < 6}
                className={`h-[2.6rem] px-[1rem] rounded-md font-semibold flex items-center gap-[0.4rem] ${
                  pairing || code.length < 6
                    ? "bg-slate-600/60 cursor-not-allowed opacity-60"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
                data-testid="button-cast-pair"
              >
                {pairing ? <Loader2 className="w-[1rem] h-[1rem] animate-spin" /> : <Plus className="w-[1rem] h-[1rem]" />}
                Pair
              </button>
            </div>
            {pairError && (
              <p
                className="mt-[0.5rem] text-[0.85rem] text-red-400 font-medium"
                data-testid="text-cast-pair-error"
                role="alert"
              >
                {pairError}
              </p>
            )}
          </div>

          <div className="p-[1.2rem]">
            <div className="flex items-center justify-between mb-[0.6rem]">
              <span className={`text-[0.95rem] font-semibold ${isDarkMode ? "text-slate-300" : "text-gray-700"}`}>
                Paired TVs ({tvs.length})
              </span>
              {tvs.length > 0 && (
                <button
                  onClick={handlePushAll}
                  className="text-[0.85rem] px-[0.7rem] py-[0.3rem] rounded bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-semibold flex items-center gap-[0.3rem]"
                  data-testid="button-cast-push-all"
                >
                  <Send className="w-[0.9rem] h-[0.9rem]" /> Push to all
                </button>
              )}
            </div>

            {tvs.length === 0 ? (
              <p className={`text-[0.85rem] italic ${isDarkMode ? "text-slate-500" : "text-gray-500"}`}>
                No TVs paired yet. Pair one above to start casting.
              </p>
            ) : (
              <ul className="space-y-[0.5rem] max-h-[20rem] overflow-y-auto">
                {tvs.map((tv) => {
                  const m = meta[tv.roomId];
                  const isEditing = editingRoom === tv.roomId;
                  const persistentCode = m?.code ?? tv.code ?? null;
                  return (
                    <li
                      key={tv.roomId}
                      className={`p-[0.7rem] rounded-md border flex flex-col gap-[0.4rem] ${
                        isDarkMode ? "bg-slate-800/60 border-slate-700" : "bg-gray-50 border-gray-200"
                      }`}
                      data-testid={`row-tv-${tv.roomId}`}
                    >
                      <div className="flex items-center justify-between gap-[0.5rem]">
                        {isEditing ? (
                          <input
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleRename(tv.roomId);
                              if (e.key === "Escape") setEditingRoom(null);
                            }}
                            autoFocus
                            className={`flex-1 px-[0.4rem] py-[0.2rem] rounded border text-[0.95rem] ${
                              isDarkMode ? "bg-slate-900 border-slate-600 text-white" : "bg-white border-gray-300"
                            }`}
                            data-testid={`input-rename-${tv.roomId}`}
                          />
                        ) : (
                          <span className="font-semibold text-[1rem] flex-1 truncate">{tv.label}</span>
                        )}
                        <span
                          className={`inline-block w-[0.6rem] h-[0.6rem] rounded-full ${
                            m?.online ? "bg-emerald-500" : "bg-slate-500"
                          }`}
                          title={m?.online ? "Online" : "Offline"}
                          data-testid={`presence-${tv.roomId}`}
                        />
                      </div>
                      {persistentCode && (
                        <div
                          className={`text-[0.7rem] font-mono ${isDarkMode ? "text-cyan-400" : "text-cyan-700"}`}
                          data-testid={`text-room-code-${tv.roomId}`}
                        >
                          {persistentCode}
                        </div>
                      )}
                      <div className={`text-[0.75rem] ${isDarkMode ? "text-slate-500" : "text-gray-500"}`}>
                        <span data-testid={`text-last-pushed-${tv.roomId}`}>Last pushed: {timeAgo(m?.lastPushedAt)}</span>
                        <span className="mx-[0.4rem]">·</span>
                        <span data-testid={`text-last-seen-${tv.roomId}`}>
                          Last seen: {m?.online ? "now" : timeAgo(m?.lastSeenAt)}
                        </span>
                      </div>
                      <div className="flex gap-[0.4rem] flex-wrap">
                        <button
                          onClick={() => handlePush(tv.roomId)}
                          disabled={pushingRoom === tv.roomId}
                          className="flex-1 h-[2.2rem] rounded bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[0.85rem] font-semibold flex items-center justify-center gap-[0.3rem] disabled:opacity-60"
                          data-testid={`button-push-${tv.roomId}`}
                        >
                          {pushingRoom === tv.roomId
                            ? <Loader2 className="w-[0.9rem] h-[0.9rem] animate-spin" />
                            : <Send className="w-[0.9rem] h-[0.9rem]" />}
                          Push
                        </button>
                        {isAuthenticated && (
                          <button
                            onClick={() => setScheduleRoom(tv)}
                            className="h-[2.2rem] px-[0.7rem] rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[0.85rem] flex items-center gap-[0.3rem]"
                            data-testid={`button-schedule-${tv.roomId}`}
                            title="Schedule layouts"
                          >
                            <Calendar className="w-[0.9rem] h-[0.9rem]" />
                          </button>
                        )}
                        {isEditing ? (
                          <button
                            onClick={() => handleRename(tv.roomId)}
                            className="h-[2.2rem] px-[0.7rem] rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[0.85rem]"
                            data-testid={`button-rename-save-${tv.roomId}`}
                          >
                            <Check className="w-[0.9rem] h-[0.9rem]" />
                          </button>
                        ) : (
                          <button
                            onClick={() => { setEditingRoom(tv.roomId); setEditLabel(tv.label); }}
                            className="h-[2.2rem] px-[0.7rem] rounded bg-slate-600 hover:bg-slate-500 text-white text-[0.85rem]"
                            data-testid={`button-rename-${tv.roomId}`}
                          >
                            <Pencil className="w-[0.9rem] h-[0.9rem]" />
                          </button>
                        )}
                        <button
                          onClick={() => handleUnpair(tv.roomId)}
                          className="h-[2.2rem] px-[0.7rem] rounded bg-red-600 hover:bg-red-500 text-white text-[0.85rem]"
                          data-testid={`button-unpair-${tv.roomId}`}
                        >
                          <Trash2 className="w-[0.9rem] h-[0.9rem]" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {isAuthenticated && (
            <div className="p-[1.2rem] border-t border-slate-700/40">
              <div className="flex items-center justify-between mb-[0.5rem]">
                <span className={`text-[0.95rem] font-semibold ${isDarkMode ? "text-slate-300" : "text-gray-700"}`}>
                  Saved layouts ({layouts.length})
                </span>
              </div>
              <div className="flex gap-[0.4rem] mb-[0.6rem]">
                <input
                  value={layoutName}
                  onChange={(e) => setLayoutName(e.target.value.slice(0, 80))}
                  placeholder="Layout name (e.g. Morning)"
                  className={`flex-1 h-[2.2rem] px-[0.6rem] rounded border text-[0.9rem] ${
                    isDarkMode ? "bg-slate-800 border-slate-600 text-white" : "bg-gray-50 border-gray-300"
                  }`}
                  data-testid="input-layout-name"
                />
                <button
                  onClick={handleSaveLayout}
                  disabled={savingLayout || !layoutName.trim()}
                  className="h-[2.2rem] px-[0.7rem] rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[0.85rem] flex items-center gap-[0.3rem] disabled:opacity-50"
                  data-testid="button-save-layout"
                >
                  {savingLayout ? <Loader2 className="w-[0.9rem] h-[0.9rem] animate-spin" /> : <Save className="w-[0.9rem] h-[0.9rem]" />}
                  Save current
                </button>
              </div>
              {layouts.length > 0 && (
                <ul className="space-y-[0.3rem] max-h-[10rem] overflow-y-auto">
                  {layouts.map((l) => (
                    <li
                      key={l.id}
                      className={`flex items-center justify-between gap-[0.4rem] px-[0.6rem] py-[0.3rem] rounded text-[0.85rem] ${
                        isDarkMode ? "bg-slate-800/40" : "bg-gray-100"
                      }`}
                      data-testid={`row-layout-${l.id}`}
                    >
                      <span className="truncate flex-1">{l.name}</span>
                      <button
                        onClick={() => handleDeleteLayout(l.id)}
                        className="p-[0.2rem] rounded text-red-400 hover:text-red-300"
                        data-testid={`button-delete-layout-${l.id}`}
                        aria-label={`Delete layout ${l.name}`}
                      >
                        <Trash2 className="w-[0.85rem] h-[0.85rem]" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!isAuthenticated && (
            <div className={`p-[1rem] border-t border-slate-700/40 text-[0.8rem] italic ${isDarkMode ? "text-slate-500" : "text-gray-500"}`}>
              Sign in to save layouts and schedule them across the week.
            </div>
          )}
        </div>
      )}

      {scheduleRoom && (
        <ScheduleModal
          tv={scheduleRoom}
          layouts={layouts}
          isDarkMode={isDarkMode}
          onClose={() => setScheduleRoom(null)}
        />
      )}
    </div>
  );
}

// ─── Schedule modal ──────────────────────────────────────────────────────────
function ScheduleModal({
  tv, layouts, isDarkMode, onClose,
}: {
  tv: PairedTV;
  layouts: SavedLayout[];
  isDarkMode: boolean;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [layoutId, setLayoutId] = useState<string>(layouts[0]?.id ?? "");
  const [day, setDay] = useState<number>(1); // Mon
  const [time, setTime] = useState("09:00");
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await authedFetch("GET", `/api/cast/rooms/${tv.roomId}/schedules`);
        const data = await r.json();
        if (cancelled) return;
        setEntries(data?.schedules ?? []);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tv.roomId]);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) =>
      a.dayOfWeek - b.dayOfWeek || a.minuteOfDay - b.minuteOfDay,
    );
  }, [entries]);

  function fmtMinute(m: number): string {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  async function add(): Promise<void> {
    if (!layoutId) {
      toast({ title: "Save a layout first", variant: "destructive" });
      return;
    }
    const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) {
      toast({ title: "Invalid time", variant: "destructive" });
      return;
    }
    const minuteOfDay = hh * 60 + mm;
    setAdding(true);
    try {
      const r = await authedFetch("POST", `/api/cast/rooms/${tv.roomId}/schedules`, {
        layoutId, dayOfWeek: day, minuteOfDay,
      });
      const data = await r.json();
      setEntries((prev) => [...prev, data.schedule]);
    } catch (err) {
      toast({
        title: "Schedule failed",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string): Promise<void> {
    try {
      await authedFetch("DELETE", `/api/cast/schedules/${id}`);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      toast({ title: "Remove failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    }
  }

  function layoutName(id: string): string {
    return layouts.find((l) => l.id === id)?.name ?? "(deleted layout)";
  }

  return (
    <div
      className="fixed inset-0 z-[10100] flex items-center justify-center p-[1rem] bg-slate-950/70 backdrop-blur-sm"
      data-testid="modal-schedule"
      onMouseDown={onClose}
    >
      <div
        className={`w-full max-w-[40rem] rounded-xl shadow-2xl border ${
          isDarkMode ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-gray-200 text-gray-900"
        }`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-[1rem] border-b border-slate-700/40">
          <h3 className="text-[1.1rem] font-bold flex items-center gap-[0.4rem]">
            <Calendar className="w-[1.1rem] h-[1.1rem]" /> Schedule for {tv.label}
          </h3>
          <button
            onClick={onClose}
            className="p-[0.3rem] rounded hover:bg-slate-700/30"
            data-testid="button-close-schedule"
          >
            <X className="w-[1.1rem] h-[1.1rem]" />
          </button>
        </div>

        <div className="p-[1rem] space-y-[0.8rem]">
          {layouts.length === 0 ? (
            <p className="text-[0.85rem] italic text-amber-400" data-testid="text-no-layouts">
              No saved layouts yet. Save one from the cast popover first.
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-[0.4rem]">
              <label className="flex flex-col text-[0.75rem] flex-1 min-w-[10rem]">
                Layout
                <select
                  value={layoutId}
                  onChange={(e) => setLayoutId(e.target.value)}
                  className={`h-[2.2rem] px-[0.5rem] rounded border text-[0.9rem] ${
                    isDarkMode ? "bg-slate-800 border-slate-600 text-white" : "bg-gray-50 border-gray-300"
                  }`}
                  data-testid="select-schedule-layout"
                >
                  {layouts.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-[0.75rem]">
                Day
                <select
                  value={day}
                  onChange={(e) => setDay(parseInt(e.target.value, 10))}
                  className={`h-[2.2rem] px-[0.5rem] rounded border text-[0.9rem] ${
                    isDarkMode ? "bg-slate-800 border-slate-600 text-white" : "bg-gray-50 border-gray-300"
                  }`}
                  data-testid="select-schedule-day"
                >
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </label>
              <label className="flex flex-col text-[0.75rem]">
                Time
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={`h-[2.2rem] px-[0.5rem] rounded border text-[0.9rem] ${
                    isDarkMode ? "bg-slate-800 border-slate-600 text-white" : "bg-gray-50 border-gray-300"
                  }`}
                  data-testid="input-schedule-time"
                />
              </label>
              <button
                onClick={add}
                disabled={adding}
                className="h-[2.2rem] px-[0.7rem] rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[0.85rem] flex items-center gap-[0.3rem] disabled:opacity-60"
                data-testid="button-add-schedule"
              >
                {adding ? <Loader2 className="w-[0.9rem] h-[0.9rem] animate-spin" /> : <Plus className="w-[0.9rem] h-[0.9rem]" />}
                Add
              </button>
            </div>
          )}

          <div>
            <h4 className="text-[0.85rem] font-semibold mb-[0.4rem]">Weekly schedule</h4>
            {loading ? (
              <p className="text-[0.85rem] italic opacity-60">Loading…</p>
            ) : sortedEntries.length === 0 ? (
              <p className="text-[0.85rem] italic opacity-60">No entries. Add one above to rotate layouts automatically.</p>
            ) : (
              <ul className="space-y-[0.3rem] max-h-[16rem] overflow-y-auto">
                {sortedEntries.map((e) => (
                  <li
                    key={e.id}
                    className={`flex items-center justify-between gap-[0.4rem] px-[0.6rem] py-[0.4rem] rounded text-[0.9rem] ${
                      isDarkMode ? "bg-slate-800/60" : "bg-gray-100"
                    }`}
                    data-testid={`row-schedule-${e.id}`}
                  >
                    <span className="font-mono w-[6rem]">{DAYS[e.dayOfWeek]} {fmtMinute(e.minuteOfDay)}</span>
                    <span className="flex-1 truncate">→ {layoutName(e.layoutId)}</span>
                    <button
                      onClick={() => remove(e.id)}
                      className="p-[0.2rem] rounded text-red-400 hover:text-red-300"
                      data-testid={`button-remove-schedule-${e.id}`}
                      aria-label={`Remove schedule entry`}
                    >
                      <Trash2 className="w-[0.85rem] h-[0.85rem]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
