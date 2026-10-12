// ============================================================
// PlayDock.tsx — Din hand + "Klar" i den fasta panelen
// ============================================================
// Korten i handen kan tryckas (lyfts, sedan tryck på en rad) eller
// dras direkt till brädet. När rätt antal kort ligger ute blir
// "Klar"-knappen aktiv. Kort som blir kvar kastas.
// ============================================================

import type { MoveBuilder } from '../../training/useMoveBuilder';
import HandTray from '../cards/HandTray';

interface PlayDockProps {
  mb: MoveBuilder;
  place: number;
  total: number;
  onDone: () => void;
  doneLabel?: string;
  /** Rad ovanför handen, t.ex. solverns status */
  top?: React.ReactNode;
  disabled?: boolean;
}

export default function PlayDock({ mb, place, total, onDone, doneLabel = 'Klar', top, disabled }: PlayDockProps) {
  const discard = total - place;
  const left = place - mb.placedCount;
  const many = total > 6;

  const hint = (() => {
    if (mb.done) return discard > 0 ? `Klart! ${discard === 1 ? 'Kortet' : `De ${discard} korten`} som är kvar kastas.` : 'Klart! Tryck på ett lagt kort två gånger för att ångra.';
    if (mb.heldCard) return 'Tryck på en rad – eller dra kortet dit';
    if (discard > 0 && mb.placedCount === 0) return `Lägg ${place} kort, ${discard === 1 ? 'det sista' : `de ${discard} sista`} kastas`;
    return left === 1 ? 'Lägg ditt kort: tryck på det, sedan på en rad' : `Lägg ${left} kort till`;
  })();

  return (
    <div className="flex flex-col gap-2.5">
      {top}
      <div className={`flex gap-2.5 ${many ? 'flex-col' : 'min-h-[60px] items-center'}`}>
        {mb.remaining.length > 0 && (
          <HandTray
            cards={mb.remaining.map((r) => r.card)}
            capacity={mb.remaining.length}
            heldIndex={mb.heldIndex}
            draggable
            onTapCard={mb.tapHand}
            wrap={many}
            cardWidth={many ? 'min(40px, calc((100vw - 90px) / 8))' : '42px'}
          />
        )}
        <span className="flex-1 text-[12.5px] font-semibold leading-snug text-ink-2" aria-live="polite">
          {hint}
        </span>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={mb.reset} disabled={mb.placedCount === 0 || disabled} className="btn-ghost h-12 rounded-full px-4 text-[13px] font-bold">
          ↶ Ångra
        </button>
        <button type="button" onClick={onDone} disabled={!mb.done || disabled} className="btn-primary h-12 flex-1 rounded-full text-[15px] font-bold">
          {doneLabel}
        </button>
      </div>
    </div>
  );
}
