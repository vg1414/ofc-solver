# OFC Solver

En webbaserad solver för Open Face Chinese Poker (OFC) med stöd för hemspels-regler.

## Funktioner

- Stöd för vanlig OFC och Pineapple OFC
- Fantasy Land med variabelt antal kort (QQ=13, KK=14, AA=15, triss=16)
- 54 kort (52 vanliga + 2 jokrar som är helt vilda)
- 5-tal som handkategori (20p bottom / 40p middle) — möjligt med joker
- Monte Carlo-solver som räknar ut förväntat poängvärde (EV) per placering, inklusive FL-chans och foul-risk
- Exakt Fantasy Land-lösare (13–16 kort, provar alla uppställningar)

## Gränssnitt

- **Mobil först**: byggd för en hand vid pokerbordet (360–430 px). Liggande telefon och desktop får två kolumner
- **Egna spelkort** i fyrfärgslek (♠ svart, ♥ röd, ♦ blå, ♣ grön): hela kortet har färgens pastellton, stor valör och färgen som vattenstämpel. Jokrarna har en guldstjärna
- **Lägg kort** genom att trycka på ett kort och sedan på en rad/plats, eller dra-och-släpp (touch + mus). Lediga platser andas i guld, kortet snäpper på plats och telefonen vibrerar lätt
- **Kompakt 4×13-rutnät** för kortinmatning, alltid nåbart med tummen
- **Två lägen: Vanlig hand och Fantasy Land.** Öppningen ingår i vanlig hand: med tomt bräde väljer du 5 kort → "Bästa öppning" → "Lägg så här" lägger ut alla. Sedan ett kort i taget
- **Solverns förslag visas som spökkort direkt på brädet**, med EV, FL-chans, foul-risk och "↻ FL igen"
- Följer telefonens ljusa/mörka läge. Ark sveps ner för att stängas

## Specialregler (hemspel)

- **Jokrar:** Helt vilda, kan vara vilket kort som helst (även dubletter). Jokern väljs så att handen inte foulear
- **Lika starka rader** räknas inte som foul. **Royal flush slår 5-tal**
- **Fantasy Land-inträde:** QQ+ på topp ger 13–16 kort beroende på hand
- **Repeat FL:** Kräver 4-tal+ på bottom, kåk+ på middle, eller triss+ på topp
- **Middle = dubbla royalties** jämfört med bottom för alla händer

### Royalty-tabell

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

## Så räknar solvern

1. **Vanligt drag / öppningshand:** varje möjlig placering spelas klart hundratals till tusentals gånger. Korten kommer ett i taget och en simulerad spelare placerar dem (`src/core/lookahead.ts`), som för varje kort provar några möjliga framtider. EV = snittpoäng mot en pool av färdigspelade motståndarhänder (`src/core/poolData.ts`), plus värdet av Fantasy Land.
2. **Fantasy Land:** alla uppställningar gås igenom exakt (`src/core/fl.ts`).
3. **FL-värde:** uträknat med `scripts/computeFlValue.ts` och sparat i `src/core/flValue.ts`.

## Teknik

- React 19 + Vite
- TypeScript
- Zustand (state management)
- Tailwind CSS 4 (styling, temat ligger som CSS-variabler i `src/index.css`)
- Web Worker (solver körs i bakgrunden utan att frysa UI)

## Köra lokalt

```bash
# Installera beroenden
npm install

# Starta utvecklingsserver
npm run dev

# Bygg för produktion
npm run build

# Förhandsgranska produktionsbygget
npm run preview

# Kör tester
npm test

# Mät/demo av solvern (bygger och kör ett script)
sh scripts/run.sh scripts/demo.ts
```

## Deploy (GitHub Pages)

Varje push till `main` bygger, testar och publicerar appen automatiskt via GitHub Actions (`.github/workflows/deploy.yml`).

Live: https://vg1414.github.io/ofc-solver/
