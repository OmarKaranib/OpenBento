import { useState, useEffect, useCallback, useRef } from 'react';
import { X, AlertTriangle, Zap } from 'lucide-react';
import { Widget } from '@/App';

const GRID_COLS = 12;
const GRID_ROWS = 6;
const EXPANSION_INTERVAL = 5000;
const AD_SPAWN_INTERVAL = 45000;

export interface AdBlockData {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  createdAt: number;
}

interface AdBlockProps {
  ad: AdBlockData;
  onSkip: (adId: string) => void;
  isDarkMode?: boolean;
}

export function AdBlock({ ad, onSkip, isDarkMode = true }: AdBlockProps) {
  const [showSkipButton, setShowSkipButton] = useState(false);
  const [skipCountdown, setSkipCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setSkipCountdown(prev => {
        if (prev <= 1) {
          setShowSkipButton(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className={`relative w-full h-full flex flex-col items-center justify-center overflow-hidden ${
        isDarkMode 
          ? 'bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 border-2 border-red-500/60' 
          : 'bg-gradient-to-br from-red-200 via-orange-200 to-yellow-200 border-2 border-red-400/60'
      }`}
      style={{
        gridColumn: `${ad.x + 1} / span ${ad.w}`,
        gridRow: `${ad.y + 1} / span ${ad.h}`,
        animation: 'pulse 2s ease-in-out infinite'
      }}
      data-testid={`ad-block-${ad.id}`}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-full h-full" 
            style={{
              background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)'
            }}
          />
        </div>
      </div>

      <div className="relative z-10 text-center p-4">
        <AlertTriangle className={`w-8 h-8 mx-auto mb-2 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'} animate-bounce`} />
        <h3 className={`font-bold text-lg mb-1 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
          Support OpenBento
        </h3>
        <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
          Upgrade to Pro to remove ads
        </p>
      </div>

      <div className="absolute bottom-2 right-2 z-20">
        {showSkipButton ? (
          <button
            onClick={() => onSkip(ad.id)}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-white text-xs font-semibold rounded transition-all duration-200 border border-slate-600"
            data-testid={`button-skip-ad-${ad.id}`}
          >
            <X className="w-3 h-3" />
            Skip Ad
          </button>
        ) : (
          <div className={`px-3 py-1.5 text-xs font-medium rounded ${isDarkMode ? 'bg-slate-800/80 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>
            Skip in {skipCountdown}s
          </div>
        )}
      </div>

      <div className="absolute top-2 left-2 z-20">
        <div className={`flex items-center gap-1 px-2 py-1 text-xs font-bold rounded ${isDarkMode ? 'bg-red-600 text-white' : 'bg-red-500 text-white'}`}>
          <Zap className="w-3 h-3" />
          AD
        </div>
      </div>
    </div>
  );
}

function getPerimeterPositions(): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  
  for (let x = 0; x < GRID_COLS; x++) {
    positions.push({ x, y: 0 });
    positions.push({ x, y: GRID_ROWS - 1 });
  }
  for (let y = 1; y < GRID_ROWS - 1; y++) {
    positions.push({ x: 0, y });
    positions.push({ x: GRID_COLS - 1, y });
  }
  
  return positions;
}

function getAdjacentPositions(ad: AdBlockData): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  
  for (let dx = -1; dx <= ad.w; dx++) {
    const topY = ad.y - 1;
    const bottomY = ad.y + ad.h;
    if (topY >= 0) positions.push({ x: ad.x + dx, y: topY });
    if (bottomY < GRID_ROWS) positions.push({ x: ad.x + dx, y: bottomY });
  }
  
  for (let dy = 0; dy < ad.h; dy++) {
    const leftX = ad.x - 1;
    const rightX = ad.x + ad.w;
    if (leftX >= 0) positions.push({ x: leftX, y: ad.y + dy });
    if (rightX < GRID_COLS) positions.push({ x: rightX, y: ad.y + dy });
  }
  
  return positions.filter(p => p.x >= 0 && p.x < GRID_COLS && p.y >= 0 && p.y < GRID_ROWS);
}

export function useViralAds(
  isPremium: boolean,
  widgets: Widget[],
  setWidgets: React.Dispatch<React.SetStateAction<Widget[]>>
) {
  const [ads, setAds] = useState<AdBlockData[]>([]);
  const expansionTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isPositionOccupied = useCallback((x: number, y: number, currentAds: AdBlockData[], currentWidgets: Widget[]) => {
    for (const ad of currentAds) {
      if (x >= ad.x && x < ad.x + ad.w && y >= ad.y && y < ad.y + ad.h) {
        return { occupied: true, type: 'ad' as const, item: ad };
      }
    }
    
    for (const widget of currentWidgets) {
      if (x >= widget.x && x < widget.x + widget.w && y >= widget.y && y < widget.y + widget.h) {
        return { occupied: true, type: 'widget' as const, item: widget };
      }
    }
    
    return { occupied: false, type: null, item: null };
  }, []);

  const checkWidgetOverlap = useCallback((
    newWidget: Widget, 
    allWidgets: Widget[], 
    allAds: AdBlockData[],
    excludeWidgetId: string
  ): boolean => {
    for (const other of allWidgets) {
      if (other.id === excludeWidgetId) continue;
      const overlapsX = newWidget.x < other.x + other.w && newWidget.x + newWidget.w > other.x;
      const overlapsY = newWidget.y < other.y + other.h && newWidget.y + newWidget.h > other.y;
      if (overlapsX && overlapsY) return true;
    }
    
    for (const ad of allAds) {
      const overlapsX = newWidget.x < ad.x + ad.w && newWidget.x + newWidget.w > ad.x;
      const overlapsY = newWidget.y < ad.y + ad.h && newWidget.y + newWidget.h > ad.y;
      if (overlapsX && overlapsY) return true;
    }
    
    return false;
  }, []);

  const shrinkWidget = useCallback((
    widget: Widget, 
    expandingFrom: { x: number; y: number },
    allWidgets: Widget[],
    allAds: AdBlockData[]
  ): { newWidget: Widget; cellFreed: boolean } => {
    const targetX = expandingFrom.x;
    const targetY = expandingFrom.y;
    
    const widgetCoversCell = (w: Widget) => 
      targetX >= w.x && targetX < w.x + w.w && targetY >= w.y && targetY < w.y + w.h;
    
    const isValidMove = (candidate: Widget): boolean => {
      if (candidate.x < 0 || candidate.x + candidate.w > GRID_COLS) return false;
      if (candidate.y < 0 || candidate.y + candidate.h > GRID_ROWS) return false;
      return !checkWidgetOverlap(candidate, allWidgets, allAds, widget.id);
    };
    
    if (widget.w > 1) {
      if (expandingFrom.x < widget.x + widget.w / 2) {
        const candidate = { ...widget, w: widget.w - 1, x: widget.x + 1 };
        if (isValidMove(candidate) && !widgetCoversCell(candidate)) {
          return { newWidget: candidate, cellFreed: true };
        }
      } else {
        const candidate = { ...widget, w: widget.w - 1 };
        if (isValidMove(candidate) && !widgetCoversCell(candidate)) {
          return { newWidget: candidate, cellFreed: true };
        }
      }
    } 
    
    if (widget.h > 1) {
      if (expandingFrom.y < widget.y + widget.h / 2) {
        const candidate = { ...widget, h: widget.h - 1, y: widget.y + 1 };
        if (isValidMove(candidate) && !widgetCoversCell(candidate)) {
          return { newWidget: candidate, cellFreed: true };
        }
      } else {
        const candidate = { ...widget, h: widget.h - 1 };
        if (isValidMove(candidate) && !widgetCoversCell(candidate)) {
          return { newWidget: candidate, cellFreed: true };
        }
      }
    }
    
    const moveDirections = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 }
    ];
    
    for (const { dx, dy } of moveDirections) {
      const newX = widget.x + dx;
      const newY = widget.y + dy;
      const candidate = { ...widget, x: newX, y: newY };
      if (isValidMove(candidate) && !widgetCoversCell(candidate)) {
        return { newWidget: candidate, cellFreed: true };
      }
    }
    
    return { newWidget: widget, cellFreed: false };
  }, [checkWidgetOverlap]);

  const expandAd = useCallback((adId: string) => {
    setAds(currentAds => {
      const ad = currentAds.find(a => a.id === adId);
      if (!ad) return currentAds;
      
      const adjacentPositions = getAdjacentPositions(ad);
      const shuffled = [...adjacentPositions].sort(() => Math.random() - 0.5);
      
      for (const pos of shuffled) {
        const occupation = isPositionOccupied(pos.x, pos.y, currentAds, widgets);
        
        if (!occupation.occupied) {
          if (pos.x === ad.x - 1 && pos.y >= ad.y && pos.y < ad.y + ad.h) {
            return currentAds.map(a => a.id === adId ? { ...a, x: a.x - 1, w: a.w + 1 } : a);
          } else if (pos.x === ad.x + ad.w && pos.y >= ad.y && pos.y < ad.y + ad.h) {
            return currentAds.map(a => a.id === adId ? { ...a, w: a.w + 1 } : a);
          } else if (pos.y === ad.y - 1 && pos.x >= ad.x && pos.x < ad.x + ad.w) {
            return currentAds.map(a => a.id === adId ? { ...a, y: a.y - 1, h: a.h + 1 } : a);
          } else if (pos.y === ad.y + ad.h && pos.x >= ad.x && pos.x < ad.x + ad.w) {
            return currentAds.map(a => a.id === adId ? { ...a, h: a.h + 1 } : a);
          } else {
            const newAd: AdBlockData = {
              id: `ad-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              x: pos.x,
              y: pos.y,
              w: 1,
              h: 1,
              createdAt: Date.now()
            };
            return [...currentAds, newAd];
          }
        }
        
        if (occupation.type === 'widget' && occupation.item) {
          const widget = occupation.item as Widget;
          const { newWidget, cellFreed } = shrinkWidget(widget, pos, widgets, currentAds);
          
          if (!cellFreed) {
            continue;
          }
          
          setWidgets(currentWidgets => 
            currentWidgets.map(w => w.id === widget.id ? newWidget : w)
          );
          
          if (pos.x === ad.x - 1 && pos.y >= ad.y && pos.y < ad.y + ad.h) {
            return currentAds.map(a => a.id === adId ? { ...a, x: a.x - 1, w: a.w + 1 } : a);
          } else if (pos.x === ad.x + ad.w && pos.y >= ad.y && pos.y < ad.y + ad.h) {
            return currentAds.map(a => a.id === adId ? { ...a, w: a.w + 1 } : a);
          } else if (pos.y === ad.y - 1 && pos.x >= ad.x && pos.x < ad.x + ad.w) {
            return currentAds.map(a => a.id === adId ? { ...a, y: a.y - 1, h: a.h + 1 } : a);
          } else if (pos.y === ad.y + ad.h && pos.x >= ad.x && pos.x < ad.x + ad.w) {
            return currentAds.map(a => a.id === adId ? { ...a, h: a.h + 1 } : a);
          }
        }
      }
      
      return currentAds;
    });
  }, [widgets, setWidgets, isPositionOccupied, shrinkWidget]);

  const spawnAd = useCallback(() => {
    if (isPremium) return;
    
    const perimeterPositions = getPerimeterPositions();
    const shuffled = [...perimeterPositions].sort(() => Math.random() - 0.5);
    
    setAds(currentAds => {
      for (const pos of shuffled) {
        const occupation = isPositionOccupied(pos.x, pos.y, currentAds, widgets);
        
        if (!occupation.occupied) {
          const newAd: AdBlockData = {
            id: `ad-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            x: pos.x,
            y: pos.y,
            w: 1,
            h: 1,
            createdAt: Date.now()
          };
          return [...currentAds, newAd];
        }
      }
      return currentAds;
    });
  }, [isPremium, widgets, isPositionOccupied]);

  const skipAd = useCallback((adId: string) => {
    const timer = expansionTimersRef.current.get(adId);
    if (timer) {
      clearInterval(timer);
      expansionTimersRef.current.delete(adId);
    }
    
    setAds(currentAds => currentAds.filter(ad => ad.id !== adId));
  }, []);

  useEffect(() => {
    if (isPremium) {
      setAds([]);
      expansionTimersRef.current.forEach(timer => clearInterval(timer));
      expansionTimersRef.current.clear();
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
        spawnTimerRef.current = null;
      }
      return;
    }
    
    const initialDelay = setTimeout(() => {
      spawnAd();
    }, 15000);
    
    spawnTimerRef.current = setInterval(spawnAd, AD_SPAWN_INTERVAL);
    
    return () => {
      clearTimeout(initialDelay);
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
      }
    };
  }, [isPremium, spawnAd]);

  useEffect(() => {
    expansionTimersRef.current.forEach(timer => clearInterval(timer));
    expansionTimersRef.current.clear();
    
    ads.forEach(ad => {
      const timer = setInterval(() => {
        expandAd(ad.id);
      }, EXPANSION_INTERVAL);
      expansionTimersRef.current.set(ad.id, timer);
    });
    
    return () => {
      expansionTimersRef.current.forEach(timer => clearInterval(timer));
      expansionTimersRef.current.clear();
    };
  }, [ads, expandAd]);

  useEffect(() => {
    return () => {
      expansionTimersRef.current.forEach(timer => clearInterval(timer));
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
      }
    };
  }, []);

  return { ads, skipAd };
}
