# Changelog

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
