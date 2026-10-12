// ============================================================
// HandOver.tsx — Resultatet av en hand (i panelen längst ner)
// ============================================================
// Rad för rad (vem vann topp/mitt/botten), royalties, scoop, foul,
// nettopoäng för handen och om någon går till Fantasy Land.
// Poängen räknas av appens egen motor (src/engine/scoring.ts):
// 1 p per rad, +3 för scoop, royalties (mitten dubbelt), foul = 6 p + royalties.
// ============================================================

import type { HandOutcome } from '../../training/game';
import type { CoachEntry } from './HandRun';
import { evFmt } from './ReviewBoard';
import { useCountUp } from './TrainingBits';

const ROW_LABEL = { top: 'Topp', middle: 'Mitt', bottom: 'Botten' } as const;

interface Props {
  outcome: HandOutcome;
  last: boolean;
  coachLog: CoachEntry[];
  onNext: () => void;
  top?: React.ReactNode;
}

export default function HandOver({ outcome, last, coachLog, onNext, top }: Props) {
  const s = outcome.score;
  const net = s.p1Net;
  const shown = useCountUp(net, 800, 0);
  const title = net > 0 ? 'Du vann handen' : net < 0 ? 'Datorn vann handen' : 'Oavgjort';
  const judged = coachLog.filter((c) => c.j);
  const coachLoss = judged.reduce((n, c) => n + (c.j?.diff ?? 0), 0);

  return (
    <div className="flex flex-col gap-2.5 animate-rise-in">
      {top}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="title-serif text-[23px]">{title}</div>
          <div className="text-[12px] font-semibold text-ink-3">
            {s.p1Foul && s.p2Foul ? 'Båda foulade' : s.p1Foul ? 'Du foulade' : s.p2Foul ? 'Datorn foulade' : s.p1Scoop ? 'Scoop! +3 extra' : s.p2Scoop ? 'Datorn scoopade' : `${s.p1RowWins}–${s.p2RowWins} i rader`}
          </div>
        </div>
        <div className={`text-[36px] font-extrabold leading-none tabular ${net > 0 ? 'text-accent-ink' : net < 0 ? 'text-danger' : 'text-ink-2'}`}>
          {net > 0 ? '+' : ''}
          {Math.round(shown)}
        </div>
      </div>

      {s.rows.top && s.rows.middle && s.rows.bottom && (
        <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-2 gap-y-1 rounded-[16px] bg-sunken/60 px-3 py-2 text-[12px]">
          {(['top', 'middle', 'bottom'] as const).map((r) => {
            const row = s.rows[r]!;
            return (
              <div key={r} className="contents">
                <span className="font-bold text-ink-3">{ROW_LABEL[r]}</span>
                <span className={`truncate ${row.winner === 'p1' ? 'font-bold text-accent-ink' : 'text-ink-2'}`}>{row.p1Hand.description}</span>
                <span className="text-center font-extrabold text-ink-3">{row.winner === 'p1' ? '◀' : row.winner === 'p2' ? '▶' : '='}</span>
                <span className={`truncate text-right ${row.winner === 'p2' ? 'font-bold text-danger' : 'text-ink-2'}`}>{row.p2Hand.description}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 text-[11.5px] font-bold">
        <span className="rounded-full bg-gold-soft px-2.5 py-0.5 text-gold">Dina royalties +{s.p1Royalties.total}</span>
        <span className="rounded-full bg-sunken px-2.5 py-0.5 text-ink-2">Datorns +{s.p2Royalties.total}</span>
        {judged.length > 0 && (
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-accent-ink">Coach: {coachLoss > 0.0001 ? `${evFmt.format(-coachLoss)} EV` : 'felfritt!'}</span>
        )}
      </div>

      {outcome.nextFl[0] > 0 && !last && (
        <div className="rounded-2xl px-3.5 py-2 text-[13.5px] font-bold text-white shadow-[var(--glow-fl)] animate-badge-in" style={{ background: 'var(--grad-fl)' }}>
          ★ Fantasy Land! Du får {outcome.nextFl[0]} kort nästa hand.
        </div>
      )}
      {outcome.nextFl[1] > 0 && !last && (
        <div className="rounded-2xl bg-fl-soft px-3.5 py-2 text-[12.5px] font-bold text-fl">★ Datorn går till Fantasy Land ({outcome.nextFl[1]} kort).</div>
      )}

      <button type="button" onClick={onNext} className="btn-primary h-12 w-full rounded-full text-[15px] font-bold">
        {last ? 'Visa resultat ★' : 'Nästa hand →'}
      </button>
    </div>
  );
}
