// ============================================================
// TrainingView.tsx — "Träna"-fliken: startsida + de två lägena
// ============================================================
// Startsidan: välj läge (Scenarion / Hel hand), variant och antal.
// Hel hand har egna inställningar (längd, FL i slutet, coach) i ett ark
// bakom kugghjulet. Topplistan för just det valet visas direkt under.
// Valen sparas i localStorage så att de är kvar till nästa gång.
// "Spela igen" byter `runId`, vilket monterar om omgången från noll.
// ============================================================

import { useEffect, useState } from 'react';
import type { GameVariant } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import { boardKey, loadBoard, type TrainingMode } from '../../training/leaderboard';
import { haptic } from '../cards/cardStyle';
import Segmented from '../ui/Segmented';
import Footer from '../layout/Footer';
import Leaderboard from './Leaderboard';
import ScenarioRun from './ScenarioRun';
import HandRun from './HandRun';
import { POOL_SIZE, useScenarioPool } from '../../training/useScenarioPool';
import HandSettingsSheet, { SettingsSummary } from './HandSettingsSheet';
import { CPU_LEVELS, leaderboardCount, lengthLabel, sanitizeHandSettings, type HandSettings } from '../../training/session';

const COUNTS = [5, 10, 20] as const;
const CFG_KEY = 'ofc-train-config';

interface Config {
  mode: TrainingMode;
  /** Antal scenarion */
  count: number;
  /** Hel hand: längd, FL i slutet, coach */
  hand: HandSettings;
}

/** Version av FL-valet. Före v2 var "Spelas ut" standard och sparades
 *  automatiskt, så äldre sparade val nollställs till nya standarden. */
const FL_VERSION = 2;

function loadConfig(): Config {
  const def: Config = { mode: 'scenario', count: 10, hand: sanitizeHandSettings(null) };
  try {
    const v = JSON.parse(localStorage.getItem(CFG_KEY) ?? '{}') as Partial<Config> & { coach?: boolean; flV?: number };
    const count = COUNTS.includes(v.count as 5) ? (v.count as number) : def.count;
    // Äldre sparade val hade coach + antal direkt i config — ta med dem
    const hand = sanitizeHandSettings(v.hand ?? { length: { kind: 'hands', n: count }, coach: v.coach });
    if (v.flV !== FL_VERSION) hand.flEnd = def.hand.flEnd;
    return { mode: v.mode === 'hand' || v.mode === 'joker' ? v.mode : 'scenario', count, hand };
  } catch {
    return def;
  }
}

/** active = Träna-fliken syns (annars pausas scenariokön) */
export default function TrainingView({ active = true }: { active?: boolean }) {
  const { variant, setVariant } = useGameStore();
  const [cfg, setCfg] = useState<Config>(loadConfig);
  const [running, setRunning] = useState<{ id: number; variant: GameVariant } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CFG_KEY, JSON.stringify({ ...cfg, flV: FL_VERSION }));
    } catch {
      /* privat läge */
    }
  }, [cfg]);

  // Scenariokön fylls redan på startsidan, så första scenariot är klart direkt
  const poolVariant = running?.variant ?? variant;
  const pool = useScenarioPool(poolVariant, cfg.mode === 'joker', active && cfg.mode !== 'hand');

  const start = () => {
    haptic([8, 30, 8]);
    window.scrollTo({ top: 0 });
    setRunning((r) => ({ id: (r?.id ?? 0) + 1, variant }));
  };
  const exit = () => setRunning(null);

  if (running) {
    return cfg.mode !== 'hand' ? (
      <ScenarioRun key={running.id} variant={running.variant} jokers={cfg.mode === 'joker'} pool={pool} count={cfg.count} onExit={exit} onRestart={start} />
    ) : (
      <HandRun key={running.id} variant={running.variant} settings={cfg.hand} active={active} onExit={exit} onRestart={start} />
    );
  }

  return <Setup cfg={cfg} setCfg={setCfg} variant={variant} setVariant={setVariant} onStart={start} ready={cfg.mode === 'hand' ? null : pool.ready} />;
}

