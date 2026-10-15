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
    expect(targets(ans([['Ks', '7d'], ['9h', '9c', 'Tc']]))).toEqual(['top', 'middle']);
    expect(targets(ans([['5d', '2d', '3s', 'Ad'], ['3h', '4h']]))).toEqual(['middle', 'bottom']);
  });
  it('en ensam rad = öppningshand', () => {
    expect(targets(ans([['As', 'Kd', '7h', '7c', 'JK']]))).toEqual(['hand']);
  });
  it('motståndaren får aldrig "att lägga"', () => {
    expect(targets(ans([['As', 'Kd']]), false)).toEqual(['top']);
  });
});

describe('problems', () => {
  it('godkänner ett vanligt läge', () => {
    expect(problems(guessRows(ans([['Jh'], ['8d', '6d'], ['Kc', '9c']], ['7c'])))).toEqual([]);
  });
  it('hittar dubbletter, för många jokrar och överfulla rader', () => {
    const p = problems(guessRows(ans([['Jh', 'Jh', 'JK', 'JK'], ['8d'], ['JK']])));
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
  it('inte när brädet inte är fullt', () => {
    expect(flHand(guessRows(ans([['Jh'], ['8d']], ['7c'])))).toBeNull();
  });
  it('collect slår ihop rader med samma mål', () => {
    const rows = guessRows(ans([['Jh'], ['8d']]));
    rows[1].target = 'top';
    expect(collect(rows).top.length).toBe(2);
  });
});
