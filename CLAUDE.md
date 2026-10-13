# OFC Solver — så fungerar projektet

Läses automatiskt av varje ny Claude-session. Håll den kort och uppdatera den när något viktigt ändras.

## Vad appen är

Webbapp för **Open Face Chinese Poker** med Davids hemspelsregler. Två flikar:

- **Solver** – mata in läget, få bästa draget med EV (förväntade poäng).
- **Träna** – öva mot solvern: Scenarion, ★ Joker och Hel hand mot datorn.

Live: https://vg1414.github.io/ofc-solver/ (varje push till `main` testas, byggs och publiceras automatiskt via `.github/workflows/deploy.yml`).

## Teknik och kommandon

React 19 + Vite + TypeScript + Tailwind 4 + Zustand. Solvern körs i en Web Worker.

```
npm run dev      # utvecklingsserver
npm run build    # tsc + vite build (måste gå igenom innan push)
npm test         # vitest (måste gå igenom innan push)
```

Förhandsvisning i Claude-appen: `.claude/launch.json` ligger i föräldermappen `OFC/` (konfigurationerna `ofc-dev`, `ofc-ui`, `ofc-train`, `ofc-splash`).

## Husregler (motorn räknar redan med dessa)

- 54 kort: 52 + 2 helt vilda jokrar (jokern väljs så att handen inte foular).
- Poäng: 1 p per rad, scoop +3, foul = motståndaren får 6 + sina royalties.
- Royalties: mitten ger dubbelt mot botten (triss i mitten 2 p, i botten 0 p). 5-tal finns (20/40 p). Royal flush slår 5-tal.
- Fantasy Land: QQ i topp = 13 kort, KK = 14, AA = 15, triss = 16. Repeat-FL (alltid 13 kort) kräver fyrtal+ i botten, kåk+ i mitten eller triss i topp.
- Varianter: **Vanlig** (5 kort, sedan 1 åt gången) och **Pineapple** (5 kort, sedan 3 där 1 kastas).

## Mappar

| Mapp | Innehåll |
|---|---|
| `src/core/` | Snabb solver-kärna: handvärdering (`eval.ts`), simulerad spelare (`lookahead.ts`, `policy.ts`), Monte Carlo (`sim.ts`), exakt FL-lösare (`fl.ts`), förberäknade motståndarhänder (`poolData.ts`), FL-värde (`flValue.ts`) |
| `src/solver/solver.ts` | Solverns API: översätter appens kort/bräden till kärnan och tillbaka |
| `src/workers/` | Web Workern som kör solvern |
| `src/engine/` | Appens regler: kort, lek, handvärdering, royalties, foul, poäng (`scoring.ts`), FL-regler (`gameState.ts`) |
| `src/hooks/useSolver.ts` | React-hook för solvern (se nedan). `solverOrder.ts` sorterar resultatet för visning |
| `src/store/gameStore.ts` | Zustand-state för Solver-fliken (bräden, valda kort, variant) |
| `src/components/` | UI. `board/` bräde, `cards/` spelkort + rutnät + hand, `dnd/` dra-och-släpp, `solver/` Solver-fliken, `training/` Träna-fliken, `ui/` BottomSheet + Segmented |
| `src/training/` | Träningslogik (ingen UI): drag/poäng, turordning, scenariogenerator, topplistor |
| `src/splash/` | Splash-skärmen (`splash.ts` + `splash.css`), startas från `main.tsx` |
| `public/` | Appikoner (`favicon.svg/.ico`, `apple-touch-icon.png`, `icon-*.png`) och `manifest.webmanifest` |
| `scripts/` | Mät- och kalibreringsskript för solvern (`sh scripts/run.sh scripts/demo.ts`) |

## Hur solvern räknar

