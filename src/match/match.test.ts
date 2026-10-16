import { describe, expect, it } from 'vitest';
import { buildDeck } from '../engine/deck';
import type { Board, Card, RowName } from '../engine/types';
import type { Move } from '../training/moves';
import { startHand } from '../training/game';
import { applyAction, createMatch, currentTurn, MatchError, parseMatch, totals, viewFor, type MatchConfig, type MatchState } from './match';
import { pickCpuOption } from './cpu';
import type { DetailedPlacementOption, DetailedSolverResult } from '../solver/solver';

const CFG: MatchConfig = { variant: 'regular', names: ['David', 'Anna'], length: { kind: 'hands', n: 2 }, flEnd: 'stop' };

const SIZE: Record<RowName, number> = { top: 3, middle: 5, bottom: 5 };

/** Enkelt drag: fyll botten → mitten → topp, kasta resten */
function simpleMove(board: Board, dealt: Card[], place: number): Move {
  const free: Record<RowName, number> = {
    top: SIZE.top - board.top.cards.filter(Boolean).length,
    middle: SIZE.middle - board.middle.cards.filter(Boolean).length,
    bottom: SIZE.bottom - board.bottom.cards.filter(Boolean).length,
  };
  const placements = dealt.slice(0, place).map((card) => {
    const row = (['bottom', 'middle', 'top'] as const).find((r) => free[r] > 0)!;
    free[row]--;
    return { card, row, slotIndex: 0 };
  });
  return { placements, discards: dealt.slice(place) };
}

function playTurn(s: MatchState): MatchState {
  const t = currentTurn(s)!;
  const h = s.hand;
  return applyAction(s, { type: 'move', hand: h.no, turn: h.idx, seat: t.seat, move: simpleMove(h.seats[t.seat].board, h.dealt, t.place) });
}

function playHand(s: MatchState): MatchState {
  while (currentTurn(s)) s = playTurn(s);
  return s;
}

