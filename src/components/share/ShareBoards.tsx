// ============================================================
// ShareBoards.tsx — Dela-knapp i brädets hörn + ark med bilden
// ============================================================
// Knappen ser ut som mobilernas vanliga dela-symbol (fyrkant med pil upp).
// Ett tryck ritar brädena som en bild (share/boardImage.ts) och öppnar
// ett ark med förhandsvisning. Inget kopieras förrän man trycker
// "Kopiera bild" — så att man inte skriver över något i urklipp av misstag.
// Kan webbläsaren inte kopiera bilder blir knappen "Spara bild" (ladda ner).
// ============================================================

import { useEffect, useState } from 'react';
import { canCopyImage, copyImage, renderBoardsImage, type ShareBoard, type ShareHand } from '../../share/boardImage';
import { haptic } from '../cards/cardStyle';
import BottomSheet from '../ui/BottomSheet';

export function ShareIcon({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="M7.5 7.5 12 3l4.5 4.5" />
      <path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" />
    </svg>
  );
}

type Phase = 'idle' | 'copying' | 'copied' | 'error';

/** Dela-knappen (placeras absolut i brädets hörn av den som använder den) */
export default function ShareBoards({
  boards,
  hand,
  className = 'absolute right-2.5 top-2.5 z-10',
  title = 'Dela brädena',
}: {
  boards: () => ShareBoard[];
  /** Korten som ska läggas (dela läget som pussel) */
  hand?: () => ShareHand | undefined;
  className?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [img, setImg] = useState<{ blob: Blob; url: string } | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');

  // Släpp förhandsbilden när arket stängs
  useEffect(() => () => {
    if (img) URL.revokeObjectURL(img.url);
  }, [img]);

  const start = () => {
    haptic(6);
    setPhase('idle');
    setImg(null);
    setOpen(true);
    renderBoardsImage(boards(), hand?.())
      .then((blob) => setImg({ blob, url: URL.createObjectURL(blob) }))
      .catch(() => setPhase('error'));
  };

  const copy = async () => {
    if (!img) return;
    setPhase('copying');
    try {
      await copyImage(img.blob);
      haptic([8, 30, 8]);
      setPhase('copied');
      window.setTimeout(() => setOpen(false), 1100);
    } catch {
      setPhase('error');
    }
  };

  const copyable = canCopyImage();

  return (
    <>
      <button
        type="button"
        aria-label={`${title} som bild`}
        onClick={start}
        className={`${className} flex h-9 w-9 items-center justify-center rounded-full bg-surface/85 text-accent-ink shadow-[var(--shadow-soft)] backdrop-blur transition-transform duration-200 active:scale-90`}
      >
        <ShareIcon />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={title}>
        <div className="flex flex-col gap-3">
          <div className="flex min-h-[140px] items-center justify-center overflow-hidden rounded-[18px] bg-sunken/70 p-2">
            {img ? (
              <img src={img.url} alt="Brädena som bild" className="max-h-[50dvh] w-full rounded-[12px] object-contain shadow-[var(--shadow-soft)]" />
            ) : phase === 'error' ? null : (
              <span className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
            )}
          </div>
          {phase === 'error' ? (
            <p className="rounded-[14px] bg-danger-soft px-3 py-2 text-[12.5px] font-semibold text-danger">
              {img ? 'Bilden kunde inte kopieras. Prova "Spara bild" i stället.' : 'Bilden kunde inte skapas.'}
            </p>
          ) : (
            copyable && <p className="px-1 text-[12px] text-ink-2">Bilden kopieras till urklipp och ersätter det som ligger där nu.</p>
          )}
          {copyable && phase !== 'error' ? (
            <button type="button" disabled={!img || phase !== 'idle'} onClick={copy} className="btn-primary h-12 rounded-full text-[15px] font-bold disabled:opacity-80">
              {phase === 'copied' ? '✓ Kopierad' : phase === 'copying' ? 'Kopierar…' : 'Kopiera bild'}
            </button>
          ) : (
            img && (
              <a href={img.url} download="ofc-solver.png" className="btn-primary flex h-12 items-center justify-center rounded-full text-[15px] font-bold">
                Spara bild
              </a>
            )
          )}
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost h-11 rounded-full text-[14px] font-bold">
            Avbryt
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
