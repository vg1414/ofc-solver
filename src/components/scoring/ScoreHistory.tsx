import { useScoreStore } from '../../store/scoreStore';

export default function ScoreHistory() {
  const { entries, removeEntry } = useScoreStore();

  if (entries.length === 0) {
    return (
      <div className="bg-[#111c28] border border-slate-700 rounded-xl p-4 text-center text-slate-600 text-sm">
        Inga händer registrerade ännu.
      </div>
    );
  }

  let running = 0;

  return (
    <div className="bg-[#111c28] border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700">
        <h3 className="text-slate-300 font-semibold">Historik</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-800">
              <th className="px-4 py-2 text-left">Hand</th>
              <th className="px-4 py-2 text-left">Datum</th>
              <th className="px-4 py-2 text-right">Poäng</th>
              <th className="px-4 py-2 text-right">Löpande total</th>
              <th className="px-4 py-2 text-left">Notering</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              running += entry.points;
              const isPos = entry.points > 0;
              const isNeg = entry.points < 0;
              const runningPos = running > 0;
              const runningNeg = running < 0;
              return (
                <tr
                  key={entry.handNumber}
                  className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors"
                >
                  <td className="px-4 py-2 text-slate-400">#{entry.handNumber}</td>
                  <td className="px-4 py-2 text-slate-500">{entry.date}</td>
                  <td className={`px-4 py-2 text-right font-bold ${isPos ? 'text-green-400' : isNeg ? 'text-red-400' : 'text-slate-500'}`}>
                    {entry.points > 0 ? `+${entry.points}` : entry.points}
                  </td>
                  <td className={`px-4 py-2 text-right font-semibold ${runningPos ? 'text-green-300' : runningNeg ? 'text-red-300' : 'text-slate-400'}`}>
                    {running > 0 ? `+${running}` : running}
                  </td>
                  <td className="px-4 py-2 text-slate-500 text-xs">{entry.notes ?? '—'}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => removeEntry(entry.handNumber)}
                      title="Ta bort"
                      className="text-slate-700 hover:text-red-400 transition-colors text-xs"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
