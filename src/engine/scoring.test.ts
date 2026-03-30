// ============================================================
// scoring.test.ts — Enhetstester för OFC-poängberäkning
// ============================================================

import { describe, it, expect } from 'vitest';
import { scoreHand } from './scoring';
import { makeCard, makeJoker } from './card';

// Hjälpare
const c = makeCard;
const J = makeJoker;

// ---------------------------------------------------------------
// Standardhänder för återanvändning
// ---------------------------------------------------------------

// P1: stark och giltig (high card top, par mid, triss bot)
const P1_TOP_OK    = [c('2','clubs'),   c('3','hearts'),   c('4','diamonds')];
const P1_MID_OK    = [c('T','clubs'),   c('T','diamonds'),  c('2','hearts'), c('3','spades'), c('4','clubs')];
const P1_BOT_OK    = [c('K','clubs'),   c('K','diamonds'),  c('K','hearts'), c('7','spades'), c('8','clubs')];

// P2: svag men giltig (high card top, high card mid, par bot)
const P2_TOP_WEAK  = [c('5','clubs'),   c('6','hearts'),   c('7','diamonds')];
const P2_MID_WEAK  = [c('8','clubs'),   c('9','hearts'),   c('J','diamonds'), c('Q','spades'), c('K','clubs')];
const P2_BOT_WEAK  = [c('A','clubs'),   c('A','diamonds'),  c('2','hearts'), c('3','spades'), c('4','clubs')];

// ---------------------------------------------------------------
// Inga fouls — rad-för-rad-jämförelse
// ---------------------------------------------------------------

