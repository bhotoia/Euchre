// rivals.js — tournament rivals: voice, signature reward, and your head-to-head
// record against each. Voice is "witty & cutting" — stylish, never crude.
// In-game reactions reuse event keys (euchredThem/gotEuchred/trick/order/call);
// faceoff/win/lose/stolen drive the face-off and post-match screens.

export const RIVALS = {
  // Marquee villain of The Cellar — a raven card-sharp.
  vesper: {
    name: 'Vesper', title: 'The Cellar Sharp',
    bio: 'Runs the back room. Smiles when you misplay — which, to her, is always.',
    style: 'punisher',
    signatureReward: { pack: 'obsidian', title: 'Cellar Shark' },
    lines: {
      faceoff: ['Fresh meat. Sit — I’ll make it quick.',
                'They told you I was beatable? They lied.',
                'Shuffle up. I do so love a donation.'],
      order:   ['Mine. Obviously.', 'I’ll take that, thanks.'],
      call:    ['Trump, and trouble — for you.'],
      euchredThem: ['Set. Predictable.', 'You telegraph everything, darling.'],
      gotEuchred:  ['…cute. It won’t happen twice.', 'A lucky thread. Snipped soon enough.'],
      trick:   ['Tsk. Mine.', 'Was that your plan?'],
      stolen:  ['Oh — bold. Noted.', 'Stealing from me? Brave.'],
      win:     ['As expected. Run along.', 'Come back when you can count cards.'],
      lose:    ['…well played. I won’t forget it.', 'Hm. You actually read me. Once.'],
    },
  },
  // Supporting: a brash boar who bids the roof down.
  duke: {
    name: 'Duke', title: 'The Bulldozer',
    bio: 'Bids big, leads trump, dares you to stop him. Subtlety is for owls.',
    style: 'aggressor',
    signatureReward: null,
    lines: {
      faceoff: ['Hah! Another one. Let’s wreck this.', 'No dancing. Just trump. Lots of it.'],
      order:   ['UP. Always up.', 'My suit. Deal with it.'],
      call:    ['Trump! Hit me harder, cards!'],
      euchredThem: ['BOOM. Set!', 'Down you go, scrub.'],
      gotEuchred:  ['Bah! Fluke.', 'Won’t stop me. Next!'],
      trick:   ['Yoink!', 'Too slow.'],
      stolen:  ['Oi! That was mine!', 'Cheeky little—'],
      win:     ['Bulldozed. Next!', 'That’s how it’s done.'],
      lose:    ['Ngh — you’ve got teeth. Fine.', 'Rematch. REMATCH.'],
    },
  },
  // ── Highland & Apex field ──
  vera: {
    name: 'Vera', title: 'The Gambler',
    bio: 'Bets the farm on a pair of nines and wins anyway. Infuriating.',
    style: 'aggressor', signatureReward: null,
    lines: {
      faceoff: ['Feeling lucky? Don’t. That’s my job.', 'I only know one speed: all in.'],
      order: ['Up. Live a little.', 'That’s coming home with me.'],
      call: ['Trump. Let’s gamble.'],
      euchredThem: ['Set! Should’ve folded.', 'House always wins, sweetheart.'],
      gotEuchred: ['Bad beat. I’ll allow it.', 'Variance. It evens out.'],
      trick: ['Cha-ching.', 'Rake it in.'],
      stolen: ['Oh, playing for keeps?', 'Bold bet.'],
      win: ['Pay the lady.', 'Always bet on Vera.'],
      lose: ['Hah — you out-gambled me. Once.', 'Lucky cards. Sit again.'],
    },
  },
  pip: {
    name: 'Pip', title: 'The Trapper',
    bio: 'Lets you think you’re winning right up until you aren’t.',
    style: 'punisher', signatureReward: null,
    lines: {
      faceoff: ['I’ve already seen how this ends.', 'Step into the parlour…'],
      order: ['I’ll take it. Quietly.', 'Mm. This suits me.'],
      call: ['Trump. The trap is set.'],
      euchredThem: ['And… snap. Euchred.', 'You never saw the wire.'],
      gotEuchred: ['Curious. You found the seam.', 'Hm. Noted, and filed.'],
      trick: ['Tick.', 'Just so.'],
      stolen: ['Patience. I’ll have it back.', 'Take it. For now.'],
      win: ['Predictable to the last card.', 'The web holds.'],
      lose: ['You read the trap. Impressive.', 'Hm. You’re not prey after all.'],
    },
  },
  coral: {
    name: 'Coral', title: 'The Calculator',
    bio: 'Counts every card and your odds with it. No tells, no nerves.',
    style: 'punisher', signatureReward: null,
    lines: {
      faceoff: ['I’ve run the numbers. You lose.', 'Cards are just math. Watch.'],
      order: ['Correct play: take it.', 'The math says up.'],
      call: ['Trump. Optimal.'],
      euchredThem: ['Outcome as calculated. Set.', 'Your line was -EV.'],
      gotEuchred: ['Variance within tolerance.', 'Recalculating…'],
      trick: ['As expected.', 'Naturally.'],
      stolen: ['A deviation. Interesting.', 'Noted in the count.'],
      win: ['Math doesn’t miss.', 'Q.E.D.'],
      lose: ['You beat the odds. Literally.', 'Your line was… better. Hm.'],
    },
  },
  nyx: {
    name: 'Nyx', title: 'The Closer',
    bio: 'Says nothing. Takes everything. Highland’s final word.',
    style: 'punisher', signatureReward: null,
    lines: {
      faceoff: ['…', 'Sit. Lose. Leave.'],
      order: ['Mine.', 'Up.'],
      call: ['Trump.'],
      euchredThem: ['Set.', 'Done.'],
      gotEuchred: ['…', 'Hm.'],
      trick: ['.', 'Mine.'],
      stolen: ['…bold.', 'Once.'],
      win: ['Closed.', 'Leave.'],
      lose: ['…you’re dangerous.', '…we’ll meet again.'],
    },
  },
  rex: {
    name: 'Rex', title: 'The Champion',
    bio: 'Wears the crown and won’t shut up about it. The Apex itself.',
    style: 'aggressor', signatureReward: null,
    lines: {
      faceoff: ['You climbed all this way… to lose to me.', 'I am the Apex. You are a footnote.'],
      order: ['Mine. As all things are.', 'Up. Bow later.'],
      call: ['Trump — and the crown stays put.'],
      euchredThem: ['Euchred! Know your place.', 'That’s why I wear the crown.'],
      gotEuchred: ['…impossible. Lucky.', 'A scratch. Nothing more.'],
      trick: ['Mine. Obviously.', 'Roar.'],
      stolen: ['You DARE?', 'Enjoy it. It’s the last.'],
      win: ['Long live the champion. Me.', 'Run home, challenger.'],
      lose: ['No… NO. You— you actually…', 'The crown… is yours. Earned.'],
    },
  },
  sage: {
    name: 'Sage', title: 'The Veteran',
    bio: 'Played a thousand hands before yours. Slow, certain, deadly.',
    style: 'grinder', signatureReward: null,
    lines: {
      faceoff: ['Seen a hundred like you, kid.', 'Take your time. I have plenty.'],
      order: ['I’ll have that. Slow and sure.', 'Up she goes.'],
      call: ['Trump. The old way.'],
      euchredThem: ['Set. Patience pays.', 'Rushed it, didn’t you.'],
      gotEuchred: ['Heh. Sharp.', 'Even old dogs get bit.'],
      trick: ['Mm-hm.', 'Steady does it.'],
      stolen: ['Spry one, aren’t you.', 'Cheeky.'],
      win: ['Experience tells.', 'Come back in ten years.'],
      lose: ['Well now. The kid’s got game.', 'Color me impressed.'],
    },
  },
  // Supporting: an eager rookie chick — endearing, leaks tells.
  kit: {
    name: 'Kit', title: 'The Hopeful',
    bio: 'New to the room and trying so hard. Watch the eyes — they tell you everything.',
    style: 'grinder',
    signatureReward: null,
    lines: {
      faceoff: ['Okay okay — I’ve been practicing!', 'Be gentle? …no? Okay!'],
      order:   ['Um — order up!', 'I think I can make this!'],
      call:    ['I’ll call… this one!'],
      euchredThem: ['I did it! I euchred you!', 'Wait — that worked?!'],
      gotEuchred:  ['Aw, beans.', 'I knew I shouldn’t have…'],
      trick:   ['Got one!', 'Yes! A trick!'],
      stolen:  ['Hey, no fair!', 'Aw, I wanted that.'],
      win:     ['I actually won?! I WON!', 'Did you see that?!'],
      lose:    ['So close! You’re really good.', 'Good game! I’ll get you next time!'],
    },
  },
};

export function rivalById(id) { return RIVALS[id] || null; }
export function isRival(id) { return !!RIVALS[id]; }

export function rivalLine(id, event) {
  const r = RIVALS[id];
  const pool = r && r.lines && r.lines[event];
  if (!pool || !pool.length) return '';
  return pool[(Math.random() * pool.length) | 0];
}

// ─── head-to-head record ───
export const RIVALS_KEY = 'euchre.rivals.v1';

export function loadRivals() {
  try { return JSON.parse(localStorage.getItem(RIVALS_KEY) || '{}') || {}; }
  catch { return {}; }
}
export function saveRivals(store) {
  try { localStorage.setItem(RIVALS_KEY, JSON.stringify(store)); } catch {}
  return store;
}
export function h2h(store, id) { return store[id] || { wins: 0, losses: 0, beaten: false }; }

// Record a match result vs a rival from YOUR perspective. Returns the new record.
export function recordVsRival(store, id, youWon) {
  const r = { ...h2h(store, id) };
  if (youWon) { r.wins += 1; r.beaten = true; } else { r.losses += 1; }
  store[id] = r;
  return r;
}
