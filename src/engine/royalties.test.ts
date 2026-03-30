// ============================================================
// royalties.test.ts — Enhetstester för royalty-beräkning
// ============================================================

import { describe, it, expect } from 'vitest';
import { calcRowRoyalty5, calcTopRoyalty, calcAllRoyalties, calcRoyaltyForRow } from './royalties';
import { parseCard } from './card';
import { makeJoker } from './card';

// Hjälpfunktion: parsa flera kortssträngar
function cards(...strs: string[]) {
  return strs.map(parseCard);
}

// ---------------------------------------------------------------
// Bottom-royalties
// ---------------------------------------------------------------

describe('calcRowRoyalty5 — bottom', () => {
  it('ger 0p för par (inte royalty-berättigad)', () => {
    expect(calcRowRoyalty5(cards('As', 'Ah', '2c', '3d', '5s'), 'bottom')).toBe(0);
  });

  it('ger 0p för triss (hemspel-regel: triss = 0p på bottom)', () => {
    expect(calcRowRoyalty5(cards('As', 'Ah', 'Ac', '2d', '5s'), 'bottom')).toBe(0);
  });

  it('ger 2p för stege', () => {
    expect(calcRowRoyalty5(cards('9s', 'Th', 'Jc', 'Qd', 'Ks'), 'bottom')).toBe(2);
  });

  it('ger 4p för färg', () => {
    expect(calcRowRoyalty5(cards('2s', '5s', '7s', 'Js', 'As'), 'bottom')).toBe(4);
  });

  it('ger 6p för kåk', () => {
    expect(calcRowRoyalty5(cards('As', 'Ah', 'Ac', '2d', '2s'), 'bottom')).toBe(6);
  });

  it('ger 10p för fyrtal', () => {
    expect(calcRowRoyalty5(cards('As', 'Ah', 'Ac', 'Ad', '2s'), 'bottom')).toBe(10);
  });

  it('ger 15p för färgstege', () => {
    expect(calcRowRoyalty5(cards('9s', 'Ts', 'Js', 'Qs', 'Ks'), 'bottom')).toBe(15);
  });

  it('ger 25p för royalstege', () => {
    expect(calcRowRoyalty5(cards('Ts', 'Js', 'Qs', 'Ks', 'As'), 'bottom')).toBe(25);
  });

  it('ger 20p för 5-tal (med joker)', () => {
    // Joker + AAAA = fem ess
    const hand = [parseCard('As'), parseCard('Ah'), parseCard('Ac'), parseCard('Ad'), makeJoker()];
    expect(calcRowRoyalty5(hand, 'bottom')).toBe(20);
  });

  it('returnerar 0 om hand har fel antal kort', () => {
    expect(calcRowRoyalty5(cards('As', 'Ah'), 'bottom')).toBe(0);
  });
});

// ---------------------------------------------------------------
// Middle-royalties (dubbla jämfört med bottom)
// ---------------------------------------------------------------

describe('calcRowRoyalty5 — middle', () => {
  it('ger 2p för triss (specialregel: 2p på middle)', () => {
    expect(calcRowRoyalty5(cards('As', 'Ah', 'Ac', '2d', '5s'), 'middle')).toBe(2);
  });

  it('ger 4p för stege', () => {
    expect(calcRowRoyalty5(cards('9s', 'Th', 'Jc', 'Qd', 'Ks'), 'middle')).toBe(4);
  });

  it('ger 8p för färg', () => {
    expect(calcRowRoyalty5(cards('2s', '5s', '7s', 'Js', 'As'), 'middle')).toBe(8);
  });

  it('ger 12p för kåk', () => {
    expect(calcRowRoyalty5(cards('As', 'Ah', 'Ac', '2d', '2s'), 'middle')).toBe(12);
  });

  it('ger 20p för fyrtal', () => {
    expect(calcRowRoyalty5(cards('As', 'Ah', 'Ac', 'Ad', '2s'), 'middle')).toBe(20);
  });

  it('ger 30p för färgstege', () => {
    expect(calcRowRoyalty5(cards('9s', 'Ts', 'Js', 'Qs', 'Ks'), 'middle')).toBe(30);
  });

  it('ger 50p för royalstege', () => {
    expect(calcRowRoyalty5(cards('Ts', 'Js', 'Qs', 'Ks', 'As'), 'middle')).toBe(50);
  });

  it('ger 40p för 5-tal (med joker)', () => {
    const hand = [parseCard('As'), parseCard('Ah'), parseCard('Ac'), parseCard('Ad'), makeJoker()];
    expect(calcRowRoyalty5(hand, 'middle')).toBe(40);
  });

  it('ger 0p för high card', () => {
    expect(calcRowRoyalty5(cards('2s', '4h', '7c', '9d', 'Js'), 'middle')).toBe(0);
  });
});

