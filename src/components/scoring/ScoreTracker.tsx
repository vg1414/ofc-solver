import { useState } from 'react';
import { useScoreStore } from '../../store/scoreStore';

export default function ScoreTracker() {
  const { addEntry } = useScoreStore();
  const [input, setInput] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const points = parseInt(input, 10);
    if (isNaN(points)) return;
    addEntry(points, notes.trim() || undefined);
    setInput('');
    setNotes('');
  };

  const handleQuick = (points: number) => {
    addEntry(points);
  };

  return (
    <div className="bg-[#111c28] border border-slate-700 rounded-xl p-4">
      <h3 className="text-slate-300 font-semibold mb-3">Knappa in hand</h3>

      {/* Snabbknappar */}
      <div className="flex flex-wrap gap-2 mb-3">
        {[-6, -4, -2, -1, 0, 1, 2, 4, 6].map((p) => (
          <button
            key={p}
            onClick={() => handleQuick(p)}
            className={`
              px-3 py-1.5 rounded-md text-sm font-bold border transition-colors
              ${p > 0
                ? 'bg-green-900/30 border-green-700 text-green-300 hover:bg-green-800/50'
                : p < 0
                ? 'bg-red-900/30 border-red-800 text-red-400 hover:bg-red-800/50'
                : 'bg-slate-700/30 border-slate-600 text-slate-400 hover:bg-slate-600/50'
              }
            `}
          >
            {p > 0 ? `+${p}` : p}
          </button>
        ))}
      </div>

      {/* Manuell input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Poäng (t.ex. +3 eller -2)"
          className="flex-1 bg-[#0d1f2d] border border-slate-600 text-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-green-500 placeholder:text-slate-600"
        />
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notering (valfritt)"
          className="flex-1 bg-[#0d1f2d] border border-slate-600 text-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-green-500 placeholder:text-slate-600"
        />
        <button
          type="submit"
          className="bg-green-800/60 border border-green-700 text-green-300 text-sm rounded-md px-4 py-2 hover:bg-green-700/60 transition-colors font-semibold"
        >
          Lägg till
        </button>
      </form>
    </div>
  );
}
