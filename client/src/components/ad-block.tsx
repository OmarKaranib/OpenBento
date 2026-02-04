import { useState, useEffect, useCallback, useRef } from 'react';
import { X, AlertTriangle, Zap } from 'lucide-react';
import { Widget } from '@/App';

const GRID_COLS = 12;
const GRID_ROWS = 6;
const EXPANSION_INTERVAL = 5000;

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
  onSkip: () => void;
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
      className={`relative w-full h-full flex flex-col items-center justify-center overflow-hidden rounded-[12px] ${
        isDarkMode 
          ? 'bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 border-2 border-red-500/60 shadow-lg shadow-red-900/50' 
          : 'bg-gradient-to-br from-red-400 via-orange-400 to-yellow-400 border-3 border-red-600 shadow-xl shadow-red-500/40'
      }`}
      style={{
        gridColumn: `${ad.x + 1} / span ${ad.w}`,
        gridRow: `${ad.y + 1} / span ${ad.h}`,
        animation: 'pulse 2s ease-in-out infinite',
        zIndex: 100
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
        <AlertTriangle className={`w-8 h-8 mx-auto mb-2 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-900'} animate-bounce`} />
        <h3 className={`font-bold text-lg mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          Support OpenBento
        </h3>
        <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
          Upgrade to Pro to remove ads
        </p>
      </div>

      <div className="absolute bottom-2 right-2 z-20">
        {showSkipButton ? (
          <button
            onClick={() => onSkip()}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-white text-xs font-semibold rounded transition-all duration-200 border border-slate-600"
            data-testid="button-skip-ad"
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
  const [ad, setAd] = useState<AdBlockData | null>(null);
  const expansionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const widgetsRef = useRef(widgets);

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  const isPositionOccupied = useCallback((x: number, y: number, currentAd: AdBlockData | null, currentWidgets: Widget[]) => {
    if (currentAd) {
      if (x >= currentAd.x && x < currentAd.x + currentAd.w && y >= currentAd.y && y < currentAd.y + currentAd.h) {
        return { occupied: true, type: 'ad' as const, item: currentAd };
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
    currentAd: AdBlockData | null,
    excludeWidgetId: string
  ): boolean => {
    for (const other of allWidgets) {
      if (other.id === excludeWidgetId) continue;
      const overlapsX = newWidget.x < other.x + other.w && newWidget.x + newWidget.w > other.x;
      const overlapsY = newWidget.y < other.y + other.h && newWidget.y + newWidget.h > other.y;
      if (overlapsX && overlapsY) return true;
    }
    
    if (currentAd) {
      const overlapsX = newWidget.x < currentAd.x + currentAd.w && newWidget.x + newWidget.w > currentAd.x;
      const overlapsY = newWidget.y < currentAd.y + currentAd.h && newWidget.y + newWidget.h > currentAd.y;
      if (overlapsX && overlapsY) return true;
    }
    
    return false;
  }, []);

  const pushWidgetAway = useCallback((
    widget: Widget, 
    adPosition: { x: number; y: number },
    allWidgets: Widget[],
    currentAd: AdBlockData | null
  ): { newWidget: Widget; success: boolean } => {
    const isValidMove = (candidate: Widget): boolean => {
      if (candidate.x < 0 || candidate.x + candidate.w > GRID_COLS) return false;
      if (candidate.y < 0 || candidate.y + candidate.h > GRID_ROWS) return false;
      
      const adRect = { x: adPosition.x, y: adPosition.y, w: 1, h: 1 };
      const overlapsAd = candidate.x < adRect.x + adRect.w && candidate.x + candidate.w > adRect.x &&
                         candidate.y < adRect.y + adRect.h && candidate.y + candidate.h > adRect.y;
      if (overlapsAd) return false;
      
      return !checkWidgetOverlap(candidate, allWidgets, currentAd, widget.id);
    };
    
    const dx = adPosition.x - widget.x;
    const dy = adPosition.y - widget.y;
    
    const moveDirections = [];
    if (dx <= 0) moveDirections.push({ dx: 1, dy: 0 });
    if (dx >= 0) moveDirections.push({ dx: -1, dy: 0 });
    if (dy <= 0) moveDirections.push({ dx: 0, dy: 1 });
    if (dy >= 0) moveDirections.push({ dx: 0, dy: -1 });
    moveDirections.push({ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 });
    
    const tried = new Set<string>();
    for (const dir of moveDirections) {
      const key = `${dir.dx},${dir.dy}`;
      if (tried.has(key)) continue;
      tried.add(key);
      
      const candidate = { ...widget, x: widget.x + dir.dx, y: widget.y + dir.dy };
      if (isValidMove(candidate)) {
        return { newWidget: candidate, success: true };
      }
    }
    
    if (widget.w > 1) {
      const shrinkLeft = { ...widget, w: widget.w - 1, x: widget.x + 1 };
      const shrinkRight = { ...widget, w: widget.w - 1 };
      if (isValidMove(shrinkLeft)) return { newWidget: shrinkLeft, success: true };
      if (isValidMove(shrinkRight)) return { newWidget: shrinkRight, success: true };
    }
    
    if (widget.h > 1) {
      const shrinkTop = { ...widget, h: widget.h - 1, y: widget.y + 1 };
      const shrinkBottom = { ...widget, h: widget.h - 1 };
      if (isValidMove(shrinkTop)) return { newWidget: shrinkTop, success: true };
      if (isValidMove(shrinkBottom)) return { newWidget: shrinkBottom, success: true };
    }
    
    return { newWidget: widget, success: false };
  }, [checkWidgetOverlap]);

  const expandAd = useCallback(() => {
    setAd(currentAd => {
      if (!currentAd) return null;
      
      const currentWidgets = widgetsRef.current;
      const adjacentPositions = getAdjacentPositions(currentAd);
      const shuffled = [...adjacentPositions].sort(() => Math.random() - 0.5);
      
      for (const pos of shuffled) {
        const occupation = isPositionOccupied(pos.x, pos.y, currentAd, currentWidgets);
        
        if (!occupation.occupied) {
          if (pos.x === currentAd.x - 1 && pos.y >= currentAd.y && pos.y < currentAd.y + currentAd.h) {
            return { ...currentAd, x: currentAd.x - 1, w: currentAd.w + 1 };
          } else if (pos.x === currentAd.x + currentAd.w && pos.y >= currentAd.y && pos.y < currentAd.y + currentAd.h) {
            return { ...currentAd, w: currentAd.w + 1 };
          } else if (pos.y === currentAd.y - 1 && pos.x >= currentAd.x && pos.x < currentAd.x + currentAd.w) {
            return { ...currentAd, y: currentAd.y - 1, h: currentAd.h + 1 };
          } else if (pos.y === currentAd.y + currentAd.h && pos.x >= currentAd.x && pos.x < currentAd.x + currentAd.w) {
            return { ...currentAd, h: currentAd.h + 1 };
          }
        }
        
        if (occupation.type === 'widget' && occupation.item) {
          const widget = occupation.item as Widget;
          const { newWidget, success } = pushWidgetAway(widget, pos, currentWidgets, currentAd);
          
          if (success) {
            setWidgets(widgets => 
              widgets.map(w => w.id === widget.id ? newWidget : w)
            );
            
            if (pos.x === currentAd.x - 1 && pos.y >= currentAd.y && pos.y < currentAd.y + currentAd.h) {
              return { ...currentAd, x: currentAd.x - 1, w: currentAd.w + 1 };
            } else if (pos.x === currentAd.x + currentAd.w && pos.y >= currentAd.y && pos.y < currentAd.y + currentAd.h) {
              return { ...currentAd, w: currentAd.w + 1 };
            } else if (pos.y === currentAd.y - 1 && pos.x >= currentAd.x && pos.x < currentAd.x + currentAd.w) {
              return { ...currentAd, y: currentAd.y - 1, h: currentAd.h + 1 };
            } else if (pos.y === currentAd.y + currentAd.h && pos.x >= currentAd.x && pos.x < currentAd.x + currentAd.w) {
              return { ...currentAd, h: currentAd.h + 1 };
            }
          }
        }
      }
      
      return currentAd;
    });
  }, [isPositionOccupied, pushWidgetAway, setWidgets]);

  const triggerAd = useCallback(() => {
    if (isPremium) return;
    if (ad !== null) return;
    
    const currentWidgets = widgetsRef.current;
    const perimeterPositions = getPerimeterPositions();
    const shuffled = [...perimeterPositions].sort(() => Math.random() - 0.5);
    
    for (const pos of shuffled) {
      const occupation = isPositionOccupied(pos.x, pos.y, null, currentWidgets);
      
      if (!occupation.occupied) {
        const newAd: AdBlockData = {
          id: `ad-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          x: pos.x,
          y: pos.y,
          w: 1,
          h: 1,
          createdAt: Date.now()
        };
        setAd(newAd);
        return;
      }
      
      if (occupation.type === 'widget' && occupation.item) {
        const widget = occupation.item as Widget;
        const { newWidget, success } = pushWidgetAway(widget, pos, currentWidgets, null);
        
        if (success) {
          setWidgets(widgets => 
            widgets.map(w => w.id === widget.id ? newWidget : w)
          );
          
          const newAd: AdBlockData = {
            id: `ad-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            x: pos.x,
            y: pos.y,
            w: 1,
            h: 1,
            createdAt: Date.now()
          };
          setAd(newAd);
          return;
        }
      }
    }
  }, [isPremium, ad, isPositionOccupied, pushWidgetAway, setWidgets]);

  const skipAd = useCallback(() => {
    if (expansionTimerRef.current) {
      clearInterval(expansionTimerRef.current);
      expansionTimerRef.current = null;
    }
    setAd(null);
  }, []);

  const isAdActive = ad !== null;

  useEffect(() => {
    if (isPremium) {
      setAd(null);
      if (expansionTimerRef.current) {
        clearInterval(expansionTimerRef.current);
        expansionTimerRef.current = null;
      }
    }
  }, [isPremium]);

  useEffect(() => {
    if (expansionTimerRef.current) {
      clearInterval(expansionTimerRef.current);
      expansionTimerRef.current = null;
    }
    
    if (ad) {
      expansionTimerRef.current = setInterval(() => {
        expandAd();
      }, EXPANSION_INTERVAL);
    }
    
    return () => {
      if (expansionTimerRef.current) {
        clearInterval(expansionTimerRef.current);
        expansionTimerRef.current = null;
      }
    };
  }, [ad, expandAd]);

  useEffect(() => {
    return () => {
      if (expansionTimerRef.current) {
        clearInterval(expansionTimerRef.current);
      }
    };
  }, []);

  return { ad, skipAd, triggerAd, isAdActive };
}
