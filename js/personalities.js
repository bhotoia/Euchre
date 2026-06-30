// personalities.js — gives the AI seats a face and a voice. Used in Solo/Train
// (seat 0 is the human) and in Tournaments, where opponents are drawn from the
// ROSTER below. Reaction lines are chosen by the character's tone; ui.js renders
// them as speech bubbles with a cooldown so they never spam.

// Default casual seats (Solo/Train). index by seat (0 = you, no character).
export const CHARACTERS = [
  null,
  { id: 'vera', name: 'Vera', emoji: '🦊', tone: 'bold',   color: '#ff7a6b' }, // seat 1 (West)
  { id: 'mac',  name: 'Mac',  emoji: '🐻', tone: 'steady', color: '#4ea3ff' }, // seat 2 (Partner)
  { id: 'pip',  name: 'Pip',  emoji: '🦉', tone: 'sly',    color: '#e8c468' }, // seat 3 (East)
];

// Tournament roster — referenced by id from tournaments.js. `bio` shows on the
// tournament detail screen; `tone` selects the voice; `lines` (optional) overrides
// specific events with signature taunts.
export const ROSTER = {
  vera:  { name: 'Vera',   emoji: '🦊', color: '#ff7a6b', tone: 'bold',   style: 'aggressor', bio: 'Fearless. Orders up on a prayer and usually makes it.' },
  mac:   { name: 'Mac',    emoji: '🐻', color: '#4ea3ff', tone: 'steady', style: 'grinder',   bio: 'Your dependable partner. Never overplays a hand.' },
  pip:   { name: 'Pip',    emoji: '🦉', color: '#e8c468', tone: 'sly',    style: 'punisher',  bio: 'Patient and tricky. Sets traps and waits.' },
  duke:  { name: 'Duke',   emoji: '🐗', color: '#e8772e', tone: 'brash',  style: 'aggressor', bio: 'All gas, no brakes. Leads trump and dares you to stop him.' },
  coral: { name: 'Coral',  emoji: '🐬', color: '#34d27b', tone: 'calm',   style: 'punisher',  bio: 'Cool under pressure. Counts every card.' },
  rex:   { name: 'Rex',    emoji: '🦁', color: '#e8c468', tone: 'cocky',  style: 'aggressor', bio: 'Thinks he’s the best at the table. Sometimes he is.' },
  nyx:   { name: 'Nyx',    emoji: '🐈‍⬛', color: '#9b8cff', tone: 'icy', style: 'punisher',  bio: 'Silent and surgical. Punishes every mistake.' },
  sage:  { name: 'Sage',   emoji: '🐢', color: '#7fd4c1', tone: 'wily',   style: 'grinder',   bio: 'Old-school grinder. Has seen every hand twice.' },
  bo:    { name: 'Bo',     emoji: '🐶', color: '#ffb454', tone: 'jolly',  style: 'grinder',   bio: 'Here for a good time. Dangerous when underestimated.' },
  kit:   { name: 'Kit',    emoji: '🐥', color: '#9be36b', tone: 'rookie', style: 'grinder',   bio: 'Eager newcomer. Bold, but leaks tells.' },
  vesper:{ name: 'Vesper', emoji: '🐦‍⬛', color: '#c8a24a', tone: 'sly',  style: 'punisher',  bio: 'Runs the back room. Smiles when you misplay.' },
};

// Opponent pairs get a compact team identity for the scoreboard and results.
// West contributes the adjective; East contributes the noun, so every pairing
// (including seeded Daily pairs and tournament substitutions) has a stable name.
const TEAM_ADJECTIVE = {
  vera: 'Crimson', mac: 'Blue', pip: 'Midnight', duke: 'Iron', coral: 'Silver',
  rex: 'Royal', nyx: 'Shadow', sage: 'Ancient', bo: 'Golden', kit: 'Rising', vesper: 'Blackwing',
};
const TEAM_NOUN = {
  vera: 'Foxes', mac: 'Bears', pip: 'Owls', duke: 'Boars', coral: 'Tide',
  rex: 'Pride', nyx: 'Shadows', sage: 'Guard', bo: 'Hounds', kit: 'Upstarts', vesper: 'Ravens',
};

export function teamNameForPair(westId, eastId) {
  const west = TEAM_ADJECTIVE[westId] || ROSTER[westId]?.name || 'House';
  const east = TEAM_NOUN[eastId] || ROSTER[eastId]?.name || 'Players';
  return `${west} ${east}`;
}

