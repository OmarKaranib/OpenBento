// Extracted from pages/dashboard.tsx during widget modularization.
// Stateless visual placeholder; rendered by the registry.
import React from 'react';
import { Square } from 'lucide-react';

export function SpacerWidget() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-slate-500">
        <Square className="w-[2rem] h-[2rem]" />
        <span className="text-[1rem]">Spacer</span>
      </div>
    </div>
  );
}
