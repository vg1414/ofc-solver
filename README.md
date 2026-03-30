# OFC Solver

En webbaserad solver för Open Face Chinese Poker (OFC) med stöd för hemspels-regler.

## Funktioner

- Stöd för vanlig OFC och Pineapple OFC
- Fantasy Land med variabelt antal kort (QQ=13, KK=14, AA=15, triss=16)
- 54 kort (52 vanliga + 2 jokrar som är helt vilda)
- 5-tal som handkategori (20p bottom / 40p middle) — möjligt med joker
- Monte Carlo-solver som räknar ut förväntat poängvärde (EV) per placering
- Poängräknare med historik per hand och session
- Bokföring för att logga sessioner (datum, motståndare, poäng, pengar)

## Specialregler (hemspel)

- **Jokrar:** Helt vilda, kan vara vilket kort som helst (även dubletter)
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

## Teknik

- React 18 + Vite
- TypeScript
- Zustand (state management, localStorage för bokföring)
- Tailwind CSS (styling)
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
```

## Deploy (Vercel)

Projektet är konfigurerat för Vercel med `vercel.json`. Pusha till GitHub och koppla repot till Vercel — bygget sker automatiskt.
