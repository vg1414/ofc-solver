# OFC Poker Solver — Projektplan

## Kontext
David vill bygga en webbaserad solver för Open Face Chinese Poker (OFC) som hjälper spelaren att avgöra var ett kort ska placeras för att maximera förväntat poängvärde. Appen ska stödja både **vanlig OFC** och **Pineapple OFC**, inklusive **Fantasy Land**. Designen ska ha ett mörkt pokertema. Kortinput via klick (click-to-place).

---

## Specialregler (ert hemspel)

Dessa regler avviker från standard-OFC och måste bäddas in i motorn:

### Jokrar (Wilds)
- **54 kort** i leken: 52 vanliga + 2 jokrar
- Jokrar är **helt vilda** — de representerar vilket kort som helst
- Två jokrar **kan** vara samma kort (t.ex. båda = A♠)
- En joker kan vara ett kort som redan finns på brädet

### Fantasy Land (FL)
**Inträde (första gången):**
- QQ på topp → 13 kort
- KK på topp → 14 kort (använd 13, kasta 1)
- AA på topp → 15 kort (använd 13, kasta 2)
- Triss på topp → 16 kort (använd 13, kasta 3)

**Stanna kvar i FL (repeat):**
- Krav: minst 4-tal på bottom, ELLER minst kåk (full house) på middle, ELLER minst triss på topp
- Vid repeat-FL får man alltid **13 kort** (oavsett topphanden)

### Royalties (avvikelser från standard)
- **Middle = dubbla poäng jämfört med bottom** för alla händer
- **Triss:** 0p på bottom, 2p på middle
- **5-tal** (five of a kind, möjligt med joker): **20p bottom, 40p middle**
- **Triss på topp:** 222 = 10p, 333 = 11p, 444 = 12p, ..., AAA = 22p (standard)

**Komplett royalty-tabell:**
| Hand | Bottom | Middle |
|------|--------|--------|
| Triss | 0p | 2p |
| Straight | 2p | 4p |
| Flush | 4p | 8p |
| Full house | 6p | 12p |
| Fyrtal | 10p | 20p |
| Straight flush | 15p | 30p |
| Royal flush | 25p | 50p |
| 5-tal | 20p | 40p |

**Topp-royalties (3-korts hand):**
| Hand | Poäng |
|------|-------|
| 66 | 1p |
| 77 | 2p |
| 88 | 3p |
| 99 | 4p |
| TT | 5p |
| JJ | 6p |
| QQ | 7p |
| KK | 8p |
| AA | 9p |
| 222 | 10p |
| 333 | 11p |
| ... | ... |
| AAA | 22p |

### Solver-implikationer
- Handvärderaren måste hantera jokrar som wildcards vid utvärdering
- 5-tal måste vara en giltig handkategori (högre än fyrtal)
- FL-logiken behöver stödja variabelt antal kort (13-16) + kastning
- Monte Carlo-simuleringen måste ta hänsyn till att jokrar finns i leken (54 kort, inte 52)
- Vid greedy-completion i simulering: joker-placering kräver att solvern avgör vilken "bästa identitet" jokern ska anta

---

## Teknikstack
| Vad | Val | Varför |
|-----|-----|--------|
| Ramverk | React 18 + Vite | Snabbt, enkelt, nybörjarvänligt |
| Språk | TypeScript | Fångar buggar tidigt |
| State | Zustand | Minimal boilerplate |
| Styling | Tailwind CSS | Snabb styling med utility-klasser |
| Solver | Web Worker | Håller UI responsivt under beräkningar |
| Deploy | Vercel | Gratis, noll-konfiguration för Vite |

---

## Filstruktur

