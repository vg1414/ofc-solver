// ============================================================
// core.test.ts — Facit-tester för nya solver-kärnan
// ============================================================
import { describe, it, expect } from 'vitest';
import { rowValues, settle, royaltyOf, catOf, scoreVs, flEntryCards, qualifiesRepeat,
  HC, PAIR, STRAIGHT, FLUSH, FIVE_KIND, ROYAL, STRAIGHT_FLUSH, toInt } from './eval';
import { solveFantasyLand, evaluateFLAssign } from './fl';
import { opponentPool, evaluateCandidates } from './sim';
import { parseCard } from '../engine/card';
import { createEmptyBoard } from '../engine/types';
import type { Board, RowName } from '../engine/types';
import { solveFromBoard, solveOpeningHand, solveFantasyLandMode } from '../solver/solver';
import type { PinnedMove } from '../solver/solver';

const R = '23456789TJQKA', S = 'cdhs';
let jk = 0;
/** "Ah Kd Jk" → heltal (Jk = joker) */
const c = (s: string) => s.split(' ').map((x) => (x === 'Jk' ? 52 + (jk++ % 2) : R.indexOf(x[0]) * 4 + S.indexOf(x[1])));
const v = (s: string) => rowValues(c(s))[0];

describe('handvärdering', () => {
  it('känner igen kategorier', () => {
    expect(catOf(v('Ah 2d 3c 4s 5h'))).toBe(STRAIGHT); // hjulet
    expect(catOf(v('2h 7h 9h Jh Kh'))).toBe(FLUSH);
    expect(catOf(v('Ah Kh Qh Jh Th'))).toBe(ROYAL);
    expect(catOf(v('As Ad Ah Ac Jk'))).toBe(FIVE_KIND);
  });
  it('royal flush slår 5-tal, 5-tal slår straight flush', () => {
    expect(v('Ah Kh Qh Jh Th')).toBeGreaterThan(v('As Ad Ah Ac Jk'));
    expect(v('As Ad Ah Ac Jk')).toBeGreaterThan(v('9h Kh Qh Jh Th'));
    expect(catOf(v('9h Kh Qh Jh Th'))).toBe(STRAIGHT_FLUSH);
  });
  it('hjulet är lägsta stegen', () => {
    expect(v('Ah 2d 3c 4s 5h')).toBeLessThan(v('2h 3d 4c 5s 6h'));
  });
  it('topp jämförs rätt mot middle (AKQ < AKQJ9, KK5 < KK543)', () => {
    expect(v('Ah Kd Qc')).toBeLessThan(v('As Kh Qd Jc 9s'));
    expect(v('Kh Kd 5c')).toBeLessThan(v('Ks Kc 5d 4c 3s'));
  });
});

describe('foul & jokrar', () => {
  it('lika starka rader är inte foul', () => {
    // middle och bottom: båda par i kungar med samma kickers
    expect(settle(c('2c 3d 4h'), c('Kh Kd 9c 7s 5h'), c('Ks Kc 9d 7h 5c')).foul).toBe(false);
  });
  it('jokern på toppen väljs så att handen inte foulear', () => {
    // Joker kunde bli K (KK > QQ i middle) — väljs istället som 5 → par 5:or
    const s = settle(c('Jk Kc 5d'), c('Qs Qd 7c 4h 3s'), c('Ac Ad Ah 2c 2d'));
    expect(s.foul).toBe(false);
    expect(catOf(s.top)).toBe(PAIR);
    expect(royaltyOf(s.top, 0)).toBe(0); // 55 ger 0p
  });
  it('riktig foul upptäcks', () => {
    expect(settle(c('Ah Ad 2c'), c('Ks Qd 7c 4h 3s'), c('Ac Kd Kh 2h 2d')).foul).toBe(true);
  });
});