describe('2 spelare: spelmotorn', () => {
  it('spelar en hel hand och sparar resultatet', () => {
    const s = playHand(createMatch(CFG, { first: 0, deck: buildDeck() }));
    expect(s.hand.outcome).not.toBeNull();
    expect(s.records).toHaveLength(1);
    const [a, b] = totals(s);
    expect(a + b).toBe(0);
  });

  it('avvisar drag av fel spelare, gamla turer och fel kort', () => {
    const s = createMatch(CFG, { first: 0, deck: buildDeck() });
    const h = s.hand;
    const move = simpleMove(h.seats[0].board, h.dealt, 5);
    expect(() => applyAction(s, { type: 'move', hand: 1, turn: 0, seat: 1, move })).toThrow(MatchError);
    expect(() => applyAction(s, { type: 'move', hand: 1, turn: 3, seat: 0, move })).toThrow(/redan är spelad/);
    const fake = { ...move, placements: move.placements.map((p, i) => (i === 0 ? { ...p, card: h.deck[40] } : p)) };
    expect(() => applyAction(s, { type: 'move', hand: 1, turn: 0, seat: 0, move: fake })).toThrow(/inte delades ut/);
    // Samma drag två gånger (dubbelskickat): andra gången avvisas
    const s2 = applyAction(s, { type: 'move', hand: 1, turn: 0, seat: 0, move });
    expect(() => applyAction(s2, { type: 'move', hand: 1, turn: 0, seat: 0, move })).toThrow(MatchError);
  });

  it('den som börjar växlar, och partiet slutar efter rätt antal händer', () => {
    let s = playHand(createMatch(CFG, { first: 0, deck: buildDeck() }));
    s = applyAction(s, { type: 'nextHand', hand: 1, elapsedMs: 0 });
    expect(s.hand.no).toBe(2);
    expect(s.hand.first).toBe(1);
    expect(currentTurn(s)?.seat).toBe(1);
    s = playHand(s);
    s = applyAction(s, { type: 'nextHand', hand: 2, elapsedMs: 0 });
    expect(s.finished).toEqual({ complete: true });
    expect(() => applyAction(s, { type: 'nextHand', hand: 2, elapsedMs: 0 })).toThrow(/slut/);
  });

  it('vyn visar bara egna utdelade kort och döljer motståndarens FL-bräde', () => {
    const s = createMatch(CFG, { first: 0, deck: buildDeck() });
    expect(viewFor(s, 0).dealt).toHaveLength(5);
    expect(viewFor(s, 1).dealt).toHaveLength(0);
    expect(viewFor(s, 1).seats[0].discards).toBeNull();
    // Spelare 2 i Fantasy Land: brädet syns inte för spelare 1 förrän handen är klar
    const fl: MatchState = { ...s, hand: { ...s.hand, seats: [s.hand.seats[0], { ...s.hand.seats[1], fl: 14 }] } };
    expect(viewFor(fl, 0).seats[1].board).toBeNull();
    expect(viewFor(fl, 1).seats[1].board).not.toBeNull();
  });

  it('öppningshanden är dold för motståndaren tills båda har lagt sin', () => {
    let s = playTurn(createMatch(CFG, { first: 0, deck: buildDeck() }));
    expect(viewFor(s, 1).seats[0]).toMatchObject({ board: null, hidden: 'opening' });
    expect(viewFor(s, 0).seats[0].board).not.toBeNull();
    s = playTurn(s); // spelare 2 lägger sin öppning → runda 2, allt syns
    expect(viewFor(s, 0).seats[1].hidden).toBeNull();
    expect(viewFor(s, 1).seats[0].hidden).toBeNull();
  });

  it('Fantasy Land-brädet är dolt tills båda spelarna lagt klart sina händer', () => {
    for (const first of [0, 1] as const) {
      const base = createMatch({ ...CFG, variant: 'pineapple' }, { first, deck: buildDeck() });
      // Spelare 2 i FL med 14 kort, spelare 1 spelar vanligt
      let s: MatchState = { ...base, hand: startHand(1, first, [0, 14], 'pineapple', buildDeck()) };
      let flPlaced = false;
      while (currentTurn(s)) {
        if (currentTurn(s)!.seat === 1) flPlaced = true;
        // Varje gång spelare 1 tittar (eller telefonen ligger hos dem) är FL-brädet dolt
        expect(viewFor(s, 0).seats[1]).toMatchObject({ board: null, hidden: 'fl' });
        s = playTurn(s);
        if (currentTurn(s)) expect(viewFor(s, 0).seats[1].board).toBeNull();
      }
      expect(flPlaced).toBe(true);
      // Först när båda lagt klart (handen är slut) syns det
      expect(viewFor(s, 0).seats[1].board).not.toBeNull();
    }
  });

  it('går att spara som JSON och läsa tillbaka', () => {
    const s = playTurn(createMatch(CFG, { first: 1, deck: buildDeck() }));
    const back = parseMatch(JSON.stringify(s));
    expect(back).toEqual(s);
    expect(parseMatch('{"v":0}')).toBeNull();
    expect(parseMatch('trasig')).toBeNull();
  });

  it('Pineapple: 2 läggs och 1 kastas per tur', () => {
    let s = createMatch({ ...CFG, variant: 'pineapple' }, { first: 0, deck: buildDeck() });
    s = playTurn(playTurn(s));
    const t = currentTurn(s)!;
    expect(t).toMatchObject({ count: 3, place: 2 });
    s = playHand(s);
    expect(s.hand.seats[0].discards).toHaveLength(4);
  });
});

describe('datorn som motståndare', () => {
  const opt = (ev: number) => ({ ev, rank: 0, primaryRow: 'bottom', placements: [], discards: [], simulations: 1 }) as unknown as DetailedPlacementOption;
  const res = (evs: number[]) => {
    const options = evs.map(opt);
    return { options, best: options[0], simulations: 1, timedOut: false, method: 'monteCarlo' } as DetailedSolverResult;
  };
  it('Svår och Proffs tar alltid bästa draget', () => {
    const r = res([1, 0.99, 0.5]);
    for (let i = 0; i < 50; i++) {
      expect(pickCpuOption(r, 'hard')).toBe(r.best);
      expect(pickCpuOption(r, 'pro')).toBe(r.best);
    }
  });
  it('Lätt gör oftare misstag än Medel, och sällan grova', () => {
    const r = res([1, 0.8, 0.6, -1]);
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const miss = (lvl: 'easy' | 'medium') => {
      let n = 0, gross = 0;
      for (let i = 0; i < 2000; i++) {
        const o = pickCpuOption(r, lvl, rand);
        if (o !== r.best) n++;
        if (o.ev === -1) gross++;
      }
      return { n, gross };
    };
    const e = miss('easy'), m = miss('medium');
    expect(e.n).toBeGreaterThan(m.n);
    expect(m.n).toBeGreaterThan(0);
    expect(e.gross / 2000).toBeLessThan(0.1);
  });
});
