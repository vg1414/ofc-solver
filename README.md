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
- **Splash vid start:** korten delas ut och vänds till en hand, virvlar runt som solverns simuleringar och slår ihop till appikonen med ett fjädrande klick. Ett tryck hoppar över
- **Egen appikon** (grönt kort med vit spader). Appen kan läggas till på hemskärmen och öppnas då i helskärm som "OFC"

## Träna

- **Scenarion (poängjakt):** riktiga lägen som datorn spelar fram. Lägg dina kort; solvern (Noggrann) bedömer draget. Sållades ditt drag bort tidigt räknas det om, lika noga som bästa draget och på samma kortlekar, så att poängen blir rättvis. Max 100 p per scenario (100 − EV-förlust × 100), gradering Perfekt / Bra / Miss och en sammanfattning med sämsta beslutet
- **★ Joker:** samma poängjakt, men varje scenario har minst en joker i handen (ibland båda) — öva på var jokern gör mest nytta
- **Hel hand mot datorn:** spela sessioner med husreglerna, inklusive Fantasy Land. Längd: antal händer, minuter eller fritt spel. Välj om FL måste spelas ut i slutet. Ställningen och varje hands poäng syns under spelet, och foul-risk och FL-chans visas efter varje drag, både för dig och datorn. Datorns styrka går att välja (Snabb/Normal/Noggrann). Valfritt coach-läge visar EV-förlusten och bästa draget, och ett drag kan räknas om noggrant
- **Topplistor** sparas lokalt i webbläsaren (topp 10 per läge, variant och antal)

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
3. **FL-värde:** vad Fantasy Land är värt i poäng (13 kort 19,5 · 14 kort 25,9 · 15 kort 33,3 · 16 kort 41,4). Uträknat med `scripts/computeFlValue.ts`, som löser 1000 slumpade FL-händer per kortantal exakt, och sparat i `src/core/flValue.ts`. Chansen att stanna kvar i FL räknas in, även flera repeat i rad: värde = snittvinst ÷ (1 − repeat-chans). Räkna om med `sh scripts/run.sh scripts/computeFlValue.ts 1000` (tar ca 2 timmar).
4. **Låsta drag (`options.pinned`):** ett eller flera kompletta drag kan låsas. De sållas aldrig bort och räknas lika noga som bästa draget, på samma blandade kortlekar. Varje svar har `finalist` (räknat till slutet) och, för finalister, `evDiffSE` (standardfelet för EV-skillnaden mot bästa draget, räknat parvis).

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