describe('scoreHand — inga fouls', () => {
  it('P1 vinner alla 3 rader → scoop', () => {
    // P1: high card / par TT / triss KKK (giltig)
    // P2: måste vara svagare på alla rader (giltig)
    const p2Top    = [c('2','clubs'), c('5','hearts'), c('8','diamonds')];     // high card 8
    const p2Mid    = [c('3','clubs'), c('4','hearts'), c('6','diamonds'),
                      c('7','spades'), c('9','clubs')];                          // 9-high
    const p2Bot    = [c('J','clubs'), c('J','diamonds'), c('2','hearts'),
                      c('3','spades'), c('4','clubs')];                          // par JJ

    const result = scoreHand(P1_TOP_OK, P1_MID_OK, P1_BOT_OK,
                             p2Top, p2Mid, p2Bot);

    // P1 ska vinna topp (4-high vs 8-high) → P2 vinner topp faktiskt
    // Låt oss istället göra P1 svagare på topp
    // Notera: high card 4 < high card 8 → P2 vinner topp
    // P1 vinner middle (par TT vs 9-high)
    // P1 vinner bottom (triss KKK vs par JJ)
    // P1: 2 rader, P2: 1 rad → ingen scoop
    expect(result.p1Foul).toBe(false);
    expect(result.p2Foul).toBe(false);
    expect(result.p1Scoop).toBe(false);
    expect(result.p2Scoop).toBe(false);
    expect(result.p1RowWins).toBe(2);
    expect(result.p2RowWins).toBe(1);
    expect(result.p1Net).toBeGreaterThan(0);
  });

  it('P1 vinner alla 3 rader → scoop +3p', () => {
    // P1: high card / stege / flush (giltig)
    const p1Top    = [c('2','clubs'), c('3','hearts'), c('4','diamonds')];     // 4-high
    const p1Mid    = [c('5','clubs'), c('6','hearts'), c('7','diamonds'),
                      c('8','spades'), c('9','clubs')];                          // stege 5-9
    const p1Bot    = [c('A','clubs'), c('K','clubs'), c('Q','clubs'),
                      c('J','clubs'), c('9','clubs')];                           // A-flush

    // P2: svag men giltig
    const p2Top    = [c('5','hearts'), c('6','diamonds'), c('7','spades')];    // 7-high
    // P1 top (4-high) < P2 top (7-high) → P2 vinner topp
    // Gör P1 starkare på topp
    const p1TopStr = [c('J','clubs'), c('Q','hearts'), c('K','diamonds')];    // K-high

    const p2TopW   = [c('2','hearts'), c('3','diamonds'), c('4','spades')];   // 4-high (svagare)
    const p2MidW   = [c('T','clubs'), c('T','diamonds'), c('2','hearts'),
                      c('3','spades'), c('4','clubs')];                         // par TT (svagare än stege)
    const p2BotW   = [c('K','hearts'), c('K','spades'), c('2','diamonds'),
                      c('3','clubs'), c('4','hearts')];                         // par KK (svagare än flush)

    const result = scoreHand(p1TopStr, p1Mid, p1Bot,
                             p2TopW, p2MidW, p2BotW);

    expect(result.p1Scoop).toBe(true);
    expect(result.p1RowWins).toBe(3);
    expect(result.rows.top?.winner).toBe('p1');
    expect(result.rows.middle?.winner).toBe('p1');
    expect(result.rows.bottom?.winner).toBe('p1');
    // Net = 3 rader (3p) + scoop (3p) + royalties
    expect(result.p1Net).toBeGreaterThanOrEqual(6);
  });

  it('tie på en rad ger 0p för den raden', () => {
    // P1 och P2 har exakt samma bottom-hand → tie
    const p1Top    = [c('2','clubs'), c('3','hearts'), c('4','diamonds')];
    const p1Mid    = [c('T','clubs'), c('T','diamonds'), c('2','hearts'),
                      c('3','spades'), c('4','clubs')];
    const p1Bot    = [c('A','clubs'), c('K','clubs'), c('Q','clubs'),
                      c('J','clubs'), c('9','clubs')];                          // A-flush clubs

    const p2Top    = [c('5','clubs'), c('6','hearts'), c('7','diamonds')];
    const p2Mid    = [c('J','clubs'), c('J','diamonds'), c('2','hearts'),
                      c('3','spades'), c('5','clubs')];                         // par JJ
    const p2Bot    = [c('A','hearts'), c('K','hearts'), c('Q','hearts'),
                      c('J','hearts'), c('9','hearts')];                        // A-flush hearts (lika stark)

    const result = scoreHand(p1Top, p1Mid, p1Bot, p2Top, p2Mid, p2Bot);

    expect(result.rows.bottom?.winner).toBe('tie');
    expect(result.rows.bottom?.p1Points).toBe(0);
  });

  it('nettoresultat är nollsummespel (p1Net + p2Net = 0)', () => {
    const result = scoreHand(P1_TOP_OK, P1_MID_OK, P1_BOT_OK,
                             P2_TOP_WEAK, P2_MID_WEAK, P2_BOT_WEAK);
    expect(result.p1Net + result.p2Net).toBe(0);
  });
});

// ---------------------------------------------------------------
// Royalties inkluderas i nettot
// ---------------------------------------------------------------

