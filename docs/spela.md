# Spela-fliken (2 spelare)

Läs detta innan du ändrar i `src/components/play/` eller `src/match/`.

- `PlayView.tsx` startsida (namn, variant, längd/FL via `HandSettingsSheet duel`, "Fortsätt" för sparat parti), `DuelRun.tsx` partiet, `DuelSummary.tsx` slutresultat.
- Spelmotorn (ingen UI) i `src/match/`: `match.ts` (MatchState, actions, `validateMove`, `viewFor`), `useLocalMatch.ts` (samma telefon + sparning), `names.ts`.
- **Online-förberedelse:** allt går via `applyAction(state, action)`. Actions bär handens nummer + turens index så gamla/dubbla avvisas, och `validateMove` kontrollerar kort, antal och tur. UI ritar från `viewFor(state, seat)`, som döljer kortleken, motståndarens kast, motståndarens öppning under runda 1 (husregel) och FL-bräde till handens slut. `MatchState` är ren JSON. En framtida `useOnlineMatch` ska ha samma `{ state, dispatch }` som `useLocalMatch`.
- Spelarfärger: `--p1*` (grön) och `--p2*` (blå) i `index.css`. `HandOver`, `Scoreboard` och `SessionHeader` tar `names` / `p1`/`p2`-prickar för 2-spelarläget.
- Ingen solverhjälp i 2-spelarläget.
- Delade bitar med Träna (draglista, dela som bild, senaste dragets kort, brädens storlek): se [traning.md](traning.md) och [ui.md](ui.md).
