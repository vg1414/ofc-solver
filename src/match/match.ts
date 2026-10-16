// ============================================================
// match.ts — Spelmotorn för 2 spelare (ett parti = flera händer)
// ============================================================
//
// Byggd för att fungera både när man skickar telefonen mellan sig och
// för online-spel senare:
//
//  - MatchState är BARA data (inga funktioner/klasser), så hela partiet
//    kan sparas som JSON (localStorage nu, en server/databas senare).
//  - Allt som händer är en "action": { type: 'move', seat, move, … }.
//    applyAction(state, action) → nytt state. Samma action kan alltså
//    komma från den här telefonen eller över nätet.
//  - Varje drag kontrolleras (validateMove): rätt spelares tur, rätt
//    kort, rätt antal. Varje action har handens nummer och turens index,
//    så ett gammalt eller dubbelskickat meddelande avvisas i stället för
//    att lägga ett drag två gånger.
//  - viewFor(state, seat) visar bara det den spelaren får se: inte
//    motståndarens kastade kort, inte motståndarens öppningshand förrän
//    båda har lagt sin (husregel), inte ett Fantasy Land-bräde förrän
//    handen är slut, och aldrig kortleken. Online skickar servern bara
//    den vyn till varje spelare, så ingen kan fuska genom att läsa datan.
//
// Själva handen (giv, turordning, poäng) är samma kod som "Hel hand mot
// datorn" (training/game.ts). Plats 0 = spelare 1, plats 1 = spelare 2.
// ============================================================

import type { Board, Card, GameVariant } from '../engine/types';
import { played, startHand, type HandOutcome, type HandState, type SeatId, type Turn } from '../training/game';
import { applyMove, cardKey, type Move } from '../training/moves';
import type { DuelCpuLevel } from './cpu';
import { flPending, sessionOver, targetReached, type FlEnd, type SessionLength } from '../training/session';

/** Version av sparformatet — höj om strukturen ändras, så gamla sparningar ignoreras */
export const MATCH_VERSION = 1;

export interface MatchConfig {
  variant: GameVariant;
  names: [string, string];
  length: SessionLength;
  flEnd: FlEnd;
  /** Mot datorn: datorns nivå (datorn sitter på plats 2). Saknas = 2 spelare */
  cpu?: DuelCpuLevel;
}

/** En färdig hand (samma form som HandRecord i Scoreboard) */
export interface MatchRecord {
  no: number;
  /** Poäng för spelare 1 (spelare 2 får lika mycket med omvänt tecken) */
  net: number;
  outcome: HandOutcome;
  fl: [number, number];
  boards: [Board, Board];
}

export interface MatchState {
  v: typeof MATCH_VERSION;
  id: string;
  config: MatchConfig;
  hand: HandState;
  records: MatchRecord[];
  /** Första handen som bara spelas för att FL ska spelas ut */
  extraFrom: number | null;
  /** null = pågår; complete = partiet gick hela vägen */
  finished: { complete: boolean } | null;
}

export type MatchAction =
  /** Spelaren på `seat` lägger sitt drag på tur `turn` i hand `hand` */
  | { type: 'move'; hand: number; turn: number; seat: SeatId; move: Move }
  /** Gå vidare efter en färdig hand. elapsedMs avgör om ett tidsparti är slut */
  | { type: 'nextHand'; hand: number; elapsedMs: number }
  /** Avsluta partiet (✕ → "Visa resultat") */
  | { type: 'finish'; complete: boolean };

export class MatchError extends Error {}

const other = (s: SeatId): SeatId => (s === 0 ? 1 : 0);

export function createMatch(config: MatchConfig, opts: { first?: SeatId; deck?: Card[]; id?: string } = {}): MatchState {
  const first = opts.first ?? (Math.random() < 0.5 ? 0 : 1);
  return {
    v: MATCH_VERSION,
    id: opts.id ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    config,
    hand: startHand(1, first, [0, 0], config.variant, opts.deck),
    records: [],
    extraFrom: null,
    finished: null,
  };
}

/** Turen som pågår (null när handen är klar) */
export function currentTurn(s: MatchState): Turn | null {
  const h = s.hand;
  return h.outcome ? null : (h.turns[h.idx] ?? null);
}

/** Varför draget inte är tillåtet, eller null om det är okej */
export function validateMove(h: HandState, seat: SeatId, move: Move): string | null {
  if (h.outcome) return 'Handen är redan klar';
  const t = h.turns[h.idx];
  if (!t) return 'Ingen tur pågår';
  if (t.seat !== seat) return 'Det är inte din tur';
  if (move.placements.length !== t.place) return `Lägg ${t.place} kort`;
  if (move.placements.length + move.discards.length !== h.dealt.length) return 'Alla utdelade kort ska läggas eller kastas';
  // Korten i draget ska vara exakt de utdelade (två jokrar räknas som två)
  const left = new Map<string, number>();
  for (const c of h.dealt) left.set(cardKey(c), (left.get(cardKey(c)) ?? 0) + 1);
  for (const c of [...move.placements.map((p) => p.card), ...move.discards]) {
    const n = left.get(cardKey(c)) ?? 0;
    if (n <= 0) return 'Draget innehåller ett kort som inte delades ut';
    left.set(cardKey(c), n - 1);
  }
  try {
    applyMove(h.seats[seat].board, move.placements);
  } catch {
    return 'En rad blir för full';
  }
  return null;
}

