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

test('YouTube title lookup reaches its video-ID fallback after a deadline', () => {
  const shell = readFileSync('client/src/dashboard/dashboard-shell.tsx', 'utf8');

  assert.match(shell, /noembed\.com[\s\S]*signal: requestTimeoutSignal\(\)/);
});

test('onboarding channel preload has a deadline', () => {
  const onboarding = readFileSync('client/src/components/onboarding-flow.tsx', 'utf8');

  assert.match(onboarding, /fetch\('\/api\/links', \{ signal: requestTimeoutSignal\(\) \}\)/);
});

test('Marketplace loading reaches its error state after a deadline', () => {
  const marketplace = readFileSync('client/src/pages/marketplace.tsx', 'utf8');

  assert.match(marketplace, /marketplace\/widgets\.json[\s\S]*signal: requestTimeoutSignal\(\)/);
});

test('Feedback submission has a longer upload deadline', () => {
  const feedback = readFileSync('client/src/pages/feedback.tsx', 'utf8');

  assert.match(feedback, /api\/feedback[\s\S]*signal: requestTimeoutSignal\(30_000\)/);
});

test('Sun and Sky city lookup has a deadline', () => {
  const widget = readFileSync('client/src/widgets/sun-sky-widget.tsx', 'utf8');

  assert.match(widget, /api\/weather[\s\S]*signal: requestTimeoutSignal\(\)/);
});

test('soundscape asset loading has a longer audio deadline', () => {
  const widget = readFileSync('client/src/widgets/focus-soundscape-widget.tsx', 'utf8');

  assert.match(widget, /fetch\(opt\.asset, \{ signal: requestTimeoutSignal\(30_000\) \}\)/);
});

test('Kick catalog checks combine close-cancellation with a deadline', () => {
  const sidebar = readFileSync('client/src/components/widget-sidebar.tsx', 'utf8');

  assert.match(sidebar, /api\/kick[\s\S]*requestTimeoutSignal\(undefined, signal\)/);
});
