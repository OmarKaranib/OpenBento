import { pathToFileURL } from 'node:url';
import { register } from 'tsx/esm/api';
register({ parentURL: pathToFileURL('./').href });

import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

globalThis.React = React;

const Internals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

function renderWithHooks(Component, props) {
  const dispatcher = {
    useState(initial) {
      return [typeof initial === 'function' ? initial() : initial, () => {}];
    },
    useRef(initial) {
      return { current: initial };
    },
    useEffect() {},
    useMemo(factory) {
      return factory();
    },
  };

  const previous = Internals.ReactCurrentDispatcher.current;
  Internals.ReactCurrentDispatcher.current = dispatcher;
  try {
    return Component(props);
  } finally {
    Internals.ReactCurrentDispatcher.current = previous;
  }
}

function findElement(node, type) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === type) return node;

  const children = node.props?.children;
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    const match = findElement(child, type);
    if (match) return match;
  }
  return null;
}

const { NoteWidget } = await import('../../client/src/widgets/note-widget.tsx');

test('Note widget saves the text the user typed', () => {
  const updates = [];
  const widget = {
    id: 'note-1',
    type: 'note',
    x: 0,
    y: 0,
    w: 3,
    h: 2,
    noteContent: '',
  };

  const adapter = NoteWidget({
    widget,
    isEditMode: false,
    onUpdate: (id, patch) => updates.push({ id, patch }),
  });
  const rendered = renderWithHooks(adapter.type, adapter.props);
  const textarea = findElement(rendered, 'textarea');

  assert.ok(textarea, 'an empty note should open its text editor');
  textarea.props.onChange({ target: { value: 'Remember the typed text' } });

  assert.deepEqual(updates, [
    { id: 'note-1', patch: { noteContent: 'Remember the typed text' } },
  ]);
});
