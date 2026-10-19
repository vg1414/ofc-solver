# Träna-fliken

Läs detta innan du ändrar i `src/components/training/` eller `src/training/`. UI ligger i `components/training/`, logiken (ingen UI) i `training/`.

## Scenarion

- 5/10/20 scenarion. `scenarios.ts` låter datorn spela fram båda bräden med solvern (Normal: 800 sim, max 3 s per drag) och stannar på ett slumpat drag (≈ 25 % öppningar). Vid öppningshand får scenariot ett tomt motståndarbräde: öppningen läggs dolt, så den varken visas eller räknas med av solvern.
- **Bara svåra lägen:** varje läge räknas på Normal med `naive: true` och bedöms av `scenarioDifficulty`: *fälla* = tumregelspelarens drag är ≥ 0,15 sämre (eller utsållat), *nära val* = en annan finalist ligger 0,05–0,6 under bästa. Givna lägen slängs; datorn spelar då vidare i samma hand till din nästa tur och provar där (Jokerläget börjar om med ny hand). Inget svårt läge efter 4 händer (Joker 6) → första icke-triviala används. Mät med `sh scripts/run.sh scripts/scenDifficulty.ts regular 20`.
- **Scenariobanken** (`scenarioBank.ts`, filer i `public/scenarios/<variant>-<vanlig|joker>.json`): förberäknade scenarion, framspelade och bedömda på Noggrann på datorn. Kön hämtar bara filen för läget när den startar och fyller sig direkt med slumpade scenarion du inte sett nyligen (sedda id i localStorage `ofc-scenario-seen`, de senaste 80 % av bankens storlek). Saknas filen (t.ex. offline) spelas scenarion fram live som nedan. Kompakt format: kort som strängar, drag som `kort+rad` (t/m/b/x), bara bästa + finalister + de 12 bästa övriga alternativen. Lägger spelaren ett drag som inte finns i listan (`judge` → `missing`) räknas det om med `pinned`, precis som ett bortsållat drag.
- **Bygga om banken** (t.ex. om reglerna eller solvern ändras — höj då `BANK_VERSION`): bygg skriptet en gång (`npx rolldown scripts/buildScenarioBank.ts --format esm --platform node --file $TMPDIR/ofc-bank.mjs`), kör flera `node $TMPDIR/ofc-bank.mjs gen <regular|pineapple> <vanlig|joker> <antal> <shard>` parallellt (en per kärna, olika shard-bokstäver; fortsätter där de slutade) och sedan `… merge`. Mellanfilerna ligger i `scenarios-tmp/` (gitignorerad). Med 8 processer tar 1 200 scenarion ≈ 3 h. Har bara solverns EV ändrats (inte vilka lägen som är svåra) räcker det att räkna om lägena som redan finns: töm `scenarios-tmp/`, kör `node $TMPDIR/ofc-bank.mjs reeval <variant> <läge> <del> <antal delar>` (t.ex. två delar per fil = 8 processer) och sedan `merge` (≈ 1 h för 1 200).
- Scenariokön `useScenarioPool.ts` (ägs av `TrainingView`) håller 3 scenarion (ur banken, annars live) redo per variant + läge i en egen worker. Den börjar redan på startsidan, sparar överblivna till nästa omgång och pausas när Solver-fliken visas.
- Kön har två workers som körs samtidigt: framspelaren håller kön full, och bedömaren räknar äldsta obedömda scenariot på Noggrann (`SCENARIO_EVAL`, sparas i `Scenario.evaluation`). En jokerbedömning tar ≈ 4× så lång tid som en vanlig, så de ska inte vänta på varandra. Saknas bedömningen (scenariot togs för tidigt) avbryts den och ScenarioRun räknar själv.
- Draget matchas mot `result.options` på kort + rad (`moves.ts`). Om draget sållades bort räknas det om med `pinned` (`pinned.ts`).
- **Poäng:** 100 − EV-förlust × 100 per scenario (golv 0), men Perfekt ger alltid 100. Perfekt ≤ 0,05, Bra ≤ 0,5, annars Miss.

