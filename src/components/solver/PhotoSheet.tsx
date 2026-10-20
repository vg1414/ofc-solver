// ============================================================
// PhotoSheet.tsx — "Fota brädet": foto → "Stämmer det här?" → läget
// ============================================================
// Steg i arket:
//   pick     – ta ett foto eller välj en bild
//   reading  – fotot krymps och skickas; Workern berättar om den
//              dubbelkollar med en noggrannare modell (tar längre tid)
//   confirm  – raderna visas. Osäkra kort har en gul ring. Tryck ett kort
//              för att byta/ta bort det, "+" lägger till. Varje rad kan
//              flyttas till Toppen/Mitten/Botten/Att lägga.
//   error    – något gick fel: "Försök igen" skickar samma foto en gång till
//              (korten är ofta redan blandade), eller fyll i för hand
// Motståndarens bräde fotas från andra sidan bordet, så den bilden vänds 180°
// innan den skickas. "↻ Vänd och läs igen" läser samma bild åt andra hållet.
// Arket lägger inget själv: onDone får raderna och SolverView lägger ut dem.
// ============================================================

import { useEffect, useRef, useState } from 'react';
import type { Card } from '../../engine/types';
import BottomSheet from '../ui/BottomSheet';
import PlayingCard from '../cards/PlayingCard';
import CardGrid, { JokerButton } from '../cards/CardGrid';
import { cardAriaLabel, haptic, sameCard } from '../cards/cardStyle';
import { readPhoto, shrinkPhoto, type PhotoStage } from '../../photo/photoRead';
import {
  collect, flHand, guessRows, isUncertain, problems, TARGET_LABEL,
  type PhotoAnswer, type PhotoRow, type PhotoTarget,
} from '../../photo/photoLayout';

export type PhotoChoice = 'solve' | 'opponent' | 'fantasyLand';

interface PhotoSheetProps {
  open: boolean;
  onClose: () => void;
  /** Vems bräde som fotas */
  who: 'me' | 'opponent';
  /** Kort som redan ligger på det andra brädet (för dubblettkollen) */
  takenElsewhere: Card[];
  onDone: (rows: PhotoRow[], choice: PhotoChoice) => void;
}

type Phase = 'pick' | 'reading' | 'confirm' | 'error';
/** Kortet som ändras: plats i en rad, eller "lägg till" sist i raden */
type Edit = { row: number; index: number | null };

const CARD_W = 44;

/** Skämt som byts var 3:e sekund under den riktiga statusen medan fotot läses */
const JOKES = [
  'Ringer Lennart och frågar efter facit…',
  'Skiljer på 6:or och 9:or…',
  'Letar efter den andra jokern…',
  'Putsar glasögonen…',
  'Räknar hjärter, ruter, klöver och spader…',
  'Kollar att ingen har ett ess i ärmen…',
  'Frågar en croupier i Las Vegas…',
  'Mutar Gemini med kaffe…',
  'Vänder på korten åt rätt håll…',
  'Lovar att inte titta på motståndarens hand…',
  'Räknar till 13. Två gånger.',
  'Övertalar damen att sluta blinka…',
];

