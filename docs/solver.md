# Solvern och Solver-fliken

Läs detta innan du ändrar i `src/core/`, `src/solver/`, `src/workers/`, `src/hooks/useSolver.ts` eller `src/components/solver/`.

## Hur solvern räknar

1. Alla sätt att lägga korten blir kandidater (Pineapple: även vilket kort som kastas).
2. Varje kandidat spelas klart många gånger med slumpade framtida kort. En simulerad spelare lägger korten ett i taget. EV = snittpoäng mot motståndaren (känt bräde, annars snitt mot `SIM.oppSamples` = 64 händer ur en pool med färdiga händer) + värdet av Fantasy Land. Alla kandidater får samma blandningar, och spelarens provframtider startas om per simulering (`reseedLookahead(i)`), så solvern är deterministisk. Bruset mäts med `scripts/variance.ts`.
3. **Sållning:** vid många kandidater (öppningshänder) körs först en snabb grovsållning (60 spel, svag spelare), och de 12 bästa går vidare. Sedan slås drag ut när de är statistiskt sämre än ledaren. Bortsållade drag har därför färre simuleringar och osäkrare, ofta för lågt, EV.
4. **Låsta drag (`options.pinned`):** ett låst drag sållas aldrig bort och räknas lika noga som bästa draget på samma blandningar. Träningen använder det för att bedöma spelarens drag rättvist.
5. Fantasy Land löses exakt (alla uppställningar). Där returneras bara topp 15.
6. **FL-värde** (`flValue.ts`): poäng som läggs till när en simulering når FL, och som FL-lösaren lägger på en uppställning som ger repeat. Inkluderar upprepade repeat (geometrisk serie). Räknas om med `sh scripts/run.sh scripts/computeFlValue.ts 1000` (1000 händer per kortantal, 3 varv, ca 2 timmar; 16 kort tar ~1,5 s per hand). Med få händer (t.ex. 60) svänger värdena 1–2 poäng.

Nivåer: Snabb 300 sim (max 8 s), Normal 800 (20 s), Noggrann 2000 (45 s).

**`pinnedOnly`:** räknar bara de låsta dragen (snabb omräkning av t.ex. ditt drag mot bästa draget). Kandidaterna byggs direkt från de låsta dragen (ingen `allAssignments`), så ett "drag" kan vara ett helt bräde från tomt bräde (Jämför fritt).

**`naive`:** markerar tumregelspelarens val (policy-heuristiken, `LA.samples = 0`) med `naive: true` i `options`. Används för att hitta fällor bland träningsscenariona.

**Viktigt i resultatet:** `result.options` innehåller ALLA kandidater, inte bara de som visas. `result.best` är solverns val. Fält per alternativ: `finalist` (räknades klart), `pinned`, `evDiffSE`. `useSolver` sorterar för visning (`solverOrder.ts`): bästa draget först, resten efter EV.

**"≈ lika bra" i resultatlistan** (`ResultsPanel` `withinMargin`): ett alternativ vars |EV − bästa EV| < 2·`evDiffSE` märks med en grön "≈ lika bra"-bricka, skillnaden visas grå i stället för röd, och en förklaring står under listan. Ihopfälld lista: "Visa alla 6 alternativ · N ≈ lika bra". Bara finalister har `evDiffSE` (bortsållade och exakt uträknade märks aldrig).

**Förberäknad data som bygger på husreglerna:** `core/poolData.ts` (motståndarbräden, genereras av `scripts/buildPool.ts`) och `core/flValue.ts`. Ändras reglerna måste båda räknas om.

## Använda solvern från UI

```ts
const { runSolver, cancelSolver, clearResult, result, isLoading, progress, error } = useSolver();
runSolver({ board, cards, deadCards, variant, opponentBoard, options: { simulations: 800 }, mode: 'normal' });
// mode: 'normal' (även öppning) | 'fantasyLand'
```

En `useSolver()` = en egen worker, och den räknar en sak i taget. `runSolver` ger ett id, och `doneId` i state säger vilken körning som senast blev klar. Träningen använder `useSolverJobs()` (`src/training/useSolverJobs.ts`), som gör samma hook "await"-bar med en kö: `const res = await jobs.solve(input)`.

## Solver-fliken

- State i `src/store/gameStore.ts` (Zustand: bräden, valda kort, variant).
- Lägena "Vanlig hand" och "Fantasy Land". Tomt bräde = öppningshand (välj upp till 5 kort, "Bästa öppning", "Lägg så här").
- Kort läggs genom tryck kort → tryck rad, eller dra-och-släpp. Ett lagt kort tas bort med två tryck.
- Förslaget visas som spökkort på brädet, med EV, FL-chans och foul-risk.
- **Jämför (`solver/CompareView.tsx`):** "⇄ Jämför mot…" när ett helt drag ligger på brädet (`lastMove` i SolverView letar bakifrån i `_history`), eller "Lägg själv och jämför" i FL. Två `useMoveBuilder` (A, B; `load()` gör B till en kopia av A), solvern körs med `pinned: [A, B]`. A–B-felmarginal = `evDiffSEPin0`. FL: låsta uppställningar räknas exakt (`evaluateFLAssign`).
  - **B kan flytta alla kort**, även från tidigare rundor: B:s builder har tomt grundbräde och "handen" = tidigare kort + dragets kort. Ligger tidigare kort kvar i sina rader räknas B som vanligt drag (`bMove`). Annars (fritt läge) räknas A och B som hela bräden från tomt bräde (`pinnedOnly`, samma osedda kort → samma blandningar), och en andra `useSolver` räknar bästa draget från det riktiga brädet med A låst; bästa dragets EV flyttas så att A har samma värde i båda. Ett sådant B kan inte läggas ut ("Behåll B" avstängd).
- Dela-knappen finns också här (`SolverView` shareBoards/shareHand), se [ui.md](ui.md).

## Skript

`scripts/` innehåller mät- och kalibreringsskript: `sh scripts/run.sh scripts/demo.ts`.