## ★ Joker

Som Scenarion, men `placeJokers` flyttar en joker (ibland två) i leken till platserna där spelarens hand delas ut.

## Hel hand mot datorn

- `HandRun.tsx` och `game.ts`. Turordningen räknas ut i förväg (`turnOrder`), och den som börjar växlar varje hand.
- Datorns öppning är dold under runda 1, och ingen av sidorna räknar med motståndarens öppning då. Därför **läggs runda 1 samtidigt**: `seatTurn(h, seat)` ger platsens tur just nu — i runda 1 även turen efter den pågående, med korten som ligger näst i leken (samma kort som om man väntat). Läggs den i förväg uppdateras brädet och `h.ahead` sätts; `played` hoppar sedan över turen när motståndaren lagt sin, så runda 2 börjar först när båda ligger. Gäller även FL-händer (dolda till handens slut). Spela-fliken (`match.ts`) använder fortfarande strikt turordning (`validateMove`).
- I HandRun har din tur (`mine`, nyckel `h.no-mine.idx`) och datorns (`cpuT`) var sin effekt, så båda kan pågå samtidigt; coachens förberäkning och foul/FL-mätaren följer `mine`.
- Datorn spelar med solvern på vald styrka (`CPU_LEVELS` i `session.ts`: Snabb 300/3 s, Normal 800/3 s, Noggrann 2000/10 s). Appens nivåval (Solver) påverkar inte datorn.
- Poäng via `engine/scoring.ts`, FL och repeat-FL till nästa hand.
- **Coach-läge:** en tredje worker bedömer varje drag (800 sim, max 10 s). Bedömningen förberäknas när din tur börjar (`precomputed` i HandRun); sållades ditt drag bort räknas bara ditt och bästa draget om (`options.pinnedOnly` + `pinned`, samma blandningar → samma siffror). I coach-arket kan ett drag räknas om på Noggrann (2000 sim).
- Varje drag bedöms även utan coach för foul/FL-mätaren, alltid med spelarens drag låst (`pinnedOptions`). Datorns mätare tar siffrorna från `res.best` i datorns eget solveranrop.

## Sessioner (Hel hand)

- `session.ts`: längd (händer/minuter/fritt), FL-regel `stop` (standard) / `playout`, `sessionOver()`.
- `usePlayClock.ts`: klocka som pausar när appen inte syns.
- Inställningsark `HandSettingsSheet.tsx`, toppraden `SessionHeader.tsx`, ställning + handlista `Scoreboard.tsx`, coachens bricka/ark `CoachReview.tsx` (brickan visar Foul % · FL % för ditt och bästa draget via `RiskText` från `ReviewBoard`).
- Topplista bara för fullständiga sessioner med antal händer.

## Topplistor

localStorage, topp 10 per läge × variant × antal (`leaderboard.ts`). Senaste namnet kommer ihåg.

## Draglista, förklaring och sparade drag

- `MoveHistory.tsx` (lodrät lista, i `DockLayout side`: högerkolumn på bred skärm, under brädena på telefon) i Hel hand, Scenarion/Joker och Spela (`hideGrades`).
- `MoveReviewSheet` i `CoachReview.tsx` är det gemensamma arket (`ReviewBoard` visar alltid Foul % · FL % under både ditt och bästa draget).
- `MoveExplain` = regelbaserad "Varför?" från `training/explain.ts` (kort som ligger olika, foul/FL-jämförelse, slutsats).
- ☆ sparar ett drag i `training/savedMoves.ts` (localStorage `ofc-saved-moves`, id = `<runId>:<nyckel>`, input utan options). `useSavedAnalyser` (monterad i `App`, egen worker) räknar varje sparat drag på Noggrann med draget låst direkt när det sparas; status via `useAnalysisStatus`. `SavedMoves.tsx` på Träna-startsidan visar listan och arket.

## Delas med Spela-fliken

Dela som bild, senaste dragets kort, brädens storlek på telefon, nytt kort-animationen och `useMoveBuilder`: se [ui.md](ui.md).
