import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Heart, Coffee } from 'lucide-react';
import { Widget } from '@/App';

const GRID_COLS = 12;
const GRID_ROWS = 6;
const EXPANSION_INTERVAL = 10000;
const SPAWN_INTERVAL = 1800000; // 30 minutes

const DONATION_URL = 'https://buymeacoffee.com/openbento';
const AD_COOLDOWN_DAYS = 10; // Show ad once every 10 days
const LAST_AD_SEEN_KEY = 'last_ad_seen';

// ✅ FIXED AD SIZE: Always 3 columns × 2 rows
const AD_WIDTH = 3;
const AD_HEIGHT = 2;

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
      className={`relative flex flex-col items-center justify-center overflow-hidden rounded-[12px] ${
        isDarkMode 
          ? 'bg-gradient-to-br from-pink-900 via-purple-900 to-blue-900 border-2 border-pink-500/60 shadow-lg shadow-pink-900/50' 
          : 'bg-gradient-to-br from-pink-400 via-purple-400 to-blue-400 border-3 border-pink-600 shadow-xl shadow-pink-500/40'
      }`}
      style={{
        gridColumn: `${ad.x + 1} / span ${ad.w}`,
        gridRow: `${ad.y + 1} / span ${ad.h}`,
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
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

      <div className="relative z-10 text-center p-4 space-y-3">
        <Heart className={`w-8 h-8 mx-auto mb-2 ${isDarkMode ? 'text-pink-400' : 'text-pink-900'} animate-pulse`} />
        <h3 className={`font-bold text-base mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          OpenBento is free for everyone
        </h3>
        <p className={`text-xs leading-relaxed px-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
          If you find this tool useful, please consider a small donation to help us keep the servers running.
        </p>

        {/* Donation Button */}
        <a
          href={DONATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
            isDarkMode
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-lg'
              : 'bg-gradient-to-r from-pink-600 to-purple-700 hover:from-pink-700 hover:to-purple-800 text-white shadow-xl'
          }`}
          onClick={(e) => e.stopPropagation()}
          data-testid="button-donate-ad"
        >
          <Coffee className="w-4 h-4" />
          Buy Me a Coffee
        </a>
      </div>

      <div className="absolute bottom-2 right-2 z-20">
        {showSkipButton ? (
          <button
            onClick={() => onSkip()}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-white text-xs font-semibold rounded transition-all duration-200 border border-slate-600"
            data-testid="button-skip-ad"
          >
            <X className="w-3 h-3" />
            Close
          </button>
        ) : (
          <div className={`px-3 py-1.5 text-xs font-medium rounded ${isDarkMode ? 'bg-slate-800/80 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>
            Close in {skipCountdown}s
          </div>
        )}
      </div>

      <div className="absolute top-2 left-2 z-20">
        <div className={`flex items-center gap-1 px-2 py-1 text-xs font-bold rounded ${isDarkMode ? 'bg-pink-600 text-white' : 'bg-pink-500 text-white'}`}>
          <Heart className="w-3 h-3" />
          SUPPORT US
        </div>
      </div>
    </div>
  );
}

function getPerimeterPositions(): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];

  // Top and bottom rows
  for (let x = 0; x <= GRID_COLS - AD_WIDTH; x++) {
    positions.push({ x, y: 0 }); // Top row
    if (GRID_ROWS - AD_HEIGHT >= 0) {
      positions.push({ x, y: GRID_ROWS - AD_HEIGHT }); // Bottom row
    }
  }

  // Left and right columns (excluding corners already added)
  for (let y = 1; y < GRID_ROWS - AD_HEIGHT; y++) {
    positions.push({ x: 0, y }); // Left column
    if (GRID_COLS - AD_WIDTH > 0) {
      positions.push({ x: GRID_COLS - AD_WIDTH, y }); // Right column
    }
  }

  return positions;
}

// ✅ 10-DAY COOLDOWN: Check if enough time has passed since last ad
function shouldShowAd(): boolean {
  try {
    const lastAdSeen = localStorage.getItem(LAST_AD_SEEN_KEY);

    if (!lastAdSeen) {
      // No ad seen before - show ad
      return true;
    }

    const lastSeenTime = parseInt(lastAdSeen, 10);
    if (isNaN(lastSeenTime)) {
      // Invalid timestamp - show ad
      return true;
    }

    const now = Date.now();
    const daysSinceLastAd = (now - lastSeenTime) / (1000 * 60 * 60 * 24);

    // Show ad only if 10 or more days have passed
    return daysSinceLastAd >= AD_COOLDOWN_DAYS;
  } catch (error) {
    // localStorage might be disabled - allow ad to show
    console.warn('[Ad] localStorage error, showing ad anyway:', error);
    return true;
  }
}

// ✅ 10-DAY COOLDOWN: Update timestamp when ad is shown
function markAdAsSeen(): void {
  try {
    localStorage.setItem(LAST_AD_SEEN_KEY, Date.now().toString());
  } catch (error) {
    console.warn('[Ad] Failed to save ad timestamp to localStorage:', error);
  }
}

