// ============================================================
// PlayView.tsx — "Spela"-fliken: 2 spelare på samma telefon
// ============================================================
// Startsidan: skriv in namnen, välj variant och längd (samma ark som
// Hel hand, men utan dator och coach). Namn och val sparas till nästa gång.
// Ett pågående parti sparas efter varje drag (useLocalMatch), så här
// finns "Fortsätt" om appen har stängts mitt i ett parti.
// "Spela igen" byter `id`, vilket monterar om partiet från noll.
// ============================================================

import { useEffect, useState } from 'react';
import type { GameVariant } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import { createMatch, totals, type MatchConfig, type MatchState } from '../../match/match';
import { cleanName, defaultName, MAX_NAME } from '../../match/names';
import { clearSavedMatch, loadSavedMatch, type SavedMatch } from '../../match/useLocalMatch';
import { lengthLabel, sanitizeHandSettings, type HandSettings } from '../../training/session';
import { haptic } from '../cards/cardStyle';
import Segmented from '../ui/Segmented';
import Footer from '../layout/Footer';
import HandSettingsSheet, { SettingsSummary } from '../training/HandSettingsSheet';
import DuelRun from './DuelRun';

const CFG_KEY = 'ofc-duel-config';

interface DuelConfig {
  names: [string, string];
  hand: HandSettings;
}

function loadConfig(): DuelConfig {
  const def: DuelConfig = { names: ['', ''], hand: sanitizeHandSettings(null) };
  try {
    const v = JSON.parse(localStorage.getItem(CFG_KEY) ?? '{}') as Partial<DuelConfig>;
    const n = Array.isArray(v.names) ? v.names : [];
    const name = (i: 0 | 1) => (typeof n[i] === 'string' ? n[i].slice(0, MAX_NAME) : '');
    return { names: [name(0), name(1)], hand: sanitizeHandSettings(v.hand) };
  } catch {
    return def;
  }
}

export default function PlayView({ active = true }: { active?: boolean }) {
  const { variant, setVariant } = useGameStore();
  const [cfg, setCfg] = useState<DuelConfig>(loadConfig);
  const [running, setRunning] = useState<{ id: number; match: MatchState; elapsed: number } | null>(null);
  const [saved, setSaved] = useState<SavedMatch | null>(loadSavedMatch);

  useEffect(() => {
    try {
      localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    } catch {
      /* privat läge */
    }
  }, [cfg]);

  /** Nytt parti — med valen på startsidan, eller samma som förra partiet ("Spela igen") */
  const start = (config?: MatchConfig) => {
    haptic([8, 30, 8]);
    window.scrollTo({ top: 0 });
    const match = createMatch(
      config ?? {
        variant,
        names: [cleanName(cfg.names[0], 0), cleanName(cfg.names[1], 1)],
        length: cfg.hand.length,
        flEnd: cfg.hand.flEnd,
      },
    );
    setRunning((r) => ({ id: (r?.id ?? 0) + 1, match, elapsed: 0 }));
  };
  const resume = () => {
    if (!saved) return;
    haptic([8, 30, 8]);
    window.scrollTo({ top: 0 });
    setRunning((r) => ({ id: (r?.id ?? 0) + 1, match: saved.state, elapsed: saved.elapsedMs }));
  };
  const exit = () => {
    setRunning(null);
    setSaved(loadSavedMatch());
  };

  if (running) {
    return <DuelRun key={running.id} initial={running.match} initialElapsed={running.elapsed} active={active} onExit={exit} onRestart={() => start(running.match.config)} />;
  }

  return (
    <Setup
      cfg={cfg}
      setCfg={setCfg}
      variant={variant}
      setVariant={setVariant}
      onStart={() => start()}
      saved={saved}
      onResume={resume}
      onDiscard={() => {
        clearSavedMatch();
        setSaved(null);
      }}
    />
  );
}

