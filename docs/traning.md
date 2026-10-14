# Träna-fliken

Läs detta innan du ändrar i `src/components/training/` eller `src/training/`. UI ligger i `components/training/`, logiken (ingen UI) i `training/`.

## Scenarion

- 5/10/20 scenarion. `scenarios.ts` låter datorn spela fram båda bräden med solvern (Normal: 800 sim, max 3 s per drag) och stannar på ett slumpat drag (≈ 25 % öppningar).
- Scenariokön `useScenarioPool.ts` (ägs av `TrainingView`) håller 3 scenarion redo per variant + läge i en egen worker. Den börjar redan på startsidan, sparar överblivna till nästa omgång och pausas när Solver-fliken visas.
- Kön bedömer också varje scenario i förväg på Noggrann (`SCENARIO_EVAL`, sparas i `Scenario.evaluation`): tom kö → spela fram, annars bedöm äldsta obedömda, annars spela fram nästa. Saknas bedömningen (scenariot togs för tidigt) räknar ScenarioRun själv.
- Draget matchas mot `result.options` på kort + rad (`moves.ts`). Om draget sållades bort räknas det om med `pinned` (`pinned.ts`).
- **Poäng:** 100 − EV-förlust × 100 per scenario (golv 0), men Perfekt ger alltid 100. Perfekt ≤ 0,05, Bra ≤ 0,5, annars Miss.

## ★ Joker

Som Scenarion, men `placeJokers` flyttar en joker (ibland två) i leken till platserna där spelarens hand delas ut.

## Hel hand mot datorn

- `HandRun.tsx` och `game.ts`. Turordningen räknas ut i förväg (`turnOrder`), och den som börjar växlar varje hand.
- Datorns öppning är dold under runda 1, och ingen av sidorna räknar med motståndarens öppning då.
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
