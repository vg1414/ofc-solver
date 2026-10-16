// ============================================================
// scenarioBank.ts — Förberäknade träningsscenarion (banken)
// ============================================================
//
// Att spela fram och bedöma ett scenario tar 10–20 s på en dator och
// mer på en telefon. Därför bygger vi en bank på datorn i förväg
// (scripts/buildScenarioBank.ts) och lägger den i public/scenarios/:
// en fil per variant + läge, t.ex. "regular-joker.json". Appen hämtar
// bara filen för läget du tränar, när scenariokön startar.
//
// Filerna är kompakta för att bli små:
//   - kort som strängar ("As", "Th", "JK"), rader som "As..Kd" där ".." = tom plats
//   - ett drag = 3 tecken per kort: kort + rad (t/m/b, x = kastas)
//   - bara de BANK_KEEP bästa alternativen + alla finalister sparas.
//     Lägger spelaren ett drag som inte finns med räknas det om med
//     draget låst (pinned) — precis som ett drag solvern sållat bort.
//
// Sedda scenarion: id:n sparas i localStorage (per fil). Bara de senaste
// SEEN_SHARE av bankens storlek räknas som "nyligen sedda", så de du såg
// för längst sedan kommer tillbaka först när resten är spelade.
// ============================================================

import type { Board, Card, GameVariant, Rank, RowName, Suit } from '../engine/types';
import { createEmptyBoard } from '../engine/types';
import type { DetailedPlacementOption, DetailedSolverResult } from '../solver/solver';
import { ROWS, applyMove, placementsOn } from './moves';
import type { Scenario } from './scenarios';

/** Formatversion — höj om formatet ändras (gamla filer ignoreras) */
export const BANK_VERSION = 1;
/** Antal alternativ (utöver finalisterna) som sparas per scenario */
export const BANK_KEEP = 12;
/** Andel av banken som räknas som "nyligen sedda" */
export const SEEN_SHARE = 0.8;

export interface BankFile {
  v: number;
  variant: GameVariant;
  jokers: boolean;
  /** Byggdatum (ÅÅÅÅ-MM-DD) */
  built: string;
  scenarios: BankScenario[];
}

/** Ett alternativ: [drag, ev, simuleringar, FL-chans, foul-chans, flaggor (1 = finalist, 2 = tumregel), standardfel] */
export type BankOption = [string, number, number, number, number, number, number];

export interface BankScenario {
  id: string;
  /** Runda */
  r: number;
  /** Ditt bräde: "topp/mitten/botten" */
  b: string;
  /** Motståndarens bräde */
  o: string;
  /** Handen */
  h: string;
  /** Egna kastade kort */
  d: string;
  /** Antal kort som ska läggas */
  p: number;
  /** Bedömningens alternativ, bästa först */
  e: BankOption[];
  /** Simuleringar totalt */
  s: number;
  /** Tidsgräns nådd */
  t?: 1;
}

export function bankKey(variant: GameVariant, jokers: boolean): string {
  return `${variant}-${jokers ? 'joker' : 'vanlig'}`;
}

// ---------- Kort ----------

const SUITS: Record<string, Suit> = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' };
const SUIT_CH: Record<Suit, string> = { clubs: 'c', diamonds: 'd', hearts: 'h', spades: 's' };
const ROW_CH: Record<RowName, string> = { top: 't', middle: 'm', bottom: 'b' };
const ROW_OF: Record<string, RowName> = { t: 'top', m: 'middle', b: 'bottom' };

export function encCard(c: Card): string {
  return c.kind === 'joker' ? 'JK' : c.rank + SUIT_CH[c.suit];
}

export function decCard(s: string): Card {
  if (s === 'JK') return { kind: 'joker' };
  return { kind: 'card', rank: s[0] as Rank, suit: SUITS[s[1]] };
}

export const encCards = (cs: Card[]) => cs.map(encCard).join('');

export function decCards(s: string): Card[] {
  const out: Card[] = [];
  for (let i = 0; i < s.length; i += 2) out.push(decCard(s.slice(i, i + 2)));
  return out;
}

export function encBoard(b: Board): string {
  return ROWS.map((r) => b[r].cards.map((c) => (c ? encCard(c) : '..')).join('')).join('/');
}

export function decBoard(s: string): Board {
  const board = createEmptyBoard();
  s.split('/').forEach((row, k) => {
    const r = ROWS[k];
    for (let i = 0; i * 2 < row.length; i++) {
      const t = row.slice(i * 2, i * 2 + 2);
      board[r].cards[i] = t === '..' ? null : decCard(t);
    }
  });
  return board;
}

// ---------- Drag ----------

export function encMove(o: { placements: { card: Card; row: RowName }[]; discards: Card[] }): string {
  return o.placements.map((p) => encCard(p.card) + ROW_CH[p.row]).join('') + o.discards.map((c) => encCard(c) + 'x').join('');
}

