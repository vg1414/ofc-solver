// ============================================================
// ScenarioFeedback.tsx — Graderingen efter ett scenario
// ============================================================
// Brickan (Perfekt / Bra / Miss) "poppar" in fjädrande, poängen räknas
// upp från 0 och EV för ditt drag och bästa draget står bredvid.
// Vid Perfekt sprakar en liten gnistring runt brickan.
// ============================================================

import { useEffect } from 'react';
import { GRADE_LABEL, type Judgement } from '../../training/moves';
import { haptic } from '../cards/cardStyle';
import { evFmt } from './ReviewBoard';
import { GRADE_STYLE, useCountUp } from './TrainingBits';

export function GradeBadge({ grade, size = 64 }: { grade: Judgement['grade']; size?: number }) {
  const st = GRADE_STYLE[grade];
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {grade === 'perfect' && (
        <span className="burst" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <i key={i} style={{ '--a': `${i * 36}deg` } as React.CSSProperties} />
          ))}
        </span>
      )}
      <span
        className="relative flex h-full w-full items-center justify-center rounded-full font-extrabold animate-grade-pop"
        style={{ background: st.bg, boxShadow: st.glow, color: st.text, fontSize: size * 0.42 }}
      >
        {st.icon}
      </span>
    </span>
  );
}

interface ScenarioFeedbackProps {
  j: Judgement;
  onNext: () => void;
  nextLabel: string;
}

export default function ScenarioFeedback({ j, onNext, nextLabel }: ScenarioFeedbackProps) {
  const pts = useCountUp(j.points, 800, 0);

  useEffect(() => {
    haptic(j.grade === 'perfect' ? [10, 40, 10, 40, 18] : j.grade === 'good' ? [10, 40, 12] : [30]);
  }, [j.grade]);

  return (
    <div className="flex flex-col gap-3 animate-rise-in">
      <div className="flex items-center gap-3.5">
        <GradeBadge grade={j.grade} />
        <div className="min-w-0 flex-1">
          <div className="title-serif text-[26px]">{GRADE_LABEL[j.grade]}{j.grade === 'perfect' ? '!' : ''}</div>
          <div className="text-[12.5px] font-semibold text-ink-2">
            {j.grade === 'perfect' ? 'Du hittade bästa draget.' : j.diff > 0 ? `${evFmt.format(-j.diff)} EV mot bästa draget` : 'Lika bra som bästa draget.'}
          </div>
        </div>
        <div className="text-right leading-none">
          <div className="text-[32px] font-extrabold tabular text-gold">+{Math.round(pts)}</div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-3">poäng</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-[16px] bg-sunken/70 px-2 py-2">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-3">Ditt drag</div>
          <div className="text-[18px] font-extrabold tabular text-ink">{evFmt.format(j.playerEv)}</div>
        </div>
        <div className="rounded-[16px] bg-gold-soft px-2 py-2 shadow-[inset_0_0_0_1px_var(--gold-line)]">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-gold">★ Bästa</div>
          <div className="text-[18px] font-extrabold tabular text-ink">{evFmt.format(j.bestEv)}</div>
        </div>
      </div>

      {j.screened && (
        <p className="rounded-[14px] bg-fl-soft px-3 py-2 text-[11.5px] font-semibold leading-snug text-fl">
          ⓘ Solvern sållade bort draget tidigt ({j.player?.simulations ?? 0} mot {j.best.simulations} simuleringar), så dess EV är osäkrare och kan vara lite för låg.
        </p>
      )}
      {j.missing && (
        <p className="rounded-[14px] bg-fl-soft px-3 py-2 text-[11.5px] font-semibold leading-snug text-fl">
          ⓘ Draget fanns inte bland solverns alternativ — EV visas som det sämsta alternativet.
        </p>
      )}

      <button type="button" onClick={onNext} className="btn-primary h-12 w-full rounded-full text-[15px] font-bold">
        {nextLabel}
      </button>
    </div>
  );
}