describe('royalties & FL', () => {
  it('middle ger dubbelt, triss 0/2p', () => {
    expect(royaltyOf(v('2h 7h 9h Jh Kh'), 2)).toBe(4);
    expect(royaltyOf(v('2h 7h 9h Jh Kh'), 1)).toBe(8);
    expect(royaltyOf(v('9h 9d 9c 2s 5h'), 2)).toBe(0);
    expect(royaltyOf(v('9h 9d 9c 2s 5h'), 1)).toBe(2);
    expect(royaltyOf(v('As Ad Ah Ac Jk'), 2)).toBe(20);
    expect(royaltyOf(v('As Ad Ah Ac Jk'), 1)).toBe(40);
  });
  it('topp: 66=1p, AA=9p, 222=10p, AAA=22p', () => {
    expect(royaltyOf(v('6h 6d 2c'), 0)).toBe(1);
    expect(royaltyOf(v('Ah Ad 2c'), 0)).toBe(9);
    expect(royaltyOf(v('2h 2d 2c'), 0)).toBe(10);
    expect(royaltyOf(v('Ah Ad Ac'), 0)).toBe(22);
  });
  it('FL-inträde och repeat', () => {
    expect(flEntryCards(v('Qh Qd 2c'))).toBe(13);
    expect(flEntryCards(v('Ah Ad 2c'))).toBe(15);
    expect(flEntryCards(v('3h 3d 3c'))).toBe(16);
    expect(flEntryCards(v('Jh Jd Ac'))).toBe(0);
    expect(qualifiesRepeat(v('2c 3d 4h'), v('9h 9d 9c 2s 2h'), v('Ac Ad Ah Kc Kd'))).toBe(true); // kåk middle
    expect(qualifiesRepeat(v('2c 3d 4h'), v('9h 9d 8c 2s 2h'), v('Ac Ad Ah As Kd'))).toBe(true); // fyrtal bottom
    expect(qualifiesRepeat(v('2c 3d 4h'), v('9h 9d 8c 2s 2h'), v('Ac Ad Ah Ks Kd'))).toBe(false);
  });
});

describe('poäng', () => {
  it('scoop ger 6p, foul ger 6p + royalties', () => {
    const a = settle(c('Ah Ad 2c'), c('Ks Kd Kc 4h 3s'), c('Ac 9c 7c 5c 3c'));
    const b = settle(c('2h 3d 4c'), c('5s 6d 8c Th Js'), c('7s 7d 9h Qd Kh'));
    expect(scoreVs(a, b)).toBe(6 + a.roy - b.roy);
    expect(scoreVs(b, a)).toBe(-scoreVs(a, b));
    const f = settle(c('Ah Ad 2c'), c('Ks Qd 7c 4h 3s'), c('Ac Kd Kh 2h 2d'));
    expect(scoreVs(a, f)).toBe(6 + a.roy);
  });

  it('royalty bara till radens vinnare (husregel), lika rad = ingen', () => {
    // A: Q-färg i botten, B: A-färg i botten → bara B får botten-royaltyn (4p)
    const a = settle(c('Kd Tc 8h'), c('4h 4s 3h 7c 5d'), c('Qd Td 6d 7d 8d'));
    const b = settle(c('Qh Kh 8c'), c('2c 5c 5s 7h 9h'), c('9s Js Qs 3s As'));
    expect(a.rb).toBe(4);
    expect(b.rb).toBe(4);
    // topp: A (K-T-8) < B (K-Q-8), mitt: A (44) < B (55), botten: A < B → B scoopar
    expect(scoreVs(a, b)).toBe(-(3 + 3 + b.roy));
    // Botten vunnen av A: A får sin, B:s går förlorad
    const a2 = settle(c('Kd Tc 8h'), c('4h 4s 3h 7c 5d'), c('Jk Ac Ad Ah 2c'));
    expect(scoreVs(a2, b)).toBe(-1 + a2.rb - b.rm - b.rt);
  });
});

