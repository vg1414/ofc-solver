import { describe, expect, it } from 'vitest';
import type { Card } from '../engine/types';
import type { DetailedPlacementOption, DetailedSolverResult } from '../solver/solver';
import { applyMove, countPlaced, emptyBoard, gradeOf, judge, moveKey, placementsOn, pointsFor, wasScreenedEarly } from './moves';
import { settleHand, turnOrder, newSeat, applyToSeat } from './game';
import { insertEntry, qualifies, makeEntry, type LeaderboardEntry } from './leaderboard';

const c = (s: string): Card => (s === 'JK' ? { kind: 'joker' } : { kind: 'card', rank: s[0] as never, suit: ({ s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' } as const)[s[1] as 's'] });

function opt(ev: number, sims: number, rows: [string, 'top' | 'middle' | 'bottom'][], discards: string[] = []): DetailedPlacementOption {
  return {
    ev,
    rank: 0,
    primaryRow: 'bottom',
    placements: rows.map(([k, row], i) => ({ card: c(k), row, slotIndex: i })),
    discards: discards.map(c),
    simulations: sims,
  };
}

function res(options: DetailedPlacementOption[]): DetailedSolverResult {
  return { options, best: options[0], simulations: 0, timedOut: false, method: 'monteCarlo' };
}

describe('träning: matchning av drag', () => {
  it('slotIndex spelar ingen roll, ordningen inte heller', () => {
    const a = moveKey({ placements: [{ card: c('As'), row: 'top' }, { card: c('Kd'), row: 'bottom' }], discards: [] });
    const b = moveKey({ placements: [{ card: c('Kd'), row: 'bottom' }, { card: c('As'), row: 'top' }], discards: [] });
    expect(a).toBe(b);
  });

  it('jokrar räknas som lika, kastade kort skiljer drag åt', () => {
    const r = res([
      opt(1.2, 2000, [['As', 'bottom'], ['JK', 'middle']], ['2c']),
      opt(0.7, 400, [['As', 'bottom'], ['2c', 'middle']], ['JK']),
    ]);
    const j = judge(r, { placements: [{ card: { kind: 'joker' }, row: 'middle', slotIndex: 4 }, { card: c('As'), row: 'bottom', slotIndex: 0 }], discards: [c('2c')] });
    expect(j.grade).toBe('perfect');
    expect(j.points).toBe(100);

    const k = judge(r, { placements: [{ card: c('2c'), row: 'middle', slotIndex: 0 }, { card: c('As'), row: 'bottom', slotIndex: 0 }], discards: [{ kind: 'joker' }] });
    expect(k.diff).toBeCloseTo(0.5);
    expect(k.points).toBe(50);
    expect(k.screened).toBe(true); // 400 < 50 % av 2000
  });

  it('aldrig negativ diff när ett bortsållat drag har högre EV än best', () => {
    const r = res([opt(1.0, 2000, [['As', 'bottom']]), opt(1.3, 100, [['As', 'top']])]);
    const j = judge(r, { placements: [{ card: c('As'), row: 'top', slotIndex: 0 }], discards: [] });
    expect(j.diff).toBe(0);
    expect(j.points).toBe(100);
  });
});

describe('träning: bortsållat drag (finalist)', () => {
  it('solverns finalist-flagga går före tumregeln', () => {
    const best = { ...opt(1.0, 2000, [['As', 'bottom']]), finalist: true };
    // Lika många simuleringar men inte finalist → bortsållat
    expect(wasScreenedEarly({ ...opt(0.8, 2000, [['As', 'top']]), finalist: false }, best)).toBe(true);
    // Låst/finalist → säker, även med färre simuleringar (tidsgränsen)
    expect(wasScreenedEarly({ ...opt(0.8, 900, [['As', 'top']]), finalist: true }, best)).toBe(false);
    // Bästa draget själv är aldrig bortsållat
    expect(wasScreenedEarly(best, best)).toBe(false);
  });
  it('utan finalist-fält (t.ex. Fantasy Land) används tumregeln', () => {
    const best = opt(1.0, 2000, [['As', 'bottom']]);
    expect(wasScreenedEarly(opt(0.8, 999, [['As', 'top']]), best)).toBe(true);
    expect(wasScreenedEarly(opt(0.8, 1000, [['As', 'top']]), best)).toBe(false);
  });
});

describe('träning: poäng och gradering', () => {
  it('100 − diff×100 med golv 0', () => {
    expect(pointsFor(0)).toBe(100);
    expect(pointsFor(0.01)).toBe(100); // Perfekt = fulla poäng
    expect(pointsFor(0.06)).toBe(94);
    expect(pointsFor(0.234)).toBe(77);
    expect(pointsFor(3)).toBe(0);
  });
  it('gränser 0,05 / 0,5', () => {
    expect(gradeOf(0.05)).toBe('perfect');
    expect(gradeOf(0.051)).toBe('good');
    expect(gradeOf(0.5)).toBe('good');
    expect(gradeOf(0.51)).toBe('miss');
  });
});

describe('träning: bräden och turordning', () => {
  it('applyMove lägger på första lediga plats', () => {
    let b = applyMove(emptyBoard(), [{ card: c('As'), row: 'bottom' }]);
    b = applyMove(b, [{ card: c('Ks'), row: 'bottom' }]);
    expect(b.bottom.cards[1]).toEqual(c('Ks'));
    expect(countPlaced(b)).toBe(2);
    expect(placementsOn(b, [{ card: c('Qs'), row: 'bottom' }, { card: c('Js'), row: 'bottom' }]).map((p) => p.slotIndex)).toEqual([2, 3]);
  });

  it('vanlig OFC: 9 rundor, 13 kort var', () => {
    const t = turnOrder('regular', 1);
    expect(t[0].seat).toBe(1);
    expect(t.filter((x) => x.seat === 0).reduce((n, x) => n + x.place, 0)).toBe(13);
  });

  it('pineapple: 5 + 4×(3 kort, lägg 2) = 13', () => {
    const mine = turnOrder('pineapple', 0).filter((x) => x.seat === 0);
    expect(mine.map((x) => x.count)).toEqual([5, 3, 3, 3, 3]);
    expect(mine.reduce((n, x) => n + x.place, 0)).toBe(13);
  });

  it('Fantasy Land: en tur med alla kort i runda 1', () => {
    const t = turnOrder('regular', 0, [15, 0]);
    const mine = t.filter((x) => x.seat === 0);
    expect(mine).toEqual([{ seat: 0, round: 1, count: 15, place: 13, fl: true }]);
    expect(t.filter((x) => x.seat === 1)).toHaveLength(9);
  });

  it('settleHand: QQ i topp ger 13 kort FL, foul ger 0', () => {
    let me = newSeat();
    me = applyToSeat(me, {
      placements: [
        ...['Qs', 'Qh', '2c'].map((k) => ({ card: c(k), row: 'top' as const, slotIndex: 0 })),
        ...['Ks', 'Kh', '3c', '4d', '5s'].map((k) => ({ card: c(k), row: 'middle' as const, slotIndex: 0 })),
        ...['As', 'Ah', 'Ad', '7c', '8d'].map((k) => ({ card: c(k), row: 'bottom' as const, slotIndex: 0 })),
      ],
      discards: [],
    });
    let cpu = newSeat();
    cpu = applyToSeat(cpu, {
      placements: [
        ...['As', 'Ac', '2h'].map((k) => ({ card: c(k), row: 'top' as const, slotIndex: 0 })),
        ...['3s', '4h', '6c', '8h', 'Th'].map((k) => ({ card: c(k), row: 'middle' as const, slotIndex: 0 })),
        ...['5h', '6d', '7h', '9s', 'Jd'].map((k) => ({ card: c(k), row: 'bottom' as const, slotIndex: 0 })),
      ],
      discards: [],
    });
    const o = settleHand(me, cpu);
    expect(o.nextFl).toEqual([13, 0]);
    expect(o.score.p2Foul).toBe(true);
    expect(o.score.p1Net).toBeGreaterThan(6);
  });
});

describe('träning: topplistor', () => {
  const e = (score: number, date: string): LeaderboardEntry => ({ id: date, name: 'x', score, date });
  it('topp 10, högst först, äldst först vid lika', () => {
    let list: LeaderboardEntry[] = [];
    for (let i = 0; i < 12; i++) list = insertEntry(list, e(i * 10, `2026-01-${String(i + 1).padStart(2, '0')}`));
    expect(list).toHaveLength(10);
    expect(list[0].score).toBe(110);
    expect(qualifies(list, 20)).toBe(false);
    expect(qualifies(list, 21)).toBe(true);
    list = insertEntry(list, e(110, '2027-01-01'));
    expect(list[1].date).toBe('2027-01-01');
  });
  it('tomt namn blir Anonym', () => {
    expect(makeEntry('   ', 5).name).toBe('Anonym');
  });
});

describe('visningsordning', () => {
  it('bästa först, resten efter EV', async () => {
    const { sortForDisplay } = await import('../hooks/solverOrder');
    const a = opt(2.0, 2000, [['As', 'bottom']]);
    const b = opt(0.5, 300, [['As', 'middle']]);
    const d = opt(2.4, 60, [['As', 'top']]);
    const s = sortForDisplay(res([a, b, d]));
    expect(s.options.map((o) => o.ev)).toEqual([2.0, 2.4, 0.5]);
    expect(s.best.ev).toBe(2.0);
    expect(s.options.map((o) => o.rank)).toEqual([1, 2, 3]);
  });
});

describe('jokerträning', () => {
  it('placeJokers flyttar jokrar till handens platser', async () => {
    const { placeJokers } = await import('./scenarios');
    const { buildDeck } = await import('../engine/deck');
    const deck = buildDeck(); // jokrarna ligger sist (52, 53)
    placeJokers(deck, 10, 2);
    expect(deck[10].kind).toBe('joker');
    expect(deck[11].kind).toBe('joker');
    expect(deck.filter((c) => c.kind === 'joker')).toHaveLength(2);
    const d2 = buildDeck();
    placeJokers(d2, 0, 1);
    expect(d2[0].kind).toBe('joker');
    expect(d2.filter((c) => c.kind === 'joker')).toHaveLength(2);
  });
});
