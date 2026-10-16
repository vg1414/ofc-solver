// ============================================================
// RulesSheet.tsx — Husreglerna för nybörjare (öppnas med ?-knappen)
// ============================================================
// Dragspel: ett avsnitt öppet i taget. Siffrorna kommer från
// engine/constants.ts (royalties, FL) så att texten inte kan
// glida isär från motorn.
// ============================================================

import { useState } from 'react';
import BottomSheet from '../ui/BottomSheet';
import PlayingCard from '../cards/PlayingCard';
import { parseCard } from '../../engine/card';
import {
  BOTTOM_ROYALTIES,
  MIDDLE_ROYALTIES,
  TOP_PAIR_ROYALTIES,
  TOP_TRIPS_ROYALTIES,
  FL_ENTRY_CARDS,
} from '../../engine/constants';
import type { HandRank } from '../../engine/types';

interface RulesSheetProps {
  open: boolean;
  onClose: () => void;
}

/** Liten rad med kort, t.ex. "Qh Qs 4c" */
function Cards({ cards, label }: { cards: string; label?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex gap-1">
        {cards.split(' ').map((c, i) => (
          <PlayingCard key={i} card={parseCard(c)} width={30} compact />
        ))}
      </div>
      {label && <span className="text-[13px] text-ink-2">{label}</span>}
    </div>
  );
}

const FIVE_ROWS: [HandRank, string][] = [
  ['trips', 'Triss'],
  ['straight', 'Stege'],
  ['flush', 'Färg'],
  ['full_house', 'Kåk'],
  ['quads', 'Fyrtal'],
  ['straight_flush', 'Färgstege'],
  ['five_of_a_kind', '5-tal'],
  ['royal_flush', 'Royal flush'],
];

const RANK_NAME: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

