# Changelog

## 2026-10-12 — Splash: rubriken delas ut som kort

- "OFC Solver" skrivs inte längre fram med ett penndrag. I stället delar ikonkortet ut nio små kort som flyger i en båge, snäpper fast med en studs över varje bokstav, vänds och "puffar" bort så att rubriken blir kvar som text ("Solver" i appens gröna gradient)
- Pulsringarna vid klicket är ersatta av färgsymboler (♠♥♦♣) som sprutar ut ur leken och faller undan
- Räknaren "2 000 simuleringar" och underraden är borttagna

## 2026-10-12 — Splash: tusentals framtider blir ett drag

- **Ny splash vid varje start (ca 5 s):** 13 kort delas ut på brädet och vänds i en våg till en riktig hand (QQ i toppen glöder guld för Fantasy Land). Sedan lyfter korten till en ring som snurrar allt fortare medan valörerna flimrar (solverns simuleringar). Ringen rusar ihop med ett fjädrande klick och en pulsring, det översta kortet växer till appikonen och "OFC Solver" skrivs fram med ett penndrag
- Ett tryck var som helst hoppar över. Med "minska rörelse" visas bara slutbilden. Tempot styrs av `--splash-k`. Följer mörkt läge
- Nya filer `src/splash/splash.ts` + `splash.css`, och testsidan `splash-demo.html` (bara i dev: spela igen, tempo, stega i tid)
- README och CLAUDE.md beskriver splashen och appikonen

## 2026-10-12 — Egen appikon och hemskärms-app

- Ny ikon (grönt kort med vit spader på krämvit botten) ersätter Vites standardikon: `favicon.svg`, `favicon.ico` (16/32/48 px), `apple-touch-icon.png` (180 px) och `icon-192/512.png` + `icon-maskable-512.png` för Android
- Ny `manifest.webmanifest`: appen kan läggas till på hemskärmen som "OFC" och öppnas då i helskärm utan webbläsarens adressfält

## 2026-10-12 — Projektbeskrivning för Claude

- Ny `CLAUDE.md`: kort beskrivning av alla funktioner, mappar, husregler, hur solvern räknar, träningslägena, designregler och arbetsrutin. Claude Code läser den automatiskt vid varje ny session i projektet

## 2026-10-12 — Jokerträning

- **Nytt läge "★ Joker"** i Träna-fliken (bredvid Scenarion och Hel hand) med egen topplista. Varje scenario har minst en joker i handen, ungefär var tredje hand med plats för det får båda. Blandat öppningshänder och drag mitt i handen
- Generatorn (`placeJokers` i `src/training/scenarios.ts`) flyttar jokrarna till de platser i leken där din hand delas ut, innan datorn spelar fram brädena — så lägena är lika realistiska som vanliga scenarion
- Nytt test i `training.test.ts`

## 2026-10-12 — Träningsläge: "Träna"-flik med scenarion och hela händer mot datorn

- **Ny flik "Träna"** bredvid Solvern (flikar i sidhuvudet). Träningen monteras först när fliken öppnas och ligger sedan kvar, så en pågående omgång inte försvinner
- **Scenarioträning (poängjakt):** 5/10/20 scenarion. Datorn spelar fram båda bräden med solvern (öppningshänder ≈ 25 %, annars en senare runda; Pineapple: lägg 2, kasta 1). Max 100 p per scenario = 100 − EV-förlust × 100. Gradering Perfekt ≤ 0,05 / Bra ≤ 0,5 / Miss. Bedömning på Noggrann nivå som startar i bakgrunden direkt. Feedback med animerad bricka, ditt drag mot bästa draget (spökkort), notis när draget sållades bort tidigt. Sammanfattning med snitt, sämsta beslutet och alla scenarion (tryck för att se igen)
- **Hel hand mot datorn:** 5/10/20 händer, 54 kort, Vanlig eller Pineapple. Datorn spelar med solvern (Snabb, max 3 s). Poäng med `src/engine/scoring.ts`, Fantasy Land (QQ/KK/AA/triss, repeat-FL). Valfritt coach-läge som visar EV-förlusten per drag
- **Lokala topplistor** (topp 10 per läge × variant × antal) med namn-ark och animerad markering av nytt resultat
- Förberett för solverns kommande `pinned`-fält (`src/training/pinned.ts`, flaggan `SOLVER_HAS_PINNED`)
- `BoardView`: ny valfri prop `canRemove` (bara kort från aktuellt drag kan tas bort)
- Ny logik i `src/training/` med tester (`training.test.ts`), nya komponenter i `src/components/training/`. Solver-motorn är orörd
- **Solvern: låsta drag.** Ny valfri `SolverOptions.pinned` (lista av kompletta drag, `row: 'discard'` = kastas). Låsta drag går alltid vidare från grovsållningen, slås aldrig ut, räknas inte in i 12-taket och simuleras klart på samma blandningar som ledaren. `DetailedPlacementOption` har nya valfria fälten `finalist`, `pinned` och `evDiffSE`. Utan `pinned` blir resultatet identiskt med förut (kontrollerat). `src/training/pinned.ts` har fått den nya formen (flaggan `SOLVER_HAS_PINNED` är fortfarande `false`). Nya tester i `core.test.ts`
- **Träning: låsta drag påslagna.** `SOLVER_HAS_PINNED = true`: sållades ditt drag bort körs bedömningen om med draget låst, och notisen om osäker EV försvinner. `wasScreenedEarly` använder solverns `finalist` (tumregeln "färre än hälften så många simuleringar" används bara när fältet saknas, t.ex. i Fantasy Land). Väntevyn visar "Räknar om ditt drag lika noga som bästa draget" under omräkningen. Nya tester i `training.test.ts`

