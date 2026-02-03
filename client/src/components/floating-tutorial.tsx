import { useState, useEffect, useRef } from 'react';
import { HelpCircle, X, ArrowRight, ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TutorialStep {
  id: string;
  targetSelector: string;
  title: string;
  description: string;
  arrowDirection: 'right' | 'down' | 'up' | 'left';
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'master-mute',
    targetSelector: '[data-testid="button-master-mute"]',
    title: 'Master Mute',
    description: 'Silence all streams instantly.',
    arrowDirection: 'up',
  },
  {
    id: 'edit-mode',
    targetSelector: '[data-testid="button-edit-layout"]',
    title: 'Edit Mode',
    description: 'Arrange your Bento grid.',
    arrowDirection: 'up',
  },
  {
    id: 'pro-crown',
    targetSelector: '[data-testid="button-pro-crown"]',
    title: 'Pro Crown',
    description: 'Unlimited power & saved layouts.',
    arrowDirection: 'up',
  },
];

export function FloatingTutorial({ isPremium }: { isPremium: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [positions, setPositions] = useState<Record<string, { top: number; left: number } | null>>({});
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const calculatePositions = () => {
      const newPositions: Record<string, { top: number; left: number } | null> = {};
      
      TUTORIAL_STEPS.forEach((step) => {
        if (step.id === 'pro-crown' && isPremium) {
          newPositions[step.id] = null;
          return;
        }
        
        const element = document.querySelector(step.targetSelector);
        if (element) {
          const rect = element.getBoundingClientRect();
          newPositions[step.id] = {
            top: rect.bottom + 10,
            left: rect.left + rect.width / 2,
          };
        } else {
          newPositions[step.id] = null;
        }
      });
      
      setPositions(newPositions);
    };

    calculatePositions();
    window.addEventListener('resize', calculatePositions);
    window.addEventListener('scroll', calculatePositions);

    return () => {
      window.removeEventListener('resize', calculatePositions);
      window.removeEventListener('scroll', calculatePositions);
    };
  }, [isOpen, isPremium]);

  const handleClose = () => {
    setIsOpen(false);
  };

  const ArrowIcon = ({ direction }: { direction: string }) => {
    switch (direction) {
      case 'up':
        return <ArrowUp className="w-5 h-5 text-cyan-400 animate-bounce" />;
      case 'down':
        return <ArrowDown className="w-5 h-5 text-cyan-400 animate-bounce" />;
      case 'right':
        return <ArrowRight className="w-5 h-5 text-cyan-400 animate-bounce" />;
      default:
        return <ArrowUp className="w-5 h-5 text-cyan-400 animate-bounce" />;
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="menu-btn h-[3.2rem] w-[3.2rem] bg-slate-700 hover:bg-slate-600 slot-button font-semibold flex items-center justify-center transition-all duration-300 transform hover:scale-105 shadow-lg shadow-slate-900/50 border border-slate-500"
        data-testid="button-help-tutorial"
        title="Quick Tutorial"
      >
        <HelpCircle className="w-[1.4rem] h-[1.4rem] text-cyan-400" />
      </button>

      {isOpen && (
        <div 
          ref={overlayRef}
          className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
          data-testid="tutorial-overlay"
        >
          <Button
            onClick={handleClose}
            size="icon"
            variant="outline"
            className="absolute top-4 right-4 z-[9999] bg-slate-700 border-slate-500"
            data-testid="button-close-tutorial"
          >
            <X className="w-6 h-6" />
          </Button>

          <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center">
            <h2 className="text-2xl font-bold text-white mb-2" data-testid="text-tutorial-title">Quick Tutorial</h2>
            <p className="text-slate-400" data-testid="text-tutorial-subtitle">Click anywhere to close</p>
          </div>

          {TUTORIAL_STEPS.map((step) => {
            if (step.id === 'pro-crown' && isPremium) return null;
            
            const position = positions[step.id];
            if (!position) return null;

            return (
              <div
                key={step.id}
                className="absolute z-[9999] pointer-events-none"
                style={{
                  top: position.top,
                  left: position.left,
                  transform: 'translateX(-50%)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col items-center">
                  <ArrowIcon direction={step.arrowDirection} />
                  <div className="mt-2 bg-slate-800 border border-cyan-500/50 rounded-xl px-4 py-3 shadow-xl shadow-cyan-500/10 min-w-[180px] text-center" data-testid={`tutorial-tip-${step.id}`}>
                    <h3 className="text-cyan-400 font-bold text-sm mb-1" data-testid={`text-tutorial-tip-title-${step.id}`}>{step.title}</h3>
                    <p className="text-slate-300 text-xs" data-testid={`text-tutorial-tip-desc-${step.id}`}>{step.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
