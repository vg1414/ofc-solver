// ============================================================
// SettingsSheet.tsx — Variant, simuleringsnivå och husregler
// ============================================================

import type { GameVariant } from '../../engine/types';
import BottomSheet from '../ui/BottomSheet';
import Segmented from '../ui/Segmented';
import { SIM_PRESETS } from './simPresets';

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  variant: GameVariant;
  onVariant: (v: GameVariant) => void;
  simulations: number;
  onSimulations: (n: number) => void;
  disabled?: boolean;
}

export default function SettingsSheet({ open, onClose, variant, onVariant, simulations, onSimulations, disabled }: SettingsSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Inställningar">
      <div className="flex flex-col gap-5">
        <section>
          <h3 className="eyebrow mb-2.5">Variant</h3>
          <Segmented
            ariaLabel="Variant"
            variant="brand"
            value={variant}
            onChange={onVariant}
            disabled={disabled}
            options={[
              { value: 'regular', label: 'Vanlig OFC' },
              { value: 'pineapple', label: 'Pineapple' },
            ]}
          />
        </section>

        <section>
          <h3 className="eyebrow mb-2.5">Simuleringsnivå</h3>
          <Segmented
            ariaLabel="Simuleringsnivå"
            variant="brand"
            value={simulations}
            onChange={onSimulations}
            disabled={disabled}
            options={SIM_PRESETS.map((p) => ({ value: p.value, label: p.label, sub: `≤ ${p.seconds} s` }))}
          />
          <p className="mt-2 px-1 text-[13px] text-ink-2">
            Fler simuleringar ger säkrare svar men tar längre tid. Normal räcker oftast vid bordet.
          </p>
        </section>

        <section className="rounded-[22px] bg-sunken/70 p-4 shadow-[inset_0_0_0_1px_var(--line)]">
          <h3 className="eyebrow mb-2.5">Husregler</h3>
          <ul className="flex flex-col gap-2 text-[14px] text-ink-2">
            <li>
              <b className="text-ink">54 kort</b> — 52 vanliga + 2 jokrar som är helt vilda
            </li>
            <li>
              <b className="text-ink">Mitten ger dubbla royalties</b> jämfört med botten
            </li>
            <li>
              <b className="text-ink">Fantasy Land:</b> QQ = 13, KK = 14, AA = 15, triss = 16 kort
            </li>
            <li>
              <b className="text-ink">FL igen:</b> fyrtal+ i botten, kåk+ i mitten eller triss i topp
            </li>
            <li>Lika starka rader är inte foul. Royal flush slår 5-tal</li>
          </ul>
        </section>
      </div>
    </BottomSheet>
  );
}