## 2026-10-12 — Jämn progress i solvern

- `evaluateCandidates` (`src/core/sim.ts`): progress går nu jämnt och aldrig bakåt. Grovsållningen rapporterar 0–20 % medan den pågår och huvudloopen fortsätter 20–100 % (utan sållning 0–100 % som förut). Samma procent skickas aldrig två gånger i rad. Nytt test i `core.test.ts`
- `SolverProgress` (`ResultsPanel.tsx`): hacket som visade "högsta värdet hittills" är borttaget, värdet från solvern visas direkt

## 2026-10-12 — Publicering på GitHub Pages

- `.github/workflows/deploy.yml`: bygger, testar och publicerar appen automatiskt vid varje push till main
- `vite.config.ts`: `base` = `/ofc-solver/` vid bygge så att filerna hittas på GitHub Pages
- Appen finns på https://vg1414.github.io/ofc-solver/

## 2026-10-12 — Nytt gränssnitt: varmt, ljust och mobil först

Hela UI:t är omgjort med samma designspråk som Bokis (gradienter, glaskort, mjuka skuggor, fjädrande rörelser), i smaragd och guld på krämvit botten. Solver-motorn (`src/core`, `src/solver`, `src/workers`, `src/engine`) är orörd.

- **Bara Solvern kvar**: Poängräknare och Bokföring är borttagna (finns i BlackBook)
- **Nya spelkort** (`PlayingCard`, `SuitIcon`): fyrfärgslek med pastellbakgrund per färg, stor valör, centrerad färgsymbol som vattenstämpel och lätt glans. Symbolerna ritas som SVG (inga emoji-hjärtan på iPhone). Jokern har guldstjärna
- **Brädet** (`BoardView`) är ett ljust mintfilt-bord. Lediga platser andas i guld när ett kort är valt, korten snäpper på plats, royalties visas live per rad. Tryck på ett lagt kort två gånger för att ta bort det
- **Dra-och-släpp** (`dnd/`) med pointer events: fungerar med touch och mus, det dragna kortet svävar ovanför fingret. Man kan dra kort både till brädet och till "Din hand" (öppningshand och Fantasy Land-hand), som lyser upp i guld när kortet svävar över den
- **Kortinmatning**: kompakt 4×13-rutnät i en svävande glaspanel längst ner + jokerknapp med räknare (2 jokrar)
- **Öppningen är inget eget läge längre**: lägena är "Vanlig hand" och "Fantasy Land". Med tomt bräde är det öppningshand: välj upp till 5 kort, "Bästa öppning" + "Lägg så här" lägger ut alla, sedan ett kort i taget. En rad ovanför brädet visar "Öppningshand" / "5 av 13 kort"
- **Resultat**: förslaget visas som spökkort direkt på brädet. Bästa draget i guldkort med skimrande list och EV som räknas upp; övriga alternativ fälls ut. Öppning/FL visar minibräde med royalties
- **Progress** med snurrande logga, gradient-bar och Avbryt. Siffran går aldrig bakåt (se "Jämn progress i solvern")
- **Inställningsark** (variant, simuleringsnivå, husregler) som stängs med ✕-knappen, svep ner eller tryck utanför
- Följer telefonens ljusa/mörka läge. Liggande telefon och desktop får två kolumner
- Nya store-actions `addSelectedCard` / `removeSelectedCardAt` (för två jokrar i handen). Befintliga actions är oförändrade
- Typsnitt: Outfit + Playfair Display (som Bokis) och Barlow Condensed för kortens valörer

## 2026-10-12 — Ny solver-kärna: korrekta resultat

Den gamla solvern räknade fel i grunden: simuleringen fick se alla framtida kort på en gång och sorterade dem bara efter valör, motståndaren foulade nästan jämt, FL-bonusen räknades dubbelt (även vid foul) och jokrar kunde orsaka onödig foul. Hela beräkningsdelen är därför ombyggd.

