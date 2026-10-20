# Spela-fliken (2 spelare eller mot datorn)

Läs detta innan du ändrar i `src/components/play/` eller `src/match/`.

- `PlayView.tsx` startsida (namn, variant, längd/FL via `HandSettingsSheet duel`, "Fortsätt" för sparat parti), `DuelRun.tsx` partiet, `DuelSummary.tsx` slutresultat.
- Spelmotorn (ingen UI) i `src/match/`: `match.ts` (MatchState, actions, `validateMove`, `viewFor`), `useLocalMatch.ts` (samma telefon + sparning), `names.ts`.
- **Online-förberedelse:** allt går via `applyAction(state, action)`. Actions bär handens nummer + turens index så gamla/dubbla avvisas, och `validateMove` kontrollerar kort, antal och tur. UI ritar från `viewFor(state, seat)`, som döljer kortleken, motståndarens kast, motståndarens öppning under runda 1 (husregel) och FL-bräde till handens slut. `MatchState` är ren JSON. En framtida `useOnlineMatch` ska ha samma `{ state, dispatch }` som `useLocalMatch`.
- Spelarfärger: `--p1*` (grön) och `--p2*` (blå) i `index.css`. `HandOver`, `Scoreboard` och `SessionHeader` tar `names` / `p1`/`p2`-prickar för 2-spelarläget. Mot datorn (`cpu`) visas poängen i stället som +/− från ditt håll: blått när du leder, rött när datorn leder (`Scoreboard` `cpu`-prop, `cpuTone`/`signed`).
- Ingen solverhjälp i 2-spelarläget.
- **Mot datorn:** `MatchConfig.cpu` = nivå (`match/cpu.ts`: Lätt 200 sim/1,5 s T=0,6, Medel 300/2 s T=0,15, Svår 800/3 s, Proffs 2000/8 s). Datorn sitter på plats 2 och heter "Datorn". `DuelRun` har en egen `useSolverJobs` som räknar datorns drag från `viewFor(state, 1)` (din öppning dold i runda 1) och skickar det som en vanlig `move`-action. Svagare nivåer lottar bland de 8 bästa alternativen med vikt exp(−förlust/T) (`pickCpuOption`). Du ser alltid ditt bräde nederst, ingen överlämning och ingen dold FL-skärm.
- Delade bitar med Träna (draglista, dela som bild, senaste dragets kort, brädens storlek): se [traning.md](traning.md) och [ui.md](ui.md).