const th = 'px-2 py-1.5 text-left text-[11.5px] font-bold uppercase tracking-wide text-ink-2';
const td = 'px-2 py-1.5 text-[14px]';

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[18px] bg-sunken/70 shadow-[inset_0_0_0_1px_var(--line)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[15px] font-bold text-ink active:scale-[0.99]"
      >
        {title}
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 text-ink-2 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {/* grid-rows 0fr → 1fr ger mjuk höjdanimation utan att mäta innehållet */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-2.5 px-4 pb-4 text-[14px] leading-relaxed text-ink-2 [&_b]:text-ink">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function RulesSheet({ open, onClose }: RulesSheetProps) {
  const [openId, setOpenId] = useState<string | null>('basics');
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));
  const sec = (id: string) => ({ open: openId === id, onToggle: () => toggle(id) });

  return (
    <BottomSheet open={open} onClose={onClose} title="Regler">
      <div className="flex flex-col gap-2.5">
        <p className="px-1 text-[13px] text-ink-2">
          Det här är <b className="text-ink">våra husregler</b>. De skiljer sig lite från vanlig OFC — appen räknar alltid så här.
        </p>

        <Section title="Så går det till" {...sec('basics')}>
          <p>
            Varje spelare bygger ett eget bräde med <b>tre rader</b>: <b>Toppen</b> (3 kort), <b>Mitten</b> (5 kort) och <b>Botten</b> (5 kort) — 13 kort totalt.
          </p>
          <p>
            Ett kort som är lagt ligger kvar. När alla brädena är fulla jämförs de rad mot rad.
          </p>
          <p>
            Viktigaste regeln: <b>Botten måste vara starkast</b>, sedan Mitten, och Toppen svagast. Annars blir det <b>foul</b> (se nedan). Lika starka rader är okej.
          </p>
          <p>Vi spelar med <b>54 kort</b>: en vanlig kortlek plus <b>2 jokrar</b>.</p>
        </Section>

        <Section title="Vanlig och Pineapple" {...sec('variants')}>
          <p>
            <b>Vanlig:</b> du får 5 kort och lägger alla. Sedan får du <b>1 kort åt gången</b> tills brädet är fullt.
          </p>
          <p>
            <b>Pineapple:</b> du får 5 kort och lägger alla. Sedan får du <b>3 kort åt gången</b>: lägg 2 och kasta 1 (det kastade kortet är hemligt).
          </p>
          <p>Du väljer variant under inställningarna (kugghjulet).</p>
        </Section>

        <Section title="Handernas ordning" {...sec('hands')}>
          <p>Från svagast till starkast:</p>
          <ol className="list-decimal pl-5">
            <li>Högt kort</li>
            <li>Par</li>
            <li>Två par</li>
            <li>Triss</li>
            <li>Stege (A-2-3-4-5 räknas också)</li>
            <li>Färg</li>
            <li>Kåk</li>
            <li>Fyrtal</li>
            <li>Färgstege</li>
            <li><b>5-tal</b> (fem lika, går bara med joker)</li>
            <li><b>Royal flush</b> — slår även 5-tal</li>
          </ol>
          <p>
            I <b>Toppen</b> (3 kort) finns bara högt kort, par och triss — stege och färg räknas inte där.
          </p>
        </Section>

        <Section title="Jokrar" {...sec('jokers')}>
          <p>
            Jokrarna är <b>helt vilda</b>: de kan bli vilket kort som helst, även ett kort som redan ligger ute (så kan man få 5-tal).
          </p>
          <p>
            Jokern bestäms först när handen är klar, och den väljs så att <b>handen inte foular</b> om det går — och därefter så bra som möjligt.
          </p>
          <Cards cards="Ks Kh JK" label="= triss kungar" />
        </Section>

        <Section title="Foul" {...sec('foul')}>
          <p>
            Om Toppen är starkare än Mitten, eller Mitten starkare än Botten, har du <b className="text-[var(--danger)]">foulat</b>.
          </p>
          <div className="flex flex-col gap-1.5">
            <Cards cards="Kh Kd 4c" label="Toppen: par kungar" />
            <Cards cards="9s 9h 7d 5c 2s" label="Mitten: par nior" />
            <p className="text-[13px]">→ Toppen slår Mitten = foul.</p>
          </div>
          <p>
            Straff: motståndaren får <b>6 poäng plus alla sina royalties</b>. Du får inga royalties. Foular båda blir det 0 poäng.
          </p>
        </Section>

        <Section title="Poäng" {...sec('points')}>
          <p>Varje rad jämförs mot motståndarens samma rad:</p>
          <ul className="list-disc pl-5">
            <li><b>1 poäng</b> för varje rad du vinner.</li>
            <li><b>Scoop:</b> vinner du alla tre raderna får du <b>+3</b> extra (alltså 6).</li>
            <li>Lika rad ger ingen poäng.</li>
            <li>
              <b>Royalties</b> (bonuspoäng, se nästa avsnitt) får du <b>bara för rader du vinner</b>. Lika rad = ingen royalty.
            </li>
          </ul>
          <p>Det du vinner förlorar motståndaren, och tvärtom.</p>
        </Section>

        <Section title="Royalties (bonus)" {...sec('royalties')}>
          <p>
            Starka händer ger bonuspoäng. <b>Mitten ger dubbelt</b> mot Botten, och triss ger 2 i Mitten men 0 i Botten.
          </p>
          <table className="w-full overflow-hidden rounded-[12px] bg-surface/70">
            <thead>
              <tr>
                <th className={th}>Hand</th>
                <th className={`${th} text-right`}>Botten</th>
                <th className={`${th} text-right`}>Mitten</th>
              </tr>
            </thead>
            <tbody>
              {FIVE_ROWS.map(([rank, name]) => (
                <tr key={rank} className="border-t border-[var(--line)]">
                  <td className={`${td} text-ink`}>{name}</td>
                  <td className={`${td} text-right tabular-nums`}>{BOTTOM_ROYALTIES[rank] ?? 0}</td>
                  <td className={`${td} text-right tabular-nums font-bold text-ink`}>{MIDDLE_ROYALTIES[rank] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1">
            <b>Toppen:</b> par från 66 och uppåt, och all triss.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <table className="w-full rounded-[12px] bg-surface/70">
              <thead>
                <tr>
                  <th className={th}>Par</th>
                  <th className={`${th} text-right`}>p</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(TOP_PAIR_ROYALTIES).map(([r, p]) => (
                  <tr key={r} className="border-t border-[var(--line)]">
                    <td className={`${td} text-ink`}>{RANK_NAME[+r].repeat(2)}</td>
                    <td className={`${td} text-right tabular-nums`}>{p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="w-full rounded-[12px] bg-surface/70">
              <thead>
                <tr>
                  <th className={th}>Triss</th>
                  <th className={`${th} text-right`}>p</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(TOP_TRIPS_ROYALTIES).map(([r, p]) => (
                  <tr key={r} className="border-t border-[var(--line)]">
                    <td className={`${td} text-ink`}>{RANK_NAME[+r].repeat(3)}</td>
                    <td className={`${td} text-right tabular-nums`}>{p}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Fantasy Land" {...sec('fl')}>
          <p>
            Får du <b>QQ eller bättre i Toppen</b> utan att foula, hamnar du i <b className="text-[var(--fl)]">Fantasy Land</b> nästa hand. Då får du alla kort på en gång, lägger 13 och kastar resten — och ingen ser dina kort förrän du är klar.
          </p>
          <Cards cards="Qh Qs 4c" label="QQ i Toppen → Fantasy Land" />
          <table className="w-full rounded-[12px] bg-surface/70">
            <thead>
              <tr>
                <th className={th}>Toppen</th>
                <th className={`${th} text-right`}>Antal kort</th>
              </tr>
            </thead>
            <tbody>
              {[['QQ', FL_ENTRY_CARDS.QQ], ['KK', FL_ENTRY_CARDS.KK], ['AA', FL_ENTRY_CARDS.AA], ['Triss', FL_ENTRY_CARDS.trips]].map(([k, n]) => (
                <tr key={k} className="border-t border-[var(--line)]">
                  <td className={`${td} text-ink`}>{k}</td>
                  <td className={`${td} text-right tabular-nums font-bold text-ink`}>{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            <b>Stanna kvar (repeat):</b> i Fantasy Land får du stanna en hand till (alltid 13 kort) om du lägger något av:
          </p>
          <ul className="list-disc pl-5">
            <li>fyrtal eller bättre i Botten</li>
            <li>kåk eller bättre i Mitten</li>
            <li>triss i Toppen</li>
          </ul>
        </Section>
      </div>
    </BottomSheet>
  );
}
