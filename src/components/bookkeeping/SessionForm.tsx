import { useState } from 'react';
import { useBookStore } from '../../store/bookStore';

// ============================================================
// SessionForm.tsx — Formulär för att lägga till en ny session
// Fält: datum, motståndare, poäng, pengar (+valuta), notering
// ============================================================

const CURRENCIES = ['SEK', 'EUR', 'USD', 'GBP'];

export default function SessionForm({ onClose }: { onClose?: () => void }) {
  const { addSession } = useBookStore();

  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [opponent, setOpponent] = useState('');
  const [points, setPoints] = useState('');
  const [money, setMoney] = useState('');
  const [currency, setCurrency] = useState('SEK');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedPoints = parseInt(points, 10);
    const parsedMoney = parseFloat(money);

    if (!date) { setError('Välj ett datum.'); return; }
    if (!opponent.trim()) { setError('Ange motståndarens namn.'); return; }
    if (isNaN(parsedPoints)) { setError('Ange ett giltigt poängresultat (t.ex. +5 eller -3).'); return; }
    if (money !== '' && isNaN(parsedMoney)) { setError('Ange ett giltigt penningbelopp.'); return; }

    addSession({
      date,
      opponent: opponent.trim(),
      points: parsedPoints,
      moneyAmount: isNaN(parsedMoney) ? 0 : parsedMoney,
      moneyCurrency: currency,
      notes: notes.trim() || undefined,
    });

    // Återställ formuläret
    setDate(today);
    setOpponent('');
    setPoints('');
    setMoney('');
    setNotes('');
    onClose?.();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#111c28] border border-slate-700 rounded-xl p-5 flex flex-col gap-4"
    >
      <h3 className="text-slate-200 font-semibold text-base">Ny session</h3>

      {error && (
        <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Datum */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-500 text-xs uppercase tracking-wider">Datum</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-[#0d1f2d] border border-slate-600 text-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-green-500"
          />
        </div>

        {/* Motståndare */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-500 text-xs uppercase tracking-wider">Motståndare</label>
          <input
            type="text"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="T.ex. Erik"
            className="bg-[#0d1f2d] border border-slate-600 text-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-green-500 placeholder:text-slate-600"
          />
        </div>

        {/* Poäng */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-500 text-xs uppercase tracking-wider">Poäng</label>
          <input
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="+12 eller -7"
            className="bg-[#0d1f2d] border border-slate-600 text-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-green-500 placeholder:text-slate-600"
          />
        </div>

        {/* Pengar */}
        <div className="flex flex-col gap-1">
          <label className="text-slate-500 text-xs uppercase tracking-wider">Pengar (valfritt)</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={money}
              onChange={(e) => setMoney(e.target.value)}
              placeholder="0"
              className="flex-1 bg-[#0d1f2d] border border-slate-600 text-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-green-500 placeholder:text-slate-600"
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="bg-[#0d1f2d] border border-slate-600 text-slate-300 rounded-md px-2 py-2 text-sm focus:outline-none focus:border-green-500"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Notering */}
      <div className="flex flex-col gap-1">
        <label className="text-slate-500 text-xs uppercase tracking-wider">Notering (valfritt)</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="T.ex. hemma hos Erik, bra spel"
          className="bg-[#0d1f2d] border border-slate-600 text-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-green-500 placeholder:text-slate-600"
        />
      </div>

      {/* Knappar */}
      <div className="flex gap-3 justify-end">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-sm px-4 py-2 transition-colors"
          >
            Avbryt
          </button>
        )}
        <button
          type="submit"
          className="bg-green-800/60 border border-green-700 text-green-300 text-sm rounded-md px-5 py-2 hover:bg-green-700/60 transition-colors font-semibold"
        >
          Spara session
        </button>
      </div>
    </form>
  );
}