- **Ny kärna `src/core/`** (ersätter `heuristics.ts`, `monteCarlo.ts`, `placement.ts`, `flProbability.ts`, `flConfig.ts`)
  - `eval.ts`: snabb handvärdering på heltal. Jokrar väljs för att **undvika foul**, lika starka rader är OK och royal flush slår 5-tal
  - `lookahead.ts`: simulerad spelare som får ett kort i taget (ingen framtidsblick). För varje rad slumpar den 12 möjliga framtider och räknar ut bästa slutuppställning, så den förstår vad varje rad kräver. Den vinner ≈ 1 poäng/hand mer än en enkel tumregel-spelare
  - `policy.ts`: snabb tumregel-spelare (royalties, draws, FL-chans, foul-risk) som används för grovsållning
  - `sim.ts`: Monte Carlo där alla kandidater spelas mot samma blandningar. Många kandidater (öppningshand) sållas först på två oberoende sätt (försiktigt + optimistiskt), sedan slås drag ut först när de är statistiskt sämre (> 2 standardfel)
  - `poolData.ts`: 1 500 färdigspelade motståndarhänder per variant, förberäknade med `scripts/buildPool.ts` så att appen startar snabbt
  - `fl.ts`: **exakt** Fantasy Land-lösare som går igenom alla uppställningar (även 14–16 kort)
  - `flValue.ts`: FL-värdet är uträknat genom simulering (`scripts/computeFlValue.ts`) i stället för att gissas
- FL-strategi-reglaget är borttaget, eftersom solvern nu räknar ut FL-värdet själv
- Solver-panelen visar foul-risk (%) per alternativ
- Simuleringsnivåer: Snabb 300 / Normal 800 / Noggrann 2000 (max 8 / 20 / 45 sekunder)
- Appens egen foul- och royalty-visning använder samma regler som solvern
- Nya facit-tester i `src/core/core.test.ts`
- Mätskript i `scripts/` (`selfplay`, `tune`, `demo`, `compare`, `clair`, `computeFlValue`, `buildPool`)
- Utslagning kräver minst 100 simuleringar (förhindrar att bra drag slås ut av slumpbrus)
- Kalibrerat mot 7 testhänder (`scripts/calib.ts`): spelarintuitionen var bäst eller lika bra i 6 av 7
- Exempel: med A♥A♦7♣8♣2♠ rekommenderas nu AA2 i middle och 7♣8♣ i bottom (EV +3,3 mot +1,7 för AA i bottom)

## 2026-03-31 — FL-värdering, aggressivitetsinställning och royalty-visning

- `solver.ts`: Ny `flAggression`-inställning ('conservative'/'balanced'/'aggressive'), FL-sannolikhet viktas nu in i EV
- `flConfig.ts`: Ny delad konstant `FL_VALUE_MAP` (löser cirkulär import mellan solver ↔ monteCarlo)
- `heuristics.ts`: Höjda `flEntryBonus`-värden, aggressionsmultiplikator, FL-medveten `greedyCompletion`
- `monteCarlo.ts`: FL-bonus i rollout-resultat, `flAggression` propageras genom hela MC-kedjan
- `flProbability.ts`: `greedyCompletion` anropas med `tryFL=true` för bättre FL-estimat
- `SolverControls.tsx`: Ny 3-stegs FL-strategi-toggle i UI
- `ResultBoardPreview.tsx` + `SolverPanel.tsx`: Visar royalty-poäng per rad i FL-läge

## 2026-03-31 — Bugfix: Öppningshand-analys kraschade med "Okänd meddelandetyp"

- `solver.worker.ts`: Workern delegerar nu all meddelandehantering till `handleSolverMessage()` i `solver.ts` — inkluderar därmed `solve_opening` och `solve_fl` som saknades

## 2026-03-31 — Fix: Solver-rekommendationer rensas vid ny hand

- `SolverControls.tsx`: Ny `onNewHand`-prop, "Ny hand"-knappen anropar nu både `resetGame()` och `onNewHand()`
- `App.tsx`: Skickar `clearResult` som `onNewHand` — solver-panelen töms korrekt vid ny hand

## 2026-03-31 — Fas 1–8: Öppningshand-solver + Fantasy Land-solver

### Tre solver-lägen (Normal / Öppningshand / Fantasy Land)
- `types.ts`: Ny typ `SolverMode` och `FLCardCount`
- `gameStore.ts`: Nytt state `solverMode`, `selectedCards`, `flCardCount` + actions
- `flProbability.ts` (ny): MC-baserad FL%-estimering efter öppningshand
- `solver.ts`: `solveOpeningHand()` och `solveFantasyLandMode()`, enrichning med FL%, repeatFL, resultBoard
- `useSolver.ts`: Stöd för `mode` i `SolverInput`, skickar rätt worker-meddelande
- `SolverControls.tsx`: `ModeSelector`-komponent och `FLCardCountPicker` (visas i FL-läge)
- `CardPicker.tsx`: Multi-select med counter och X-knappar per valt kort
- `ResultBoardPreview.tsx` (ny): Kompakt read-only bräde-förhandsgranskning i resultatraden
- `SolverPanel.tsx`: FL%-badge, repeatFL-badge och board-preview per placeringsalternativ
- `App.tsx`: `handleRunSolver` branchar på `solverMode`, layout anpassas per läge

