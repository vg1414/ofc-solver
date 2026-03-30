import { useScoreStore } from '../../store/scoreStore';

export default function SessionSummary() {
  const { entries, totalPoints, clearSession } = useScoreStore();

  const hands = entries.length;
  const avg = hands > 0 ? (totalPoints / hands).toFixed(1) : '—';
  const isPos = totalPoints > 0;
  const isNeg = totalPoints < 0;

  const wins = entries.filter((e) => e.points > 0).length;
  const losses = entries.filter((e) => e.points < 0).length;
  const pushes = entries.filter((e) => e.points === 0).length;

  return (
    <div className="bg-[#111c28] border border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-slate-300 font-semibold">Session</h3>
        {hands > 0 && (
          <button
            onClick={() => {
              if (confirm('Rensa hela sessionens historik?')) clearSession();
            }}
            className="text-slate-600 hover:text-red-400 text-xs transition-colors"
          >
            Rensa session
          </button>
        )}
      </div>

      {/* Totalt */}
      <div className="text-center mb-4">
        <div className={`text-4xl font-bold ${isPos ? 'text-green-400' : isNeg ? 'text-red-400' : 'text-slate-400'}`}>
          {totalPoints > 0 ? `+${totalPoints}` : totalPoints}
        </div>
        <div className="text-slate-500 text-xs mt-1">totalt</div>
      </div>

      {/* Stats-rad */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-slate-800/40 rounded-lg p-2">
          <div className="text-slate-300 font-semibold">{hands}</div>
          <div className="text-slate-600 text-xs">händer</div>
        </div>
        <div className="bg-green-900/20 rounded-lg p-2">
          <div className="text-green-400 font-semibold">{wins}</div>
          <div className="text-slate-600 text-xs">vinster</div>
        </div>
        <div className="bg-red-900/20 rounded-lg p-2">
          <div className="text-red-400 font-semibold">{losses}</div>
          <div className="text-slate-600 text-xs">förluster</div>
        </div>
        <div className="bg-slate-800/40 rounded-lg p-2">
          <div className="text-slate-400 font-semibold">{avg}</div>
          <div className="text-slate-600 text-xs">snitt/hand</div>
        </div>
      </div>

      {pushes > 0 && (
        <div className="text-center text-slate-600 text-xs mt-2">{pushes} push{pushes !== 1 ? 'ar' : ''}</div>
      )}
    </div>
  );
}
