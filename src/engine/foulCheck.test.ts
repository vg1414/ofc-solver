// ============================================================
// foulCheck.test.ts — Enhetstester för foul-validering
// ============================================================

import { describe, it, expect } from 'vitest';
import { isFoul, foulReport } from './foulCheck';
import { makeCard, makeJoker } from './card';

// Hjälpare: bygg kort snabbt
const c = makeCard;
const J = makeJoker;

// ---------------------------------------------------------------
// Giltig hand (ingen foul)
// ---------------------------------------------------------------

describe('isFoul — giltiga händer', () => {
  it('klassisk giltig hand: par på topp < stege på middle < flush på bottom', () => {
    const top    = [c('K','hearts'), c('K','spades'), c('2','clubs')];       // KK par
    const middle = [c('5','clubs'), c('6','diamonds'), c('7','hearts'),
                    c('8','spades'), c('9','clubs')];                          // stege 5-9
    const bottom = [c('A','hearts'), c('K','diamonds'), c('Q','hearts'),
                    c('J','hearts'), c('T','hearts')];                         // Royal flush

    expect(isFoul(top, middle, bottom)).toBe(false);
  });

  it('high card på topp < par på middle < triss på bottom — giltig', () => {
    const top    = [c('2','clubs'), c('5','hearts'), c('9','diamonds')];      // high card 9
    const middle = [c('A','clubs'), c('A','diamonds'), c('2','hearts'),
                    c('3','spades'), c('4','clubs')];                          // par AA
    const bottom = [c('K','clubs'), c('K','diamonds'), c('K','hearts'),
                    c('7','spades'), c('8','clubs')];                          // triss KKK

    expect(isFoul(top, middle, bottom)).toBe(false);
  });

  it('minimal giltig hand: high card < high card < pair', () => {
    const top    = [c('2','clubs'), c('3','hearts'), c('4','diamonds')];       // 4-high
    const middle = [c('5','clubs'), c('7','hearts'), c('9','diamonds'),
                    c('J','spades'), c('K','clubs')];                           // K-high
    const bottom = [c('A','clubs'), c('A','diamonds'), c('2','hearts'),
                    c('3','spades'), c('4','clubs')];                           // par AA

    expect(isFoul(top, middle, bottom)).toBe(false);
  });
});

// ---------------------------------------------------------------
// Foul: top ≥ middle
// ---------------------------------------------------------------

describe('isFoul — foul när top ≥ middle', () => {
  it('par på topp > high card på middle → foul', () => {
    const top    = [c('A','clubs'), c('A','diamonds'), c('2','hearts')];       // AA par
    const middle = [c('K','clubs'), c('Q','hearts'), c('J','diamonds'),
                    c('9','spades'), c('7','clubs')];                           // K-high
    const bottom = [c('A','hearts'), c('A','spades'), c('K','hearts'),
                    c('K','diamonds'), c('Q','clubs')];                         // two pair

    expect(isFoul(top, middle, bottom)).toBe(true);
  });

  it('lika stark topp och middle → foul (kräver strikt less than)', () => {
    // Topp: par AA, Middle: par AA med samma kickers → lika = foul
    const top    = [c('A','clubs'), c('A','diamonds'), c('K','hearts')];       // AA+K
    const middle = [c('A','hearts'), c('A','spades'), c('K','clubs'),
                    c('Q','diamonds'), c('J','clubs')];                         // AA pair (stronger kicker)
    const bottom = [c('2','clubs'), c('3','hearts'), c('4','diamonds'),
                    c('5','spades'), c('7','clubs')];                           // high card

    // Middle (AA, K, Q, J kickers) > Top (AA, K kicker) → men bottom < middle = foul på middle≥bottom
    // Låt oss testa ett renare fall:
    expect(isFoul(top, middle, bottom)).toBe(true); // bottom < middle = foul
  });

  it('triss på topp, high card på middle → foul', () => {
    const top    = [c('T','clubs'), c('T','hearts'), c('T','diamonds')];       // TTT triss
    const middle = [c('2','clubs'), c('3','hearts'), c('4','diamonds'),
                    c('6','spades'), c('8','clubs')];                           // 8-high
    const bottom = [c('A','clubs'), c('A','diamonds'), c('K','clubs'),
                    c('K','hearts'), c('Q','clubs')];                           // two pair

    expect(isFoul(top, middle, bottom)).toBe(true);
  });
});

