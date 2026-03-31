// Delade konstanter för FL-aggressivitetsvärden (bryter cirkulär import solver ↔ monteCarlo)
export const FL_VALUE_MAP = { conservative: 8, balanced: 15, aggressive: 22 } as const;