function settings(c: MatchConfig) {
  return { length: c.length, flEnd: c.flEnd };
}

/** Är det här sista handen? (räknas om varje gång, så tiden kan ta slut medan resultatet visas) */
export function isLastHand(s: MatchState, elapsedMs: number): boolean {
  const o = s.hand.outcome;
  return !!o && sessionOver(settings(s.config), s.hand.no, elapsedMs, o.nextFl);
}

/** Längden är nådd men FL spelas ut med en hand till */
export function playsOutFl(s: MatchState, elapsedMs: number): boolean {
  const o = s.hand.outcome;
  return !!o && targetReached(s.config.length, s.hand.no, elapsedMs) && flPending(s.config.flEnd, o.nextFl);
}

export function applyAction(s: MatchState, a: MatchAction): MatchState {
  if (s.finished) throw new MatchError('Partiet är slut');
  switch (a.type) {
    case 'move': {
      const h = s.hand;
      if (a.hand !== h.no || a.turn !== h.idx) throw new MatchError('Draget gäller en tur som redan är spelad');
      const err = validateMove(h, a.seat, a.move);
      if (err) throw new MatchError(err);
      const hand = played(h, a.seat, a.move);
      const o = hand.outcome;
      const records = o
        ? [...s.records, { no: hand.no, net: o.score.p1Net, outcome: o, fl: [hand.seats[0].fl, hand.seats[1].fl] as [number, number], boards: [hand.seats[0].board, hand.seats[1].board] as [Board, Board] }]
        : s.records;
      return { ...s, hand, records };
    }
    case 'nextHand': {
      const h = s.hand;
      if (a.hand !== h.no) throw new MatchError('Fel hand');
      if (!h.outcome) throw new MatchError('Handen är inte klar');
      if (isLastHand(s, a.elapsedMs)) return { ...s, finished: { complete: true } };
      const reached = targetReached(s.config.length, h.no, a.elapsedMs);
      return {
        ...s,
        extraFrom: reached && s.extraFrom === null ? h.no + 1 : s.extraFrom,
        // Den som börjar växlar varje hand. FL följer med till nästa hand.
        hand: startHand(h.no + 1, other(h.first), h.outcome.nextFl, s.config.variant),
      };
    }
    case 'finish':
      return { ...s, finished: { complete: a.complete } };
  }
}

/** Ställningen: [spelare 1, spelare 2] (nollsumma) */
export function totals(s: Pick<MatchState, 'records'>): [number, number] {
  const t = s.records.reduce((n, r) => n + r.net, 0);
  return [t, -t];
}

// ---------- Vad en spelare får se ----------

export interface SeatView {
  name: string;
  /** null = dolt, se `hidden` */
  board: Board | null;
  /** Varför brädet är dolt: motståndarens FL (till handens slut) eller öppning (tills båda lagt) */
  hidden: 'fl' | 'opening' | null;
  fl: number;
  /** Egna kastade kort; motståndarens visas aldrig (bara antalet) */
  discards: Card[] | null;
  discardCount: number;
}

export interface MatchView {
  you: SeatId;
  config: MatchConfig;
  handNo: number;
  first: SeatId;
  turn: Turn | null;
  /** Index för turen som pågår (skickas med i 'move', se MatchAction) */
  turnIdx: number;
  yourTurn: boolean;
  /** Dina utdelade kort (tomt om det inte är din tur) */
  dealt: Card[];
  seats: [SeatView, SeatView];
  outcome: HandOutcome | null;
  records: MatchRecord[];
  extraFrom: number | null;
  finished: MatchState['finished'];
}

export function viewFor(s: MatchState, you: SeatId): MatchView {
  const h = s.hand;
  const turn = currentTurn(s);
  const seat = (i: SeatId): SeatView => {
    const st = h.seats[i];
    const mine = i === you;
    // Öppningshänderna läggs dolt: ingen ser den andras förrän alla har lagt sin första runda
    const hidden = mine || h.outcome ? null : st.fl > 0 ? 'fl' : turn?.round === 1 ? 'opening' : null;
    return {
      name: s.config.names[i],
      board: hidden ? null : st.board,
      hidden,
      fl: st.fl,
      discards: mine ? st.discards : null,
      discardCount: st.discards.length,
    };
  };
  const yourTurn = turn?.seat === you;
  return {
    you,
    config: s.config,
    handNo: h.no,
    first: h.first,
    turn,
    turnIdx: h.idx,
    yourTurn,
    dealt: yourTurn ? h.dealt : [],
    seats: [seat(0), seat(1)],
    outcome: h.outcome,
    records: s.records,
    extraFrom: s.extraFrom,
    finished: s.finished,
  };
}

/** Läs ett sparat parti säkert (fel version eller trasig data → null) */
export function parseMatch(json: string | null): MatchState | null {
  if (!json) return null;
  try {
    const s = JSON.parse(json) as MatchState;
    if (s?.v !== MATCH_VERSION || !s.hand || !Array.isArray(s.records) || !s.config?.names) return null;
    return s;
  } catch {
    return null;
  }
}