```
ofc-solver/
├── public/
├── src/
│   ├── main.tsx                    # Startpunkt
│   ├── App.tsx                     # Rot-komponent
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx          # Appens header med titel & knappar
│   │   │   └── Footer.tsx          # "Made by: David Hefner"
│   │   ├── board/
│   │   │   ├── BoardView.tsx       # Hela brädet (3 rader) för en spelare
│   │   │   ├── RowSlots.tsx        # En rad (top/mid/bot) med kortplatser
│   │   │   └── CardSlot.tsx        # En enskild kortplats (tom eller fylld)
│   │   ├── cards/
│   │   │   ├── Card.tsx            # Enskilt kort (visuell komponent)
│   │   │   ├── CardPicker.tsx      # 54-korts rutnät (52 + 2 jokrar) för att välja kort
│   │   │   └── DealtCards.tsx      # Visar nuvarande delade kort
│   │   ├── solver/
│   │   │   ├── SolverPanel.tsx     # Visar EV-resultat & rekommendationer
│   │   │   └── SolverSettings.tsx  # Inställningar (antal simuleringar)
│   │   ├── game/
│   │   │   ├── GameControls.tsx    # Nytt spel, ångra, återställ, variant-val
│   │   │   ├── ScoreDisplay.tsx    # Poängöversikt
│   │   │   └── RoundIndicator.tsx  # Visar vilken runda (1-9)
│   │   └── scoring/
│   │       ├── ScoreTracker.tsx    # Bokföring: knappa in poäng per hand
│   │       ├── ScoreHistory.tsx    # Historik: lista med alla händer + totalpoäng
│   │       └── SessionSummary.tsx  # Sammanfattning av sessionen (vinst/förlust)
│   │
│   ├── engine/                     # Pokermotorn (ren logik, ingen UI)
│   │   ├── types.ts                # Alla datatyper & interfaces
│   │   ├── constants.ts            # Rank/färg-enums, royalty-tabeller
│   │   ├── card.ts                 # Skapa, parsa, formatera kort
│   │   ├── deck.ts                 # Kortlek & döda kort
│   │   ├── handEval.ts            # Pokerhandsvärdering (5-kort & 3-kort)
│   │   ├── royalties.ts           # Royalty-beräkning per rad
│   │   ├── scoring.ts             # Full OFC-poängberäkning
│   │   ├── foulCheck.ts           # Kontrollera att top < mid < bot
│   │   └── gameState.ts           # Speltillstånd & övergångar
│   │
│   ├── solver/                    # Solver-algoritmen
│   │   ├── solver.ts              # Huvud-entrypoint
│   │   ├── monteCarlo.ts          # Monte Carlo-simulering
│   │   ├── placement.ts           # Generera lagliga placeringar
│   │   └── heuristics.ts         # Snabb heuristik för filtrering
│   │
│   ├── store/
│   │   └── gameStore.ts           # Zustand store (allt speltillstånd)
│   │
│   ├── hooks/
│   │   ├── useSolver.ts           # Hook som kör solver via Web Worker
│   │   └── useCardSelection.ts    # Hook för kortval-interaktion
│   │
│   ├── workers/
│   │   └── solverWorker.ts        # Web Worker för beräkningar
│   │
│   └── utils/
│       └── formatting.ts          # Hjälpfunktioner för visning
│
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── README.md
└── CHANGELOG.md
```

---

## Fasindelning & AI-modellrekommendationer

### Fas 1: Projektuppstart & Pokermotorn (engine/)
**Vad:** Sätta upp projektet och bygga all poker-logik utan UI.

| Steg | Fil(er) | Beskrivning | AI-modell | Motivering |
|------|---------|-------------|-----------|------------|
| ✅ 1.1 | Projektsetup | `npm create vite`, installera beroenden, konfigurera Tailwind | **Sonnet** | Rutinuppgift, behöver inte Opus |
| ✅ 1.2 | `types.ts`, `constants.ts` | Definiera kort, rader, speltillstånd, royalty-tabeller | **Sonnet** | Datastrukturer, okomplicerat |
| ✅ 1.3 | `card.ts`, `deck.ts` | Kort-skapande, kortlekshantering, döda kort | **Sonnet** | Enkel logik |
| ✅ 1.4 | `handEval.ts` | 5-korts och 3-korts handvärderare med joker-stöd (wildcards). Måste hantera 5-tal som handkategori. | **Opus** | Algoritmiskt komplext. Jokrar gör det svårare — kan inte använda ren lookup-tabell, behöver wildcard-logik |
| ✅ 1.5 | `royalties.ts` | Royalty-poäng per rad enligt OFC-regler | **Sonnet** | Tabell-uppslagning, rakt på sak |
| ✅ 1.6 | `scoring.ts`, `foulCheck.ts` | Full poängberäkning, foul-validering | **Sonnet** | Logik baserad på regler, men bör granskas noga |
| ✅ 1.7 | `gameState.ts` | Speltillstånd, rund-hantering, Pineapple-stöd | **Sonnet** | State machine-logik |

**Verifiering:** Kör enhetstester för varje modul. Testa kända pokerhänder och verifiera korrekt ranking och royalty-beräkning.

---

### Fas 2: Solver-algoritmen (solver/)
**Vad:** Monte Carlo-simulering som beräknar förväntat värde (EV) för varje möjlig placering.

