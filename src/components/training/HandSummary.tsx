// ============================================================
// HandSummary.tsx — Slutresultat efter alla händer mot datorn
// ============================================================

import type { GameVariant } from '../../engine/types';
import type { HandOutcome } from '../../training/game';
import { boardKey } from '../../training/leaderboard';
import { useLeaderboardRun } from '../../training/useLeaderboardRun';
import Footer from '../layout/Footer';
import Leaderboard, { NameSheet } from './Leaderboard';
import type { CoachEntry } from './HandRun';
import { evFmt } from './ReviewBoard';
import { useCountUp } from './TrainingBits';

export interface HandRecord {
  no: number;
  net: number;
  outcome: HandOutcome;
  /** FL-kort denna hand [du, datorn] */
  fl: [number, number];
}

interface Props {
  records: HandRecord[];
  coachLog: CoachEntry[];
  variant: GameVariant;
  count: number;
  onRestart: () => void;
  onExit: () => void;
}

const sign = (n: number) => `${n > 0 ? '+' : ''}${n}`;

export default function HandSummary({ records, coachLog, variant, count, onRestart, onExit }: Props) {
  const total = records.reduce((n, r) => n + r.net, 0);
  const shown = useCountUp(total, 1200, 0);
  const wins = records.filter((r) => r.net > 0).length;
  const losses = records.filter((r) => r.net < 0).length;
  const royalties = records.reduce((n, r) => n + r.outcome.score.p1Royalties.total, 0);
  const fouls = records.filter((r) => r.outcome.score.p1Foul).length;
  const flHands = records.filter((r) => r.fl[0] > 0).length;
  const judged = coachLog.filter((c) => c.j);
  const coachAvg = judged.length ? judged.reduce((n, c) => n + (c.j?.diff ?? 0), 0) / judged.length : null;
  const pending = coachLog.length - judged.length;

  const lb = useLeaderboardRun(boardKey('hand', variant, count), total, true);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 pb-4">
      <div className="glass relative overflow-hidden rounded-[28px] p-5 text-center animate-rise-in">
        <div className="gold-strip absolute inset-x-0 top-0" />
        <div className="eyebrow inline-block">{count} händer mot datorn · {variant === 'regular' ? 'Vanlig' : 'Pineapple'}</div>
        <div className={`mt-2 font-serif text-[64px] font-extrabold leading-none tabular ${total > 0 ? 'text-accent-ink' : total < 0 ? 'text-danger' : 'text-ink-2'}`}>
          {total > 0 ? '+' : ''}
          {Math.round(shown)}
        </div>
        <div className="mt-1 text-[13px] font-bold text-ink-3">{total > 0 ? 'Du slog datorn!' : total < 0 ? 'Datorn vann den här gången' : 'Helt jämnt'}</div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Vinster" value={`${wins}–${losses}`} />
          <Stat label="Royalties" value={`+${royalties}`} />
          <Stat label={flHands ? 'FL-händer' : 'Foul'} value={String(flHands || fouls)} />
        </div>
        {coachAvg !== null && (
          <div className="mt-3 rounded-[16px] bg-accent-soft px-3 py-2 text-[12.5px] font-bold text-accent-ink">
            Coach: snitt {coachAvg > 0.0001 ? evFmt.format(-coachAvg) : '0,00'} EV per drag ({judged.length} drag)
            {pending > 0 && <span className="text-ink-3"> · räknar {pending} till…</span>}
          </div>
        )}
      </div>

      <div className="glass overflow-hidden rounded-[24px] divide-y divide-line animate-rise-in" style={{ animationDelay: '0.1s' }}>
        {records.map((r) => (
          <div key={r.no} className="flex items-center gap-3 px-3.5 py-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sunken text-[12px] font-extrabold text-ink-2 tabular">{r.no}</span>
            <div className="min-w-0 flex-1 text-[12.5px] text-ink-2">
              {r.outcome.score.p1Foul ? 'Foul' : r.outcome.score.p1Scoop ? 'Scoop' : `${r.outcome.score.p1RowWins}–${r.outcome.score.p2RowWins} i rader`}
              {r.outcome.score.p1Royalties.total > 0 && <span className="text-gold"> · +{r.outcome.score.p1Royalties.total} royalties</span>}
              {r.fl[0] > 0 && <span className="font-bold text-fl"> · ★ FL</span>}
            </div>
            <span className={`text-[16px] font-extrabold tabular ${r.net > 0 ? 'text-accent-ink' : r.net < 0 ? 'text-danger' : 'text-ink-3'}`}>{sign(r.net)}</span>
          </div>
        ))}
      </div>

      <div className="glass rounded-[24px] p-3.5 animate-rise-in" style={{ animationDelay: '0.2s' }}>
        <div className="mb-1.5 flex items-baseline justify-between px-1">
          <h2 className="title-serif text-[21px]">Topplista</h2>
          <span className="text-[11px] font-bold text-ink-3">{count} händer · {variant === 'regular' ? 'Vanlig' : 'Pineapple'}</span>
        </div>
        <Leaderboard entries={lb.entries} highlightId={lb.highlightId} format={sign} />
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onExit} className="btn-ghost h-12 flex-1 rounded-full text-[14px] font-bold">
          Till start
        </button>
        <button type="button" onClick={onRestart} className="btn-primary h-12 flex-[2] rounded-full text-[15px] font-bold">
          ↻ Spela igen
        </button>
      </div>
      <Footer />

      <NameSheet open={lb.askName} rank={lb.rank} scoreText={`${sign(total)} p`} initialName={lb.initialName} onSave={lb.save} onClose={lb.skip} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] bg-sunken/70 px-2 py-2">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-3">{label}</div>
      <div className="text-[18px] font-extrabold tabular text-ink">{value}</div>
    </div>
  );
}
