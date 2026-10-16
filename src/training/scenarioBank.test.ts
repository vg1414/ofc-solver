import { describe, expect, it } from 'vitest';
import type { Card } from '../engine/types';
import type { DetailedPlacementOption, DetailedSolverResult } from '../solver/solver';
import { applyMove, judge } from './moves';
import { BANK_KEEP, decBoard, decCards, decScenario, encBoard, encCards, encScenario, pickFromBank } from './scenarioBank';
import type { Scenario } from './scenarios';

const c = (s: string): Card => decCards(s)[0];

const board = decBoard('As..../KdKh......../2c3c4c....');
const scenario: Scenario = {
  id: 'x',
  variant: 'pineapple',
  round: 3,
  board,
  opponentBoard: decBoard('....../........../..........'),
  hand: [c('JK'), c('9s'), c('Td')],
  deadCards: [c('5h')],
  place: 2,
};

function opt(placements: [string, 'top' | 'middle' | 'bottom'][], discard: string, ev: number, finalist: boolean): DetailedPlacementOption {
  return {
    ev,
    rank: 0,
    primaryRow: placements[0][1],
    placements: placements.map(([card, row]) => ({ card: c(card), row, slotIndex: 0 })),
    discards: [c(discard)],
    simulations: finalist ? 2000 : 300,
    flProbability: 0.1234,
    foulProbability: 0.05,
    finalist,
    evDiffSE: 0.02,
  };
}

describe('scenarioBank', () => {
  it('packar kort och bräden fram och tillbaka', () => {
    expect(encBoard(board)).toBe('As..../KdKh......../2c3c4c....');
    expect(encCards(decCards('JKTd2h'))).toBe('JKTd2h');
  });

  it('sparar bästa + finalister + de bästa övriga, och spelarens drag hittas igen', () => {
    const best = opt([['JK', 'top'], ['9s', 'middle']], 'Td', 1.2, true);
    const fin = opt([['JK', 'bottom'], ['9s', 'middle']], 'Td', 0.9, true);
    const weak = Array.from({ length: BANK_KEEP + 5 }, (_, i) => opt([['Td', 'bottom'], ['9s', 'top']], 'JK', -1 - i, false));
    const res: DetailedSolverResult = { options: [fin, best, ...weak], best, simulations: 9000, timedOut: false, method: 'monteCarlo' };
    const b = encScenario(scenario, res, 'q1');
    expect(b.e.length).toBe(1 + BANK_KEEP); // bästa + de 12 bästa övriga (finalisten är en av dem)

    const back = decScenario(JSON.parse(JSON.stringify(b)), 'pineapple', true);
    expect(back.id).toBe('bank-pineapple-joker-q1');
    expect(back.hand).toEqual(scenario.hand);
    expect(back.deadCards).toEqual(scenario.deadCards);
    const ev = back.evaluation!;
    expect(ev.best.ev).toBe(1.2);
    expect(ev.best.resultBoard).toEqual(applyMove(board, best.placements));

    const move = { placements: fin.placements, discards: fin.discards };
    const j = judge(ev, move);
    expect(j.missing).toBe(false);
    expect(j.diff).toBeCloseTo(0.3);
    // Ett drag som inte sparades → missing (ScenarioRun räknar då om med draget låst)
    const odd = opt([['9s', 'bottom'], ['Td', 'bottom']], 'JK', 0, false);
    expect(judge(ev, { placements: odd.placements, discards: odd.discards }).missing).toBe(true);
  });

  it('väljer inte scenarion som ligger i kön', () => {
    const list = ['a', 'b', 'c'].map((id) => ({ ...scenario, id }));
    for (let k = 0; k < 20; k++) {
      expect(pickFromBank(list, 'test', new Set(['a', 'b']))?.id).toBe('c');
    }
    expect(pickFromBank(list, 'test', new Set(['a', 'b', 'c']))).toBeNull();
  });
});
