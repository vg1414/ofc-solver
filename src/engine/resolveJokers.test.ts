import { describe, it, expect } from 'vitest';
import { resolveJokers } from './resolveJokers';
import { scoreHand } from './scoring';
import { getFantasyLandEntryCards } from './gameState';
import { makeCard, makeJoker } from './card';

const c = makeCard;
const J = makeJoker;

describe('resolveJokers — jokern väljs för hela brädet', () => {
  it('★74 i topp blir A74 (inte 77) när mitten bara är A-hög', () => {
    const r = resolveJokers(
      [J(), c('7', 'spades'), c('4', 'clubs')],
      [c('A', 'clubs'), c('5', 'hearts'), c('T', 'clubs'), c('3', 'hearts'), c('7', 'hearts')],
      [c('Q', 'diamonds'), c('T', 'diamonds'), c('6', 'diamonds'), c('7', 'diamonds'), c('8', 'diamonds')],
    );
    expect(r.top[0]).toMatchObject({ kind: 'card', rank: 'A' });
  });

  it('lämnar ett bräde som foular oavsett joker orört', () => {
    const top = [J(), c('A', 'spades'), c('A', 'clubs')];
    const mid = [c('2', 'clubs'), c('3', 'hearts'), c('5', 'clubs'), c('7', 'hearts'), c('9', 'hearts')];
    const bot = [c('4', 'clubs'), c('6', 'hearts'), c('8', 'clubs'), c('T', 'hearts'), c('Q', 'hearts')];
    expect(resolveJokers(top, mid, bot).top[0].kind).toBe('joker');
  });
});

describe('scoreHand med joker som annars ger foul', () => {
  it('hand 1: ★74 / A-hög / flush är giltig, inte foul', () => {
    const s = scoreHand(
      [J(), c('7', 'spades'), c('4', 'clubs')],
      [c('A', 'clubs'), c('5', 'hearts'), c('T', 'clubs'), c('3', 'hearts'), c('7', 'hearts')],
      [c('Q', 'diamonds'), c('T', 'diamonds'), c('6', 'diamonds'), c('7', 'diamonds'), c('8', 'diamonds')],
      [c('2', 'clubs'), c('3', 'diamonds'), c('4', 'hearts')],
      [c('8', 'hearts'), c('5', 'clubs'), c('5', 'spades'), c('7', 'clubs'), c('9', 'diamonds')],
      [c('9', 'spades'), c('J', 'spades'), c('Q', 'spades'), c('3', 'spades'), c('A', 'spades')],
    );
    expect(s.p1Foul).toBe(false);
    expect(s.p1Royalties.top).toBe(0);
    expect(s.p1Royalties.bottom).toBe(4);
    expect(s.rows.top?.winner).toBe('p1');
    expect(s.rows.bottom?.winner).toBe('p2'); // A-flush slår Q-flush
    expect(s.p1Net).toBe(-1);
  });

  it('hand 2: Q★6 / A-hög / par 2 är giltig och ger ingen FL', () => {
    const top = [c('Q', 'diamonds'), J(), c('6', 'diamonds')];
    const mid = [c('4', 'clubs'), c('A', 'diamonds'), c('5', 'clubs'), c('6', 'clubs'), c('8', 'diamonds')];
    const bot = [c('9', 'spades'), c('2', 'spades'), c('5', 'diamonds'), c('7', 'spades'), c('2', 'hearts')];
    const s = scoreHand(
      top, mid, bot,
      [c('T', 'diamonds'), c('K', 'diamonds'), c('J', 'clubs')],
      [c('4', 'diamonds'), J(), c('Q', 'spades'), c('5', 'hearts'), c('3', 'spades')],
      [c('7', 'clubs'), c('8', 'clubs'), c('9', 'clubs'), c('6', 'hearts'), c('5', 'spades')],
    );
    expect(s.p1Foul).toBe(false);
    expect(s.p2Foul).toBe(false);
    expect(s.rows.top?.winner).toBe('p1'); // KQ6 slår KJT
    expect(s.p1Net).toBe(-3);
    expect(getFantasyLandEntryCards(resolveJokers(top, mid, bot).top)).toBe(0);
  });
});
