// ============================================================
// HandOver.tsx — Resultatet av en hand (i panelen längst ner)
// ============================================================
// Rad för rad (vem vann topp/mitt/botten), royalties, scoop, foul,
// nettopoäng för handen och om någon går till Fantasy Land.
// Poängen räknas av appens egen motor (src/engine/scoring.ts):
// 1 p per rad, +3 för scoop, royalties (mitten dubbelt), foul = 6 p + royalties.
// I slutet av en session: "FL spelas ut" (en hand till) eller en notis om
// att FL inte spelas ut. Fritt spel får en "Avsluta här"-knapp.
// 2 spelare (`names`): texterna får spelarnas namn, och poängen visas för
// den som vann handen. Färgerna är alltid spelarens: blå = du / spelare 1,
// orange = datorn / spelare 2 (rött = bara foul).
// ============================================================

import type { HandOutcome } from '../../training/game';
import { CoachDots, type CoachEntry } from './CoachReview';
import { evFmt } from './ReviewBoard';
import { useCountUp } from './TrainingBits';
import { genitive } from '../../match/names';

const ROW_LABEL = { top: 'Toppen', middle: 'Mitten', bottom: 'Botten' } as const;

interface Props {
  outcome: HandOutcome;
  last: boolean;
  /** Sessionens längd är nådd, men FL spelas ut med en hand till */
  playOutFl?: boolean;
  /** Längden är nådd och FL spelas inte ut (inställning) */
  flSkipped?: boolean;
  coachLog: CoachEntry[];
  /** Öppna coachens ark för ett drag */
  onReview?: (e: CoachEntry) => void;
  /** Öppna ställningen för hela sessionen */
  onScore?: () => void;
  onNext: () => void;
  /** Fritt spel: avsluta efter den här handen */
  onStop?: () => void;
  /** FL måste spelas ut innan man får sluta */
  stopBlocked?: boolean;
  top?: React.ReactNode;
  /** 2 spelare: [spelare 1, spelare 2]. Utan = "Du" mot "Datorn" */
  names?: [string, string];
}

export default function HandOver({ outcome, last, playOutFl, flSkipped, coachLog, onReview, onScore, onNext, onStop, stopBlocked, top, names }: Props) {
  const s = outcome.score;
  const net = s.p1Net;
  const duel = !!names;
  const [n1, n2] = names ?? ['Du', 'Datorn'];
  // Mot datorn: poängen från ditt håll (+/−). 2 spelare: vinnarens poäng i vinnarens färg.
  const shown = useCountUp(duel ? Math.abs(net) : net, 800, 0);
  const title = net > 0 ? `${n1} vann handen` : net < 0 ? `${n2} vann handen` : 'Oavgjort';
  const netTone = net > 0 ? 'text-p1-ink' : net < 0 ? 'text-p2-ink' : 'text-ink-2';
  const p2Win = 'font-bold text-p2-ink';
  const p1Win = 'font-bold text-p1-ink';
  const judged = coachLog.filter((c) => c.j);
  const coachLoss = judged.reduce((n, c) => n + (c.j?.diff ?? 0), 0);

  return (
    <div className="flex flex-col gap-2.5 animate-rise-in">
      {top}
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="title-serif text-[23px]">{title}</div>
          <div className="text-[12px] font-semibold text-ink-3">
            {s.p1Foul && s.p2Foul
              ? 'Båda foulade'
              : s.p1Foul
                ? `${n1} foulade`
                : s.p2Foul
                  ? `${n2} foulade`
                  : s.p1Scoop
                    ? duel ? `${n1} scoopade! +3 extra` : 'Scoop! +3 extra'
                    : s.p2Scoop
                      ? `${n2} scoopade`
                      : `${s.p1RowWins}–${s.p2RowWins} i rader`}
          </div>
        </div>
        <div className={`text-[36px] font-extrabold leading-none tabular ${netTone}`}>
          {(duel ? net !== 0 : net > 0) ? '+' : ''}
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
                <span className={`truncate ${row.winner === 'p1' ? p1Win : 'text-ink-2'}`}>{row.p1Hand.description}</span>
                <span className="text-center font-extrabold text-ink-3">{row.winner === 'p1' ? '◀' : row.winner === 'p2' ? '▶' : '='}</span>
                <span className={`truncate text-right ${row.winner === 'p2' ? p2Win : 'text-ink-2'}`}>{row.p2Hand.description}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 text-[11.5px] font-bold">
        <span className={`rounded-full px-2.5 py-0.5 bg-p1-soft text-p1-ink`}>
          {duel ? `${genitive(n1)} royalties` : 'Dina royalties'} +{s.p1Royalties.total}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 bg-p2-soft text-p2-ink`}>
          {genitive(n2)} +{s.p2Royalties.total}
        </span>
        {judged.length > 0 && (
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-accent-ink">Coach: {coachLoss > 0.0001 ? `${evFmt.format(-coachLoss)} EV` : 'felfritt!'}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {onReview ? <CoachDots entries={coachLog} onOpen={onReview} /> : <span />}
        {onScore && (
          <button type="button" onClick={onScore} className="flex items-center gap-1 rounded-full bg-sunken px-2.5 py-1 text-[11.5px] font-bold text-ink-2 transition-transform active:scale-95">
            ▤ Ställning ›
          </button>
        )}
      </div>

      {outcome.nextFl[0] > 0 && !last && (
        <div className="rounded-2xl px-3.5 py-2 text-[13.5px] font-bold text-white shadow-[var(--glow-fl)] animate-badge-in" style={{ background: 'var(--grad-fl)' }}>
          ★ Fantasy Land! {n1} får {outcome.nextFl[0]} kort nästa hand.
        </div>
      )}
      {outcome.nextFl[1] > 0 && !last && (
        duel ? (
          <div className="rounded-2xl px-3.5 py-2 text-[13.5px] font-bold text-white shadow-[var(--glow-fl)] animate-badge-in" style={{ background: 'var(--grad-fl)' }}>
            ★ Fantasy Land! {n2} får {outcome.nextFl[1]} kort nästa hand.
          </div>
        ) : (
          <div className="rounded-2xl bg-fl-soft px-3.5 py-2 text-[12.5px] font-bold text-fl">★ Datorn går till Fantasy Land ({outcome.nextFl[1]} kort).</div>
        )
      )}

      {playOutFl && (
        <div className="flex items-center gap-2 rounded-2xl border border-fl/30 bg-fl-soft px-3.5 py-2 text-[12.5px] font-semibold text-fl animate-badge-in">
          <span className="text-[16px]">★</span>
          <span>Sessionen är slut — men Fantasy Land spelas ut först.</span>
        </div>
      )}
      {flSkipped && last && (
        <div className="rounded-2xl bg-sunken px-3.5 py-2 text-[12px] font-semibold text-ink-3">Sessionen slutar här — FL spelas inte ut (inställning).</div>
      )}

      <div className="flex gap-2">
        {onStop && !last && (
          <button
            type="button"
            onClick={onStop}
            disabled={stopBlocked}
            className="btn-ghost h-12 flex-1 rounded-full text-[14px] font-bold disabled:opacity-50"
            title={stopBlocked ? 'Fantasy Land måste spelas ut först' : undefined}
          >
            {stopBlocked ? 'FL först' : 'Avsluta här'}
          </button>
        )}
        <button type="button" onClick={onNext} className="btn-primary h-12 flex-[2] rounded-full text-[15px] font-bold">
          {last ? 'Visa resultat ★' : playOutFl ? '★ Spela ut FL →' : 'Nästa hand →'}
        </button>
      </div>
    </div>
  );
}
