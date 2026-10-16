// ============================================================
// ReviewBoard.tsx — Ditt drag mot bästa draget, på brädet
// ============================================================
// En växel "Ditt drag / Bästa draget":
//  - Ditt drag: dina kort från draget som streckade kort (samma stil som
//    bästa draget), så att man ser vilka kort som lades just då.
//  - Bästa draget: solverns förslag som pulserande spökkort (samma som
//    i Solvern) på brädet som det såg ut innan draget.
// Kastade kort (Pineapple) visas under brädet.
// ============================================================

import { useState } from 'react';
import type { Board, Card, RowName } from '../../engine/types';
import { applyMove, countPlaced, moveKey, placementsOn, type Judgement, type Move } from '../../training/moves';
import BoardView from '../board/BoardView';
import PlayingCard from '../cards/PlayingCard';
import Segmented from '../ui/Segmented';
import { haptic } from '../cards/cardStyle';

export const evFmt = new Intl.NumberFormat('sv-SE', { signDisplay: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Discards({ cards, label }: { cards: Card[]; label: string }) {
  if (cards.length === 0) return null;
  return (
    <div className="flex items-center gap-2 px-1 text-[12px] font-semibold text-ink-3">
      {label}
      <div className="flex gap-1">
        {cards.map((c, i) => (
          <PlayingCard key={i} card={c} width={24} compact className="opacity-80" />
        ))}
      </div>
    </div>
  );
}

const pct = (p: number) => {
  const v = p * 100;
  return v > 0 && v < 1 ? '<1 %' : `${Math.round(v)} %`;
};

/** Foul-risk och FL-chans för ett drag (bara det solvern har räknat). Används även i coachens bricka. */
export function RiskText({ opt, label, className = '' }: { opt: Judgement['best'] | null; label?: string; className?: string }) {
  if (!opt || (opt.foulProbability === undefined && opt.flProbability === undefined)) return null;
  return (
    <span className={`font-bold tabular ${className}`}>
      {label && <span className="text-ink-3">{label} · </span>}
      {opt.foulProbability !== undefined && <span className="text-danger">Foul {pct(opt.foulProbability)}</span>}
      {opt.foulProbability !== undefined && opt.flProbability !== undefined && <span className="text-ink-3"> · </span>}
      {opt.flProbability !== undefined && <span className="text-fl">FL {pct(opt.flProbability)}</span>}
    </span>
  );
}

function Risk({ opt, label }: { opt: Judgement['best'] | null; label?: string }) {
  return (
    <div className="text-center text-[11.5px]">
      <RiskText opt={opt} label={label} />
    </div>
  );
}

interface ReviewBoardProps {
  board: Board;
  move: Move;
  judgement: Judgement;
  maxCardWidth?: number;
  /** Öppningshandens platser på brädet innan draget (mörk ram) */
  opening?: { row: RowName; slot: number }[];
}

export default function ReviewBoard({ board, move, judgement, maxCardWidth = 92, opening }: ReviewBoardProps) {
  // Är det här själva öppningen ramas dina kort in som öppningshand
  const openingMine = countPlaced(board) === 0 ? placementsOn(board, move.placements).map((p) => ({ row: p.row, slot: p.slotIndex })) : opening;
  // moveKey i stället för ===: sparade bedömningar (JSON) är kopior
  const same = judgement.diff <= 0.0001 && moveKey(move) === moveKey(judgement.best);
  const [view, setView] = useState<'mine' | 'best'>(same ? 'mine' : 'best');
  const best = judgement.best;

  return (
    <div className="flex flex-col gap-2">
      {!same && (
        <Segmented<'mine' | 'best'>
          size="sm"
          ariaLabel="Visa drag"
          value={view}
          onChange={(v) => {
            haptic(4);
            setView(v);
          }}
          options={[
            { value: 'mine', label: 'Ditt drag', sub: evFmt.format(judgement.playerEv) },
            // Fick ditt drag högre EV är skillnaden slumpbrus — då är det "solverns val", inte bättre
            { value: 'best', label: judgement.playerEv > judgement.bestEv ? 'Solverns val' : '★ Bästa draget', sub: evFmt.format(judgement.bestEv) },
          ]}
        />
      )}
      {/* Foul och FL för båda dragen, alltid (under respektive knapp) */}
      {same ? (
        <Risk opt={judgement.player ?? best} label="Ditt drag" />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Risk opt={judgement.player} />
          <Risk opt={best} />
        </div>
      )}
      {view === 'mine' ? (
        // Öppningshand: alla kort är nya, så de visas som vanliga kort
        countPlaced(board) === 0 ? (
          <BoardView key="mine" board={applyMove(board, move.placements)} opening={openingMine} maxCardWidth={maxCardWidth} />
        ) : (
          <BoardView key="mine" board={board} ghosts={placementsOn(board, move.placements)} opening={opening} maxCardWidth={maxCardWidth} />
        )
      ) : (
        <BoardView key="best" board={board} ghosts={placementsOn(board, best.placements)} opening={opening} maxCardWidth={maxCardWidth} />
      )}
      {judgement.playerEv > judgement.bestEv && (
        <p className="rounded-[14px] bg-accent-soft px-3 py-2 text-[11.5px] font-semibold leading-snug text-accent-ink">
          ✓ Ditt drag fick lite högre EV än solverns val. Skillnaden ryms i slumpens felmarginal, så räkna dem som lika bra.
        </p>
      )}
      <Discards cards={view === 'mine' ? move.discards : best.discards} label={view === 'mine' ? 'Du kastade' : 'Bästa kastar'} />
    </div>
  );
}