| Steg | Fil(er) | Beskrivning | AI-modell | Motivering |
|------|---------|-------------|-----------|------------|
| ✅ 2.1 | `placement.ts` | Generera alla lagliga placeringar för ett kort | **Sonnet** | Enkel kombinatorik |
| ✅ 2.2 | `heuristics.ts` | Snabb heuristik: filtrera bort dåliga val, greedy-completion för simulering | **Opus** | Kräver djup OFC-förståelse för att ranka placeringar korrekt |
| 2.3 | `monteCarlo.ts` | Monte Carlo-motor: simulera N färdigspelningar, beräkna EV | **Opus** | Algoritmiskt kärnan i appen. Prestanda + korrekthet kritiskt |
| 2.4 | `solver.ts` | Orkestrerare: tar emot speltillstånd, returnerar rankade placeringar | **Sonnet** | Limkod som binder samman delarna |

**Hur solvern fungerar (förenklat):**
1. Spelaren har ett kort att placera → solvern testar varje möjlig rad
2. För varje rad: simulera 3000 slumpmässiga färdigspelningar av båda händer
3. Beräkna genomsnittlig poäng för varje placering
4. Returnera: "Lägg kortet i BOTTOM → förväntat +2.3 poäng"

**Pineapple-hantering:** I Pineapple får spelaren 3 kort, väljer 2, kastar 1. Solvern utvärderar alla möjliga kombinationer av (2 kort att behålla × placering per kort).

**Fantasy Land:** Spelaren får 13-16 kort beroende på topphanden (QQ=13, KK=14, AA=15, triss=16). Väljer ut 13 att placera, kastar resten. Solvern måste utvärdera vilka kort som kastas + optimal placering av de 13 som behålls. Vid repeat-FL: alltid 13 kort. Stanna kvar kräver: 4-tal+ på bottom, kåk+ på middle, eller triss+ på topp.

**Verifiering:** Testa med kända scenarier. T.ex. om du har 4 till flush i bottom ska solvern föredra att lägga femte flush-kortet där.

---

### Fas 3: UI-grundstomme (components/)
**Vad:** Bygga den visuella appen med mörkt pokertema.

| Steg | Fil(er) | Beskrivning | AI-modell | Motivering |
|------|---------|-------------|-----------|------------|
| 3.1 | `Card.tsx` | Kort-komponent med färg, symbol, hover-effekt | **Sonnet** | UI-komponent, Sonnet hanterar React väl |
| 3.2 | `CardSlot.tsx`, `RowSlots.tsx`, `BoardView.tsx` | Brädet: 3 rader med kortplatser | **Sonnet** | Komponentstruktur |
| 3.3 | `CardPicker.tsx` | 54-korts rutnät (52 + 2 jokrar), grå ut använda kort | **Sonnet** | Interaktiv komponent |
| 3.4 | `gameStore.ts` | Zustand store med allt speltillstånd | **Sonnet** | State management |
| 3.5 | `Header.tsx`, `Footer.tsx`, `Layout` | Pokertema: mörk bakgrund, grönt filt, subtila texturer | **Sonnet** | Layout & styling |

**Verifiering:** Öppna i webbläsaren. Kan du klicka kort och placera dem på brädet? Grå-as använda kort ut?

---

### Fas 4: Integration — koppla ihop allt
**Vad:** Koppla solver till UI via Web Worker, visa rekommendationer.

| Steg | Fil(er) | Beskrivning | AI-modell | Motivering |
|------|---------|-------------|-----------|------------|
| 4.1 | `solverWorker.ts` | Web Worker som kör solvern i bakgrunden | **Sonnet** | Standard Web Worker-mönster |
| 4.2 | `useSolver.ts` | React hook som kommunicerar med workern | **Sonnet** | Hook-mönster |
| 4.3 | `SolverPanel.tsx` | Visa EV-resultat med stapeldiagram, grön markering på bästa val | **Sonnet** | UI-komponent |
| 4.4 | `GameControls.tsx`, `ScoreDisplay.tsx` | Spelkontroller, poängvisning, variant-väljare (OFC/Pineapple) | **Sonnet** | UI-komponent |
| 4.5 | `App.tsx` — full integration | Koppla allt: picker → store → solver → resultat → bräde | **Opus** | Komplex integration, alla delar måste fungera tillsammans |

**Verifiering:** Full end-to-end-test: Välj kort → se rekommendation → placera kort → se poäng uppdateras → spela hela handen.

---

### Fas 5: Bokföringsapp (scoring/)
**Vad:** En enkel poängräknare som håller koll på sessionens totala poäng.