describe('Fantasy Land-lösaren', () => {
  it('hittar royal flush + fyrtal (och repeat-FL)', () => {
    const cards = c('Ah Kh Qh Jh Th 9s 9d 9c 9h 2c 3d 4s 6h');
    const best = solveFantasyLand(cards, opponentPool('regular', 300))[0];
    const rowOf = (i: number) => best.assign[i];
    expect([0, 1, 2, 3, 4].every((i) => rowOf(i) === 2)).toBe(true); // royal i bottom
    expect([5, 6, 7, 8].every((i) => rowOf(i) === 1)).toBe(true);    // fyrtal i middle
    expect(best.repeat).toBe(true);
    expect(best.royalties).toBe(25 + 20);
  });
});

const board = (t: string, m: string, b: string): Board => {
  const bd = createEmptyBoard();
  t.split(' ').filter(Boolean).forEach((x, i) => (bd.top.cards[i] = parseCard(x)));
  m.split(' ').filter(Boolean).forEach((x, i) => (bd.middle.cards[i] = parseCard(x)));
  b.split(' ').filter(Boolean).forEach((x, i) => (bd.bottom.cards[i] = parseCard(x)));
  return bd;
};

describe('solvern', () => {
  it('lägger inte T på toppen när det skulle ge TT > 99 (foul)', () => {
    const bd = board('Th 7c', '9s 9d 5c 4h', 'Ac Ad Ah 2c 2d');
    const r = solveFromBoard(bd, [parseCard('Td')], [], 'regular', { simulations: 400 });
    expect(r.best.primaryRow).toBe('middle');
  });
  it('gör triss i middle hellre än att riskera foul', () => {
    const bd = board('Qc Qh', '7h 7d 5s', 'Ac Ad Ah 8d');
    const r = solveFromBoard(bd, [parseCard('7s')], [], 'regular', { simulations: 800 });
    expect(r.best.primaryRow).toBe('middle');
  });
  it('fortsätter på färgen i bottom', () => {
    const bd = board('2c 7d', '9s 9d', 'Ah Jh 8h 4h');
    const r = solveFromBoard(bd, [parseCard('3h')], [], 'regular', { simulations: 800 });
    expect(r.best.primaryRow).toBe('bottom');
  });
});

describe('progress', () => {
  it('går aldrig bakåt och slutar på 100 (öppningshand med grovsållning)', () => {
    const seen: number[] = [];
    const cards = 'Ah Kd 7c 7s 2h'.split(' ').map((x) => parseCard(x));
    solveOpeningHand(cards, [], { simulations: 100, maxMs: 4000, onProgress: (p) => seen.push(p) });
    expect(seen.length).toBeGreaterThan(2);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThan(seen[i - 1]);
    expect(seen.some((p) => p > 0 && p < 20)).toBe(true); // rapporterar under sållningen
    expect(seen[seen.length - 1]).toBe(100);
  });
});

