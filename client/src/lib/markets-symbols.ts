// Pure helpers for the Markets Ticker symbol-management UI.
//
// Extracted from `client/src/App.tsx` so the validation, dedupe, cap, and
// reorder rules can be unit-tested without spinning up a DOM. The widget
// imports these directly and feeds the resulting array back through its
// `onUpdate` callback — meaning the visible row order tracks the array order
// returned by these helpers.
//
// Behavior contract (mirrored by `tests/client/markets-symbols.test.ts`):
//   • `addSymbol` rejects empty input, anything that fails `SYMBOL_RE`, any
//     symbol already in the list, and any addition past `MAX_SYMBOLS` (12).
//   • `moveSymbol` swaps with the neighbor in `dir`, returning the original
//     array when at the edge (so callers can short-circuit without re-render).
//   • `removeSymbol` returns a new array without the target symbol; missing
//     symbols are a no-op and return the input unchanged (referentially).

export const SYMBOL_RE = /^[A-Z0-9.\-]{1,8}$/;
export const MAX_SYMBOLS = 12;

export type AddSymbolResult =
  | { ok: true; symbols: string[] }
  | { ok: false; reason: 'empty' | 'invalid' | 'duplicate' | 'cap' };

export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase();
}

export function addSymbol(symbols: string[], raw: string): AddSymbolResult {
  const sym = normalizeSymbol(raw);
  if (!sym) return { ok: false, reason: 'empty' };
  if (!SYMBOL_RE.test(sym)) return { ok: false, reason: 'invalid' };
  if (symbols.includes(sym)) return { ok: false, reason: 'duplicate' };
  if (symbols.length >= MAX_SYMBOLS) return { ok: false, reason: 'cap' };
  return { ok: true, symbols: [...symbols, sym] };
}

export function removeSymbol(symbols: string[], sym: string): string[] {
  if (!symbols.includes(sym)) return symbols;
  return symbols.filter(s => s !== sym);
}

export function moveSymbol(symbols: string[], idx: number, dir: -1 | 1): string[] {
  const target = idx + dir;
  if (idx < 0 || idx >= symbols.length) return symbols;
  if (target < 0 || target >= symbols.length) return symbols;
  const next = symbols.slice();
  [next[idx], next[target]] = [next[target], next[idx]];
  return next;
}
