// TV-side cast page: shows a 6-digit pair code while unpaired, then locks
// itself to displaying snapshots pushed from a paired laptop.
import { useEffect, useMemo, useRef, useState } from "react";
import { Cast, Tv2, Wifi, WifiOff, Trash2 } from "lucide-react";
import { WidgetRenderer, type Widget } from "@/App";
import type { CastSnapshot } from "@shared/schema";

const ROOM_KEY = "openBentoCastRoomId";
const LABEL_KEY = "openBentoCastLabel";
const GRID_COLS = 12;
const GRID_ROWS = 6;

interface PairingState {
  code: string;
  roomId: string;
  expiresAt: number;
}

function getRoomId(): string | null {
  try {
    return localStorage.getItem(ROOM_KEY);
  } catch {
    return null;
  }
}
function setRoomId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ROOM_KEY, id);
    else localStorage.removeItem(ROOM_KEY);
  } catch {
    /* ignore */
  }
}
function getLabel(): string {
  try {
    return localStorage.getItem(LABEL_KEY) || "TV";
  } catch {
    return "TV";
  }
}
function setLabel(label: string): void {
  try {
    localStorage.setItem(LABEL_KEY, label);
  } catch {
    /* ignore */
  }
}

function VideoCastRender({ widget, masterMute }: { widget: Widget; masterMute: boolean }) {
  const muted = masterMute || widget.isMuted;
  const src = useMemo(() => buildEmbedUrl(widget, muted), [widget, muted]);
  if (!src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500 text-sm">
        No stream
      </div>
    );
  }
  return (
    <iframe
      src={src}
      title={widget.channelName || widget.id}
      className="w-full h-full"
      style={{ border: 0, pointerEvents: "none" }}
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  );
}

function buildEmbedUrl(widget: Widget, muted: boolean): string | null {
  const muteFlag = muted ? 1 : 0;
  const parent = typeof window !== "undefined" ? window.location.hostname : "openbento.tv";
  if (widget.isYouTube || widget.videoId) {
    const id = widget.verifiedLiveId || widget.videoId || widget.latestVideoId;
    if (!id) return null;
    return `https://www.youtube.com/embed/${id}?autoplay=1&mute=${muteFlag}&playsinline=1&rel=0&modestbranding=1&controls=0`;
  }
  if (widget.isTwitch || widget.twitchChannel) {
    const ch = widget.twitchChannel;
    if (!ch) return null;
    return `https://player.twitch.tv/?channel=${encodeURIComponent(ch)}&parent=${parent}&muted=${muted ? "true" : "false"}&autoplay=true`;
  }
  if (widget.isKick || widget.kickChannel) {
    const ch = widget.kickChannel;
    if (!ch) return null;
    return `https://player.kick.com/${encodeURIComponent(ch)}?autoplay=true&muted=${muted ? "true" : "false"}`;
  }
  return null;
}

function NoteCastRender({ widget }: { widget: Widget }) {
  const text = widget.noteContent || "";
  return (
    <div
      className="w-full h-full p-[1.2rem] overflow-auto"
      style={{
        background: widget.customColor || "rgba(15,23,42,0.6)",
        color: "#f1f5f9",
        whiteSpace: "pre-wrap",
        fontSize: "1.1rem",
        lineHeight: 1.45,
      }}
    >
      {text || <span className="opacity-50">Empty note</span>}
    </div>
  );
}

