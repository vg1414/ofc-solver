// ============================================================
// names.ts — Spelarnamn och svensk genitiv ("Davids tur", "Måns tur")
// ============================================================

export const MAX_NAME = 14;

export function defaultName(i: 0 | 1): string {
  return `Spelare ${i + 1}`;
}

/** Tomt namn → "Spelare 1/2", annars trimmat och max MAX_NAME tecken */
export function cleanName(name: string, i: 0 | 1): string {
  const n = name.trim().slice(0, MAX_NAME);
  return n || defaultName(i);
}

/** Svensk genitiv: David → Davids, Måns → Måns, Felix → Felix, Spelare 1 → Spelare 1:s, Du → Din */
export function genitive(name: string): string {
  if (name === 'Du') return 'Din';
  if (/[sxz]$/i.test(name)) return name;
  if (/\d$/.test(name)) return `${name}:s`;
  return `${name}s`;
}