export default function PhotoSheet({ open, onClose, who, takenElsewhere, onDone }: PhotoSheetProps) {
  const mine = who === 'me';
  const [phase, setPhase] = useState<Phase>('pick');
  const [stage, setStage] = useState<PhotoStage | 'shrinking'>('shrinking');
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  // Var i skämtlistan vi börjar – slumpas vid varje läsning så att det inte blir samma först
  const [jokeStart, setJokeStart] = useState(0);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState<PhotoAnswer | null>(null);
  const [rows, setRows] = useState<PhotoRow[]>([]);
  const [edit, setEdit] = useState<Edit | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Senaste fotot och om det skickades vänt – för "Vänd och läs igen"
  const fileRef = useRef<File | null>(null);
  const [upsideDown, setUpsideDown] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  // Ett nytt ark börjar om från början: SolverView ger arket en ny key varje gång det öppnas.

  // Räknar sekunder medan vi väntar, så att det syns att något händer
  useEffect(() => {
    if (phase !== 'reading') return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [phase]);
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const joke = JOKES[(jokeStart + Math.floor(seconds / 3)) % JOKES.length];

  const close = () => {
    abortRef.current?.abort();
    onClose();
  };

  const onFile = async (file: File | null | undefined, turn = !mine) => {
    if (!file) return;
    haptic(8);
    fileRef.current = file;
    setUpsideDown(turn);
    setPhase('reading');
    setStage('shrinking');
    setStartedAt(Date.now());
    setNow(Date.now());
    setJokeStart(Math.floor(Math.random() * JOKES.length));
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const base64 = await shrinkPhoto(file, turn);
      setStage('reading');
      const a = await readPhoto(base64, setStage, ctrl.signal);
      setAnswer(a);
      setRows(guessRows(a, mine));
      setEdit(null);
      setPhase('confirm');
      haptic([8, 40, 8]);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setError((e as Error).message || 'Något gick fel.');
      setPhase('error');
    }
  };

  // ---------- Ändra korten ----------

  const setTarget = (row: number, target: PhotoTarget) => {
    haptic(4);
    setRows((rs) => rs.map((r, i) => (i === row ? { ...r, target } : r)));
  };

  const putCard = (card: Card) => {
    if (!edit) return;
    haptic(6);
    setRows((rs) =>
      rs.map((r, i) => {
        if (i !== edit.row) return r;
        const cards = [...r.cards];
        if (edit.index === null) cards.push(card);
        else cards[edit.index] = card;
        return { ...r, cards };
      }),
    );
    // Efter "lägg till" står vi kvar och kan lägga till fler
    if (edit.index !== null) setEdit(null);
  };

  const removeCard = () => {
    if (!edit || edit.index === null) return;
    haptic(8);
    const { row, index } = edit;
    setRows((rs) => rs.map((r, i) => (i === row ? { ...r, cards: r.cards.filter((_, j) => j !== index) } : r)).filter((r) => r.cards.length));
    setEdit(null);
  };

  const addRow = () => {
    haptic(4);
    const used = new Set(rows.map((r) => r.target));
    const free = (['top', 'middle', 'bottom', 'hand'] as PhotoTarget[]).find((t) => !used.has(t) && (mine || t !== 'hand')) ?? 'bottom';
    setRows((rs) => [...rs, { target: free, cards: [] }]);
    setEdit({ row: rows.length, index: null });
  };

  const editing = edit ? (edit.index === null ? null : rows[edit.row]?.cards[edit.index]) : null;
  const allCards = rows.flatMap((r) => r.cards);
  const jokers = [...allCards, ...takenElsewhere].filter((c) => c.kind === 'joker').length;
  const issues = problems(rows.filter((r) => r.cards.length), takenElsewhere, mine);
  const fl = mine ? flHand(rows) : null;
  const c = collect(rows);
  const opening = mine && c.top.length + c.middle.length + c.bottom.length === 0 && c.hand.length > 0;
  const ok = issues.length === 0;
  // Högst 5 kort men utlagda som ett bräde → erbjud att göra dem till en starthand
  const canOpen = mine && !opening && allCards.length > 0 && allCards.length <= 5;
  const makeOpening = () => {
    haptic(6);
    setEdit(null);
    setRows([{ target: 'hand', cards: allCards }]);
  };
  // 13–16 kort som inte gissades som FL (t.ex. 12 lagda + 1 löst) → erbjud Fantasy Land ändå
  const canFl = mine && !fl && allCards.length >= 13 && allCards.length <= 16;
  const unsure = answer ? allCards.filter((c) => isUncertain(c, answer)).length : 0;

  const finish = (choice: PhotoChoice) => {
    haptic([10, 30, 14]);
    onDone(rows.filter((r) => r.cards.length), choice);
  };

  // ---------- Vyer ----------

  const title = phase === 'confirm' ? 'Stämmer det här?' : mine ? 'Fota ditt bräde' : 'Fota motståndarens bräde';

  return (
    <BottomSheet open={open} onClose={close} title={title}>
      {/* Två dolda filväljare: kameran direkt, eller bildbiblioteket */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />

      {phase === 'pick' && (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] leading-relaxed text-ink-2">
            Fota {mine ? 'ditt' : 'motståndarens'} bräde rakt ovanifrån så att korthörnen syns.
            {mine
              ? <> Lägg kortet som ska läggas härnäst <b>för sig självt</b> en bit bort.</>
              : <> Fota från <b>din sida</b> av bordet – appen vänder bilden själv.</>}
          </p>
          <button type="button" onClick={() => cameraRef.current?.click()} className="btn-primary h-12 rounded-full text-[15px] font-bold">
            📷 Ta foto
          </button>
          <button type="button" onClick={() => libraryRef.current?.click()} className="btn-ghost h-11 rounded-full text-[14px] font-bold">
            Välj bild från biblioteket
          </button>
        </div>
      )}

      {phase === 'reading' && (
        <div className="flex flex-col items-center gap-3 py-6 text-center" role="status" aria-live="polite">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-line-strong border-t-[var(--accent)]" />
          <div className="text-[15px] font-bold text-ink">
            {stage === 'checking' ? 'Dubbelkollar med en noggrannare modell…' : 'Läser korten…'}
          </div>
          <div className="text-[12px] text-ink-3 tabular">
            {seconds} s{stage === 'checking' && ' · kan ta upp till en minut'}
          </div>
          <div key={joke} className="min-h-[18px] text-[12.5px] italic text-ink-2 animate-fade-in">{joke}</div>
          <button type="button" onClick={close} className="btn-ghost mt-1 h-10 rounded-full px-5 text-[13px] font-bold">
            Avbryt
          </button>
        </div>
      )}

      {phase === 'error' && (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-danger-soft px-3.5 py-3 text-[13px] font-semibold text-danger">{error}</div>
          <button
            type="button"
            onClick={() => (fileRef.current ? onFile(fileRef.current, upsideDown) : setPhase('pick'))}
            className="btn-primary h-12 rounded-full text-[15px] font-bold"
          >
            Försök igen
          </button>
          <button type="button" onClick={() => setPhase('pick')} className="btn-ghost h-11 rounded-full text-[14px] font-bold">
            Ta ett nytt foto
          </button>
          <button type="button" onClick={close} className="btn-ghost h-11 rounded-full text-[14px] font-bold">
            Fyll i för hand
          </button>
        </div>
      )}

      {phase === 'confirm' && (
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] leading-snug text-ink-2">
            {unsure > 0
              ? <>Titta extra på korten med <b className="text-gold">gul ring</b>. Tryck på ett kort för att ändra det.</>
              : 'Tryck på ett kort för att ändra det. Fel rad? Byt den med knapparna.'}
          </p>

          {rows.map((r, ri) => (
            <div key={ri} className="glass rounded-[20px] p-2.5">
              <div className="mb-2 flex flex-wrap gap-1">
                {(['top', 'middle', 'bottom', 'hand'] as PhotoTarget[])
                  .filter((t) => mine || t !== 'hand')
                  .map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTarget(ri, t)}
                      aria-pressed={r.target === t}
                      className={`h-7 rounded-full px-2.5 text-[11.5px] font-bold transition-colors ${
                        r.target === t ? 'text-white shadow-[var(--glow)]' : 'bg-sunken text-ink-2'
                      }`}
                      style={r.target === t ? { background: t === 'hand' ? 'var(--grad-gold)' : 'var(--grad)' } : undefined}
                    >
                      {TARGET_LABEL[t]}
                    </button>
                  ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {r.cards.map((c, ci) => {
                  const active = edit?.row === ri && edit.index === ci;
                  const warn = isUncertain(c, answer);
                  return (
                    <button
                      key={ci}
                      type="button"
                      aria-label={`${cardAriaLabel(c)}${warn ? ', osäker' : ''} – ändra`}
                      onClick={() => { haptic(4); setEdit(active ? null : { row: ri, index: ci }); }}
                      className="relative rounded-[8px] transition-transform duration-200 active:scale-90"
                      style={{ outline: warn ? '2.5px solid var(--gold)' : undefined, outlineOffset: 2 }}
                    >
                      <PlayingCard card={c} width={CARD_W} lifted={active} />
                      {warn && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ background: 'var(--gold)' }}>
                          ?
                        </span>
                      )}
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-label={`Lägg till kort i ${TARGET_LABEL[r.target]}`}
                  onClick={() => { haptic(4); setEdit(edit?.row === ri && edit.index === null ? null : { row: ri, index: null }); }}
                  className={`flex items-center justify-center rounded-[8px] border-2 border-dashed text-[20px] font-bold ${
                    edit?.row === ri && edit.index === null ? 'border-[var(--accent)] text-accent-ink' : 'border-line-strong text-ink-3'
                  }`}
                  style={{ width: CARD_W, height: CARD_W * 1.4 }}
                >
                  +
                </button>
              </div>

              {edit?.row === ri && (
                <div className="mt-2.5 flex flex-col gap-2 animate-fade-in">
                  <div className="flex items-center justify-between gap-2 text-[12px] font-semibold text-ink-2">
                    <span>{editing ? `Byt ut ${cardAriaLabel(editing)} mot…` : 'Välj kort att lägga till'}</span>
                    {editing ? (
                      <button type="button" onClick={removeCard} className="font-bold text-danger">Ta bort</button>
                    ) : (
                      <button type="button" onClick={() => setEdit(null)} className="font-bold text-accent-ink">Klar</button>
                    )}
                  </div>
                  <CardGrid
                    stateOf={(c) => (editing && sameCard(c, editing) ? 'held' : allCards.some((x) => sameCard(x, c)) || takenElsewhere.some((x) => sameCard(x, c)) ? 'used' : 'free')}
                    onTap={putCard}
                  />
                  <JokerButton left={Math.max(0, 2 - jokers)} state={editing?.kind === 'joker' ? 'held' : 'free'} draggable={false} onTap={(c) => jokers < 2 && putCard(c)} />
                </div>
              )}
            </div>
          ))}

          {rows.length < (mine ? 4 : 3) && (
            <button type="button" onClick={addRow} className="self-start text-[12.5px] font-bold text-accent-ink">
              + Lägg till en rad
            </button>
          )}

          {canOpen && (
            <button type="button" onClick={makeOpening} className="btn-ghost h-10 rounded-full text-[13px] font-bold">
              Det är en starthand ({allCards.length} kort)
            </button>
          )}

          {canFl && (
            <button type="button" onClick={makeOpening} className="btn-ghost h-10 rounded-full text-[13px] font-bold">
              ★ Det är Fantasy Land ({allCards.length} kort)
            </button>
          )}

          {issues.length > 0 && (
            <ul className="rounded-2xl bg-danger-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-danger">
              {issues.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
          {answer?.note && ok && (
            <p className="text-[11.5px] text-ink-3">Kunde inte dubbelkolla den här gången, så titta lite extra.</p>
          )}

          <div className="mt-1 flex flex-col gap-2">
            {!mine ? (
              <button type="button" disabled={!ok} onClick={() => finish('solve')} className="btn-primary h-12 rounded-full text-[15px] font-bold">
                ✓ Ja – räkna med motståndarens bräde
              </button>
            ) : fl ? (
              <button type="button" disabled={!ok} onClick={() => finish('fantasyLand')} className="btn-primary gold h-12 rounded-full text-[15px] font-bold">
                ★ Ja – lös Fantasy Land ({fl.length} kort)
              </button>
            ) : (
              <>
                <button type="button" disabled={!ok} onClick={() => finish('opponent')} className="btn-primary h-12 rounded-full text-[15px] font-bold">
                  ✓ Ja – fota motståndaren också
                </button>
                <button type="button" disabled={!ok} onClick={() => finish('solve')} className="btn-ghost h-11 rounded-full text-[14px] font-bold">
                  {opening ? 'Ja – räkna bästa öppning' : 'Ja – räkna bara på mitt bräde'}
                </button>
              </>
            )}
            <div className="flex justify-center gap-5">
              <button type="button" onClick={() => onFile(fileRef.current, !upsideDown)} className="h-9 text-[12.5px] font-bold text-ink-3">
                ↻ Vänd och läs igen
              </button>
              <button type="button" onClick={() => setPhase('pick')} className="h-9 text-[12.5px] font-bold text-ink-3">
                Fota igen
              </button>
            </div>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
