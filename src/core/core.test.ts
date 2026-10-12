// ============================================================
// core.test.ts — Facit-tester för nya solver-kärnan
// ============================================================
import { describe, it, expect } from 'vitest';
import { rowValues, settle, royaltyOf, catOf, scoreVs, flEntryCards, qualifiesRepeat,
  HC, PAIR, STRAIGHT, FLUSH, FIVE_KIND, ROYAL, STRAIGHT_FLUSH } from './eval';
import { solveFantasyLand } from './fl';
import { opponentPool } from './sim';
import { parseCard } from '../engine/card';
import { createEmptyBoard } from '../engine/types';
import type { Board } from '../engine/types';
import { solveFromBoard } from '../solver/solver';

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
