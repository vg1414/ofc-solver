import type { GameVariant } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';

export default function Header() {
  const { variant, setVariant, resetGame, undoLastPlacement } = useGameStore();

  return (
    <header className="bg-[#0d1f2d] border-b border-slate-700/60 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
      {/* Logotyp */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-green-400 text-xl">♠</span>
        <h1 className="text-green-400 font-bold text-base sm:text-lg tracking-wide">OFC Solver</h1>
      </div>

      {/* Kontroller */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
        {/* Variant-väljare */}
        <select
          value={variant}
          onChange={(e) => setVariant(e.target.value as GameVariant)}
          className="bg-[#1a2d3e] border border-slate-600 text-slate-300 text-xs sm:text-sm rounded-md px-2 sm:px-3 py-1.5 focus:outline-none focus:border-green-500 cursor-pointer"
        >
          <option value="regular">Vanlig OFC</option>
          <option value="pineapple">Pineapple</option>
        </select>

        {/* Ångra */}
        <button
          onClick={undoLastPlacement}
          title="Ångra senaste placering"
          className="bg-[#1a2d3e] border border-slate-600 text-slate-300 text-xs sm:text-sm rounded-md px-2 sm:px-3 py-1.5 hover:border-slate-400 hover:text-slate-100 transition-colors"
        >
          ↩ Ångra
        </button>

        {/* Nytt spel */}
        <button
          onClick={resetGame}
          title="Starta nytt spel"
          className="bg-green-800/60 border border-green-700 text-green-300 text-xs sm:text-sm rounded-md px-2 sm:px-3 py-1.5 hover:bg-green-700/60 hover:text-green-100 transition-colors"
        >
          Nytt spel
        </button>
      </div>
    </header>
  );
}
