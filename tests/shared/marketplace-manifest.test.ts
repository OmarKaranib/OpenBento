import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMarketplaceManifest,
  MarketplaceWidgetSchema,
  MARKETPLACE_CATEGORIES,
} from '../../shared/marketplace-manifest';

test('parses a fully-valid manifest', () => {
  const raw = {
    version: 1,
    widgets: [
      {
        id: 'a', name: 'A', author: 'Me', description: 'desc',
        category: 'productivity', version: '1.0.0',
        url: '/examples/widgets/a/index.html',
      },
    ],
  };
  const out = parseMarketplaceManifest(raw);
  assert.equal(out.widgets.length, 1);
  assert.equal(out.invalidCount, 0);
  assert.equal(out.widgets[0].id, 'a');
});

test('skips invalid entries individually', () => {
  const raw = {
    version: 1,
    widgets: [
      { id: 'good', name: 'Good', author: 'x', description: 'd', category: 'fun', version: '1', url: 'https://example.com/w.html' },
      { id: 'bad-cat', name: 'B', author: 'x', description: 'd', category: 'nope', version: '1', url: 'https://example.com' },
      { id: 'bad-url', name: 'C', author: 'x', description: 'd', category: 'fun', version: '1', url: 'javascript:alert(1)' },
      { id: '', name: 'D', author: 'x', description: 'd', category: 'fun', version: '1', url: 'https://example.com' },
      'not-an-object',
    ],
  };
  const out = parseMarketplaceManifest(raw);
  assert.equal(out.widgets.length, 1);
  assert.equal(out.widgets[0].id, 'good');
  assert.equal(out.invalidCount, 4);
});

test('drops duplicate ids, keeping the first', () => {
  const raw = {
    version: 1,
    widgets: [
      { id: 'dup', name: 'first', author: 'x', description: 'd', category: 'fun', version: '1', url: '/a.html' },
      { id: 'dup', name: 'second', author: 'x', description: 'd', category: 'fun', version: '1', url: '/b.html' },
    ],
  };
  const out = parseMarketplaceManifest(raw);
  assert.equal(out.widgets.length, 1);
  assert.equal(out.widgets[0].name, 'first');
  assert.equal(out.invalidCount, 1);
});

test('rejects bogus outer envelopes safely', () => {
  for (const raw of [null, undefined, 'oops', 42, [], { version: 2, widgets: [] }, { version: 1 }]) {
    const out = parseMarketplaceManifest(raw);
    assert.equal(out.widgets.length, 0);
  }
});

test('protocol-relative and javascript URLs are rejected by the entry schema', () => {
  for (const url of ['javascript:alert(1)', '//evil.com/x.html', 'data:text/html,', 'file:///etc/passwd']) {
    const r = MarketplaceWidgetSchema.safeParse({
      id: 'x', name: 'x', author: 'x', description: 'x',
      category: 'fun', version: '1', url,
    });
    assert.equal(r.success, false, `${url} should fail`);
  }
});

test('all advertised categories are accepted', () => {
  for (const c of MARKETPLACE_CATEGORIES) {
    const r = MarketplaceWidgetSchema.safeParse({
      id: c, name: c, author: 'x', description: 'd',
      category: c, version: '1', url: '/x.html',
    });
    assert.equal(r.success, true, `${c} should parse`);
  }
});