export function useViralAds(
  _isPremium: boolean, // ❌ IGNORED - Donation model shows ads to everyone
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

  const isPositionOccupied = useCallback((x: number, y: number, w: number, h: number, currentAd: AdBlockData | null, currentWidgets: Widget[]) => {
    // Check if any cell in the w×h area is occupied
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        const checkX = x + dx;
        const checkY = y + dy;

        // Check ad overlap
        if (currentAd) {
          if (checkX >= currentAd.x && checkX < currentAd.x + currentAd.w && 
              checkY >= currentAd.y && checkY < currentAd.y + currentAd.h) {
            return { occupied: true, type: 'ad' as const };
          }
        }

        // Check widget overlap
        for (const widget of currentWidgets) {
          if (checkX >= widget.x && checkX < widget.x + widget.w && 
              checkY >= widget.y && checkY < widget.y + widget.h) {
            return { occupied: true, type: 'widget' as const };
          }
        }
      }
    }

    return { occupied: false, type: null };
  }, []);

  const widgetOverlapsAdBounds = useCallback((widget: Widget, adBounds: { x: number; y: number; w: number; h: number }): boolean => {
    const overlapsX = widget.x < adBounds.x + adBounds.w && widget.x + widget.w > adBounds.x;
    const overlapsY = widget.y < adBounds.y + adBounds.h && widget.y + widget.h > adBounds.y;
    return overlapsX && overlapsY;
  }, []);

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

  const widgetsOverlap = useCallback((a: Widget, b: Widget): boolean => {
    const overlapsX = a.x < b.x + b.w && a.x + a.w > b.x;
    const overlapsY = a.y < b.y + b.h && a.y + a.h > b.y;
    return overlapsX && overlapsY;
  }, []);

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

  const triggerAd = useCallback(() => {
    // ✅ SINGLE AD ENFORCEMENT: Check if ad already exists
    if (ad !== null) {
      console.log('[Ad] Skipping - ad already active');
      return;
    }

    // ✅ 10-DAY COOLDOWN: Only show ad if 10 days have passed
    if (!shouldShowAd()) {
      console.log('[Ad] Skipping ad - less than 10 days since last ad');
      return;
    }

    const currentWidgets = widgetsRef.current;
    const perimeterPositions = getPerimeterPositions();
    const shuffled = [...perimeterPositions].sort(() => Math.random() - 0.5);

    for (const pos of shuffled) {
      // ✅ FIXED AD SIZE: Always 3×2
      const newAdBounds = { x: pos.x, y: pos.y, w: AD_WIDTH, h: AD_HEIGHT };

      // Check bounds
      if (pos.x + AD_WIDTH > GRID_COLS || pos.y + AD_HEIGHT > GRID_ROWS) {
        continue;
      }

      // Check if position is empty (no overlap with existing widgets)
      const occupation = isPositionOccupied(pos.x, pos.y, AD_WIDTH, AD_HEIGHT, null, currentWidgets);

      if (!occupation.occupied) {
        // Position is free - spawn ad directly
        const newAd: AdBlockData = {
          id: `ad-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          x: pos.x,
          y: pos.y,
          w: AD_WIDTH,  // ✅ FIXED: Always 3 columns
          h: AD_HEIGHT, // ✅ FIXED: Always 2 rows
          createdAt: Date.now()
        };
        setAd(newAd);

        // ✅ 10-DAY COOLDOWN: Mark ad as seen
        markAdAsSeen();
        console.log('[Ad] Ad shown (3×2) - next ad in 10 days');
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
          w: AD_WIDTH,  // ✅ FIXED: Always 3 columns
          h: AD_HEIGHT, // ✅ FIXED: Always 2 rows
          createdAt: Date.now()
        };
        setAd(newAd);

        // ✅ 10-DAY COOLDOWN: Mark ad as seen
        markAdAsSeen();
        console.log('[Ad] Ad shown (3×2) - next ad in 10 days');
        return;
      }
    }

    console.log('[Ad] No valid position found for 3×2 ad');
  }, [ad, isPositionOccupied, performGridReflow, setWidgets]);

  useEffect(() => {
    triggerAdRef.current = triggerAd;
  }, [triggerAd]);

  const skipAd = useCallback(() => {
    if (expansionTimerRef.current) {
      clearInterval(expansionTimerRef.current);
      expansionTimerRef.current = null;
    }
    setAd(null);

    // Clear spawn timer - no need to respawn since 10-day cooldown is active
    if (spawnTimerRef.current) {
      clearTimeout(spawnTimerRef.current);
      spawnTimerRef.current = null;
    }
  }, []);

  const isAdActive = ad !== null;

  // ✅ REMOVED: Ad expansion logic (ad is now fixed at 3×2)
  // Ads no longer expand - they stay at 3×2 size

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