// ============================================================
// SavedMoves.tsx — "Sparade drag" på Träna-startsidan
// ============================================================
// Drag som du markerat med ☆ (i Hel hand, Scenarion, ★ Joker eller
// Spela), senaste först, grupperade per dag. Varje sparat drag räknas
// på Noggrann nivå (2000 sim, ditt drag låst) i bakgrunden direkt när
// det sparas (useSavedAnalyser i App), så det oftast ligger färdigt.
// Ett tryck öppnar arket:
//  - Klar bedömning visas direkt (med "Varför?").
//  - Räknas draget fortfarande visas förloppet; arket fylls i när det är klart.
//  - "Ta bort från sparade" tar bort draget.
// ============================================================

import { useState } from 'react';
import { countPlaced } from '../../training/moves';
import { SOURCE_LABEL, needsAnalysis, removeSaved, retryAnalysis, useAnalysisStatus, useSavedMoves } from '../../training/savedMoves';
import { MoveReviewSheet } from './CoachReview';
import MoveHistory from './MoveHistory';
import { OpponentMini, Spinner } from './TrainingBits';
import ShareBoards from '../share/ShareBoards';

const dayFmt = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });

export default function SavedMoves() {
  const saved = useSavedMoves();
  const status = useAnalysisStatus();
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = saved.find((s) => s.id === openId) ?? null;

  if (saved.length === 0) return null;

  const pending = saved.filter(needsAnalysis).length;
  const openedFailed = !!opened && status.failed.includes(opened.id);
  // Visa först när den noggranna räkningen är klar (en Normal-bedömning från coachen byts ut strax)
  const ready = opened && !needsAnalysis(opened) ? opened.j : null;

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
          j: needsAnalysis(s) ? null : s.j,
          fl: s.fl,
        }))}
        onOpen={setOpenId}
        openUnjudged
        saved={new Set(saved.map((s) => s.id))}
        onToggleSave={(id) => removeSaved(id)}
      />
      {pending > 0 && (
        <p className="mt-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold text-ink-3" aria-live="polite">
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
          Räknar {pending === 1 ? '1 drag' : `${pending} drag`} noggrant i bakgrunden…
        </p>
      )}
      <MoveReviewSheet
        open={!!opened}
        onClose={() => setOpenId(null)}
        title="Analys"
        itemKey={opened?.id ?? ''}
        subtitle={opened ? `${SOURCE_LABEL[opened.source]} · ${opened.label}` : ''}
        board={opened?.board}
        move={opened?.move}
        j={ready}
        fl={opened?.fl}
        thorough="✓ Noggrann (2000 sim, ditt drag låst)"
        extra={opened?.input.opponentBoard && countPlaced(opened.input.opponentBoard) > 0 ? <OpponentMini board={opened.input.opponentBoard} /> : undefined}
        saved
        onToggleSave={opened ? () => removeSaved(opened.id) : undefined}
        action={
          opened && (
            // Läget FÖRE draget + korten att lägga — som ett pussel, utan svaret
            <ShareBoards
              className="shrink-0"
              title="Dela läget"
              boards={() => [
                { name: 'Du', board: opened.board },
                ...(opened.input.opponentBoard && countPlaced(opened.input.opponentBoard) > 0 ? [{ name: 'Motståndare', board: opened.input.opponentBoard }] : []),
              ]}
              hand={() => {
                const place = opened.move.placements.length;
                const n = opened.input.cards.length;
                return {
                  cards: opened.input.cards,
                  label: opened.fl ? `Fantasy Land · ${n} kort` : place === n ? `Lägg ${n === 1 ? '1 kort' : `${n} kort`}` : `Lägg ${place}, kasta ${n - place}`,
                };
              }}
            />
          )
        }
        loading={
          openedFailed ? (
            <div className="flex items-center gap-2 rounded-2xl bg-danger-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-danger">
              <span className="flex-1">Draget kunde inte räknas.</span>
              <button type="button" className="font-bold underline" onClick={() => opened && retryAnalysis(opened.id)}>
                Försök igen
              </button>
            </div>
          ) : (
            <Spinner
              title="Analyserar draget…"
              sub={status.id === opened?.id ? 'Noggrann nivå (2000 sim), ditt drag låst' : 'Väntar på sin tur — andra sparade drag räknas först'}
              progress={status.id === opened?.id ? status.progress : null}
            />
          )
        }
      />
    </div>
  );
}