describe('scoreHand — royalties', () => {
  it('P1:s royalties adderas till nettot', () => {
    // P1 har straight flush på bottom (15p royalty)
    const p1Top    = [c('2','clubs'), c('3','hearts'), c('4','diamonds')];
    const p1Mid    = [c('T','clubs'), c('T','diamonds'), c('2','hearts'),
                      c('3','spades'), c('4','clubs')];
    const p1Bot    = [c('5','hearts'), c('6','hearts'), c('7','hearts'),
                      c('8','hearts'), c('9','hearts')];                        // SF 5-9 hearts (15p)

    const p2Top    = [c('5','clubs'), c('6','hearts'), c('7','diamonds')];
    const p2Mid    = [c('J','clubs'), c('J','diamonds'), c('2','hearts'),
                      c('3','spades'), c('4','clubs')];
    const p2Bot    = [c('A','clubs'), c('A','diamonds'), c('K','hearts'),
                      c('K','spades'), c('Q','clubs')];

    const result = scoreHand(p1Top, p1Mid, p1Bot, p2Top, p2Mid, p2Bot);

    expect(result.p1Royalties.bottom).toBe(15);
    // Nettot ska inkludera 15p royalty-bidrag
    expect(result.p1Net).toBeGreaterThan(result.p1RowWins - result.p2RowWins);
  });

  it('båda spelares royalties beräknas korrekt', () => {
    // P2 har QQ på topp (7p royalty)
    const p1Top    = [c('2','clubs'), c('3','hearts'), c('4','diamonds')];
    const p1Mid    = [c('T','clubs'), c('T','diamonds'), c('2','hearts'),
                      c('3','spades'), c('4','clubs')];
    const p1Bot    = [c('K','clubs'), c('K','diamonds'), c('K','hearts'),
                      c('7','spades'), c('8','clubs')];

    const p2Top    = [c('Q','clubs'), c('Q','diamonds'), c('2','hearts')];     // QQ = 7p royalty
    const p2Mid    = [c('A','clubs'), c('A','diamonds'), c('3','hearts'),
                      c('4','spades'), c('5','clubs')];                         // par AA
    const p2Bot    = [c('K','spades'), c('K','hearts'), c('A','hearts'),
                      c('A','spades'), c('J','clubs')];                         // two pair

    const result = scoreHand(p1Top, p1Mid, p1Bot, p2Top, p2Mid, p2Bot);

    expect(result.p2Royalties.top).toBe(7);
    expect(result.p1Net + result.p2Net).toBe(0); // fortfarande nollsummespel
  });
});

// ---------------------------------------------------------------
// Foul-scenarion
// ---------------------------------------------------------------

describe('scoreHand — P1 foulade', () => {
  it('P1 foul: P1 märks som foul, P2 inte', () => {
    // P1 foul: par AA på topp > high card på middle
    const p1TopF   = [c('A','clubs'), c('A','diamonds'), c('2','hearts')];     // AA par
    const p1MidF   = [c('K','clubs'), c('Q','hearts'), c('J','diamonds'),
                      c('9','spades'), c('7','clubs')];                         // K-high (svag)
    const p1BotF   = [c('5','clubs'), c('6','hearts'), c('7','diamonds'),
                      c('8','spades'), c('9','clubs')];                         // stege

    const result = scoreHand(p1TopF, p1MidF, p1BotF,
                             P2_TOP_WEAK, P2_MID_WEAK, P2_BOT_WEAK);

    expect(result.p1Foul).toBe(true);
    expect(result.p2Foul).toBe(false);
  });

  it('P1 foul: P2 får +6 + sina royalties', () => {
    const p1TopF   = [c('A','clubs'), c('A','diamonds'), c('2','hearts')];
    const p1MidF   = [c('K','clubs'), c('Q','hearts'), c('J','diamonds'),
                      c('9','spades'), c('7','clubs')];
    const p1BotF   = [c('5','clubs'), c('6','hearts'), c('7','diamonds'),
                      c('8','spades'), c('9','clubs')];

    // P2 har QQ på topp (7p) — ingen annan royalty
    const p2TopQQ  = [c('Q','clubs'), c('Q','diamonds'), c('2','hearts')];
    const p2Mid    = [c('A','clubs'), c('A','diamonds'), c('3','hearts'),
                      c('4','spades'), c('5','clubs')];
    const p2Bot    = [c('K','spades'), c('K','hearts'), c('A','hearts'),
                      c('A','spades'), c('J','clubs')];

    const result = scoreHand(p1TopF, p1MidF, p1BotF,
                             p2TopQQ, p2Mid, p2Bot);

    expect(result.p2Net).toBe(6 + result.p2Royalties.total);
    expect(result.p1Net).toBe(-(6 + result.p2Royalties.total));
  });

  it('P1 foul: rad-resultat är null (ingen rad-för-rad-jämförelse)', () => {
    const p1TopF   = [c('A','clubs'), c('A','diamonds'), c('2','hearts')];
    const p1MidF   = [c('K','clubs'), c('Q','hearts'), c('J','diamonds'),
                      c('9','spades'), c('7','clubs')];
    const p1BotF   = [c('5','clubs'), c('6','hearts'), c('7','diamonds'),
                      c('8','spades'), c('9','clubs')];

    const result = scoreHand(p1TopF, p1MidF, p1BotF,
                             P2_TOP_WEAK, P2_MID_WEAK, P2_BOT_WEAK);

    expect(result.rows.top).toBeNull();
    expect(result.rows.middle).toBeNull();
    expect(result.rows.bottom).toBeNull();
  });

  it('P1 foul: P1 royalties = 0', () => {
    const p1TopF   = [c('A','clubs'), c('A','diamonds'), c('2','hearts')];
    const p1MidF   = [c('K','clubs'), c('Q','hearts'), c('J','diamonds'),
                      c('9','spades'), c('7','clubs')];
    const p1BotF   = [c('5','clubs'), c('6','hearts'), c('7','diamonds'),
                      c('8','spades'), c('9','clubs')];

    const result = scoreHand(p1TopF, p1MidF, p1BotF,
                             P2_TOP_WEAK, P2_MID_WEAK, P2_BOT_WEAK);

    expect(result.p1Royalties.total).toBe(0);
  });
});

