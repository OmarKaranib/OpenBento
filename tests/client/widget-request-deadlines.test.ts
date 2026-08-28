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

test('Air Quality refreshes and city searches have deadlines', () => {
  const widget = readFileSync('client/src/widgets/air-quality-widget.tsx', 'utf8');

  assert.equal(widget.match(/signal: requestTimeoutSignal\(/g)?.length, 2);
  assert.match(widget, /requestTimeoutSignal\(undefined, signal\)/);
});

test('initial, hourly, and manual Quote requests have deadlines', () => {
  const widget = readFileSync('client/src/widgets/quote-widget.tsx', 'utf8');

  assert.equal(widget.match(/signal: requestTimeoutSignal\(\)/g)?.length, 3);
});

test('Dictionary searches have a deadline', () => {
  const widget = readFileSync('client/src/widgets/dictionary-widget.tsx', 'utf8');

  assert.match(widget, /api\.dictionaryapi\.dev[\s\S]*signal: requestTimeoutSignal\(\)/);
});

test('On This Day loads have a deadline', () => {
  const widget = readFileSync('client/src/widgets/on-this-day-widget.tsx', 'utf8');

  assert.match(widget, /api\/onthisday[\s\S]*signal: requestTimeoutSignal\(\)/);
});

test('Trivia loads and refreshes have a deadline', () => {
  const widget = readFileSync('client/src/widgets/trivia-widget.tsx', 'utf8');

  assert.match(widget, /api\/trivia[\s\S]*signal: requestTimeoutSignal\(\)/);
});

test('Wordle reaches its offline fallback after a request deadline', () => {
  const widget = readFileSync('client/src/widgets/wordle-widget.tsx', 'utf8');

  assert.match(widget, /api\/wordle\/today[\s\S]*signal: requestTimeoutSignal\(\)/);
});