| Steg | Fil(er) | Beskrivning | AI-modell | Motivering |
|------|---------|-------------|-----------|------------|
| 5.1 | `store/scoreStore.ts` | Zustand store för poänghistorik (lista med händer, totalpoäng) | **Sonnet** | Enkel state |
| 5.2 | `ScoreTracker.tsx` | Input: knappa in poäng efter varje hand (+/- poäng) | **Sonnet** | Enkel form-komponent |
| 5.3 | `ScoreHistory.tsx` | Tabell med alla händer: Hand #, poäng, löpande total | **Sonnet** | Tabell-komponent |
| 5.4 | `SessionSummary.tsx` | Visar total vinst/förlust, antal händer, snittpoäng per hand | **Sonnet** | Beräkna & visa |

**Verifiering:** Knappa in poäng för 5 händer, verifiera att totalen stämmer. Stäng & öppna appen — datan bör finnas kvar (localStorage).

---

### Fas 6: Polish & Deploy
**Vad:** Finslipa, testa, och publicera.

| Steg | Beskrivning | AI-modell | Motivering |
|------|-------------|-----------|------------|
| 6.1 | Responsiv design (mobil/tablet) | **Sonnet** | CSS-anpassning |
| 6.2 | Visuell polish: animationer, kort-flip, glow-effekter | **Sonnet** | CSS/Framer Motion |
| 6.3 | Prestandaoptimering: justera simuleringsantal, progress-indikator | **Sonnet** | Finjustering |
| 6.4 | README.md & CHANGELOG.md | **Haiku** | Enkel textgenerering |
| 6.5 | Deploy till Vercel + GitHub Pages-länk | **Sonnet** | Standardprocess |

---

## UI-layout (mörkt pokertema)

```
┌──────────────────────────────────────────────────┐
│  ♠ OFC SOLVER         [Vanlig OFC ▼]  [Ny] [↩]  │
├───────────────────────┬──────────────────────────┤
│                       │                          │
│   DITT BRÄDE          │   MOTSTÅNDARENS BRÄDE    │
│   ┌──┬──┬──┐          │   ┌──┬──┬──┐             │
│   │  │  │  │ Top      │   │  │  │  │ Top         │
│   ├──┼──┼──┼──┬──┐    │   ├──┼──┼──┼──┬──┐       │
│   │  │  │  │  │  │Mid │   │  │  │  │  │  │ Mid   │
│   ├──┼──┼──┼──┼──┤    │   ├──┼──┼──┼──┼──┤       │
│   │  │  │  │  │  │Bot │   │  │  │  │  │  │ Bot   │
│   └──┴──┴──┴──┴──┘    │   └──┴──┴──┴──┴──┘       │
│                       │                          │
├───────────────────────┴──────────────────────────┤
│  DINA KORT:  [A♥]  [K♦]  [7♣]                   │
│                                                  │
│  ┌─── SOLVER REKOMMENDERAR ────────────────────┐ │
│  │ ★ Bottom: EV = +2.3  ████████████░░  BÄST  │ │
│  │   Middle: EV = +1.1  █████░░░░░░░░░         │ │
│  │   Top:    EV = -0.4  ██░░░░░░░░░░░░         │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  KORTVÄLJARE:                                    │
│  ♣ 2  3  4  5  6  7  8  9  T  J  Q  K  A       │
│  ♦ 2  3  4  5  6  7  8  9  T  J  Q  K  A       │
│  ♥ 2  3  4  5  6  7  8  9  T  J  Q  K  A       │
│  ♠ 2  3  4  5  6  7  8  9  T  J  Q  K  A       │
│                                                  │
│  Runda: 4/9 │ Poäng: +5 │ Royalties: +8         │
├──────────────────────────────────────────────────┤
│              Made by: David Hefner               │
└──────────────────────────────────────────────────┘
```

---

## Sammanfattning av AI-modellval

| Modell | Används för | Antal steg |
|--------|------------|------------|
| **Opus** | Handvärderare, Monte Carlo-solver, heuristik, full integration | 4 steg (de svåraste) |
| **Sonnet** | De flesta steg: UI, state, worker, styling, deploy | ~15 steg |
| **Haiku** | README, CHANGELOG, enkel text | 1 steg |

**Princip:** Opus för algoritmisk komplexitet och korrekthet. Sonnet för allt som följer kända mönster. Haiku för trivial text.

---

## Verifiering (end-to-end)

1. **Motortest:** Kör enhetstester för handEval, royalties, scoring, foulCheck
2. **Solver-test:** Ge solvern kända scenarier, verifiera att den rekommenderar rimliga placeringar
3. **UI-test:** Öppna i webbläsare, spela igenom en hel hand
4. **Prestandatest:** Solver ska svara inom ~200ms per kort
5. **Deploy-test:** Pusha till GitHub, verifiera att Vercel-bygget fungerar