// ---------------------------------------------------------------
// Top-royalties (3-korts hand)
// ---------------------------------------------------------------

describe('calcTopRoyalty', () => {
  it('ger 0p för par under 66 (55)', () => {
    expect(calcTopRoyalty(cards('5s', '5h', 'Ac'))).toBe(0);
  });

  it('ger 1p för 66', () => {
    expect(calcTopRoyalty(cards('6s', '6h', 'Ac'))).toBe(1);
  });

  it('ger 2p för 77', () => {
    expect(calcTopRoyalty(cards('7s', '7h', 'Ac'))).toBe(2);
  });

  it('ger 3p för 88', () => {
    expect(calcTopRoyalty(cards('8s', '8h', 'Ac'))).toBe(3);
  });

  it('ger 4p för 99', () => {
    expect(calcTopRoyalty(cards('9s', '9h', 'Ac'))).toBe(4);
  });

  it('ger 5p för TT', () => {
    expect(calcTopRoyalty(cards('Ts', 'Th', 'Ac'))).toBe(5);
  });

  it('ger 6p för JJ', () => {
    expect(calcTopRoyalty(cards('Js', 'Jh', 'Ac'))).toBe(6);
  });

  it('ger 7p för QQ (FL-gräns)', () => {
    expect(calcTopRoyalty(cards('Qs', 'Qh', 'Ac'))).toBe(7);
  });

  it('ger 8p för KK', () => {
    expect(calcTopRoyalty(cards('Ks', 'Kh', 'Ac'))).toBe(8);
  });

  it('ger 9p för AA', () => {
    expect(calcTopRoyalty(cards('As', 'Ah', '2c'))).toBe(9);
  });

  it('ger 10p för 222', () => {
    expect(calcTopRoyalty(cards('2s', '2h', '2c'))).toBe(10);
  });

  it('ger 11p för 333', () => {
    expect(calcTopRoyalty(cards('3s', '3h', '3c'))).toBe(11);
  });

  it('ger 22p för AAA', () => {
    expect(calcTopRoyalty(cards('As', 'Ah', 'Ac'))).toBe(22);
  });

  it('ger 0p för high card', () => {
    expect(calcTopRoyalty(cards('2s', '5h', 'Ac'))).toBe(0);
  });

  it('ger 0p om hand har fel antal kort', () => {
    expect(calcTopRoyalty(cards('As', 'Ah'))).toBe(0);
  });

  it('ger triss-royalty med joker', () => {
    // JK + AA = AAA
    const hand = [parseCard('As'), parseCard('Ah'), makeJoker()];
    expect(calcTopRoyalty(hand)).toBe(22);
  });
});

// ---------------------------------------------------------------
// calcAllRoyalties — komplett bräde
// ---------------------------------------------------------------

describe('calcAllRoyalties', () => {
  it('summerar alla tre raders royalties korrekt', () => {
    // Top: QQ + kicker = 7p
    // Middle: färg = 8p
    // Bottom: kåk = 6p
    const top = cards('Qs', 'Qh', 'Ac');
    const middle = cards('2s', '5s', '7s', 'Js', 'As');
    const bottom = cards('Ks', 'Kh', 'Kc', '3d', '3s');

    const result = calcAllRoyalties(top, middle, bottom);
    expect(result.top).toBe(7);
    expect(result.middle).toBe(8);
    expect(result.bottom).toBe(6);
    expect(result.total).toBe(21);
  });

  it('ger total=0 när inga royalties kvalificerar', () => {
    const top = cards('2s', '5h', 'Ac');      // high card → 0p
    const middle = cards('2c', '4h', '7d', '9s', 'Jh'); // high card → 0p
    const bottom = cards('3c', '5h', '8d', 'Td', 'Qh'); // high card → 0p

    const result = calcAllRoyalties(top, middle, bottom);
    expect(result.total).toBe(0);
  });
});

// ---------------------------------------------------------------
// calcRoyaltyForRow — generisk router
// ---------------------------------------------------------------

describe('calcRoyaltyForRow', () => {
  it('delegerar till top-logiken för top', () => {
    expect(calcRoyaltyForRow(cards('As', 'Ah', 'Ac'), 'top')).toBe(22);
  });

  it('delegerar till middle-logiken för middle', () => {
    expect(calcRoyaltyForRow(cards('As', 'Ah', 'Ac', '2d', '5s'), 'middle')).toBe(2);
  });

  it('delegerar till bottom-logiken för bottom', () => {
    expect(calcRoyaltyForRow(cards('As', 'Ah', 'Ac', '2d', '5s'), 'bottom')).toBe(0);
  });
});
