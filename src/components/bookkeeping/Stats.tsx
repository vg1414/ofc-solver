import { useBookStore } from '../../store/bookStore';

// ============================================================
// Stats.tsx — Statistikvy för bokföringen
// Visar: total P&L (poäng + pengar), win rate, snitt per session, streak
// ============================================================

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'green' | 'red' | 'neutral';
}) {
  const valueColor =
    color === 'green'
      ? 'text-green-400'
      : color === 'red'
      ? 'text-red-400'
      : 'text-slate-200';

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-1">
      <div className="text-slate-500 text-xs uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</div>
      {sub && <div className="text-slate-600 text-xs">{sub}</div>}
    </div>
  );
}

function calcStreak(sessions: { points: number }[]): { current: number; type: 'win' | 'loss' | 'none' } {
  if (sessions.length === 0) return { current: 0, type: 'none' };
  // sessions är sorterade nyast-först (från store)
  const first = sessions[0].points;
  if (first === 0) return { current: 0, type: 'none' };
  const isWin = first > 0;
  let count = 0;
  for (const s of sessions) {
    if (isWin ? s.points > 0 : s.points < 0) count++;
    else break;
  }
  return { current: count, type: isWin ? 'win' : 'loss' };
}

export default function Stats() {
  const { sessions } = useBookStore();

  if (sessions.length === 0) {
    return (
      <div className="bg-[#111c28] border border-slate-700 rounded-xl p-6 text-center text-slate-600 text-sm">
        Ingen statistik ännu — lägg till din första session!
      </div>
    );
  }

  const totalSessions = sessions.length;
  const totalPoints = sessions.reduce((sum, s) => sum + s.points, 0);
  const wins = sessions.filter((s) => s.points > 0).length;
  const losses = sessions.filter((s) => s.points < 0).length;
  const pushes = sessions.filter((s) => s.points === 0).length;
  const winRate = totalSessions > 0 ? ((wins / totalSessions) * 100).toFixed(1) : '—';
  const avgPoints = totalSessions > 0 ? (totalPoints / totalSessions).toFixed(1) : '—';

  // Pengar — summera per valuta
  const moneySums: Record<string, number> = {};
  for (const s of sessions) {
    if (s.moneyAmount !== 0) {
      moneySums[s.moneyCurrency] = (moneySums[s.moneyCurrency] ?? 0) + s.moneyAmount;
    }
  }
  const moneyEntries = Object.entries(moneySums);

  // Streak
  const { current: streakCount, type: streakType } = calcStreak(sessions);

  // Bästa och sämsta session
  const best = sessions.reduce((a, b) => (a.points > b.points ? a : b));
  const worst = sessions.reduce((a, b) => (a.points < b.points ? a : b));

  // Mot vem är du bäst/sämst
  const opponentStats: Record<string, { points: number; count: number }> = {};
  for (const s of sessions) {
    if (!opponentStats[s.opponent]) opponentStats[s.opponent] = { points: 0, count: 0 };
    opponentStats[s.opponent].points += s.points;
    opponentStats[s.opponent].count++;
  }
  const opEntries = Object.entries(opponentStats);
  const bestOpp = opEntries.sort((a, b) => b[1].points - a[1].points)[0];
  const worstOpp = opEntries.sort((a, b) => a[1].points - b[1].points)[0];

  return (
    <div className="flex flex-col gap-4">
      {/* Huvud-stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Totalt (poäng)"
          value={totalPoints > 0 ? `+${totalPoints}` : totalPoints}
          sub={`${totalSessions} sessioner`}
          color={totalPoints > 0 ? 'green' : totalPoints < 0 ? 'red' : 'neutral'}
        />
        <StatCard
          label="Win rate"
          value={`${winRate}%`}
          sub={`${wins}V / ${losses}F / ${pushes}P`}
          color={parseFloat(winRate) >= 50 ? 'green' : 'red'}
        />
        <StatCard
          label="Snitt / session"
          value={parseFloat(String(avgPoints)) > 0 ? `+${avgPoints}` : avgPoints}
          sub="poäng per session"
          color={parseFloat(String(avgPoints)) > 0 ? 'green' : parseFloat(String(avgPoints)) < 0 ? 'red' : 'neutral'}
        />
        <StatCard
          label="Streak"
          value={streakCount > 0 ? `${streakCount} ${streakType === 'win' ? '🏆' : '📉'}` : '—'}
          sub={streakType === 'win' ? 'i rad vinster' : streakType === 'loss' ? 'i rad förluster' : 'ingen streak'}
          color={streakType === 'win' ? 'green' : streakType === 'loss' ? 'red' : 'neutral'}
        />
      </div>

      {/* Pengar */}
      {moneyEntries.length > 0 && (
        <div className="bg-[#111c28] border border-slate-700 rounded-xl p-4">
          <div className="text-slate-500 text-xs uppercase tracking-wider mb-3">Ekonomi</div>
          <div className="flex flex-wrap gap-4">
            {moneyEntries.map(([currency, total]) => (
              <div key={currency} className="flex flex-col">
                <span
                  className={`text-xl font-bold tabular-nums ${
                    total > 0 ? 'text-green-400' : total < 0 ? 'text-red-400' : 'text-slate-400'
                  }`}
                >
                  {total > 0 ? '+' : ''}
                  {total.toLocaleString('sv-SE')} {currency}
                </span>
                <span className="text-slate-600 text-xs">total</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bästa/sämsta + motståndare */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Bästa/sämsta session */}
        <div className="bg-[#111c28] border border-slate-700 rounded-xl p-4">
          <div className="text-slate-500 text-xs uppercase tracking-wider mb-3">Rekord</div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-sm">Bästa session</span>
              <span className="text-green-400 font-bold">
                +{best.points} mot {best.opponent}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-sm">Sämsta session</span>
              <span className="text-red-400 font-bold">
                {worst.points} mot {worst.opponent}
              </span>
            </div>
          </div>
        </div>

        {/* Per motståndare */}
        {opEntries.length > 1 && (
          <div className="bg-[#111c28] border border-slate-700 rounded-xl p-4">
            <div className="text-slate-500 text-xs uppercase tracking-wider mb-3">Motståndare</div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-sm">Bäst mot</span>
                <span className="text-green-400 font-bold">
                  {bestOpp[0]}{' '}
                  <span className="text-slate-500 font-normal text-xs">
                    (+{bestOpp[1].points} / {bestOpp[1].count} sessioner)
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-sm">Sämst mot</span>
                <span className="text-red-400 font-bold">
                  {worstOpp[0]}{' '}
                  <span className="text-slate-500 font-normal text-xs">
                    ({worstOpp[1].points} / {worstOpp[1].count} sessioner)
                  </span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
