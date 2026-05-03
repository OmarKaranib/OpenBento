export const WORDLE_POOL: readonly string[] = [
  'apple','beach','crane','drink','eagle','flame','grape','heart','image','joker',
  'knife','lemon','mango','noble','ocean','piano','queen','river','stone','tiger',
  'whale','yacht','zebra','adobe','bread','cabin','dance','enjoy','fable','glide',
  'hover','irony','jolly','karma','laser','medal','novel','olive','peach','quirk',
  'rapid','swift','torch','unity','venom','wagon','youth','adore','blade','crazy',
  'daisy','eight','frost','giant','honey','index','jelly','lunar','magic','nerve',
  'orbit','party','rebel','sugar','toast','urban','vivid','witch','agile','baker',
  'cigar','dough','elite','flute','grasp','hatch','irate','jumpy','knack','liver',
  'march','night','plant','quail','radio','salad','tooth','valve','water','yield',
  'album','badge','candy','depth','event','fluid','glass','horse','ivory','jewel',
  'kayak','large','metal','north','onion','pearl','quote','round','seven','table',
  'under','virus','world','adapt','below','cargo','denim','elder','focus','grain',
  'happy','infer','judge','kneel','lobby','movie','named','offer','paste','raise',
  'sound','trick','until','vague','whirl','young','admit','blink','clean','elope',
  'first','gauze','hardy','joint','known','later','medic','nylon','optic','pride',
  'snake','treat','vinyl','widow','yodel','adopt','cloud','draft','equal','field',
  'green','hello','input','light','money','niece','onset','plain','rocky','solid',
  'today','upset','value','woven','adage','bagel','craft','dwell','envoy','farce',
  'gusto','hippo','islet','jaunt','melon','nudge','oxide','pluck','queue','rusty',
  'saint','torso','usher','vouch','waist','aside','bingo','civil','deity','epoch',
  'fruit','gnome','heave','jaded','knoll','liner','mocha','noisy','pixel','reedy',
  'satin','tweak','vista',
];

export function wordleHash(s: string): number {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

export function wordleUtcDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function pickDailyWordleAnswer(date: Date | string): string {
  const key = typeof date === 'string' ? date : wordleUtcDateKey(date);
  const idx = wordleHash(key) % WORDLE_POOL.length;
  return WORDLE_POOL[idx];
}
