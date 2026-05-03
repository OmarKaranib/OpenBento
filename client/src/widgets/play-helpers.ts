// Knowledge & Play pack — pure helpers used by the Wordle widget and
// the trivia/quote/on-this-day widgets. Imported by the widgets and by
// tests/client/play-helpers.test.ts so any drift fails the `check` gate.

// ─── Wordle ────────────────────────────────────────────────────────────
// Pool, hash, and date-key all come from @shared/wordle-pool so the
// client offline fallback can never disagree with /api/wordle/today.
import { WORDLE_POOL, wordleHash, wordleUtcDateKey } from '@shared/wordle-pool';

export const WORDLE_ANSWERS = WORDLE_POOL;
export const fnv1a32 = wordleHash;
export const utcDateKey = wordleUtcDateKey;

export function pickDailyWord(
  dateKey: string,
  pool: readonly string[] = WORDLE_ANSWERS,
): string {
  if (pool.length === 0) return 'apple';
  const idx = wordleHash(dateKey) % pool.length;
  return pool[idx].toLowerCase();
}

export type WordleVerdict = 'correct' | 'present' | 'absent';

/**
 * Wordle guess evaluator that handles duplicate letters correctly.
 *
 * Two-pass algorithm: pass 1 marks exact matches and consumes those
 * answer slots; pass 2 marks 'present' only if the corresponding
 * answer letter is still unconsumed. This guarantees that a guess
 * containing two of a letter against an answer containing one will
 * mark exactly one as present (or correct) and the other as absent.
 */
export function evaluateWordleGuess(guess: string, answer: string): WordleVerdict[] {
  const g = guess.toLowerCase();
  const a = answer.toLowerCase();
  const len = a.length;
  const verdicts: WordleVerdict[] = new Array(len).fill('absent');
  const consumed: boolean[] = new Array(len).fill(false);

  // Pass 1 — exact matches.
  for (let i = 0; i < len; i++) {
    if (g[i] === a[i]) {
      verdicts[i] = 'correct';
      consumed[i] = true;
    }
  }
  // Pass 2 — present (letter exists elsewhere in answer, not yet consumed).
  for (let i = 0; i < len; i++) {
    if (verdicts[i] === 'correct') continue;
    for (let j = 0; j < len; j++) {
      if (!consumed[j] && g[i] === a[j]) {
        verdicts[i] = 'present';
        consumed[j] = true;
        break;
      }
    }
  }
  return verdicts;
}

// ─── Quotes (offline fallback) ─────────────────────────────────────────
export interface QuoteEntry { text: string; author: string; }

export const FALLBACK_QUOTES: readonly QuoteEntry[] = [
  { text: 'The unexamined life is not worth living.', author: 'Socrates' },
  { text: 'I think, therefore I am.', author: 'René Descartes' },
  { text: 'The only true wisdom is in knowing you know nothing.', author: 'Socrates' },
  { text: 'Whereof one cannot speak, thereof one must be silent.', author: 'Ludwig Wittgenstein' },
  { text: 'Be the change you wish to see in the world.', author: 'Mahatma Gandhi' },
  { text: 'Simplicity is the ultimate sophistication.', author: 'Leonardo da Vinci' },
  { text: 'Stay hungry, stay foolish.', author: 'Stewart Brand' },
  { text: 'Make it work, make it right, make it fast.', author: 'Kent Beck' },
  { text: 'Premature optimization is the root of all evil.', author: 'Donald Knuth' },
  { text: 'Programs must be written for people to read.', author: 'Harold Abelson' },
  { text: 'Talk is cheap. Show me the code.', author: 'Linus Torvalds' },
  { text: 'In the middle of difficulty lies opportunity.', author: 'Albert Einstein' },
  { text: 'The journey of a thousand miles begins with a single step.', author: 'Lao Tzu' },
  { text: 'What we think, we become.', author: 'Buddha' },
  { text: 'Happiness depends upon ourselves.', author: 'Aristotle' },
  { text: 'Not all those who wander are lost.', author: 'J.R.R. Tolkien' },
  { text: 'It always seems impossible until it’s done.', author: 'Nelson Mandela' },
  { text: 'A ship in harbor is safe, but that is not what ships are built for.', author: 'John A. Shedd' },
  { text: 'Do or do not. There is no try.', author: 'Yoda' },
  { text: 'Quality is not an act, it is a habit.', author: 'Aristotle' },
];

/** Picks a fallback quote deterministically from a numeric seed. */
export function pickFallbackQuote(seed: number, pool: readonly QuoteEntry[] = FALLBACK_QUOTES): QuoteEntry {
  const idx = (seed >>> 0) % pool.length;
  return pool[idx];
}
