import { describe, expect, it } from 'vitest';
import type { Card } from '../engine/types';
import type { DetailedPlacementOption, DetailedSolverResult } from '../solver/solver';
import { applyMove, countPlaced, emptyBoard, gradeOf, judge, moveKey, placementsOn, pointsFor, wasScreenedEarly } from './moves';
import { settleHand, turnOrder, newSeat, applyToSeat } from './game';
import { cardDiffs, explainMove } from './explain';
import { insertEntry, qualifies, makeEntry, type LeaderboardEntry } from './leaderboard';
import { scenarioDifficulty } from './scenarios';

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

describe('träning: session mot datorn', () => {
  const base = { flEnd: 'playout' as const, coach: false, cpuLevel: 'normal' as const };
  it('antal händer: slut efter n händer, men FL spelas ut först', async () => {
    const { sessionOver } = await import('./session');
    const s = { ...base, length: { kind: 'hands' as const, n: 10 } };
    expect(sessionOver(s, 9, 0, [0, 0])).toBe(false);
    expect(sessionOver(s, 10, 0, [0, 0])).toBe(true);
    expect(sessionOver(s, 10, 0, [14, 0])).toBe(false); // du har FL → en hand till
    expect(sessionOver(s, 11, 0, [0, 13])).toBe(false); // datorn repeat-FL → en till
    expect(sessionOver(s, 12, 0, [0, 0])).toBe(true);
    expect(sessionOver({ ...s, flEnd: 'stop' }, 10, 0, [14, 0])).toBe(true);
  });

  it('minuter: slut när tiden är ute, fritt spel tar aldrig slut', async () => {
    const { sessionOver } = await import('./session');
    const m = { ...base, length: { kind: 'minutes' as const, n: 20 } };
    expect(sessionOver(m, 30, 19 * 60_000, [0, 0])).toBe(false);
    expect(sessionOver(m, 3, 20 * 60_000, [0, 0])).toBe(true);
    expect(sessionOver(m, 3, 20 * 60_000, [0, 15])).toBe(false);
    expect(sessionOver({ ...base, length: { kind: 'free' } }, 500, 1e9, [0, 0])).toBe(false);
  });

  it('sparade inställningar läses säkert', async () => {
    const { sanitizeHandSettings, clockText } = await import('./session');
    expect(sanitizeHandSettings({ length: { kind: 'minutes', n: 999 }, flEnd: 'stop', coach: false })).toEqual({ length: { kind: 'minutes', n: 180 }, flEnd: 'stop', coach: false, cpuLevel: 'normal' });
    expect(sanitizeHandSettings({ cpuLevel: 'thorough' }).cpuLevel).toBe('thorough');
    expect(sanitizeHandSettings('skräp').length).toEqual({ kind: 'hands', n: 10 });
    expect(clockText(754_000)).toBe('12:34');
    expect(clockText(0)).toBe('0:00');
  });
});

describe('träning: förklaring av drag', () => {
  const mv = (rows: [string, 'top' | 'middle' | 'bottom'][], discards: string[] = []) => ({
    placements: rows.map(([k, row], i) => ({ card: c(k), row, slotIndex: i })),
    discards: discards.map(c),
  });

  it('cardDiffs hittar bara kort som ligger olika (jokrar lika)', () => {
    const d = cardDiffs(mv([['Ks', 'middle'], ['JK', 'top']], ['2c']), mv([['Ks', 'bottom'], ['JK', 'top']], ['2c']));
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ mine: 'middle', best: 'bottom' });
  });

  it('säkrare men lägre FL-chans ger rätt slutsats', () => {
    const best = { ...opt(1.0, 800, [['Ks', 'bottom']]), foulProbability: 0.09, flProbability: 0.1 };
    const mine = { ...opt(0.5, 800, [['Ks', 'middle']]), foulProbability: 0.28, flProbability: 0.15 };
    const j = judge(res([best, mine]), mv([['Ks', 'middle']]));
    const ex = explainMove(mv([['Ks', 'middle']]), j);
    expect(ex.diffs).toHaveLength(1);
    expect(ex.lines.join(' ')).toContain('28 %');
    expect(ex.verdict).toContain('offrar lite FL-chans');
  });

  it('samma drag som solvern', () => {
    const j = judge(res([opt(1.0, 800, [['Ks', 'bottom']])]), mv([['Ks', 'bottom']]));
    expect(explainMove(mv([['Ks', 'bottom']]), j).verdict).toContain('samma drag');
  });
});

describe('svårare scenarion: scenarioDifficulty', () => {
  const mk = (rows: { ev: number; finalist?: boolean; naive?: boolean }[]) => {
    const options = rows.map((r) => ({ ev: r.ev, finalist: r.finalist ?? true, naive: r.naive, rank: 0, primaryRow: 'bottom', placements: [], discards: [], simulations: 1 })) as unknown as DetailedSolverResult['options'];
    return { options, best: options[0], simulations: 1, timedOut: false, method: 'monteCarlo' } as DetailedSolverResult;
  };
  it('givet: bara ett rimligt drag, tumregeln hittar det', () => {
    const d = scenarioDifficulty(mk([{ ev: 1, naive: true }, { ev: -0.5 }, { ev: 0.2, finalist: false }]));
    expect(d.hard).toBe(false);
  });
  it('givet: två nästan lika drag (båda ger Perfekt)', () => {
    expect(scenarioDifficulty(mk([{ ev: 1, naive: true }, { ev: 0.98 }])).hard).toBe(false);
  });
  it('nära val: ett annat drag 0,05–0,6 sämre', () => {
    const d = scenarioDifficulty(mk([{ ev: 1, naive: true }, { ev: 0.7 }]));
    expect(d.hard && !d.trap && d.close === 1).toBe(true);
  });
  it('fälla: tumregelns drag är fel', () => {
    expect(scenarioDifficulty(mk([{ ev: 1 }, { ev: -2, naive: true }])).trap).toBe(true);
    expect(scenarioDifficulty(mk([{ ev: 1 }, { ev: 0.5, finalist: false, naive: true }])).trap).toBe(true);
    expect(scenarioDifficulty(mk([{ ev: 1 }, { ev: 0.9, naive: true }])).trap).toBe(false);
  });
});
