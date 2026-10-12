// Simuleringsnivåer (max-tid enligt solver.ts)
export const SIM_PRESETS = [
  { label: 'Snabb', value: 300, seconds: 8 },
  { label: 'Normal', value: 800, seconds: 20 },
  { label: 'Noggrann', value: 2000, seconds: 45 },
] as const;

export function simPreset(value: number) {
  return SIM_PRESETS.find((p) => p.value === value) ?? SIM_PRESETS[1];
}