function Setup({
  cfg,
  setCfg,
  variant,
  setVariant,
  onStart,
  saved,
  onResume,
  onDiscard,
}: {
  cfg: DuelConfig;
  setCfg: (c: DuelConfig) => void;
  variant: GameVariant;
  setVariant: (v: GameVariant) => void;
  onStart: () => void;
  saved: SavedMatch | null;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const [sheet, setSheet] = useState(false);
  const setName = (i: 0 | 1, v: string) => {
    const names: [string, string] = [...cfg.names];
    names[i] = v.slice(0, MAX_NAME);
    setCfg({ ...cfg, names });
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 wide:grid wide:max-w-6xl wide:grid-cols-[minmax(0,1fr)_minmax(300px,420px)] wide:items-start wide:gap-5">
      <div className="flex flex-col gap-3">
        <div className="px-1 pt-1">
          <h1 className="title-serif text-[30px]">Spela</h1>
          <p className="text-[13px] font-medium text-ink-2">Två spelare, en telefon — skicka den mellan er.</p>
        </div>

        {saved && <ResumeCard saved={saved} onResume={onResume} onDiscard={onDiscard} />}

        <div className="glass flex flex-col gap-3 rounded-[24px] p-4">
          <div>
            <div className="mb-1.5 px-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-3">Spelare</div>
            <div className="flex flex-col gap-2">
              {([0, 1] as const).map((i) => (
                <label
                  key={i}
                  className={`flex items-center gap-3 rounded-[18px] px-3 py-2 shadow-[inset_0_0_0_1.5px_var(--line)] transition-shadow duration-200 ${i === 0 ? 'bg-p1-soft/60 focus-within:shadow-[inset_0_0_0_2px_var(--p1)]' : 'bg-p2-soft/60 focus-within:shadow-[inset_0_0_0_2px_var(--p2)]'}`}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white"
                    style={{ background: `var(--grad-p${i + 1})`, boxShadow: `var(--glow-p${i + 1})` }}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    value={cfg.names[i]}
                    onChange={(e) => setName(i, e.target.value)}
                    placeholder={defaultName(i)}
                    maxLength={MAX_NAME}
                    autoComplete="off"
                    enterKeyHint="next"
                    aria-label={`Namn på spelare ${i + 1}`}
                    className="min-w-0 flex-1 bg-transparent text-[16px] font-bold text-ink outline-none placeholder:font-semibold placeholder:text-ink-3"
                  />
                  <span className={`text-[11px] font-bold ${i === 0 ? 'text-p1-ink' : 'text-p2-ink'}`}>{i === 0 ? 'grön' : 'blå'}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 px-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-3">Variant</div>
            <Segmented<GameVariant>
              size="sm"
              ariaLabel="Variant"
              value={variant}
              onChange={(v) => {
                haptic(4);
                setVariant(v);
              }}
              options={[
                { value: 'regular', label: 'Vanlig', sub: '5 + 1 åt gången' },
                { value: 'pineapple', label: 'Pineapple', sub: '5 + 3, kasta 1' },
              ]}
            />
          </div>

          <SettingsSummary value={cfg.hand} onOpen={() => setSheet(true)} duel />

          <button type="button" onClick={onStart} className="btn-primary h-13 rounded-full py-3.5 text-[16px] font-bold">
            ★ Starta {cfg.hand.length.kind === 'free' ? 'fritt spel' : lengthLabel(cfg.hand.length)}
          </button>
          {saved && <p className="-mt-1 text-center text-[11.5px] font-semibold text-ink-3">Ett nytt parti ersätter det pågående.</p>}
        </div>
      </div>

      <div className="glass rounded-[24px] p-4 wide:sticky wide:top-[84px]">
        <div className="font-serif text-[18px] font-extrabold text-ink">Så funkar det</div>
        <ul className="mt-1.5 flex flex-col gap-1 text-[13px] text-ink-2">
          <li>• Den som har turen ser alltid sitt eget bräde längst ner.</li>
          <li>• Banner och skärmkant i spelarens färg visar vems tur det är.</li>
          <li>• Tryck <b>Klar</b> och ge telefonen till den andra.</li>
          <li>• Kastade kort (Pineapple) visas aldrig för motståndaren.</li>
          <li>• Öppningshänderna läggs dolt — de visas när båda har lagt sin.</li>
          <li>• Fantasy Land-brädet är dolt tills handen är klar.</li>
          <li>• Husreglerna: 1 p/rad, scoop +3, royalties, foul, FL 13–16 kort.</li>
          <li>• Partiet sparas efter varje drag — stängs appen kan ni fortsätta.</li>
        </ul>
      </div>

      <HandSettingsSheet open={sheet} onClose={() => setSheet(false)} value={cfg.hand} onChange={(hand) => setCfg({ ...cfg, hand })} duel />
      <Footer className="wide:col-span-2" />
    </div>
  );
}

function ResumeCard({ saved, onResume, onDiscard }: { saved: SavedMatch; onResume: () => void; onDiscard: () => void }) {
  const s = saved.state;
  const [t1, t2] = totals(s);
  const [n1, n2] = s.config.names;
  // Släng kräver två tryck, så att ett parti inte försvinner av misstag
  const [sure, setSure] = useState(false);
  return (
    <div className="glass flex flex-col gap-2.5 rounded-[24px] p-4 animate-rise-in">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[18px] text-white shadow-[var(--glow-gold)]" style={{ background: 'var(--grad-gold)' }}>
          ↻
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-extrabold text-ink">Pågående parti</div>
          <div className="truncate text-[12px] font-semibold text-ink-3">
            Hand {s.hand.no} · {lengthLabel(s.config.length)} · {s.config.variant === 'regular' ? 'Vanlig' : 'Pineapple'}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-[16px] bg-p1-soft/70 px-2 py-1.5">
          <div className="truncate text-[11px] font-extrabold uppercase tracking-[0.06em] text-p1-ink">{n1}</div>
          <div className="text-[20px] font-extrabold tabular text-ink">{t1 > 0 ? '+' : ''}{t1}</div>
        </div>
        <div className="rounded-[16px] bg-p2-soft/70 px-2 py-1.5">
          <div className="truncate text-[11px] font-extrabold uppercase tracking-[0.06em] text-p2-ink">{n2}</div>
          <div className="text-[20px] font-extrabold tabular text-ink">{t2 > 0 ? '+' : ''}{t2}</div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => (sure ? onDiscard() : setSure(true))}
          onBlur={() => setSure(false)}
          className={`h-11 flex-1 rounded-full text-[13px] font-bold transition-colors duration-200 ${sure ? 'bg-danger text-white' : 'btn-ghost text-danger'}`}
        >
          {sure ? 'Ja, släng' : 'Släng'}
        </button>
        <button type="button" onClick={onResume} className="btn-primary h-11 flex-[2] rounded-full text-[14px] font-bold">
          Fortsätt →
        </button>
      </div>
    </div>
  );
}
