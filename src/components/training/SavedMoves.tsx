// ============================================================
// SavedMoves.tsx — "Sparade drag" på Träna-startsidan
// ============================================================
// Drag som du markerat med ☆ (i Hel hand, Scenarion, ★ Joker eller
// Spela), senaste först, grupperade per dag. Ett tryck öppnar arket:
//  - Har draget redan en bedömning visas den direkt.
//  - Annars räknar solvern fram den på Noggrann nivå (2000 sim) med
//    ditt drag låst (pinned), och sparar den så att det går fort nästa gång.
//  - En bedömning från coachen (Normal) kan räknas om noggrant.
//  - "Ta bort från sparade" tar bort draget.
// Solvern körs i en egen worker (useSolverJobs) som bara finns medan
// startsidan visas.
// ============================================================

import { useEffect, useState } from 'react';
import type { SolverOptions } from '../../solver/solver';
import { countPlaced, judge } from '../../training/moves';
import { pinnedOptions } from '../../training/pinned';
import { SOURCE_LABEL, removeSaved, updateSavedJudgement, useSavedMoves, type SavedMove } from '../../training/savedMoves';
import { CANCELLED, useSolverJobs } from '../../training/useSolverJobs';
import { MoveReviewSheet } from './CoachReview';
import MoveHistory from './MoveHistory';
import { OpponentMini, Spinner } from './TrainingBits';

const THOROUGH: SolverOptions = { simulations: 2000 };

const dayFmt = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });

export default function SavedMoves() {
  const saved = useSavedMoves();
  const jobs = useSolverJobs();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const opened = saved.find((s) => s.id === openId) ?? null;

  const { solve } = jobs;
  const analyse = (s: SavedMove) => {
    setBusy(s.id);
    setError(null);
    solve({ ...s.input, options: s.fl ? {} : pinnedOptions(THOROUGH, s.move) })
      .then((res) => updateSavedJudgement(s.id, judge(res, s.move), !s.fl))
      .catch((e: Error) => {
        if (e.message !== CANCELLED) setError(e.message);
      })
      .finally(() => setBusy((b) => (b === s.id ? null : b)));
  };

  // Öppnat drag utan bedömning: räkna fram den direkt
  useEffect(() => {
    if (opened && !opened.j && busy !== opened.id && !error) analyse(opened);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, opened?.j]);

  if (saved.length === 0) return null;

  return (
    <div className="glass rounded-[24px] p-3.5">
      <MoveHistory
        title={`Sparade drag · ${saved.length}`}
        // MoveHistory vill ha äldsta först (den vänder själv till senaste överst)
        items={[...saved].reverse().map((s) => ({
          key: s.id,
          group: dayFmt.format(new Date(s.savedAt)),
          label: `${SOURCE_LABEL[s.source]} · ${s.label}`,
          move: s.move,
          j: s.j,
          fl: s.fl,
        }))}
        onOpen={(id) => {
          setError(null);
          setOpenId(id);
        }}
        openUnjudged
        saved={new Set(saved.map((s) => s.id))}
        onToggleSave={(id) => removeSaved(id)}
      />
      <MoveReviewSheet
        open={!!opened}
        onClose={() => setOpenId(null)}
        title="Analys"
        itemKey={opened ? `${opened.id}-${opened.thorough}` : ''}
        subtitle={opened ? `${SOURCE_LABEL[opened.source]} · ${opened.label}` : ''}
        board={opened?.board}
        move={opened?.move}
        j={opened?.j ?? null}
        fl={opened?.fl}
        thorough={opened?.thorough ? '✓ Noggrann (2000 sim, ditt drag låst)' : undefined}
        onRecheck={opened ? () => analyse(opened) : undefined}
        rechecking={!!opened && busy === opened.id}
        extra={opened?.input.opponentBoard && countPlaced(opened.input.opponentBoard) > 0 ? <OpponentMini board={opened.input.opponentBoard} /> : undefined}
        saved
        onToggleSave={opened ? () => removeSaved(opened.id) : undefined}
        loading={
          error ? (
            <div className="flex items-center gap-2 rounded-2xl bg-danger-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-danger">
              <span className="flex-1">Solvern: {error}</span>
              <button type="button" className="font-bold underline" onClick={() => opened && analyse(opened)}>
                Försök igen
              </button>
            </div>
          ) : (
            <Spinner title="Analyserar draget…" sub="Noggrann nivå (2000 sim), ditt drag låst" progress={jobs.progress} />
          )
        }
      />
    </div>
  );
}
