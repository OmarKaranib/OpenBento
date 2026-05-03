// Extracted from pages/dashboard.tsx during widget modularization.
// Renders widget.imageUrl when present, otherwise an empty-state placeholder.
import React from 'react';
import { Image as ImageIcon } from 'lucide-react';
import type { Widget } from './shared';

export function ImageWidget({ widget }: { widget: Widget }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-800/50">
      {widget.imageUrl ? (
        <img
          src={widget.imageUrl}
          alt="Widget image"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-2 text-purple-400/60">
          <ImageIcon className="w-[2.5rem] h-[2.5rem]" />
          <span className="text-[1rem]">Image Widget</span>
        </div>
      )}
    </div>
  );
}
