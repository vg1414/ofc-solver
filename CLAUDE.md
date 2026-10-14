# OFC Solver — så fungerar projektet

Läses automatiskt av varje ny Claude-session. Håll den kort: bara sånt som gäller nästan varje session. Detaljer per område ligger i `docs/`. Uppdatera rätt fil när något viktigt ändras.

## Vad appen är

Webbapp för **Open Face Chinese Poker** med Davids hemspelsregler. Tre flikar:

- **Solver** – mata in läget, få bästa draget med EV (förväntade poäng).
- **Träna** – öva mot solvern: Scenarion, ★ Joker och Hel hand mot datorn.
- **Spela** – 2 spelare på samma telefon (förberett för online).

Live: https://vg1414.github.io/ofc-solver/ (varje push till `main` testas, byggs och publiceras automatiskt via `.github/workflows/deploy.yml`).

## Teknik och kommandon

React 19 + Vite + TypeScript + Tailwind 4 + Zustand. Solvern körs i en Web Worker.

```
npm run dev      # utvecklingsserver
npm run build    # tsc + vite build (måste gå igenom innan push)
npm test         # vitest (måste gå igenom innan push)
```

Förhandsvisning i Claude-appen: `.claude/launch.json` ligger i föräldermappen `OFC/` (konfigurationerna `ofc-dev`, `ofc-ui`, `ofc-train`, `ofc-splash`).

## Karta — läs rätt fil innan du ändrar

| Jobbar du med… | Läs först |
|---|---|
| Solvern (`src/core/`, `src/solver/`, `src/workers/`, `useSolver`), Solver-fliken | [docs/solver.md](docs/solver.md) |
| Träna-fliken (`src/components/training/`, `src/training/`) | [docs/traning.md](docs/traning.md) |
| Spela-fliken (`src/components/play/`, `src/match/`) | [docs/spela.md](docs/spela.md) |
| Bräden, kort, dela-bild, nytt kort-animation, splash, ikoner | [docs/ui.md](docs/ui.md) |
| Vad som ändrats och när | `CHANGELOG.md` |

Övriga mappar: `src/engine/` = appens regler (kort, lek, handvärdering, royalties, foul, poäng i `scoring.ts`, FL i `gameState.ts`). `src/components/ui/` = BottomSheet + Segmented. `scripts/` = mät- och kalibreringsskript.

## Husregler (motorn räknar redan med dessa)

- 54 kort: 52 + 2 helt vilda jokrar (jokern väljs så att handen inte foular).
- Poäng: 1 p per rad, scoop +3, foul = motståndaren får 6 + sina royalties.
- **Royalty bara till radens vinnare** (lika rad = ingen). Vid foul får motståndaren alla sina. `engine/scoring.ts` (`p1Royalties` = intjänade, `p1RawRoyalties` = brädets värde) och `core/eval.ts` (`scoreVs` med `rt/rm/rb` per rad). Bräden visar bara intjänad royalty när handen är klar (`BoardView earnedRoyalties`).
- Royalties: mitten ger dubbelt mot botten (triss i mitten 2 p, i botten 0 p). 5-tal finns (20/40 p). Royal flush slår 5-tal.
- Fantasy Land: QQ i topp = 13 kort, KK = 14, AA = 15, triss = 16. Repeat-FL (alltid 13 kort) kräver fyrtal+ i botten, kåk+ i mitten eller triss i topp.
- Varianter: **Vanlig** (5 kort, sedan 1 åt gången) och **Pineapple** (5 kort, sedan 3 där 1 kastas).
- **Reglerna finns på två ställen:** `src/engine/` (appen) och `src/core/eval.ts` (solverns snabba kopia). Ändra båda. `core/poolData.ts` och `core/flValue.ts` är förberäknade med husreglerna och måste räknas om om reglerna ändras.

## Fällor

- `result.options` innehåller ALLA kandidater, inte bara de som visas. `result.best` är solverns val.
- En `useSolver()` = en egen worker som räknar en sak i taget.
- Panelen hittas med `dockFor(el)`, aldrig `document.querySelector('[data-dock]')` (dolda flikar har också en panel).
- Jokerfärgen finns i både `--joker-bg` (index.css) och `JOKER_BG` (`cardStyle.ts`). Ändra båda.
- Förhandsvisningen i Claude-appen har eget urklipp — testa kopiering i Chrome.

## Design och UI-regler

- Samma stil som Davids app Bokis: ljust och varmt, krämvit botten, glaskort, gradient-pills med glöd, fjädrande mikroanimationer. Typsnitt Outfit + Playfair Display (Barlow Condensed på korten). Tema som CSS-variabler i `src/index.css` och följer mörkt läge.
- Mobil först (360–430 px, en hand). Desktop och liggande telefon får två kolumner (`wide:`-varianten).
- Alla ark använder `BottomSheet`: ✕-knapp, svep ner för att stänga, tryck på den mörka ytan stänger.
- Allt UI på svenska. Diskret "Made by: David Hefner" längst ner ska alltid finnas.
- Återanvänd byggstenarna: `PlayingCard`, `BoardView`, `CardGrid`/`JokerButton`, `HandTray`, `BottomSheet`, `Segmented`, `DragProvider`/`useDraggable`, `useMoveBuilder`.

## Arbetsrutin

- Läs `README.md` och `CHANGELOG.md` vid behov. Lägg en rad i `CHANGELOG.md` (med datum) vid varje push.
- Kör `npm run build` och `npm test` innan push.
- Ändrar du något som beskrivs i `docs/`, uppdatera den filen i samma commit.
- Flera Claude-sessioner kan jobba i projektet samtidigt (t.ex. en på solver-motorn, en på UI). Kolla `git status` och committa bara det du själv ändrat, om inget annat sägs.
