# Changelog

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
