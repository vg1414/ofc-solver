import { useState } from 'react';
import SessionForm from './SessionForm';
import SessionList from './SessionList';
import Stats from './Stats';
import { useBookStore } from '../../store/bookStore';

// ============================================================
// Bookkeeping.tsx — Huvudvy för bokföring
// Innehåller tre under-flikar: Statistik | Sessioner | Ny session
// ============================================================

type SubTab = 'stats' | 'sessions' | 'new';

export default function Bookkeeping() {
  const [subTab, setSubTab] = useState<SubTab>('stats');
  const { sessions } = useBookStore();

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'stats', label: 'Statistik' },
    { key: 'sessions', label: `Sessioner (${sessions.length})` },
    { key: 'new', label: '+ Ny session' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Under-flikar */}
      <div className="flex gap-1 bg-[#0d1923] border border-slate-700/60 rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              subTab === t.key
                ? 'bg-slate-700/80 text-slate-100'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Innehåll */}
      {subTab === 'stats' && <Stats />}
      {subTab === 'sessions' && <SessionList />}
      {subTab === 'new' && (
        <SessionForm onClose={() => setSubTab('sessions')} />
      )}
    </div>
  );
}
