import { useEffect, useState } from 'react';
import Footer from './components/layout/Footer';
import SolverView from './components/solver/SolverView';
import SettingsSheet from './components/solver/SettingsSheet';
import { simPreset } from './components/solver/simPresets';
import SuitIcon from './components/cards/SuitIcon';
import { useGameStore } from './store/gameStore';

function loadSims() {
  try {
    const v = Number(localStorage.getItem('ofc-sim-level'));
    return [300, 800, 2000].includes(v) ? v : 800;
  } catch {
    return 800;
  }
}

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [simulations, setSimulations] = useState(loadSims);
  const { variant, setVariant } = useGameStore();

  useEffect(() => {
    try {
      localStorage.setItem('ofc-sim-level', String(simulations));
    } catch {
      /* privat läge — inget att göra */
    }
  }, [simulations]);

  return (
    <div className="relative min-h-dvh bg-page text-ink flex flex-col">
      {/* Levande bakgrund — mjuka färgklickar som sakta driver runt */}
      <div className="bg-blobs" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      {/* ===== Topbar ===== */}
      <header className="topbar pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-[64px] max-w-6xl items-center gap-3 px-4">
          <div className="group flex items-center gap-3 shrink-0">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#17996b] shadow-[0_4px_14px_rgba(0,0,0,0.2)] ring-2 ring-white/55 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-rotate-12 group-hover:scale-105">
              <SuitIcon suit="spades" className="h-[22px] w-[22px]" />
            </span>
            <div className="leading-tight">
              <div className="text-[19px] font-extrabold tracking-[-0.02em]">OFC Solver</div>
              <div className="text-[11.5px] font-medium text-white/75">Open Face Chinese · 54 kort</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="ml-auto flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-3.5 py-2 text-[12.5px] font-bold text-white backdrop-blur-md transition-[background,transform] duration-200 hover:bg-white/25 active:scale-95"
            aria-label="Inställningar"
          >
            {variant === 'regular' ? 'Vanlig' : 'Pineapple'}
            <span className="text-white/60">·</span>
            {simPreset(simulations).label}
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
        </div>
      </header>

      {/* ===== Innehåll ===== */}
      <main className="relative z-[1] mx-auto w-full max-w-6xl flex-1 px-3 sm:px-4 pt-3 wide:pb-2">
        <SolverView simulations={simulations} />
        {/* På mobil ligger signaturen i kortpanelen längst ner */}
        <Footer className="hidden wide:block" />
      </main>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        variant={variant}
        onVariant={setVariant}
        simulations={simulations}
        onSimulations={setSimulations}
      />
    </div>
  );
}
