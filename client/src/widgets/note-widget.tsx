// Note widget — thin shim that exposes the existing
// components/note-widget under the unified widgets/ namespace
// so the registry can dispatch by Widget.type === 'note' without
// reaching across into components/. The implementation already
// lives in @/components/note-widget; we re-export it and add the
// {widget, onUpdate} adapter the registry expects.
import React from 'react';
import { NoteWidget as InnerNoteWidget } from '@/components/note-widget';
import type { Widget } from './shared';

interface NoteWidgetAdapterProps {
  widget: Widget;
  isDarkMode?: boolean;
  isEditMode: boolean;
  onUpdate: (widgetId: string, patch: Partial<Widget>) => void;
}

export function NoteWidget({
  widget,
  isDarkMode = false,
  isEditMode,
  onUpdate,
}: NoteWidgetAdapterProps) {
  return (
    <InnerNoteWidget
      widgetId={widget.id}
      noteContent={widget.noteContent || ''}
      isDarkMode={isDarkMode}
      isEditMode={isEditMode}
      onChange={(content) => onUpdate(widget.id, { noteContent: content })}
    />
  );
}
