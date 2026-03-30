import { useState } from 'react';
import { useBookStore } from '../../store/bookStore';
import type { BookSession } from '../../store/bookStore';

// ============================================================
// SessionList.tsx — Lista över tidigare sessioner
// Stöder filtrering på motståndare och sortering på datum/poäng/pengar
// ============================================================

type SortKey = 'date' | 'points' | 'money';
type SortDir = 'desc' | 'asc';

function fmt(n: number, prefix = false) {
  if (prefix && n > 0) return `+${n}`;
  return String(n);
}

function fmtMoney(amount: number, currency: string) {
  if (amount === 0) return '—';
  const sign = amount > 0 ? '+' : '';
  return `${sign}${amount.toLocaleString('sv-SE')} ${currency}`;
}

export default function SessionList() {
  const { sessions, removeSession } = useBookStore();

  const [filterOpponent, setFilterOpponent] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  if (sessions.length === 0) {
    return (
      <div className="bg-[#111c28] border border-slate-700 rounded-xl p-6 text-center text-slate-600 text-sm">
        Inga sessioner registrerade ännu. Lägg till din första session ovan.
      </div>
    );
  }

  // Unika motståndare för filter-dropdown
  const opponents = Array.from(new Set(sessions.map((s) => s.opponent))).sort();

  // Filtrera
  let filtered: BookSession[] = filterOpponent
    ? sessions.filter((s) => s.opponent === filterOpponent)
    : [...sessions];

  // Sortera
  filtered.sort((a, b) => {
    let va: number, vb: number;
    if (sortKey === 'date') {
      va = new Date(a.date).getTime();
      vb = new Date(b.date).getTime();
    } else if (sortKey === 'points') {
      va = a.points;
      vb = b.points;
    } else {
      va = a.moneyAmount;
      vb = b.moneyAmount;
    }
    return sortDir === 'desc' ? vb - va : va - vb;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <span className="text-slate-700 ml-1">↕</span>;
    return <span className="text-green-400 ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>;
  };

  return (
    <div className="bg-[#111c28] border border-slate-700 rounded-xl overflow-hidden">
      {/* Verktygsrad */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-3 flex-wrap">
        <h3 className="text-slate-300 font-semibold flex-1">
          Sessioner <span className="text-slate-600 font-normal text-sm">({filtered.length})</span>
        </h3>
        <select
          value={filterOpponent}
          onChange={(e) => setFilterOpponent(e.target.value)}
          className="bg-[#0d1f2d] border border-slate-600 text-slate-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-green-500"
        >
          <option value="">Alla motståndare</option>
          {opponents.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      {/* Tabell */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-800">
              <th
                className="px-4 py-2 text-left cursor-pointer hover:text-slate-300 select-none whitespace-nowrap"
                onClick={() => toggleSort('date')}
              >
                Datum <SortIcon k="date" />
              </th>
              <th className="px-4 py-2 text-left">Motståndare</th>
              <th
                className="px-4 py-2 text-right cursor-pointer hover:text-slate-300 select-none whitespace-nowrap"
                onClick={() => toggleSort('points')}
              >
                Poäng <SortIcon k="points" />
              </th>
              <th
                className="px-4 py-2 text-right cursor-pointer hover:text-slate-300 select-none whitespace-nowrap"
                onClick={() => toggleSort('money')}
              >
                Pengar <SortIcon k="money" />
              </th>
              <th className="px-4 py-2 text-left text-slate-600">Notering</th>
              <th className="px-4 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const ptPos = s.points > 0;
              const ptNeg = s.points < 0;
              const mPos = s.moneyAmount > 0;
              const mNeg = s.moneyAmount < 0;
              return (
                <tr
                  key={s.id}
                  className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors"
                >
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{s.date}</td>
                  <td className="px-4 py-2.5 text-slate-300 font-medium">{s.opponent}</td>
                  <td
                    className={`px-4 py-2.5 text-right font-bold tabular-nums ${
                      ptPos ? 'text-green-400' : ptNeg ? 'text-red-400' : 'text-slate-500'
                    }`}
                  >
                    {fmt(s.points, true)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-semibold tabular-nums text-xs ${
                      mPos ? 'text-green-300' : mNeg ? 'text-red-300' : 'text-slate-600'
                    }`}
                  >
                    {fmtMoney(s.moneyAmount, s.moneyCurrency)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs max-w-[180px] truncate">
                    {s.notes ?? '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => {
                        if (confirm(`Ta bort session mot ${s.opponent} (${s.date})?`)) {
                          removeSession(s.id);
                        }
                      }}
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