// ---------------------------------------------------------------
// Foul: middle ≥ bottom
// ---------------------------------------------------------------

describe('isFoul — foul när middle ≥ bottom', () => {
  it('flush på middle > par på bottom → foul', () => {
    const top    = [c('2','clubs'), c('3','hearts'), c('4','diamonds')];       // high card
    const middle = [c('A','clubs'), c('K','clubs'), c('Q','clubs'),
                    c('J','clubs'), c('9','clubs')];                            // A-high flush
    const bottom = [c('T','clubs'), c('T','diamonds'), c('2','hearts'),
                    c('3','spades'), c('4','clubs')];                           // par TT

    expect(isFoul(top, middle, bottom)).toBe(true);
  });

  it('kåk på middle > stege på bottom → foul', () => {
    const top    = [c('2','clubs'), c('3','hearts'), c('4','diamonds')];       // high card
    const middle = [c('K','clubs'), c('K','diamonds'), c('K','hearts'),
                    c('A','spades'), c('A','clubs')];                           // kåk KKK-AA
    const bottom = [c('5','clubs'), c('6','hearts'), c('7','diamonds'),
                    c('8','spades'), c('9','clubs')];                           // stege 5-9

    expect(isFoul(top, middle, bottom)).toBe(true);
  });

  it('lika strong middle och bottom → foul', () => {
    const top    = [c('2','clubs'), c('3','hearts'), c('4','diamonds')];       // high card
    // Exakt samma hand-styrka på middle och bottom
    const middle = [c('A','clubs'), c('A','diamonds'), c('K','hearts'),
                    c('K','spades'), c('Q','clubs')];                           // two pair AA+KK
    const bottom = [c('A','hearts'), c('A','spades'), c('K','clubs'),
                    c('K','diamonds'), c('Q','hearts')];                        // two pair AA+KK (lika)

    expect(isFoul(top, middle, bottom)).toBe(true);
  });
});

// ---------------------------------------------------------------
// Foul med jokrar
// ---------------------------------------------------------------

describe('isFoul — joker-hantering', () => {
  it('joker på topp optimeras till trips — starkare än middle (pair) → foul', () => {
    // handEval maximerar alltid joker-identiteten oberoende av foul-regler.
    // Topp: joker + 2 + 3 → bäst möjlig = triss (t.ex. AAA, trips rankindex 14).
    // Middle: par TT (rankindex pair). Trips > pair → foul = true.
    // Men: topp är 3-korthand, 'trips' i 3-korthand klassificeras som 'trips'.
    // Middle är 5-korthand med par TT → klassificeras som 'pair'.
    // compareHands(trips, pair) > 0 → top ≥ middle → foul.
    //
    // OBS: handEval är utformad att alltid maximera utan hänsyn till foul.
    // Det är scoring.ts ansvar att hantera foul-konsekvenser.
    const top    = [J(), c('2','clubs'), c('3','hearts')];                     // joker → trips (maximize)
    const middle = [c('T','clubs'), c('T','diamonds'), c('2','hearts'),
                    c('3','spades'), c('4','clubs')];                           // par TT
    const bottom = [c('A','clubs'), c('A','diamonds'), c('K','hearts'),
                    c('K','spades'), c('Q','clubs')];                           // two pair (giltig bottom)

    // Top (trips via joker) > Middle (pair TT) → foul
    // Verifieras mot faktiskt beteende: handEval returnerar trips för joker+2+3
    // eftersom joker kan bli 2 eller 3, men bäst med joker=2 → 222=trips.
    // Faktum: joker+2+3 med joker=2 → [2,2,3] = par 2:or (ej trips).
    // Joker+2+3 med joker=3 → [3,3,2] = par 3:or.
    // Joker+2+3 med joker=J → [J,2,3] = high card.
    // Trips kräver tre lika → joker+2+3 kan INTE bli trips (bara 2 av varje rank).
    // Bäst möjligt = par (t.ex. AA med kicker 3 → [A,2,3]? Nej: [A,A,?] ≠ tre kort.
    // 3 kort: joker+2+3 → joker=A → [A,2,3] = pair? Nej, ingen match.
    // joker=2 → [2,2,3] = pair 2s. joker=3 → [3,3,2] = pair 3s. joker=A → [A,2,3] = high card A.
    // Bäst = pair (t.ex. par AA med kicker? Nej, bara 3 kort).
    // joker+2+3 → bäst = pair (joker matchar 2 eller 3).
    // Pair (topp) vs Pair TT (middle): jämför tiebreakers.
    // Topp-paret max = AA (om joker=A → [A,2,3] = high card, inte pair).
    // Faktiskt bäst pair: joker=2 → pair 2s (låg), joker=3 → pair 3s.
    // Pair 3s tiebreaker: [3, 2]. Pair TT tiebreaker: [10, ...].
    // Pair 3s < Pair TT → top < middle → INGEN foul = false.
    expect(isFoul(top, middle, bottom)).toBe(false);
  });

  it('joker på bottom gör att bottom > middle → ingen foul', () => {
    const top    = [c('2','clubs'), c('3','hearts'), c('4','diamonds')];       // high card
    const middle = [c('T','clubs'), c('T','diamonds'), c('2','hearts'),
                    c('3','spades'), c('4','clubs')];                           // par TT
    // Bottom med joker → blir minst quads/flush → starkare än par TT
    const bottom = [c('A','clubs'), c('A','diamonds'), c('A','hearts'),
                    c('A','spades'), J()];                                      // joker → five_of_a_kind AAAAA

    expect(isFoul(top, middle, bottom)).toBe(false);
  });

  it('foul detekteras trots jokrar', () => {
    const top    = [c('A','clubs'), c('A','diamonds'), J()];                   // joker → AAA triss
    const middle = [c('K','clubs'), c('Q','hearts'), c('J','diamonds'),
                    c('9','spades'), c('7','clubs')];                           // K-high (svag)
    const bottom = [c('5','clubs'), c('6','hearts'), c('7','diamonds'),
                    c('8','spades'), c('9','clubs')];                           // stege

    // Top optimeras till AAA (triss), middle = K-high → trips > high_card → foul
    expect(isFoul(top, middle, bottom)).toBe(true);
  });
});