export function decMove(s: string): { placements: { card: Card; row: RowName }[]; discards: Card[] } {
  const placements: { card: Card; row: RowName }[] = [];
  const discards: Card[] = [];
  for (let i = 0; i < s.length; i += 3) {
    const card = decCard(s.slice(i, i + 2));
    const r = s[i + 2];
    if (r === 'x') discards.push(card);
    else placements.push({ card, row: ROW_OF[r] });
  }
  return { placements, discards };
}

const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

// ---------- Scenario ↔ bank ----------

/** Packa ett bedömt scenario. Bästa draget först, sedan finalister och de bästa övriga. */
export function encScenario(s: Scenario, res: DetailedSolverResult, id: string): BankScenario {
  const rest = res.options.filter((o) => o !== res.best).sort((a, b) => b.ev - a.ev);
  const keep = new Set(rest.slice(0, BANK_KEEP));
  const kept = [res.best, ...rest.filter((o) => o.finalist || keep.has(o))];
  return {
    id,
    r: s.round,
    b: encBoard(s.board),
    o: encBoard(s.opponentBoard),
    h: encCards(s.hand),
    d: encCards(s.deadCards),
    p: s.place,
    e: kept.map((o) => [
      encMove(o),
      round(o.ev, 3),
      o.simulations,
      round(o.flProbability ?? 0, 3),
      round(o.foulProbability ?? 0, 3),
      (o.finalist ? 1 : 0) | (o.naive ? 2 : 0),
      round(o.evDiffSE ?? 0, 3),
    ]),
    s: res.simulations,
    ...(res.timedOut ? { t: 1 as const } : {}),
  };
}

/** Packa upp till ett Scenario med färdig bedömning (evaluation) */
export function decScenario(b: BankScenario, variant: GameVariant, jokers: boolean): Scenario {
  const board = decBoard(b.b);
  const options: DetailedPlacementOption[] = b.e.map(([m, ev, sims, fl, foul, flags, se], i) => {
    const mv = decMove(m);
    return {
      ev,
      rank: i + 1,
      primaryRow: mv.placements[0]?.row ?? 'bottom',
      placements: placementsOn(board, mv.placements),
      discards: mv.discards,
      simulations: sims,
      flProbability: fl,
      foulProbability: foul,
      resultBoard: applyMove(board, mv.placements),
      finalist: !!(flags & 1),
      ...(flags & 2 ? { naive: true } : {}),
      ...(i > 0 && se ? { evDiffSE: se } : {}),
    };
  });
  return {
    id: `bank-${bankKey(variant, jokers)}-${b.id}`,
    variant,
    round: b.r,
    board,
    opponentBoard: decBoard(b.o),
    hand: decCards(b.h),
    deadCards: decCards(b.d),
    place: b.p,
    evaluation: { options, best: options[0], simulations: b.s, timedOut: !!b.t, method: 'monteCarlo' },
  };
}

// ---------- Sedda scenarion ----------

const SEEN_KEY = 'ofc-scenario-seen';

function loadSeen(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

export function markSeen(key: string, id: string, bankSize: number): void {
  try {
    const all = loadSeen();
    const list = (all[key] ?? []).filter((x) => x !== id);
    list.push(id);
    all[key] = list.slice(-Math.max(1, Math.floor(bankSize * SEEN_SHARE)));
    localStorage.setItem(SEEN_KEY, JSON.stringify(all));
  } catch {
    /* privat läge */
  }
}

/** Slumpa ett scenario ur banken som inte setts nyligen och inte redan ligger i kön */
export function pickFromBank(bank: Scenario[], key: string, exclude: Set<string>, rand: () => number = Math.random): Scenario | null {
  const seen = new Set(loadSeen()[key] ?? []);
  let pool = bank.filter((s) => !seen.has(s.id) && !exclude.has(s.id));
  // Allt sett nyligen (liten bank) → ta något som åtminstone inte ligger i kön
  if (pool.length === 0) pool = bank.filter((s) => !exclude.has(s.id));
  if (pool.length === 0) return null;
  return pool[Math.floor(rand() * pool.length)];
}

/** Hämta och packa upp banken för ett läge (null om den saknas eller är fel version) */
export async function fetchBank(variant: GameVariant, jokers: boolean): Promise<Scenario[] | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}scenarios/${bankKey(variant, jokers)}.json`);
    if (!res.ok) return null;
    const f = (await res.json()) as BankFile;
    if (f.v !== BANK_VERSION || f.variant !== variant || f.jokers !== jokers || !Array.isArray(f.scenarios)) return null;
    const list = f.scenarios.map((b) => decScenario(b, variant, jokers));
    return list.length > 0 ? list : null;
  } catch {
    return null;
  }
}