function ImageCastRender({ widget }: { widget: Widget }) {
  return (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center overflow-hidden">
      {widget.imageUrl ? (
        <img src={widget.imageUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-slate-500">No image</span>
      )}
    </div>
  );
}

function CastWidgetCell({ widget, masterMute }: { widget: Widget; masterMute: boolean }) {
  const style: React.CSSProperties = {
    gridColumn: `${widget.x + 1} / span ${Math.min(widget.w, GRID_COLS - widget.x)}`,
    gridRow: `${widget.y + 1} / span ${Math.min(widget.h, GRID_ROWS - widget.y)}`,
    backgroundColor: widget.customColor,
    overflow: "hidden",
    position: "relative",
  };

  let inner: React.ReactNode;
  switch (widget.type) {
    case "video":
      inner = <VideoCastRender widget={widget} masterMute={masterMute} />;
      break;
    case "note":
      inner = <NoteCastRender widget={widget} />;
      break;
    case "image":
      inner = <ImageCastRender widget={widget} />;
      break;
    case "spacer":
      inner = <div className="w-full h-full" />;
      break;
    default: {
      const node = WidgetRenderer({
        widget,
        onToggle24Hour: () => {},
        onColorChange: () => {},
        onUpdate: () => {},
      });
      inner = node || (
        <div className="w-full h-full flex items-center justify-center text-slate-500">
          {widget.type}
        </div>
      );
    }
  }

  return (
    <div
      className="dashboard-slot border-2 border-slate-700/60 shadow-xl rounded-[12px]"
      style={style}
      data-testid={`cast-widget-${widget.id}`}
    >
      {inner}
    </div>
  );
}

export default function CastPage() {
  const [roomId, setRoomIdState] = useState<string | null>(() => getRoomId());
  const [pairing, setPairing] = useState<PairingState | null>(null);
  const [snapshot, setSnapshot] = useState<CastSnapshot | null>(null);
  const [label, setLabelState] = useState<string>(() => getLabel());
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState<number>(Date.now());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const codeTimerRef = useRef<number | null>(null);
  const codeRetryRef = useRef<number | null>(null);
  const forgetHoldRef = useRef<number | null>(null);
  // Mirror live pairing state into a ref so closures inside ws callbacks
  // don't capture stale values when a code rotates.
  const pairingRef = useRef<PairingState | null>(null);
  const cursorTimerRef = useRef<number | null>(null);
  const [forgetProgress, setForgetProgress] = useState(0);
  const [cursorIdle, setCursorIdle] = useState(false);

  // Idle-hide the cursor after 3s of mouse inactivity for a clean TV display.
  useEffect(() => {
    function ping() {
      setCursorIdle(false);
      if (cursorTimerRef.current) window.clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = window.setTimeout(() => setCursorIdle(true), 3000);
    }
    ping();
    window.addEventListener("mousemove", ping);
    window.addEventListener("touchstart", ping);
    return () => {
      window.removeEventListener("mousemove", ping);
      window.removeEventListener("touchstart", ping);
      if (cursorTimerRef.current) window.clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = null;
    };
  }, []);

  useEffect(() => {
    pairingRef.current = pairing;
  }, [pairing]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  async function fetchNewCode(): Promise<void> {
    if (codeRetryRef.current) {
      window.clearTimeout(codeRetryRef.current);
      codeRetryRef.current = null;
    }
    try {
      const res = await fetch("/api/cast/codes", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPairing({
        code: data.code,
        roomId: data.roomId,
        expiresAt: data.expiresAt,
      });
      openSocket(data.roomId);
    } catch (err) {
      console.error("[Cast] code fetch failed", err);
      if (codeRetryRef.current) window.clearTimeout(codeRetryRef.current);
      codeRetryRef.current = window.setTimeout(fetchNewCode, 5000);
    }
  }

  useEffect(() => {
    if (roomId) return;
    fetchNewCode();
    codeTimerRef.current = window.setInterval(() => {
      if (!getRoomId()) fetchNewCode();
    }, 60_000);
    return () => {
      if (codeTimerRef.current) window.clearInterval(codeTimerRef.current);
      codeTimerRef.current = null;
      if (codeRetryRef.current) window.clearTimeout(codeRetryRef.current);
      codeRetryRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    openSocket(roomId);
    return () => {
      closeSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  function openSocket(rid: string): void {
    closeSocket();
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}/ws/cast?roomId=${encodeURIComponent(rid)}&role=tv`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectRef.current) {
        window.clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg.type === "paired") {
          setRoomId(msg.roomId);
          setRoomIdState(msg.roomId);
          if (msg.label) {
            setLabel(msg.label);
            setLabelState(msg.label);
          }
          setPairing(null);
          if (codeTimerRef.current) {
            window.clearInterval(codeTimerRef.current);
            codeTimerRef.current = null;
          }
        } else if (msg.type === "snapshot" && msg.snapshot) {
          // Monotonic guard: ignore older snapshots that arrive after a newer
          // one (e.g. a DB-replay landing after a fresh /push during connect).
          const next = msg.snapshot as CastSnapshot;
          setSnapshot((prev) => {
            if (prev && typeof next.pushedAt === "number" && next.pushedAt <= prev.pushedAt) {
              return prev;
            }
            return next;
          });
        } else if (msg.type === "renamed" && typeof msg.label === "string") {
          setLabel(msg.label);
          setLabelState(msg.label);
        } else if (msg.type === "closed") {
          setRoomId(null);
          setRoomIdState(null);
          setSnapshot(null);
        }
      } catch (err) {
        console.warn("[Cast] WS message parse failed", err);
      }
    };
    ws.onclose = () => {
      setConnected(false);
      // Decide retry from refs (not captured state) so a code rotation or
      // pair event between connect and close doesn't strand us. Only retry
      // if `rid` is still the room we care about.
      const persistedId = getRoomId();
      const pendingPair = pairingRef.current;
      const stillRelevant = persistedId === rid || pendingPair?.roomId === rid;
      const nextTarget = persistedId || pendingPair?.roomId || null;
      if (stillRelevant && nextTarget) {
        if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
        reconnectRef.current = window.setTimeout(() => {
          reconnectRef.current = null;
          const t = getRoomId() || pairingRef.current?.roomId;
          if (t) openSocket(t);
        }, 2500);
      }
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }

  function closeSocket(): void {
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      try {
        ws.onclose = null;
        ws.close();
      } catch {
        /* ignore */
      }
    }
    if (reconnectRef.current) {
      window.clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
  }

  function startForget(): void {
    forgetHoldRef.current = window.setInterval(() => {
      const start = forgetHoldStartRef.current;
      if (!start) return;
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / 1500) * 100, 100);
      setForgetProgress(pct);
      if (pct >= 100) doForget();
    }, 50);
    forgetHoldStartRef.current = Date.now();
  }
  function endForget(): void {
    if (forgetHoldRef.current) window.clearInterval(forgetHoldRef.current);
    forgetHoldRef.current = null;
    forgetHoldStartRef.current = null;
    setForgetProgress(0);
  }
  function doForget(): void {
    endForget();
    const rid = getRoomId();
    if (rid) {
      fetch(`/api/cast/rooms/${encodeURIComponent(rid)}`, { method: "DELETE" }).catch(
        () => {},
      );
    }
    setRoomId(null);
    setRoomIdState(null);
    setSnapshot(null);
    setPairing(null);
  }
  const forgetHoldStartRef = useRef<number | null>(null);

  if (!roomId) {
    const code = pairing?.code ?? "------";
    const remaining = pairing
      ? Math.max(0, Math.ceil((pairing.expiresAt - now) / 1000))
      : 0;
    return (
      <div
        className="w-screen h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-[2rem]"
        data-testid="cast-pairing-screen"
      >
        <Tv2 className="w-[6rem] h-[6rem] text-cyan-400 mb-[1.5rem]" />
        <h1 className="text-[3rem] font-bold mb-[0.5rem]">Cast to this TV</h1>
        <p className="text-[1.4rem] text-slate-400 mb-[2rem]">
          On your laptop, click <span className="font-bold text-cyan-300">Cast</span> in the menu bar and enter:
        </p>
        <div
          className="font-mono text-[8rem] tracking-[0.3em] font-bold text-cyan-300 select-all"
          data-testid="text-cast-code"
        >
          {code.split("").join(" ")}
        </div>
        <p className="text-[1.1rem] text-slate-500 mt-[1.5rem]">
          {pairing ? `New code in ${remaining}s` : "Generating code…"}
        </p>
        <div className="flex items-center gap-[0.5rem] mt-[2rem] text-slate-400">
          {connected ? (
            <>
              <Wifi className="w-[1.2rem] h-[1.2rem] text-emerald-400" />
              <span>Listening for pairing</span>
            </>
          ) : (
            <>
              <WifiOff className="w-[1.2rem] h-[1.2rem] text-amber-400" />
              <span>Connecting…</span>
            </>
          )}
        </div>
      </div>
    );
  }

  // Paired view
  const widgets = (snapshot?.widgets ?? []) as unknown as Widget[];
  const isDark = snapshot?.isDarkMode ?? true;
  const masterMute = snapshot?.masterMute ?? true;
  const background = snapshot?.background || (isDark ? "#0f172a" : "#F8F9FA");

  return (
    <div
      className="w-screen h-screen overflow-hidden flex flex-col relative"
      style={{
        background,
        color: isDark ? "#f1f5f9" : "#1A1A1A",
        cursor: cursorIdle ? "none" : "default",
      }}
      data-testid="cast-paired-screen"
    >
      {/* Always-visible label badge so it's clear which TV this is. */}
      <div
        className={`absolute bottom-[1rem] right-[1rem] z-40 flex items-center gap-[0.4rem] px-[0.7rem] py-[0.3rem] rounded-full text-[0.8rem] font-semibold shadow-md backdrop-blur-md transition-opacity duration-500 pointer-events-none ${
          isDark ? "bg-slate-900/60 text-slate-300" : "bg-white/70 text-gray-700"
        } ${cursorIdle ? "opacity-30" : "opacity-90"}`}
        data-testid="badge-tv-label"
      >
        <Cast className="w-[0.85rem] h-[0.85rem]" />
        <span>{label}</span>
        <span
          className={`inline-block w-[0.45rem] h-[0.45rem] rounded-full ${
            connected ? "bg-emerald-400" : "bg-amber-400"
          }`}
        />
      </div>
      <div
        className="absolute top-0 left-0 right-0 z-50 group"
        style={{ height: "2.4rem" }}
      >
        <div
          className={`flex items-center justify-between px-[1rem] py-[0.4rem] text-[0.85rem] backdrop-blur-md transition-opacity duration-300 ${
            isDark ? "bg-slate-900/80 text-slate-300" : "bg-white/80 text-gray-700"
          } opacity-0 group-hover:opacity-100`}
        >
          <span className="flex items-center gap-[0.5rem]">
            <Cast className="w-[1rem] h-[1rem]" /> {label} •{" "}
            {connected ? (
              <span className="text-emerald-400">connected</span>
            ) : (
              <span className="text-amber-400">reconnecting</span>
            )}
            {snapshot && (
              <span className="opacity-60">
                • last push {Math.max(0, Math.floor((now - snapshot.pushedAt) / 1000))}s ago
              </span>
            )}
          </span>
          <button
            onMouseDown={startForget}
            onMouseUp={endForget}
            onMouseLeave={endForget}
            onTouchStart={startForget}
            onTouchEnd={endForget}
            className="relative flex items-center gap-[0.4rem] px-[0.6rem] py-[0.3rem] rounded bg-red-600/80 hover:bg-red-500 text-white font-semibold overflow-hidden"
            title="Hold to unpair"
            data-testid="button-cast-forget"
          >
            <div
              className="absolute inset-0 bg-red-800"
              style={{ width: `${forgetProgress}%`, transition: "none" }}
            />
            <Trash2 className="w-[0.9rem] h-[0.9rem] relative z-10" />
            <span className="relative z-10">Hold to forget</span>
          </button>
        </div>
      </div>

      {snapshot ? (
        <div
          className="flex-1 grid gap-[1rem] p-[1rem]"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
            gridAutoFlow: "dense",
            // TV is read-only: block all interaction with widgets so the
            // remote/laptop is always the source of truth. Forget button +
            // status bar live above this grid in z-order with their own
            // pointer-events.
            pointerEvents: "none",
          }}
          data-testid="cast-grid"
        >
          {widgets.map((w) => (
            <CastWidgetCell key={w.id} widget={w} masterMute={masterMute} />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-[1rem]">
          <Cast className="w-[5rem] h-[5rem] text-fuchsia-400" />
          <h2 className="text-[2rem] font-bold">{label} is paired</h2>
          <p className="text-[1.2rem] text-slate-400">
            Waiting for the first push from your laptop…
          </p>
          <div className="text-[0.9rem] text-slate-500 mt-[1rem]">
            {connected ? "Connected" : "Reconnecting…"}
          </div>
        </div>
      )}
    </div>
  );
}
