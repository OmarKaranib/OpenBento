import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the polling Markets widget gives each request a deadline', () => {
  const widget = readFileSync('client/src/widgets/markets-ticker-widget.tsx', 'utf8');

  assert.match(widget, /requestTimeoutSignal/);
  assert.match(widget, /api\/markets[\s\S]*signal: requestTimeoutSignal\(\)/);
});

test('the polling News widget gives each request a deadline', () => {
  const widget = readFileSync('client/src/widgets/crisis-ticker-widget.tsx', 'utf8');

  assert.match(widget, /requestTimeoutSignal/);
  assert.match(widget, /api\/news[\s\S]*signal: requestTimeoutSignal\(\)/);
});

test('the polling GitHub widget gives each request a deadline', () => {
  const widget = readFileSync('client/src/widgets/github-pulse-widget.tsx', 'utf8');

  assert.match(widget, /requestTimeoutSignal/);
  assert.match(widget, /fetch\(url, \{ signal: requestTimeoutSignal\(\) \}\)/);
});

test('the polling RSS widget gives each request a deadline', () => {
  const widget = readFileSync('client/src/widgets/rss-headlines-widget.tsx', 'utf8');

  assert.match(widget, /requestTimeoutSignal/);
  assert.match(widget, /api\/rss[\s\S]*signal: requestTimeoutSignal\(\)/);
});

test('the polling Network Light gives each request a deadline', () => {
  const widget = readFileSync('client/src/widgets/network-light-widget.tsx', 'utf8');

  assert.match(widget, /requestTimeoutSignal/);
  assert.match(widget, /api\/ping[\s\S]*signal: requestTimeoutSignal\(\)/);
});

test('ISS position, city, and pass requests all have deadlines', () => {
  const widget = readFileSync('client/src/widgets/iss-tracker-widget.tsx', 'utf8');

  assert.equal(widget.match(/signal: requestTimeoutSignal\(/g)?.length, 3);
  assert.match(widget, /requestTimeoutSignal\(undefined, ctrl\.signal\)/);
});