describe('låsta drag (pinned)', () => {
  const cards = 'Ah Kd 7c 7s 2h'.split(' ').map((x) => parseCard(x));
  // Uppenbart dåligt: paret delas, A och K på toppen
  const rows: RowName[] = ['top', 'top', 'middle', 'bottom', 'middle'];
  const bad: PinnedMove = cards.map((card, k) => ({ card, row: rows[k] }));
  const sameMove = (o: { placements: { row: RowName }[] }) => o.placements.every((p, k) => p.row === rows[k]);

  it('dåligt låst drag räknas lika noga som bästa draget, och nära en separat körning', () => {
    const r = solveOpeningHand(cards, [], { simulations: 300, maxMs: 60000, pinned: [bad] });
    const mine = r.options.find((o) => o.pinned)!;
    expect(sameMove(mine)).toBe(true);
    expect(mine.finalist).toBe(true);
    expect(mine.simulations).toBe(r.best.simulations);
    expect(mine.ev).toBeLessThan(r.best.ev);
    expect(r.best.evDiffSE).toBe(0);
    expect(mine.evDiffSE!).toBeGreaterThan(0);
    // Separat körning med bara det draget (samma blandningar, frö i sim.ts)
    const hand = cards.map((c) => toInt(c));
    const unseen = Array.from({ length: 54 }, (_, i) => i).filter((i) => !hand.includes(i));
    const alone = evaluateCandidates(
      { rows: [[], [], []], hand, unseen, variant: 'regular', maxSims: 300, maxMs: 60000 },
      [{ assign: rows.map((x) => ['top', 'middle', 'bottom'].indexOf(x)), pinned: true }],
    )[0];
    expect(alone.sims).toBe(mine.simulations);
    expect(Math.abs(alone.ev - mine.ev)).toBeLessThan(1);
  }, 120000);

  it('pinnedOnly: räknar bara de låsta dragen, med samma siffror som en hel körning', () => {
    const full = solveOpeningHand(cards, [], { simulations: 300, maxMs: 60000, pinned: [bad] });
    const mine = full.options.find((o) => o.pinned)!;
    const best: PinnedMove = [...full.best.placements.map((p) => ({ card: p.card, row: p.row })), ...full.best.discards.map((card) => ({ card, row: 'discard' as const }))];
    const r = solveOpeningHand(cards, [], { simulations: 300, maxMs: 60000, pinned: [bad, best], pinnedOnly: true });
    expect(r.options).toHaveLength(2);
    expect(r.options.every((o) => o.pinned && o.finalist)).toBe(true);
    // Samma blandningar och samma provframtider → exakt samma EV som i den hela körningen
    expect(r.best.ev).toBe(full.best.ev);
    expect(r.options.find((o) => sameMove(o))!.ev).toBe(mine.ev);
  }, 120000);

  it('utan pinned: inga låsta, finalist-flaggan finns', () => {
    const bd = board('2c 7d', '9s 9d', 'Ah Jh 8h 4h');
    const r = solveFromBoard(bd, [parseCard('3h')], [], 'regular', { simulations: 200 });
    expect(r.options.some((o) => o.pinned)).toBe(false);
    expect(r.best.finalist).toBe(true);
    expect(r.options.every((o) => typeof o.finalist === 'boolean')).toBe(true);
  });

  it('Pineapple: låst drag med kast följer med till slutet', () => {
    const bd = board('2c 7d', '9s 9d 5c', 'Ah Jh 8h 4h');
    const hand = '3h Kc Qs'.split(' ').map((x) => parseCard(x));
    const pin: PinnedMove = [{ card: hand[0], row: 'top' }, { card: hand[1], row: 'middle' }, { card: hand[2], row: 'discard' }];
    const r = solveFromBoard(bd, hand, [], 'pineapple', { simulations: 200, maxMs: 30000, pinned: [pin] });
    const mine = r.options.find((o) => o.pinned)!;
    expect(mine.discards).toEqual([hand[2]]);
    expect(mine.finalist).toBe(true);
    expect(mine.simulations).toBe(r.best.simulations);
  }, 60000);

  it('ogiltigt låst drag ger tydligt fel', () => {
    const bd = board('2c 7d', '9s 9d', 'Ah Jh 8h 4h');
    expect(() => solveFromBoard(bd, [parseCard('3h')], [], 'regular', { pinned: [[{ card: parseCard('4h'), row: 'bottom' }]] })).toThrow();
    // Raden är full
    const full = board('2c 7d', '9s 9d', 'Ah Jh 8h 4h 5h');
    expect(() => solveFromBoard(full, [parseCard('3h')], [], 'regular', { pinned: [[{ card: parseCard('3h'), row: 'bottom' }]] })).toThrow();
  });
});