const LINES = {
  intro: {
    bold:   ['Hope you brought your A-game.', 'Let’s make this quick.'],
    steady: ['Good luck out there.', 'May the better team win.'],
    sly:    ['This should be fun… for me.', 'I’ve read your tells already.'],
    brash:  ['Sit down — this won’t take long.', 'I eat callers like you for breakfast.'],
    calm:   ['No pressure. For me.', 'I’ll be counting.'],
    cocky:  ['You’re lucky to share my table.', 'Try to keep up.'],
    icy:    ['…', 'Begin.'],
    wily:   ['Been playing since before you were dealt in.', 'Let’s see what you’ve got.'],
    jolly:  ['Ahaha, let’s play!', 'Win or lose, this’ll be a blast!'],
    rookie: ['I’ve been practicing!', 'Okay okay, here we go!'],
  },
  order: {
    bold:   ['I’ll take that!', 'Mine. Easy.', 'Order up!'],
    steady: ['Picking it up.', 'I like this hand.'],
    sly:    ['Don’t mind if I do…', 'Heh — perfect.'],
    brash:  ['Up it goes! Deal with it.', 'That’s mine.'],
    calm:   ['I’ll order it.', 'This works.'],
    cocky:  ['Obviously I’m taking that.', 'Too easy. Up.'],
    icy:    ['Up.'],
    wily:   ['I’ll have that, thanks.'],
    jolly:  ['Ooh, yes please!', 'Up up up!'],
    rookie: ['Um — order up!', 'I think… yeah, take it!'],
  },
  call: {
    bold:   ['Trump’s mine!', 'Let’s dance.'],
    steady: ['I’ll name it.', 'Trump it is.'],
    sly:    ['This’ll do nicely…'],
    brash:  ['My suit now. Tough luck.'],
    cocky:  ['Watch and learn — trump.'],
    icy:    ['Trump.'],
    jolly:  ['Let’s try this one!'],
    rookie: ['I’ll… call this!'],
  },
  euchredThem: {
    bold:   ['Euchred! Sit down.', 'Gotcha!'],
    steady: ['That’s a euchre.', 'Set ’em up.'],
    sly:    ['You walked right into it…'],
    brash:  ['SET! Hahaha!', 'Down you go!'],
    calm:   ['And that’s a set.'],
    cocky:  ['Told you. Euchred.'],
    icy:    ['Set.'],
    wily:   ['Old trick. Euchred.'],
    jolly:  ['Whoops — euchred ya!'],
    rookie: ['Wait, I euchred you?! Yes!'],
  },
  gotEuchred: {
    bold:   ['Ugh — robbed!', 'No way!'],
    steady: ['Hmm. My miscalc.'],
    sly:    ['…I’ll remember that.'],
    brash:  ['Lucky. Won’t happen again.'],
    calm:   ['Noted.'],
    cocky:  ['A fluke. Clearly.'],
    icy:    ['…'],
    wily:   ['Hmph. Well played.'],
    jolly:  ['Hah! You got me!'],
    rookie: ['Aw, man…'],
  },
  march: {
    bold:   ['All five — sweep!', 'Clean sweep!'],
    steady: ['Marched it.'],
    sly:    ['Every trick. Lovely.'],
    brash:  ['ALL FIVE. Bow down.'],
    cocky:  ['A march, naturally.'],
    icy:    ['Five.'],
    jolly:  ['Wheee, all of them!'],
    rookie: ['I got ALL of them?!'],
  },
  trick: {
    bold:   ['Boom.', 'Mine!'],
    steady: ['Got it.'],
    sly:    ['Tsk, too easy.'],
    brash:  ['Yoink!'],
    cocky:  ['Of course.'],
    icy:    ['.'],
    wily:   ['Mm-hm.'],
    jolly:  ['Gotcha!'],
    rookie: ['Got one!'],
  },
  praise: {
    steady: ['Nice call, partner!', 'Good read.', 'I’m with you.', 'Sharp.'],
  },
  winMatch: {
    bold:   ['Told you I’d win.', 'Next!'],
    steady: ['Good game. Well played.'],
    sly:    ['Predictable, but fun.'],
    brash:  ['Easy money. Who’s next?'],
    calm:   ['As expected. Good game.'],
    cocky:  ['Was there ever any doubt?'],
    icy:    ['Done.'],
    wily:   ['Same as it ever was.'],
    jolly:  ['What a match! Good fun!'],
    rookie: ['I actually won! Wow!'],
  },
  loseMatch: {
    bold:   ['You earned that one.', 'Rematch. Now.'],
    steady: ['Well played. You’re good.'],
    sly:    ['Hmph. You’re learning.'],
    brash:  ['Fine. FINE. Rematch.'],
    calm:   ['Clean. You’ve improved.'],
    cocky:  ['…I let you have that one.'],
    icy:    ['…congratulations.'],
    wily:   ['Heh. The kid’s got game.'],
    jolly:  ['Beautiful play! Gg!'],
    rookie: ['You’re really good!'],
  },
};

// Pick a line for a tone+event, falling back gracefully when a tone lacks one.
export function line(tone, event) {
  const table = LINES[event];
  if (!table) return '';
  const pool = table[tone] || table.steady || Object.values(table)[0];
  if (!pool || !pool.length) return '';
  return pool[(Math.random() * pool.length) | 0];
}

// Line for a specific roster character: prefer a per-character override, then tone.
export function characterLine(charId, event) {
  const ch = ROSTER[charId];
  if (!ch) return '';
  const override = ch.lines?.[event];
  if (override && override.length) return override[(Math.random() * override.length) | 0];
  return line(ch.tone, event);
}
