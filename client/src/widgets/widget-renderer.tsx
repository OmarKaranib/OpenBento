// Auto-extracted from App.tsx during widget modularization.
// Thin dispatcher: looks up the right renderer in WIDGET_RENDERERS
// and falls back to an "Unknown Widget Type" error tile.
import React from 'react';
import type { Widget } from './shared';
import { MONO } from './shared';
import { WIDGET_RENDERERS } from './registry';

interface WidgetRendererProps {
  widget: Widget;
  onToggle24Hour: (widgetId: string) => void;
  onColorChange?: (widgetId: string, color: string) => void;
  // Generic per-widget patcher used by widgets that persist their own
  // settings (Crisis Ticker filters, Markets Ticker symbols, Note body).
  onUpdate?: (widgetId: string, patch: Partial<Widget>) => void;
  // Forwarded to the note renderer for theming/edit-lock awareness.
  isDarkMode?: boolean;
  isEditMode?: boolean;
}

export function WidgetRenderer({
  widget,
  onToggle24Hour,
  onColorChange,
  onUpdate,
  isDarkMode,
  isEditMode,
}: WidgetRendererProps): React.ReactElement | null | false {
  const renderer = WIDGET_RENDERERS[widget.type];
  if (renderer) {
    return renderer({ widget, onToggle24Hour, onColorChange, onUpdate, isDarkMode, isEditMode });
  }
  return (
    <div
      style={{
        width: '100%', height: '100%', backgroundColor: '#0f172a',
        borderRadius: '0.5rem', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem', boxSizing: 'border-box', border: '1px dashed #334155',
      }}
    >
      <p style={{ color: '#f87171', fontSize: '0.85rem', fontWeight: 700, textAlign: 'center', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>
        Unknown Widget Type
      </p>
      <p style={{ color: '#475569', fontSize: '0.75rem', textAlign: 'center', fontFamily: MONO }}>
        type: &quot;{(widget as Widget).type}&quot;
      </p>
    </div>
  );
}
