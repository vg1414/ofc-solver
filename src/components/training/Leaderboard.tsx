// ============================================================
// Leaderboard.tsx — Topp 10 + namn-ark när man kommer in på listan
// ============================================================

import { useEffect, useRef, useState } from 'react';
import type { LeaderboardEntry } from '../../training/leaderboard';
import BottomSheet from '../ui/BottomSheet';

const dateFmt = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: '2-digit' });

const MEDAL = ['var(--grad-gold)', 'linear-gradient(135deg,#f1f1f1 0%,#c9cdd3 60%,#9aa0a8 100%)', 'linear-gradient(135deg,#ffd2b0 0%,#d98b52 60%,#a8602d 100%)'];

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  highlightId?: string | null;
  format?: (score: number) => string;
  emptyText?: string;
}

export default function Leaderboard({ entries, highlightId, format = String, emptyText = 'Inga resultat än — bli först!' }: LeaderboardProps) {
  const newRef = useRef<HTMLLIElement>(null);

  // Scrolla fram det nya resultatet
  useEffect(() => {
    if (highlightId) newRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [highlightId]);

  if (entries.length === 0) {
    return <p className="px-1 py-3 text-center text-[13px] text-ink-3">{emptyText}</p>;
  }

  return (
    <ol className="flex flex-col gap-1">
      {entries.map((e, i) => {
        const isNew = e.id === highlightId;
        return (
          <li
            key={e.id}
            ref={isNew ? newRef : undefined}
            className={`flex items-center gap-3 rounded-[16px] px-2.5 py-2 ${isNew ? 'lb-new' : ''}`}
            style={{ animation: isNew ? undefined : `fade-in 0.3s var(--ease) ${i * 0.035}s both` }}
          >
            <span
              className={`h-7 w-7 shrink-0 rounded-full text-[12px] font-extrabold flex items-center justify-center tabular ${i < 3 ? 'text-[#3a2600]' : 'bg-sunken text-ink-2'}`}
              style={i < 3 ? { background: MEDAL[i] } : undefined}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[14px] font-bold text-ink">
                {e.name}
                {isNew && <span className="ml-1.5 rounded-full px-1.5 py-[1px] text-[10px] font-extrabold text-white align-middle" style={{ background: 'var(--grad)' }}>NY</span>}
              </div>
              <div className="text-[11px] text-ink-3">{dateFmt.format(new Date(e.date))}</div>
            </div>
            <span className={`text-[16px] font-extrabold tabular ${i === 0 ? 'text-gold' : 'text-ink'}`}>{format(e.score)}</span>
          </li>
        );
      })}
    </ol>
  );
}

interface NameSheetProps {
  open: boolean;
  rank: number;
  scoreText: string;
  initialName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

/** "Du kom in på topplistan!" — ange namn (senaste namnet är förifyllt) */
export function NameSheet({ open, rank, scoreText, initialName, onSave, onClose }: NameSheetProps) {
  const [name, setName] = useState(initialName);
  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  return (
    <BottomSheet open={open} onClose={onClose} title="Topplistan!">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(name);
        }}
        className="flex flex-col gap-3"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[22px] font-extrabold text-[#3a2600] shadow-[var(--glow-gold)] animate-badge-in" style={{ background: 'var(--grad-gold)' }}>
            {rank}
          </span>
          <p className="text-[14px] text-ink-2">
            Du tog plats <b className="text-ink">{rank}</b> med <b className="text-gold">{scoreText}</b>. Vad heter du?
          </p>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          placeholder="Ditt namn"
          aria-label="Ditt namn"
          className="h-12 rounded-full border-[1.5px] border-line bg-surface px-4 text-[16px] font-semibold text-ink outline-none transition-[border-color,box-shadow] focus:border-accent focus:shadow-[var(--glow)]"
        />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-ghost h-12 flex-1 rounded-full text-[14px] font-bold">
            Hoppa över
          </button>
          <button type="submit" className="btn-primary h-12 flex-[2] rounded-full text-[15px] font-bold">
            Spara
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