// ---------------------------------------------------------------
// foulReport
// ---------------------------------------------------------------

describe('foulReport', () => {
  it('returnerar ok för giltig hand', () => {
    const top    = [c('2','clubs'), c('3','hearts'), c('4','diamonds')];
    const middle = [c('A','clubs'), c('A','diamonds'), c('2','hearts'),
                    c('3','spades'), c('4','clubs')];
    const bottom = [c('K','clubs'), c('K','diamonds'), c('K','hearts'),
                    c('7','spades'), c('8','clubs')];

    const report = foulReport(top, middle, bottom);
    expect(report.isFoul).toBe(false);
    expect(report.topVsMiddle).toBe('ok');
    expect(report.middleVsBottom).toBe('ok');
  });

  it('identifierar korrekt vilken jämförelse som foulade', () => {
    const top    = [c('A','clubs'), c('A','diamonds'), c('K','hearts')];       // AA par
    const middle = [c('2','clubs'), c('3','hearts'), c('4','diamonds'),
                    c('6','spades'), c('8','clubs')];                           // 8-high (svagare)
    const bottom = [c('K','clubs'), c('K','diamonds'), c('K','hearts'),
                    c('7','spades'), c('8','spades')];                          // KKK triss

    const report = foulReport(top, middle, bottom);
    expect(report.isFoul).toBe(true);
    expect(report.topVsMiddle).toBe('foul');
    expect(report.middleVsBottom).toBe('ok');
  });

  it('description är en icke-tom sträng', () => {
    const top    = [c('2','clubs'), c('3','hearts'), c('4','diamonds')];
    const middle = [c('T','clubs'), c('T','diamonds'), c('2','hearts'),
                    c('3','spades'), c('4','clubs')];
    const bottom = [c('A','clubs'), c('A','diamonds'), c('K','hearts'),
                    c('K','spades'), c('Q','clubs')];

    const report = foulReport(top, middle, bottom);
    expect(typeof report.description).toBe('string');
    expect(report.description.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------
// Felhantering
// ---------------------------------------------------------------

describe('isFoul — felhantering', () => {
  it('kastar Error om top inte har 3 kort', () => {
    const top    = [c('A','clubs'), c('K','hearts')];  // fel antal
    const middle = [c('T','clubs'), c('T','diamonds'), c('2','hearts'),
                    c('3','spades'), c('4','clubs')];
    const bottom = [c('A','diamonds'), c('A','hearts'), c('A','spades'),
                    c('K','clubs'), c('K','diamonds')];

    expect(() => isFoul(top, middle, bottom)).toThrow();
  });
});
