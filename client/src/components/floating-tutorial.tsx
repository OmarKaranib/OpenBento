import { useState, useEffect, useRef, useCallback } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface TutorialLabel {
  id: string;
  targetSelector: string;
  label: string;
}

const ALL_TUTORIAL_LABELS: TutorialLabel[] = [
  { id: 'fullscreen', targetSelector: '[data-testid="button-toggle-fullscreen"]', label: 'Full Screen' },
  { id: 'tutorial', targetSelector: '[data-testid="button-help-tutorial"]', label: 'Tutorial' },
  { id: 'logo', targetSelector: '[data-testid="img-logo"]', label: 'Logo' },
  { id: 'title', targetSelector: '[data-testid="text-title"]', label: 'Title' },
  { id: 'clear', targetSelector: '[data-testid="button-clear-all"]', label: 'Clear' },
  { id: 'add-block', targetSelector: '[data-testid="button-add-block"]', label: 'Add Block' },
  { id: 'refresh', targetSelector: '[data-testid="button-refresh-all"]', label: 'Refresh' },
  { id: 'edit', targetSelector: '[data-testid="button-edit-layout"]', label: 'Edit' },
  { id: 'mute', targetSelector: '[data-testid="button-master-mute"]', label: 'Mute' },
  { id: 'theme', targetSelector: '[data-testid="button-theme-toggle"]', label: 'Dark Mode' },
  { id: 'crown', targetSelector: '[data-testid="button-pro-crown"]', label: 'Crown' },
  { id: 'profile', targetSelector: '[data-testid="button-user-menu"], [data-testid="button-login"]', label: 'Profile' },
];

interface AnchoredLabelProps {
  item: TutorialLabel;
}

function AnchoredLabel({ item }: AnchoredLabelProps) {
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const calculatePosition = useCallback(() => {
    const selectors = item.targetSelector.split(', ');
    let element: Element | null = null;
    for (const selector of selectors) {
      element = document.querySelector(selector.trim());
      if (element) break;
    }
    
    if (element) {
      const rect = element.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 6,
        left: rect.left + rect.width / 2,
        width: rect.width,
      });
    } else {
      setPosition(null);
    }
  }, [item.targetSelector]);

  useEffect(() => {
    calculatePosition();
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition);

    return () => {
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition);
    };
  }, [calculatePosition]);

  if (!position) return null;

  return (
    <div
      ref={labelRef}
      className="fixed z-[10000] pointer-events-none"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
      }}
      data-testid={`tutorial-label-${item.id}`}
    >
      <div className="flex flex-col items-center">
        <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[6px] border-l-transparent border-r-transparent border-b-cyan-500/80" />
        <div className="bg-slate-900/95 border border-cyan-500/60 rounded-md px-2 py-1 shadow-lg whitespace-nowrap text-center">
          <span className="text-cyan-400 font-semibold text-xs">{item.label}</span>
        </div>
      </div>
    </div>
  );
}

export function FloatingTutorial({ isDarkMode = true }: { isDarkMode?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Global click listener - closes tutorial on ANY click anywhere on the screen
  useEffect(() => {
    if (!isOpen) return;
    
    const handleGlobalClick = (e: MouseEvent | TouchEvent) => {
      // Close on any click - the entire screen is clickable to close
      handleClose();
    };
    
    // Use capture phase to catch clicks before they reach other elements
    document.addEventListener('click', handleGlobalClick, true);
    document.addEventListener('touchend', handleGlobalClick, true);
    
    return () => {
      document.removeEventListener('click', handleGlobalClick, true);
      document.removeEventListener('touchend', handleGlobalClick, true);
    };
  }, [isOpen, handleClose]);

  const visibleLabels = ALL_TUTORIAL_LABELS.filter(item => {
    if (item.id === 'crown') return false;
    return true;
  });

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation(); // Prevent global listener from immediately closing
          setIsOpen(true);
        }}
        className={`menu-btn h-[3.2rem] w-[3.2rem] slot-button font-semibold flex items-center justify-center transition-all duration-300 border ${
          isDarkMode 
            ? 'bg-slate-800/80 hover:bg-slate-700 border-slate-600/50 hover:border-cyan-500/50'
            : 'bg-gray-200 hover:bg-gray-300 border-gray-300 hover:border-cyan-500/50'
        }`}
        data-testid="button-help-tutorial"
        title="Quick Tutorial"
      >
        <HelpCircle className={`w-[1.4rem] h-[1.4rem] ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`} />
      </button>

      {isOpen && (
        <>
          {/* Dark overlay with cutout for menu bar - no darkening over the header */}
          <div 
            className="fixed inset-0 z-[9998] cursor-pointer"
            onClick={handleClose}
            onTouchEnd={handleClose}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Escape' && handleClose()}
            data-testid="tutorial-overlay"
            style={{
              background: 'linear-gradient(to bottom, transparent 0%, transparent 3.2rem, rgba(0,0,0,0.6) 3.2rem, rgba(0,0,0,0.6) 100%)'
            }}
          />
          
          <button
            onClick={handleClose}
            className="fixed z-[10001] flex items-center justify-center w-10 h-10 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors"
            style={{ top: '1rem', right: '1rem' }}
            data-testid="button-close-tutorial"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 text-center z-[10000] pointer-events-none">
            <h2 className="text-xl font-bold text-white mb-1" data-testid="text-tutorial-title">Menu Bar Guide</h2>
            <p className="text-slate-400 text-sm" data-testid="text-tutorial-subtitle">Click anywhere to close</p>
          </div>

          {visibleLabels.map((item) => (
            <AnchoredLabel key={item.id} item={item} />
          ))}
        </>
      )}
    </>
  );
}
