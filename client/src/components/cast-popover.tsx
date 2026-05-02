import { useEffect, useRef, useState } from "react";
import { Cast, Plus, X, Send, Pencil, Check, Trash2, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  buildCastSnapshot,
  loadPairedTVs,
  savePairedTVs,
  type PairedTV,
} from "@/lib/cast-snapshot";
import type { Widget } from "@/App";

interface CastPopoverProps {
  widgets: Widget[];
  isDarkMode: boolean;
  masterMute: boolean;
}

interface RoomMeta {
  online: boolean;
  lastPushedAt?: number;
  lastSeenAt?: number;
}

export function CastPopover({ widgets, isDarkMode, masterMute }: CastPopoverProps) {
  const [open, setOpen] = useState(false);
  const [tvs, setTVs] = useState<PairedTV[]>(() => loadPairedTVs());
  const [code, setCode] = useState("");
  const [pairing, setPairing] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [pushingRoom, setPushingRoom] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [meta, setMeta] = useState<Record<string, RoomMeta>>({});
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

  // Maintain a long-lived WS per paired TV. The server broadcasts to this
  // socket whenever the TV is renamed or the room is unpaired/deleted from
  // any peer (including the TV itself), so we can keep our paired list and
  // online indicators in sync without polling.
  useEffect(() => {
    const sockets = socketsRef.current;
    const known = new Set(tvs.map((tv) => tv.roomId));

    sockets.forEach((ws, roomId) => {
      if (!known.has(roomId)) {
        clearReconnect(roomId);
        try {
          ws.onclose = null;
          ws.close();
        } catch {
          /* ignore */
        }
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

      ws.onopen = () => {
        // Hub link is up; actual TV presence arrives via {type:'presence'}.
        clearReconnect(tv.roomId);
      };
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
                lastSeenAt:
                  typeof msg.lastSeenAt === "number"
                    ? msg.lastSeenAt
                    : m[tv.roomId]?.lastSeenAt,
              },
            }));
          } else if (msg.type === "closed") {
            // Room was removed remotely (TV pressed forget, server validation
            // closed an orphan, etc). Drop from local list automatically.
            setTVs((prev) => prev.filter((p) => p.roomId !== tv.roomId));
          }
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        setMeta((m) => ({
          ...m,
          [tv.roomId]: { ...(m[tv.roomId] ?? {}), online: false },
        }));
        sockets.delete(tv.roomId);
        clearReconnect(tv.roomId);
        // Reconnect only if the TV is still in our persisted paired list.
        const timerId = window.setTimeout(() => {
          reconnectTimersRef.current.delete(tv.roomId);
          if (loadPairedTVs().some((p) => p.roomId === tv.roomId)) {
            setTVs((prev) => [...prev]);
          }
        }, 3000);
        reconnectTimersRef.current.set(tv.roomId, timerId);
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };
    });

    return () => {
      // Sockets are intentionally kept open across re-renders; the cleanup
      // path runs only when the component unmounts.
    };
  }, [tvs]);

  // Push lightweight mute control messages to all paired TVs whenever the
  // effective mute (master mute || per-widget mute) of a video widget
  // changes. Avoids the user having to remember to "Push" again just to
  // mute. Only diffs are sent; no message goes out on first render.
  const prevMutesRef = useRef<Record<string, boolean> | null>(null);
  useEffect(() => {
    const videoMutes: Record<string, boolean> = {};
    widgets.forEach((w) => {
      if (w.type === "video") {
        videoMutes[w.id] = !!(masterMute || w.isMuted);
      }
    });
    const prev = prevMutesRef.current;
    prevMutesRef.current = videoMutes;
    if (prev === null) return;
    const changed: Record<string, boolean> = {};
    let any = false;
    for (const id in videoMutes) {
      if (prev[id] !== videoMutes[id]) {
        changed[id] = videoMutes[id];
        any = true;
      }
    }
    if (!any) return;
    const payload = JSON.stringify({ type: "control", videoMutes: changed });
    socketsRef.current.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(payload);
        } catch {
          /* ignore */
        }
      }
    });
  }, [widgets, masterMute]);

  // On open, refresh last-pushed timestamps from the server. Online state
  // comes from the WS, not from this HTTP probe.
  useEffect(() => {
    if (!open || tvs.length === 0) return;
    let cancelled = false;
    (async () => {
      await Promise.all(
        tvs.map(async (tv) => {
          try {
            const res = await fetch(`/api/cast/rooms/${tv.roomId}`);
            if (cancelled) return;
            if (!res.ok) {
              if (res.status === 404) {
                setTVs((prev) => prev.filter((p) => p.roomId !== tv.roomId));
              }
              return;
            }
            const data = await res.json();
            setMeta((m) => ({
              ...m,
              [tv.roomId]: {
                ...(m[tv.roomId] ?? { online: false }),
                online:
                  typeof data.tvOnline === "boolean"
                    ? data.tvOnline
                    : (m[tv.roomId]?.online ?? false),
                lastPushedAt: data.lastPushedAt
                  ? new Date(data.lastPushedAt).getTime()
                  : undefined,
                lastSeenAt:
                  typeof data.lastSeenAt === "number"
                    ? data.lastSeenAt
                    : m[tv.roomId]?.lastSeenAt,
              },
            }));
          } catch {
            /* ignore */
          }
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tvs]);

  // Tear down all sockets and pending reconnect timers on unmount.
  useEffect(() => {
    return () => {
      reconnectTimersRef.current.forEach((id) => window.clearTimeout(id));
      reconnectTimersRef.current.clear();
      socketsRef.current.forEach((ws) => {
        try {
          ws.onclose = null;
          ws.close();
        } catch {
          /* ignore */
        }
      });
      socketsRef.current.clear();
    };
  }, []);

  async function handlePair(): Promise<void> {
    const trimmed = code.replace(/\D/g, "").slice(0, 6);
    if (trimmed.length !== 6) {
      setPairError("Enter all 6 digits.");
      return;
    }
    setPairError(null);
    setPairing(true);
    try {
      const res = await apiRequest("POST", "/api/cast/pair", { code: trimmed });
      const data = await res.json();
      if (!data?.roomId) throw new Error("No room returned");
      setTVs((prev) => {
        if (prev.some((p) => p.roomId === data.roomId)) return prev;
        return [
          ...prev,
          { roomId: data.roomId, label: data.label || "TV", pairedAt: Date.now() },
        ];
      });
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
      await apiRequest("POST", `/api/cast/rooms/${roomId}/push`, { snapshot });
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
    let ok = 0;
    let fail = 0;
    await Promise.all(
      tvs.map(async (tv) => {
        try {
          await apiRequest("POST", `/api/cast/rooms/${tv.roomId}/push`, { snapshot });
          ok++;
          setMeta((m) => ({
            ...m,
            [tv.roomId]: {
              ...(m[tv.roomId] ?? { online: true }),
              lastPushedAt: snapshot.pushedAt,
            },
          }));
        } catch {
          fail++;
        }
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
      await apiRequest("DELETE", `/api/cast/rooms/${roomId}`);
    } catch {
      /* ignore — local removal still happens below */
    }
    setTVs((prev) => prev.filter((p) => p.roomId !== roomId));
    toast({ title: "TV unpaired" });
  }

  async function handleRename(roomId: string): Promise<void> {
    const label = editLabel.trim().slice(0, 40);
    if (!label) {
      setEditingRoom(null);
      return;
    }
    try {
      await apiRequest("PATCH", `/api/cast/rooms/${roomId}`, { label });
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
          className={`absolute right-0 top-full mt-[0.4rem] w-[28rem] rounded-lg shadow-2xl border z-[10010] ${
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
              On your TV, open <span className="font-mono">openbento.tv/cast</span>{" "}
              and enter the 6-digit code shown.
            </p>
            <div className="flex gap-[0.5rem]">
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  if (pairError) setPairError(null);
                }}
                placeholder="123 456"
                inputMode="numeric"
                maxLength={6}
                className={`flex-1 h-[2.6rem] px-[0.8rem] rounded-md border text-[1.2rem] tracking-[0.3em] font-mono text-center ${
                  pairError
                    ? "border-red-500 ring-1 ring-red-500/40"
                    : isDarkMode
                      ? "border-slate-600"
                      : "border-gray-300"
                } ${
                  isDarkMode ? "bg-slate-800 text-white" : "bg-gray-50 text-gray-900"
                }`}
                data-testid="input-cast-code"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handlePair();
                }}
              />
              <button
                onClick={handlePair}
                disabled={pairing || code.length !== 6}
                className={`h-[2.6rem] px-[1rem] rounded-md font-semibold flex items-center gap-[0.4rem] ${
                  pairing || code.length !== 6
                    ? "bg-slate-600/60 cursor-not-allowed opacity-60"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
                data-testid="button-cast-pair"
              >
                {pairing ? (
                  <Loader2 className="w-[1rem] h-[1rem] animate-spin" />
                ) : (
                  <Plus className="w-[1rem] h-[1rem]" />
                )}
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
                              isDarkMode
                                ? "bg-slate-900 border-slate-600 text-white"
                                : "bg-white border-gray-300"
                            }`}
                            data-testid={`input-rename-${tv.roomId}`}
                          />
                        ) : (
                          <span className="font-semibold text-[1rem] flex-1 truncate">
                            {tv.label}
                          </span>
                        )}
                        <span
                          className={`inline-block w-[0.6rem] h-[0.6rem] rounded-full ${
                            m?.online ? "bg-emerald-500" : "bg-slate-500"
                          }`}
                          title={m?.online ? "Online" : "Offline"}
                          data-testid={`presence-${tv.roomId}`}
                        />
                      </div>
                      <div className={`text-[0.75rem] ${isDarkMode ? "text-slate-500" : "text-gray-500"}`}>
                        <span data-testid={`text-last-pushed-${tv.roomId}`}>
                          Last pushed: {timeAgo(m?.lastPushedAt)}
                        </span>
                        <span className="mx-[0.4rem]">·</span>
                        <span data-testid={`text-last-seen-${tv.roomId}`}>
                          Last seen: {m?.online ? "now" : timeAgo(m?.lastSeenAt)}
                        </span>
                      </div>
                      <div className="flex gap-[0.4rem]">
                        <button
                          onClick={() => handlePush(tv.roomId)}
                          disabled={pushingRoom === tv.roomId}
                          className="flex-1 h-[2.2rem] rounded bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[0.85rem] font-semibold flex items-center justify-center gap-[0.3rem] disabled:opacity-60"
                          data-testid={`button-push-${tv.roomId}`}
                        >
                          {pushingRoom === tv.roomId ? (
                            <Loader2 className="w-[0.9rem] h-[0.9rem] animate-spin" />
                          ) : (
                            <Send className="w-[0.9rem] h-[0.9rem]" />
                          )}
                          Push
                        </button>
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
                            onClick={() => {
                              setEditingRoom(tv.roomId);
                              setEditLabel(tv.label);
                            }}
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
        </div>
      )}
    </div>
  );
}