1. Alla sätt att lägga korten blir kandidater (Pineapple: även vilket kort som kastas).
2. Varje kandidat spelas klart många gånger med slumpade framtida kort. En simulerad spelare lägger korten ett i taget. EV = snittpoäng mot motståndaren (känt bräde, annars en pool med färdiga händer) + värdet av Fantasy Land.
3. **Sållning:** vid många kandidater (öppningshänder) körs först en snabb grovsållning (60 spel, svag spelare), och de 12 bästa går vidare. Sedan slås drag ut när de är statistiskt sämre än ledaren. Bortsållade drag har därför färre simuleringar och osäkrare, ofta för lågt, EV.
4. **Låsta drag (`options.pinned`):** ett låst drag sållas aldrig bort och räknas lika noga som bästa draget på samma blandningar. Träningen använder det för att bedöma spelarens drag rättvist.
5. Fantasy Land löses exakt (alla uppställningar). Där returneras bara topp 15.
6. **FL-värde** (`flValue.ts`): poäng som läggs till när en simulering når FL, och som FL-lösaren lägger på en uppställning som ger repeat. Inkluderar upprepade repeat (geometrisk serie). Räknas om med `sh scripts/run.sh scripts/computeFlValue.ts 1000` (1000 händer per kortantal, 3 varv, ca 2 timmar; 16 kort tar ~1,5 s per hand). Med få händer (t.ex. 60) svänger värdena 1–2 poäng.

Nivåer: Snabb 300 sim (max 8 s), Normal 800 (20 s), Noggrann 2000 (45 s).

**Viktigt i resultatet:** `result.options` innehåller ALLA kandidater, inte bara de som visas. `result.best` är solverns val. Nya fält per alternativ: `finalist` (räknades klart), `pinned`, `evDiffSE`. `useSolver` sorterar för visning: bästa draget först, resten efter EV.

## Använda solvern från UI

```ts
const { runSolver, cancelSolver, clearResult, result, isLoading, progress, error } = useSolver();
runSolver({ board, cards, deadCards, variant, opponentBoard, options: { simulations: 800 }, mode: 'normal' });
// mode: 'normal' (även öppning) | 'fantasyLand'
```

En `useSolver()` = en egen worker, och den räknar en sak i taget. Träningen använder `useSolverJobs()` (`src/training/useSolverJobs.ts`), som gör samma hook "await"-bar med en kö: `const res = await jobs.solve(input)`.

## Solver-fliken

- Lägena "Vanlig hand" och "Fantasy Land". Tomt bräde = öppningshand (välj upp till 5 kort, "Bästa öppning", "Lägg så här").
- Kort läggs genom tryck kort → tryck rad, eller dra-och-släpp. Ett lagt kort tas bort med två tryck.
- Förslaget visas som spökkort på brädet, med EV, FL-chans och foul-risk.

## Träna-fliken (`src/components/training/`, logik i `src/training/`)