## 2026-03-31 — Fas 7: Motståndarens bräde i solver

### Motståndarens bräde inkluderas i EV-beräkning (7.1–7.3)
- `solver.ts`: `solveFromBoard` tar nu emot valfri `opponentBoard`-parameter — om motståndarens bräde har minst ett kort används `runMonteCarlo` (tvåspelarläge) istället för `runMonteCarloSinglePlayer` (tomt motståndar-bräde)
- `SolverWorkerInputFromBoard`: ny valfri `opponentBoard`-prop i worker-meddelandet
- `useSolver.ts`: `SolverInput` utökad med `opponentBoard?`; skickas vidare till worker
- `App.tsx`: kollar om motståndarens bräde har kort — om ja skickas det med i solver-anropet
- `SolverPanel.tsx`: visar badge "↕ Motståndare inkl." i headern när motståndarens bräde användes

## 2026-03-30 — Fas 6: Polish & Deploy (Steg 6.1–6.3)

### Responsiv design (6.1)
- Header, flikar, bräde, kortplatser och kortväljare anpassade för mobil och tablet
- Tailwind `sm:`-breakpoints genomgående — appen fungerar från 320px och uppåt
- Kortstorlekar krymper på mobil, flikar fyller hela bredden

### Visuell polish (6.2)
- Kort-placerings-animation: kort glider in och "poppar" när de placeras på brädet
- Flik-byte tonar in med `fade-in`-animation
- Solver-panel glider in underifrån när resultat visas
- Grönt glow-puls på bästa solver-rekommendation
- Bättre hover/active-effekter på kort och kortplatser

### Prestandaoptimering (6.3)
- Live progress-indikator under solver-beräkning: "Simulerar… 45%" + grön progress-bar
- Solver-workern skickar progress-meddelanden (0–100%) i realtid
- Tidsgräns: 5s för Normal (1000 sim), 8s för Noggrann (3000 sim)
- `topCandidates` = 50 genomgående för bästa kvalitet

## 2026-03-27 — Initial release (Fas 1–5 klar)

### Pokermotorn (engine/)
- `types.ts`, `constants.ts`: Alla datatyper, rank/suit-enums, royalty-tabeller
- `card.ts`, `deck.ts`: Kort-skapande, kortlekshantering med 54 kort (52 + 2 jokrar)
- `handEval.ts`: 5-korts och 3-korts handvärderare med joker-stöd och 5-tal som kategori
- `royalties.ts`: Royalty-beräkning per rad (middle = dubbla bottom)
- `scoring.ts`, `foulCheck.ts`: Full poängberäkning och foul-validering
- `gameState.ts`: Speltillstånd, rund-hantering, Fantasy Land-logik

### Solver-algoritmen (solver/)
- `placement.ts`: Genererar alla lagliga placeringar
- `heuristics.ts`: Snabb heuristik-rankning av placeringar
- `monteCarlo.ts`: Monte Carlo-motor med EV-beräkning
- `solver.ts`: Orkestrerare som returnerar rankade placeringsalternativ

### UI (components/)
- Mörkt pokertema med Tailwind CSS
- `Card.tsx`, `CardPicker.tsx`: 54-korts kortväljare (52 + 2 jokrar), grå-ut använda
- `BoardView.tsx`, `RowSlots.tsx`, `CardSlot.tsx`: Bräde med 3 rader
- `SolverPanel.tsx`, `SolverControls.tsx`: EV-resultat med progressbar
- `Header.tsx`, `Footer.tsx`: Layout med "Made by: David Hefner"
- Flik-navigation: Solver / Poängräknare / Bokföring

### State management (store/)
- `gameStore.ts`: Zustand store för speltillstånd
- `scoreStore.ts`: Poänghistorik per hand, sparas i localStorage
- `bookStore.ts`: Sessionsbokföring (datum, motståndare, poäng, pengar), sparas i localStorage

### Bokföring (components/bookkeeping/)
- Lägg till/redigera/ta bort sessioner
- Statistik: total vinst/förlust, bästa/sämsta session, snitt per session
- Valutastöd: SEK, EUR, USD

### Infrastruktur
- Web Worker (`solver.worker.ts`) för beräkningar i bakgrunden
- `vercel.json` konfigurerad för deployment
- Projektsetup: Vite + React 18 + TypeScript + Tailwind CSS + Zustand
