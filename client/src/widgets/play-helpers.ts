// Knowledge & Play pack — pure helpers used by the Wordle widget and
// the trivia/quote/on-this-day widgets. Imported by the widgets and by
// tests/client/play-helpers.test.ts so any drift fails the `check` gate.

// ─── Wordle ────────────────────────────────────────────────────────────
// Curated 5-letter answer pool. Kept intentionally small (and trimmed of
// obscure or offensive entries) so the daily seed always lands on a
// recognisable English word. Order matters for the deterministic seed —
// adding new entries at the end is safe; reordering will shift past
// daily words.
export const WORDLE_ANSWERS: readonly string[] = [
  'apple','beach','crane','drink','eagle','flame','grape','heart','image','joker',
  'knife','lemon','mango','noble','ocean','piano','queen','river','stone','tiger',
  'umbra','vapor','whale','xenon','yacht','zebra','adobe','bread','cabin','dance',
  'enjoy','fable','glide','hover','irony','jolly','karma','laser','medal','novel',
  'olive','peach','quirk','rapid','swift','torch','unity','venom','wagon','xylit',
  'youth','zoned','adore','blade','crazy','daisy','eight','frost','giant','honey',
  'index','jelly','kebab','lunar','magic','nerve','orbit','party','quart','rebel',
  'sugar','toast','urban','vivid','witch','xeric','yummy','zesty','agile','baker',
  'cigar','dough','elite','flute','grasp','hatch','irate','jumpy','knack','liver',
  'march','night','oddly','plant','quail','radio','salad','tooth','udder','valve',
  'water','xerus','yield','zonal','album','badge','candy','depth','event','fluid',
  'glass','horse','ivory','jewel','kayak','large','metal','north','onion','pearl',
  'quote','round','seven','table','under','virus','world','yearn','adapt','below',
  'cargo','denim','elder','focus','grain','happy','infer','judge','kneel','lobby',
  'movie','named','offer','paste','quack','raise','sound','trick','until','vague',
  'whirl','xerox','young','zayin','admit','blink','clean','daunt','elope','first',
  'gauze','hardy','infix','joint','known','later','medic','nylon','optic','pride',
  'quill','riser','snake','treat','urine','vinyl','widow','yacht','yodel','adopt',
  'beach','cloud','draft','equal','field','green','hello','input','japan','kappa',
  'light','money','niece','onset','plain','quake','rocky','solid','today','upset',
  'value','woven','adage','bagel','craft','dwell','envoy','farce','gusto','hippo',
  'islet','jaunt','kraal','lapis','melon','nudge','oxide','pluck','queue','rusty',
  'saint','torso','usher','vouch','waist','xerus','yolky','zilch','aside','bingo',
  'civil','deity','epoch','fruit','gnome','heave','ivory','jaded','knoll','liner',
  'mocha','noisy','optic','pixel','quasi','reedy','satin','tweak','urgent','vista',
];

/**
 * Deterministic FNV-1a 32-bit hash. Used to seed the daily Wordle pick
 * from a YYYY-MM-DD string so every player gets the same word per UTC
 * day without needing a server round-trip.
 */
export function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/** YYYY-MM-DD in UTC for a given Date. */
export function utcDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Picks the daily Wordle answer by hashing the UTC date key into the pool. */
export function pickDailyWord(
  dateKey: string,
  pool: readonly string[] = WORDLE_ANSWERS,
): string {
  if (pool.length === 0) return 'apple';
  const idx = fnv1a32(dateKey) % pool.length;
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