function Setup({
  cfg,
  setCfg,
  variant,
  setVariant,
  onStart,
  ready,
}: {
  cfg: Config;
  setCfg: (c: Config) => void;
  variant: GameVariant;
  setVariant: (v: GameVariant) => void;
  onStart: () => void;
  /** Antal färdiga scenarion i kön (null = Hel hand) */
  ready: number | null;
}) {
  const scen = cfg.mode !== 'hand';
  const [sheet, setSheet] = useState(false);
  // Hel hand: topplista bara för antal händer
  const lbCount = scen ? cfg.count : leaderboardCount(cfg.hand.length);
  const entries = lbCount === null ? [] : loadBoard(boardKey(cfg.mode, variant, lbCount));
  const unit = scen ? 'scenarion' : 'händer';
  const startLabel = scen
    ? `${cfg.count} ${unit}`
    : cfg.hand.length.kind === 'free'
      ? 'fritt spel'
      : lengthLabel(cfg.hand.length);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 wide:grid wide:max-w-6xl wide:grid-cols-[minmax(0,1fr)_minmax(300px,420px)] wide:items-start wide:gap-5">
      <div className="flex flex-col gap-3">
        <div className="px-1 pt-1">
          <h1 className="title-serif text-[30px]">Träna</h1>
          <p className="text-[13px] font-medium text-ink-2">Öva mot solvern och slå ditt eget rekord.</p>
        </div>

        <Segmented<TrainingMode>
          variant="brand"
          ariaLabel="Träningsläge"
          value={cfg.mode}
          onChange={(m) => {
            haptic(4);
            setCfg({ ...cfg, mode: m });
          }}
          options={[
            { value: 'scenario', label: 'Scenarion' },
            { value: 'joker', label: '★ Joker' },
            { value: 'hand', label: 'Hel hand' },
          ]}
        />

        {/* Beskrivning av läget */}
        <div key={cfg.mode} className="glass rounded-[24px] p-4 animate-fade-in">
          {cfg.mode === 'joker' ? (
            <>
              <div className="font-serif text-[18px] font-extrabold text-ink">Jokerträning</div>
              <ul className="mt-1.5 flex flex-col gap-1 text-[13px] text-ink-2">
                <li>• Varje scenario har minst en joker i handen — ibland båda.</li>
                <li>• Blandat: öppningshänder och drag mitt i handen, riktiga bräden.</li>
                <li>• Var gör jokern mest nytta: draw, Fantasy Land eller säkerhet?</li>
                <li>• Samma poäng som Scenarion (max 100 p), egen topplista.</li>
              </ul>
            </>
          ) : scen ? (
            <>
              <div className="font-serif text-[18px] font-extrabold text-ink">Poängjakt</div>
              <ul className="mt-1.5 flex flex-col gap-1 text-[13px] text-ink-2">
                <li>• Riktiga lägen: datorn spelar fram båda bräden, sedan är det din tur.</li>
                <li>• Blandat: öppningshänder och drag mitt i handen.</li>
                <li>• Upp till <b className="text-gold">100 p</b> per scenario: 100 − EV-förlust × 100 (Perfekt = 100).</li>
                <li>• Perfekt ≤ 0,05 · Bra ≤ 0,5 · Miss &gt; 0,5 EV.</li>
              </ul>
            </>
          ) : (
            <>
              <div className="font-serif text-[18px] font-extrabold text-ink">Mot datorn</div>
              <ul className="mt-1.5 flex flex-col gap-1 text-[13px] text-ink-2">
                <li>• Hela händer med 54 kort. Datorn spelar med solvern ({CPU_LEVELS[cfg.hand.cpuLevel].label}).</li>
                <li>• Husreglerna: 1 p/rad, scoop +3, royalties (mitten dubbelt), foul.</li>
                <li>• Fantasy Land: QQ 13 · KK 14 · AA 15 · triss 16 kort, repeat-FL.</li>
                <li>• Spela flera händer i rad — välj antal händer, minuter eller fritt spel.</li>
              </ul>
            </>
          )}
        </div>

        <div className="glass flex flex-col gap-3 rounded-[24px] p-4">
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
          {scen ? (
            <div>
              <div className="mb-1.5 px-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-3">Antal {unit}</div>
              <Segmented<number>
                size="sm"
                ariaLabel={`Antal ${unit}`}
                value={cfg.count}
                onChange={(n) => {
                  haptic(4);
                  setCfg({ ...cfg, count: n });
                }}
                options={COUNTS.map((n) => ({ value: n, label: String(n), sub: unit }))}
              />
            </div>
          ) : (
            <SettingsSummary value={cfg.hand} onOpen={() => setSheet(true)} />
          )}
          <button type="button" onClick={onStart} className="btn-primary h-13 rounded-full py-3.5 text-[16px] font-bold">
            ★ Starta {startLabel}
          </button>
          {ready !== null && (
            <div className="-mt-1 flex items-center justify-center gap-1.5 text-[11.5px] font-bold text-ink-3" aria-live="polite">
              {Array.from({ length: POOL_SIZE }, (_, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full transition-all duration-500 ${i < ready ? 'scale-100' : 'scale-75 opacity-40'}`}
                  style={{ background: i < ready ? 'var(--grad)' : 'var(--line-strong)' }}
                />
              ))}
              <span className="ml-1">{ready > 0 ? `${ready} scenario${ready > 1 ? 'n' : ''} redo` : 'Datorn spelar fram scenarion…'}</span>
            </div>
          )}
        </div>
      </div>

      <div className="glass rounded-[24px] p-3.5 wide:sticky wide:top-[84px]">
        <div className="mb-1.5 flex items-baseline justify-between px-1">
          <h2 className="title-serif text-[21px]">Topplista</h2>
          <span className="text-[11px] font-bold text-ink-3">
            {cfg.mode === 'joker' ? '★ Joker · ' : ''}{scen ? `${cfg.count} ${unit}` : lengthLabel(cfg.hand.length)} · {variant === 'regular' ? 'Vanlig' : 'Pineapple'}
          </span>
        </div>
        {lbCount === null ? (
          <div className="px-1 py-6 text-center text-[13px] font-semibold text-ink-3">
            Topplistan gäller sessioner med ett antal händer.
            <br />
            <span className="text-[12px] font-medium">Tid och fritt spel räknas inte.</span>
          </div>
        ) : (
          <Leaderboard entries={entries} format={(s) => (scen ? `${s} p` : `${s > 0 ? '+' : ''}${s}`)} />
        )}
      </div>
      {!scen && <HandSettingsSheet open={sheet} onClose={() => setSheet(false)} value={cfg.hand} onChange={(hand) => setCfg({ ...cfg, hand })} />}
      <Footer className="wide:col-span-2" />
    </div>
  );
}
