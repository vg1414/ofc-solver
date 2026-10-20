import { describe, expect, it } from 'vitest';
import { collect, flHand, guessRows, problems, type PhotoAnswer } from './photoLayout';
import { parseCard } from '../engine/card';

const ans = (rows: string[][], loose: string[] = []): PhotoAnswer => ({ rows, loose, uncertain: [] });
const targets = (a: PhotoAnswer, hand = true) => guessRows(a, hand).map((r) => r.target);

describe('guessRows', () => {
  it('tre rader = topp, mitten, botten och lösa kort = att lägga', () => {
    expect(targets(ans([['Jh'], ['8d', '6d'], ['Kc', '9c']], ['7c']))).toEqual(['top', 'middle', 'bottom', 'hand']);
  });
  it('två rader: kort första rad = topp+mitten, lång = mitten+botten', () => {
    expect(targets(ans([['Ks', '7d'], ['9h', '9c', 'Tc'], ]), true).length).toBe(1); // 5 kort = öppning
    expect(targets(ans([['Ks', '7d', '2c'], ['9h', '9c', 'Tc']]))).toEqual(['top', 'middle']);
    expect(targets(ans([['5d', '2d', '3s', 'Ad'], ['3h', '4h']]))).toEqual(['middle', 'bottom']);
  });
  it('högst 5 kort utan löst kort = öppningshand, även i flera rader', () => {
    expect(targets(ans([['As', 'Kd', '7h', '7c', 'JK']]))).toEqual(['hand']);
    const rows = guessRows(ans([['8s', '5c'], ['7d', 'JK', '4d']]));
    expect(rows).toHaveLength(1);
    expect(rows[0].target).toBe('hand');
    expect(rows[0].cards).toHaveLength(5);
  });
  it('högst 5 kort med ett löst kort = också öppningshand', () => {
    const rows = guessRows(ans([['8s', '5c', '7d', 'JK']], ['4d']));
    expect(rows).toHaveLength(1);
    expect(rows[0].target).toBe('hand');
    expect(rows[0].cards).toHaveLength(5);
  });
  it('5 lagda kort + ett löst = mitt i handen, inte öppning', () => {
    expect(targets(ans([['8s', '5c'], ['7d', 'JK', '4d']], ['Qh']))).toEqual(['top', 'middle', 'hand']);
  });
  it('tre rader där bara den sista ryms i toppen = upp och ner, vänds', () => {
    const rows = guessRows(ans([['8c', 'Td', 'Jh', 'Js', 'Th'], ['4d', '7h', '6s', '6h'], ['Ac', 'Kh', 'Kd']]), false);
    expect(rows.map((r) => r.target)).toEqual(['top', 'middle', 'bottom']);
    expect(rows[0].cards).toHaveLength(3);
    expect(rows[2].cards).toHaveLength(5);
  });
  it('motståndaren får aldrig "att lägga"', () => {
    expect(targets(ans([['As', 'Kd']]), false)).toEqual(['top']);
    expect(targets(ans([['8s', '5c'], ['7d', 'JK', '4d']]), false)).toEqual(['top', 'middle']);
  });
});

describe('problems', () => {
  it('godkänner ett vanligt läge', () => {
    expect(problems(guessRows(ans([['Jh'], ['8d', '6d'], ['Kc', '9c']], ['7c'])))).toEqual([]);
  });
  it('hittar dubbletter, för många jokrar och överfulla rader', () => {
    const p = problems(guessRows(ans([['Jh', 'Jh', 'JK', 'JK'], ['8d'], ['JK', '2c', '3c', '4c']])));
    expect(p).toContain('Toppen har 4 kort (max 3)');
    expect(p).toContain('Fler än 2 jokrar');
    expect(p).toContain('Jh finns två gånger');
  });
  it('räknar med korten på det andra brädet', () => {
    expect(problems(guessRows(ans([['Jh'], ['8d']])), [parseCard('8d')])).toContain('8d finns två gånger');
  });
});

describe('flHand', () => {
  const full = ans([['Kd', 'Kh', 'Ac'], ['6s', '6h', '7s', '7d', '4d'], ['Js', 'Jh', 'Td', 'Th', '8c']], ['2s']);
  it('fullt bräde + löst kort = 14 korts Fantasy Land', () => {
    expect(flHand(guessRows(full))?.length).toBe(14);
    expect(problems(guessRows(full))).toEqual([]);
  });
  it('13–16 kort i långa rader = Fantasy Land, antalet räknas ut själv', () => {
    const cards = ['Ah', 'Kh', 'Qh', 'Jh', 'Th', '9h', '8h', '7h', '6h', '5h', '4h', '3h', '2h', 'As', 'Ks', 'Qs'];
    for (const n of [13, 14, 15, 16]) {
      const rows = guessRows(ans([cards.slice(0, 8), cards.slice(8, n)]));
      expect(flHand(rows)?.length).toBe(n);
      expect(problems(rows)).toEqual([]);
    }
  });
  it('fullt bräde utan lösa kort = 13 korts Fantasy Land', () => {
    const rows = guessRows(ans([['Kd', 'Kh', 'Ac'], ['6s', '6h', '7s', '7d', '4d'], ['Js', 'Jh', 'Td', 'Th', '8c']]));
    expect(flHand(rows)?.length).toBe(13);
  });
  it('12 lagda + 1 löst = också FL (sista kortet i Vanlig har bara en plats)', () => {
    const rows = guessRows(ans([['Kd', 'Kh', 'Ac'], ['6s', '6h', '7s', '7d', '4d'], ['Js', 'Jh', 'Td', 'Th']], ['8c']));
    expect(flHand(rows)?.length).toBe(13);
  });
  it('Pineapple sista rundan: 11 lagda + 3 lösa = vanlig hand, inte FL', () => {
    const rows = guessRows(ans([['Kd', 'Kh', 'Ac'], ['6s', '6h', '7s', '7d'], ['Js', 'Jh', 'Td', 'Th']], ['8c', '2d', '3s']));
    expect(flHand(rows)).toBeNull();
    expect(collect(rows).hand.length).toBe(3);
  });
  it('inte när brädet inte är fullt', () => {
    expect(flHand(guessRows(ans([['Jh'], ['8d']], ['7c'])))).toBeNull();
  });
  it('collect slår ihop rader med samma mål', () => {
    const rows = guessRows(ans([['Jh'], ['8d']]), false);
    rows[1].target = 'top';
    expect(collect(rows).top.length).toBe(2);
  });
});
