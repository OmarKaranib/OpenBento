import { useState, useEffect, useCallback, useRef } from 'react';
import { X, AlertTriangle, Zap } from 'lucide-react';
import { Widget } from '@/App';

const GRID_COLS = 12;
const GRID_ROWS = 6;
const EXPANSION_INTERVAL = 10000;
const SPAWN_INTERVAL = 1800000;

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
  const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const triggerAdRef = useRef<() => void>(() => {});
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

  // Check if a widget overlaps with the ad's proposed new bounds
  const widgetOverlapsAdBounds = useCallback((widget: Widget, adBounds: { x: number; y: number; w: number; h: number }): boolean => {
    const overlapsX = widget.x < adBounds.x + adBounds.w && widget.x + widget.w > adBounds.x;
    const overlapsY = widget.y < adBounds.y + adBounds.h && widget.y + widget.h > adBounds.y;
    return overlapsX && overlapsY;
  }, []);

  // Find a new safe position for a widget, pushing it away from the ad
  const findSafePosition = useCallback((
    widget: Widget,
    adBounds: { x: number; y: number; w: number; h: number },
    otherWidgets: Widget[],
    excludeWidgetId: string
  ): Widget | null => {
    const isValidPosition = (candidate: Widget): boolean => {
      // Check grid bounds
      if (candidate.x < 0 || candidate.x + candidate.w > GRID_COLS) return false;
      if (candidate.y < 0 || candidate.y + candidate.h > GRID_ROWS) return false;
      // Check ad overlap
      if (widgetOverlapsAdBounds(candidate, adBounds)) return false;
      // Check widget overlap
      for (const other of otherWidgets) {
        if (other.id === excludeWidgetId) continue;
        const overlapsX = candidate.x < other.x + other.w && candidate.x + candidate.w > other.x;
        const overlapsY = candidate.y < other.y + other.h && candidate.y + candidate.h > other.y;
        if (overlapsX && overlapsY) return false;
      }
      return true;
    };

    // Calculate push direction based on ad center
    const adCenterX = adBounds.x + adBounds.w / 2;
    const adCenterY = adBounds.y + adBounds.h / 2;
    const widgetCenterX = widget.x + widget.w / 2;
    const widgetCenterY = widget.y + widget.h / 2;
    
    // Try moving in the direction away from ad (increasing distance)
    const moveDirections: { dx: number; dy: number }[] = [];
    if (widgetCenterX < adCenterX) moveDirections.push({ dx: -1, dy: 0 }); // Move left
    else moveDirections.push({ dx: 1, dy: 0 }); // Move right
    if (widgetCenterY < adCenterY) moveDirections.push({ dx: 0, dy: -1 }); // Move up
    else moveDirections.push({ dx: 0, dy: 1 }); // Move down
    // Add all directions for fallback
    moveDirections.push({ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 });
    moveDirections.push({ dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: -1 });

    // Try pushing widget 1-5 cells in each direction
    const tried = new Set<string>();
    for (let distance = 1; distance <= 5; distance++) {
      for (const dir of moveDirections) {
        const newX = widget.x + dir.dx * distance;
        const newY = widget.y + dir.dy * distance;
        const key = `${newX},${newY}`;
        if (tried.has(key)) continue;
        tried.add(key);
        
        const candidate = { ...widget, x: newX, y: newY };
        if (isValidPosition(candidate)) {
          return candidate;
        }
      }
    }

    // Try shrinking the widget if moving doesn't work
    const shrinkOptions: Widget[] = [];
    if (widget.w > 1) {
      shrinkOptions.push({ ...widget, w: widget.w - 1, x: widget.x + 1 }); // Shrink from left
      shrinkOptions.push({ ...widget, w: widget.w - 1 }); // Shrink from right
    }
    if (widget.h > 1) {
      shrinkOptions.push({ ...widget, h: widget.h - 1, y: widget.y + 1 }); // Shrink from top
      shrinkOptions.push({ ...widget, h: widget.h - 1 }); // Shrink from bottom
    }

    for (const shrunk of shrinkOptions) {
      if (isValidPosition(shrunk)) {
        return shrunk;
      }
      // Also try moving the shrunk widget
      for (let distance = 1; distance <= 3; distance++) {
        for (const dir of moveDirections) {
          const candidate = { ...shrunk, x: shrunk.x + dir.dx * distance, y: shrunk.y + dir.dy * distance };
          if (isValidPosition(candidate)) {
            return candidate;
          }
        }
      }
    }

    return null; // Cannot find safe position
  }, [widgetOverlapsAdBounds]);

  // Helper to check if two widgets overlap
  const widgetsOverlap = useCallback((a: Widget, b: Widget): boolean => {
    const overlapsX = a.x < b.x + b.w && a.x + a.w > b.x;
    const overlapsY = a.y < b.y + b.h && a.y + a.h > b.y;
    return overlapsX && overlapsY;
  }, []);

  // Final validation: check entire grid for any overlaps
  const validateGridState = useCallback((
    widgets: Widget[],
    adBounds: { x: number; y: number; w: number; h: number }
  ): boolean => {
    // Check no widget overlaps with ad
    for (const widget of widgets) {
      if (widgetOverlapsAdBounds(widget, adBounds)) {
        return false;
      }
    }
    // Check no widgets overlap with each other
    for (let i = 0; i < widgets.length; i++) {
      for (let j = i + 1; j < widgets.length; j++) {
        if (widgetsOverlap(widgets[i], widgets[j])) {
          return false;
        }
      }
    }
    // Check all widgets are within grid bounds
    for (const widget of widgets) {
      if (widget.x < 0 || widget.x + widget.w > GRID_COLS ||
          widget.y < 0 || widget.y + widget.h > GRID_ROWS) {
        return false;
      }
    }
    return true;
  }, [widgetOverlapsAdBounds, widgetsOverlap]);

  // Perform grid reflow - move all affected widgets when ad expands
  const performGridReflow = useCallback((
    newAdBounds: { x: number; y: number; w: number; h: number },
    currentWidgets: Widget[]
  ): { success: boolean; newWidgets: Widget[] } => {
    // Find all widgets that overlap with the new ad bounds
    const overlappingWidgets = currentWidgets.filter(w => widgetOverlapsAdBounds(w, newAdBounds));
    
    if (overlappingWidgets.length === 0) {
      // Validate grid is still clean
      if (!validateGridState(currentWidgets, newAdBounds)) {
        return { success: false, newWidgets: currentWidgets };
      }
      return { success: true, newWidgets: currentWidgets };
    }

    // Create a working copy of widgets
    let workingWidgets = [...currentWidgets];
    
    // Process each overlapping widget - use workingWidgets for current state
    for (const originalWidget of overlappingWidgets) {
      // Get the current version of this widget from working set
      const widget = workingWidgets.find(w => w.id === originalWidget.id);
      if (!widget) continue;
      
      // Skip if widget was already moved out of the way by a previous reflow
      if (!widgetOverlapsAdBounds(widget, newAdBounds)) continue;
      
      // Get current state of other widgets (excluding the one being processed)
      const otherWidgets = workingWidgets.filter(w => w.id !== widget.id);
      
      // Find a new safe position using current state of all other widgets
      const newPosition = findSafePosition(widget, newAdBounds, otherWidgets, widget.id);
      
      if (!newPosition) {
        // Cannot relocate this widget - expansion fails
        return { success: false, newWidgets: currentWidgets };
      }
      
      // Update working widgets with new position
      workingWidgets = workingWidgets.map(w => w.id === widget.id ? newPosition : w);
    }
    
    // Final validation: ensure no overlaps in the resulting grid
    if (!validateGridState(workingWidgets, newAdBounds)) {
      return { success: false, newWidgets: currentWidgets };
    }
    
    return { success: true, newWidgets: workingWidgets };
  }, [widgetOverlapsAdBounds, findSafePosition, validateGridState]);

  const expandAd = useCallback(() => {
    const currentAd = ad;
    if (!currentAd) return;
    
    const currentWidgets = widgetsRef.current;
    
    // Define possible expansion directions
    const expansionOptions: { x: number; y: number; w: number; h: number }[] = [];
    
    // Expand left (if possible)
    if (currentAd.x > 0) {
      expansionOptions.push({ x: currentAd.x - 1, y: currentAd.y, w: currentAd.w + 1, h: currentAd.h });
    }
    // Expand right
    if (currentAd.x + currentAd.w < GRID_COLS) {
      expansionOptions.push({ x: currentAd.x, y: currentAd.y, w: currentAd.w + 1, h: currentAd.h });
    }
    // Expand up
    if (currentAd.y > 0) {
      expansionOptions.push({ x: currentAd.x, y: currentAd.y - 1, w: currentAd.w, h: currentAd.h + 1 });
    }
    // Expand down
    if (currentAd.y + currentAd.h < GRID_ROWS) {
      expansionOptions.push({ x: currentAd.x, y: currentAd.y, w: currentAd.w, h: currentAd.h + 1 });
    }
    
    // Shuffle expansion options for randomness
    const shuffled = [...expansionOptions].sort(() => Math.random() - 0.5);
    
    for (const newBounds of shuffled) {
      // Try to perform grid reflow for this expansion
      const { success, newWidgets } = performGridReflow(newBounds, currentWidgets);
      
      if (success) {
        // Update widgets with new positions
        setWidgets(newWidgets);
        // Update ad with new bounds
        setAd({ ...currentAd, ...newBounds });
        return;
      }
    }
    
    // No valid expansion found - ad stays the same
  }, [ad, performGridReflow, setWidgets]);

  const triggerAd = useCallback(() => {
    if (isPremium) return;
    if (ad !== null) return;
    
    const currentWidgets = widgetsRef.current;
    const perimeterPositions = getPerimeterPositions();
    const shuffled = [...perimeterPositions].sort(() => Math.random() - 0.5);
    
    for (const pos of shuffled) {
      const newAdBounds = { x: pos.x, y: pos.y, w: 1, h: 1 };
      
      // Check if position is empty (no overlap with existing widgets)
      const occupation = isPositionOccupied(pos.x, pos.y, null, currentWidgets);
      
      if (!occupation.occupied) {
        // Position is free - spawn ad directly
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
      
      // Position is occupied - try grid reflow to make space
      const { success, newWidgets } = performGridReflow(newAdBounds, currentWidgets);
      
      if (success) {
        setWidgets(newWidgets);
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
  }, [isPremium, ad, isPositionOccupied, performGridReflow, setWidgets]);

  useEffect(() => {
    triggerAdRef.current = triggerAd;
  }, [triggerAd]);

  const skipAd = useCallback(() => {
    if (expansionTimerRef.current) {
      clearInterval(expansionTimerRef.current);
      expansionTimerRef.current = null;
    }
    setAd(null);
    if (spawnTimerRef.current) {
      clearTimeout(spawnTimerRef.current);
      spawnTimerRef.current = null;
    }
    spawnTimerRef.current = setTimeout(() => {
      triggerAdRef.current();
    }, SPAWN_INTERVAL);
  }, []);

  const isAdActive = ad !== null;

  useEffect(() => {
    if (isPremium) {
      setAd(null);
      if (expansionTimerRef.current) {
        clearInterval(expansionTimerRef.current);
        expansionTimerRef.current = null;
      }
      if (spawnTimerRef.current) {
        clearTimeout(spawnTimerRef.current);
        spawnTimerRef.current = null;
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
      if (spawnTimerRef.current) {
        clearTimeout(spawnTimerRef.current);
      }
    };
  }, []);

  return { ad, skipAd, triggerAd, isAdActive };
}