- **Scenarion:** 5/10/20 scenarion. `scenarios.ts` låter datorn spela fram båda bräden med solvern (Normal: 800 sim, max 3 s per drag) och stannar på ett slumpat drag (≈ 25 % öppningar). Scenariokön `useScenarioPool.ts` (ägs av `TrainingView`) håller 3 scenarion redo per variant + läge i en egen worker. Den börjar redan på startsidan, sparar överblivna till nästa omgång och pausas när Solver-fliken visas. Spelarens drag bedöms på Noggrann nivå, som startar direkt när scenariot visas. Draget matchas mot `result.options` på kort + rad (`moves.ts`). Om draget sållades bort räknas det om med `pinned` (`pinned.ts`).
- **Poäng:** 100 − EV-förlust × 100 per scenario (golv 0), men Perfekt ger alltid 100. Perfekt ≤ 0,05, Bra ≤ 0,5, annars Miss.
- **★ Joker:** som Scenarion, men `placeJokers` flyttar en joker (ibland två) i leken till platserna där spelarens hand delas ut.
- **Hel hand mot datorn:** `HandRun.tsx` och `game.ts`. Turordningen räknas ut i förväg (`turnOrder`), och den som börjar växlar varje hand. Datorn spelar med solvern på vald styrka (`CPU_LEVELS` i `session.ts`: Snabb 300/3 s, Normal 800/3 s, Noggrann 2000/10 s). Appens nivåval (Solver) påverkar inte datorn. Poäng via `engine/scoring.ts`, FL och repeat-FL till nästa hand. Coach-läge: en tredje worker bedömer varje drag (800 sim, max 10 s). I coach-arket kan ett drag räknas om på Noggrann (2000 sim).
- **Sessioner (Hel hand):** `session.ts` (längd: händer/minuter/fritt, FL-regel `playout`/`stop`, `sessionOver()`), `usePlayClock.ts` (klocka som pausar när appen inte syns). Inställningsark `HandSettingsSheet.tsx`, toppraden `SessionHeader.tsx`, ställning + handlista `Scoreboard.tsx`, coachens bricka/ark `CoachReview.tsx`. Varje drag bedöms även utan coach för foul/FL-mätaren, alltid med spelarens drag låst (`pinnedOptions`). Datorns mätare tar siffrorna från `res.best` i datorns eget solveranrop. Topplista bara för fullständiga sessioner med antal händer.
- **Topplistor:** localStorage, topp 10 per läge × variant × antal (`leaderboard.ts`). Senaste namnet kommer ihåg.
- `useMoveBuilder.ts` hanterar placeringen: tryck/dra, ångra, bara kort från aktuellt drag kan tas bort, och ett ensamt kort är redan lyft.

## Design och UI-regler

- Samma stil som Davids app Bokis: ljust och varmt, krämvit botten, glaskort, gradient-pills med glöd, fjädrande mikroanimationer. Typsnitt Outfit + Playfair Display (Barlow Condensed på korten). Tema som CSS-variabler i `src/index.css` och följer mörkt läge.
- Mobil först (360–430 px, en hand). Desktop och liggande telefon får två kolumner (`wide:`-varianten).
- Alla ark använder `BottomSheet`: ✕-knapp, svep ner för att stänga, tryck på den mörka ytan stänger.
- Allt UI på svenska. Diskret "Made by: David Hefner" längst ner ska alltid finnas.
- **Ikon:** grönt kort med vit spader på krämvit botten, lutat −8°. Källan är `public/favicon.svg`. PNG-ikonerna är renderade från den.
- **Splash** (`src/splash/`), ca 5 s vid varje start: 13 kort delas ut på brädet och vänds (QQ glöder guld), virvlar i en ring med flimrande valörer, slår ihop med ett fjädrande klick medan färgsymboler (♠♥♦♣) sprutar ut, och det översta kortet växer till ikonen. Därefter delar ikonen ut nio små kort som snäpper fast över rubrikens bokstäver, vänds och löses upp, så att "OFC Solver" blir kvar som text. Bokstävernas lägen mäts på skärmen och mäts om när typsnitten har laddats. Allt räknas ut från tiden `t` i `render(t)` (tidslinjen `T`). Ett tryck hoppar över, "minska rörelse" visar slutbilden och tempot styrs av `--splash-k`. Testsida: `/splash-demo.html` i dev, med spela igen, tempo och stegning i tid. Korten vänds i 2D (scaleX), eftersom 3D + blur gör korten osynliga i Chrome.
- Återanvänd byggstenarna: `PlayingCard`, `BoardView`, `CardGrid`/`JokerButton`, `HandTray`, `BottomSheet`, `Segmented`, `DragProvider`/`useDraggable`.

## Arbetsrutin

- Läs `README.md` och `CHANGELOG.md` vid behov. Lägg en rad i `CHANGELOG.md` (med datum) vid varje push.
- Kör `npm run build` och `npm test` innan push.
- Flera Claude-sessioner kan jobba i projektet samtidigt (t.ex. en på solver-motorn, en på UI). Kolla `git status` och committa bara det du själv ändrat, om inget annat sägs.