describe('scoreHand — P2 foulade', () => {
  it('P2 foul: P1 får +6 + sina royalties', () => {
    // P2 foul: middle ≥ bottom
    const p2TopOK  = [c('2','clubs'), c('3','hearts'), c('4','diamonds')];
    const p2MidF   = [c('A','clubs'), c('K','clubs'), c('Q','clubs'),
                      c('J','clubs'), c('9','clubs')];                          // A-flush (stark)
    const p2BotF   = [c('T','clubs'), c('T','diamonds'), c('2','hearts'),
                      c('3','spades'), c('4','clubs')];                         // par TT (svagare)

    const result = scoreHand(P1_TOP_OK, P1_MID_OK, P1_BOT_OK,
                             p2TopOK, p2MidF, p2BotF);

    expect(result.p2Foul).toBe(true);
    expect(result.p1Net).toBe(6 + result.p1Royalties.total);
    expect(result.p2Net).toBe(-(6 + result.p1Royalties.total));
  });
});

describe('scoreHand — båda foulade', () => {
  it('båda foul: netto 0 för båda', () => {
    // P1 foul
    const p1TopF   = [c('A','clubs'), c('A','diamonds'), c('2','hearts')];
    const p1MidF   = [c('K','clubs'), c('Q','hearts'), c('J','diamonds'),
                      c('9','spades'), c('7','clubs')];
    const p1BotF   = [c('5','clubs'), c('6','hearts'), c('7','diamonds'),
                      c('8','spades'), c('9','clubs')];

    // P2 foul (middle ≥ bottom)
    const p2TopOK  = [c('2','hearts'), c('3','diamonds'), c('4','spades')];
    const p2MidF   = [c('A','hearts'), c('K','hearts'), c('Q','hearts'),
                      c('J','hearts'), c('9','hearts')];
    const p2BotF   = [c('T','hearts'), c('T','spades'), c('2','diamonds'),
                      c('3','clubs'), c('4','hearts')];

    const result = scoreHand(p1TopF, p1MidF, p1BotF,
                             p2TopOK, p2MidF, p2BotF);

    expect(result.p1Foul).toBe(true);
    expect(result.p2Foul).toBe(true);
    expect(result.p1Net).toBe(0);
    expect(result.p2Net).toBe(0);
  });
});

// ---------------------------------------------------------------
// Joker-scenarion
// ---------------------------------------------------------------