describe('Jämför: två låsta drag', () => {
  it('vanligt drag: båda räknas klart, felmarginal mot det första låsta', () => {
    const bd = board('2c 7d', '9s 9d', 'Ah Jh 8h 4h');
    const card = parseCard('3h');
    const a: PinnedMove = [{ card, row: 'top' }];
    const b: PinnedMove = [{ card, row: 'middle' }];
    const r = solveFromBoard(bd, [card], [], 'regular', { simulations: 200, maxMs: 30000, pinned: [a, b] });
    const oa = r.options.find((o) => o.placements[0].row === 'top')!;
    const ob = r.options.find((o) => o.placements[0].row === 'middle')!;
    expect(oa.pinned && ob.pinned).toBe(true);
    expect(oa.finalist && ob.finalist).toBe(true);
    expect(oa.evDiffSEPin0).toBe(0);
    expect(ob.evDiffSEPin0!).toBeGreaterThan(0);
  }, 60000);

  it('Fantasy Land: egen uppställning räknas exakt och läggs till i listan', () => {
    const hand = 'Ah Ad Kc Qs Jh Th 9h 8h 7c 6d 5s 4c 3d 2h'.split(' ').map((x) => parseCard(x));
    // Medvetet svag: de första 3 i topp, nästa 5 i mitten, sista 5 i botten, sista kortet kastas
    const rows: ('top' | 'middle' | 'bottom' | 'discard')[] = [...Array(3).fill('top'), ...Array(5).fill('middle'), ...Array(5).fill('bottom'), 'discard'];
    const mine: PinnedMove = hand.map((card, k) => ({ card, row: rows[k] }));
    const r = solveFantasyLandMode(hand, [], { pinned: [mine] });
    const o = r.options.find((x) => x.pinned)!;
    expect(o).toBeDefined();
    expect(o.ev).toBeLessThanOrEqual(r.best.ev);
    // Samma värde som den exakta lösarens värdering av samma uppställning
    const ids = hand.map((x) => toInt(x));
    const assign = rows.map((x) => (x === 'discard' ? -1 : ['top', 'middle', 'bottom'].indexOf(x)));
    expect(o.ev).toBeCloseTo(evaluateFLAssign(ids, assign, opponentPool('regular')).ev, 6);
    // Bästa uppställningen värderas likadant av båda vägarna
    const best = solveFantasyLand(ids, opponentPool('regular'))[0];
    expect(evaluateFLAssign(ids, best.assign, opponentPool('regular')).ev).toBeCloseTo(best.ev, 6);
  }, 60000);
});

describe('Jämför fritt: hela bräden från tomt bräde', () => {
  it('samma läggning ger samma EV som draget från det riktiga brädet', () => {
    const bd = board('2c 7d', '9s 9d', 'Ah Jh 8h 4h');
    const card = parseCard('3h');
    const normal = solveFromBoard(bd, [card], [], 'regular', { simulations: 150, maxMs: 30000, pinned: [[{ card, row: 'bottom' }]], pinnedOnly: true });
    const rowsOf: [string, RowName][] = [['2c 7d', 'top'], ['9s 9d', 'middle'], ['Ah Jh 8h 4h', 'bottom']];
    const earlier = rowsOf.flatMap(([s, row]) => s.split(' ').map((x) => ({ card: parseCard(x), row })));
    const all = [...earlier.map((p) => p.card), card];
    const a: PinnedMove = [...earlier, { card, row: 'bottom' }];
    // B: 9:orna flyttade till botten, flushkorten upp i mitten
    const b: PinnedMove = a.map((p) => ({ ...p, row: p.card.kind === 'card' && p.card.rank === '9' ? 'bottom' : p.row === 'bottom' && p.card.kind === 'card' && p.card.suit === 'hearts' && p.card.rank !== 'A' ? 'middle' : p.row })) as PinnedMove;
    const free = solveFromBoard(createEmptyBoard(), all, [], 'regular', { simulations: 150, maxMs: 30000, pinned: [a, b], pinnedOnly: true });
    expect(free.options).toHaveLength(2);
    const fa = free.options.find((o) => o.placements.find((p) => p.card === all[2])!.row === 'middle')!;
    expect(fa.ev).toBeCloseTo(normal.best.ev, 1);
  }, 60000);
});
