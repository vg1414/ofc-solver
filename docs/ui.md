# UI-detaljer: bräden, kort, dela-bild, splash

Läs detta innan du ändrar i `src/components/board/`, `cards/`, `dnd/`, `share/`, `ui/`, `src/splash/` eller i hur kort läggs och visas.

## Lägga kort

`useMoveBuilder.ts` hanterar placeringen: tryck/dra, ångra, bara kort från aktuellt drag kan tas bort, och ett ensamt kort är redan lyft.

## Dela som bild

- `share/boardImage.ts` ritar brädena (+ ev. korten att lägga) på en canvas med loggan, alltid ljust tema, 2× upplösning. Färgsymbolerna kommer från `cards/suitPaths.ts` (delas med `SuitIcon`).
- `components/share/ShareBoards.tsx` = knappen i brädets hörn + arket (förhandsvisning, "Kopiera bild" först efter tryck, annars "Spara bild").
- Används i HandRun, DuelRun, ScenarioRun, Solver-fliken (`SolverView` shareBoards/shareHand) och i Sparade drag ("Dela läget", via `MoveReviewSheet action`).
- Obs: förhandsvisningen i Claude-appen har eget urklipp — testa kopiering i Chrome.

## Senaste dragets kort

`training/useRecentSlots.ts` jämför varje plats bräde före/efter (oföränderliga Board-objekt) → `BoardView recent` (röd streckad blinkande ram: `PlayingCard recent` ritar `.recent-ring` i index.css som eget lager, så att den inte krockar med snäpp-animationen; stilla vid prefers-reduced-motion) och `ShareBoard.recent`; öppningshanden → `opening` (fast mörk ram hela handen, streckas inte). FL-drag markeras inte. Används i HandRun och DuelRun. Radetiketter: Toppen / Mitten / Botten (T/M/B i kompakta listor).

## Båda brädena på skärmen (telefon)

- `training/useFitBoards.ts` sätter `--card-h-cap` på brädenas omslag i HandRun och DuelRun, så att båda brädena + panelen ryms. `PlayDock compact` = en rad med 1–3 kort.
- Panelen hittas med `dockFor(el)` (`DockLayout.tsx`), aldrig `document.querySelector('[data-dock]')`, eftersom dolda flikar också har en panel.

## Nytt kort

`PlayDock` + `cards/DealIn.tsx`: ett ensamt kort att lägga visas stort mitt på skärmen och flyger ner i handen (Web Animations, key = handen), sedan guldglöd (`.deal-glow` i `index.css`). `useRevealAboveDock` scrollar brädet ovanför panelen vid turstart och varje gång panelen växer.

## Jokern och ikonen

- **Jokern:** lila toning i `--joker-bg` (index.css), samma färger i `JOKER_BG` (`cardStyle.ts`) för dela-bilden. Ändra båda samtidigt.
- **Ikon:** grönt kort med vit spader på krämvit botten, lutat −8°. Källan är `public/favicon.svg`. PNG-ikonerna (`apple-touch-icon.png`, `icon-*.png`) och `manifest.webmanifest` ligger i `public/` och är renderade från den.

## Splash (`src/splash/`)

- Ca 5 s vid varje start, startas från `main.tsx` (`splash.ts` + `splash.css`).
- 13 kort delas ut på brädet och vänds (QQ glöder guld), virvlar i en ring med flimrande valörer, slår ihop med ett fjädrande klick medan färgsymboler (♠♥♦♣) sprutar ut, och det översta kortet växer till ikonen. Därefter delar ikonen ut nio små kort som snäpper fast över rubrikens bokstäver, vänds och löses upp, så att "OFC Solver" blir kvar som text.
- Bokstävernas lägen mäts på skärmen och mäts om när typsnitten har laddats. Allt räknas ut från tiden `t` i `render(t)` (tidslinjen `T`).
- Ett tryck hoppar över, "minska rörelse" visar slutbilden och tempot styrs av `--splash-k`.
- Testsida: `/splash-demo.html` i dev, med spela igen, tempo och stegning i tid.
- Korten vänds i 2D (scaleX), eftersom 3D + blur gör korten osynliga i Chrome.