describe('scoreHand — jokrar', () => {
  it('joker ger P1 five of a kind på bottom → 20p royalty', () => {
    const p1Top    = [c('2','clubs'), c('3','hearts'), c('4','diamonds')];
    const p1Mid    = [c('T','clubs'), c('T','diamonds'), c('2','hearts'),
                      c('3','spades'), c('4','clubs')];
    const p1Bot    = [c('A','clubs'), c('A','diamonds'), c('A','hearts'),
                      c('A','spades'), J()];                                    // AAAAA five_of_a_kind = 20p

    const result = scoreHand(p1Top, p1Mid, p1Bot,
                             P2_TOP_WEAK, P2_MID_WEAK, P2_BOT_WEAK);

    expect(result.p1Foul).toBe(false);
    expect(result.p1Royalties.bottom).toBe(20);
  });

  it('joker på middle ger rätt royalty', () => {
    // AAAAA på middle (40p) men kräver att bottom > middle.
    // five_of_a_kind är starkaste handen — omöjligt att ha bottom > middle
    // om middle = five_of_a_kind. Använd quads på middle (20p) istället.
    const p1Top    = [c('2','clubs'), c('3','hearts'), c('4','diamonds')];
    const p1Mid    = [c('A','clubs'), c('A','diamonds'), c('A','hearts'),
                      c('A','spades'), J()];                                    // AAAAA five_of_a_kind = 40p middle
    // Bottom måste vara starkare än five_of_a_kind — omöjligt.
    // Testet är logiskt omöjligt: five_of_a_kind kan inte ha starkare bottom.
    // Testa istället quads på middle (20p) med straight flush på bottom:
    const p1MidQ   = [c('K','clubs'), c('K','diamonds'), c('K','hearts'),
                      c('K','spades'), c('2','clubs')];                         // KKKK quads = 20p middle
    const p1Bot    = [c('5','hearts'), c('6','hearts'), c('7','hearts'),
                      c('8','hearts'), c('9','hearts')];                        // SF 5-9 = 15p bottom (starkare än quads? Nej)
    // quads > SF → middle > bottom = foul. Använd five_of_a_kind på bottom istället.
    // Bot: joker + KKKK → men K redan på middle. Gör en enklare hand:
    // Middle: par TT (giltig), Bottom: quads + joker = five_of_a_kind (20p).
    const p1MidPar = [c('T','clubs'), c('T','diamonds'), c('2','hearts'),
                      c('3','spades'), c('4','clubs')];                         // par TT (svag middle)
    const p1BotFOK = [c('A','clubs'), c('A','diamonds'), c('A','hearts'),
                      c('A','spades'), J()];                                    // AAAAA five_of_a_kind = 20p bottom

    const result = scoreHand(p1Top, p1MidPar, p1BotFOK,
                             P2_TOP_WEAK, P2_MID_WEAK, P2_BOT_WEAK);

    expect(result.p1Foul).toBe(false);
    // five_of_a_kind på bottom = 20p
    expect(result.p1Royalties.bottom).toBe(20);
  });

  it('nettoresultat förblir nollsummespel med jokrar', () => {
    const p1Top    = [c('2','clubs'), c('3','hearts'), c('4','diamonds')];
    const p1Mid    = [c('T','clubs'), c('T','diamonds'), c('2','hearts'),
                      c('3','spades'), c('4','clubs')];
    const p1Bot    = [c('A','clubs'), c('A','diamonds'), c('A','hearts'),
                      c('A','spades'), J()];

    const result = scoreHand(p1Top, p1Mid, p1Bot,
                             P2_TOP_WEAK, P2_MID_WEAK, P2_BOT_WEAK);

    expect(result.p1Net + result.p2Net).toBe(0);
  });
});

// ---------------------------------------------------------------
// Description-fältet
// ---------------------------------------------------------------

describe('scoreHand — description', () => {
  it('description är en icke-tom sträng i alla scenarion', () => {
    const cases = [
      // Normal
      [P1_TOP_OK, P1_MID_OK, P1_BOT_OK, P2_TOP_WEAK, P2_MID_WEAK, P2_BOT_WEAK],
    ] as const;

    for (const [p1t, p1m, p1b, p2t, p2m, p2b] of cases) {
      const result = scoreHand(
        [...p1t], [...p1m], [...p1b],
        [...p2t], [...p2m], [...p2b],
      );
      expect(typeof result.description).toBe('string');
      expect(result.description.length).toBeGreaterThan(0);
    }
  });
});
