# Changelog

## 2026-10-14 — Coachen räknar medan du funderar (Hel hand)

- **Coachen börjar räkna när din tur börjar**, så bedömningen oftast är klar direkt när du trycker Klar (uppmätt: 85 ms i stället för flera sekunder). Gäller även foul/FL-mätaren utan coach
- Sållades ditt drag bort i förberäkningen räknas bara ditt drag och bästa draget om, på samma blandningar (nytt solveralternativ `pinnedOnly`). Det tar några sekunder i stället för upp till 10 och ger exakt samma siffror som en hel omräkning

## 2026-10-14 — Jämför två läggningar i Solver

- **Vanlig hand:** när ett helt drag ligger på brädet (öppningen, ett kort, eller Pineapple: två kort + kortet som kastas kvar i handen) dyker "⇄ Jämför mot…" upp. B börjar som en kopia av A. Flytta kort och tryck "Jämför A och B"
- **Fantasy Land:** när handen är full finns "⇄ Lägg själv och jämför". Lägg A på ett bräde, sedan B
- Båda läggningarna räknas lika noga på samma blandningar (låsta drag), och solverns bästa räknas fram samtidigt som referens. Resultatet visar A, B och ★ bästa sida vid sida (litet bräde, EV, foul, FL), vem som vinner och om skillnaden är säker eller ryms i felmarginalen (2 standardfel). Fantasy Land räknas exakt
- Välj sedan Behåll A / B / ★ (FL: Lägg ut). Rutan som är vald från början är vinnaren
- Solvern: Fantasy Land tar emot låsta uppställningar (`evaluateFLAssign` i `core/fl.ts`), och varje finalist får `evDiffSEPin0` = felmarginalen mot det första låsta draget

## 2026-10-14 — Solver: varje läge minns sin hand

- Byter man mellan Vanlig hand och Fantasy Land försvinner inte längre de valda korten. Varje läge har sin egen hand, och den ligger kvar när man byter tillbaka (`_handByMode` i `gameStore`)

## 2026-10-14 — Båda brädena syns hela tiden på telefonen

- **Hel hand och Spela:** båda brädena och panelen får plats på skärmen utan att man scrollar. Korten krymps lagom (motståndarens lite mindre än dina) utifrån skärmens höjd (`useFitBoards`)
- **Panelen är en rad** när du har 1–3 kort: kortet, ett kort tips, ↶ (Ångra) och Klar
- Handraden (+10 −8 …) visas bara på bred skärm under spelet. Den finns kvar under Poäng
- Rubrikraden (hand, klocka, poäng) är tunnare. Gäller även Scenarion
- Spela: den stora "Spelare X:s tur"-skylten visas bara på bred skärm. På telefon står turen i panelen, och skärmkanten lyser i spelarens färg
- Dold öppning / FL-ruta är lika hög som brädet, så att inget hoppar när brädet visas
- **Fix:** panelen letades upp med en global sökning och kunde hitta en dold fliks panel. Det gjorde att brädet ibland inte scrollades upp ovanför panelen. Nu används alltid panelen i samma vy (`dockFor`)

## 2026-10-14 — Jokern lila igen, men tydligare

- Regnbågen är borta. Jokern har en tydligare lila toning (ljust lila uppe till vänster → mer mättat nere till höger), mörkare lila text och en lila kant. Samma på dela-bilden och i mörkt läge

## 2026-10-14 — Foul/FL i coachens bricka

- **Hel hand:** coachens bricka efter varje drag visar nu Foul % och FL % för ditt drag ("Du · Foul 44 % · FL 4 %") och för bästa draget i den gula delen. Fantasy Land-drag har inga sådana siffror

## 2026-10-14 — Regnbågsjokrar + guldglöden på rätt plats

- **Jokrarna har regnbågens färger:** bakgrunden är en pastellregnbåge (röd → violett) som skimrar långsamt i sidled. Gäller korten i appen, jokerknappen och dela-bilden (där står regnbågen stilla). Mörkt läge har lite nedtonade färger. "Minska rörelse" stänger av skimret
- **Guldglöden kring ett ensamt kort låg snett:** den satt på knappen runt kortet, men kortet är lyft (lite högre och större). Nu sitter glöden på själva kortet

## 2026-10-14 — Scenarion bedöms i förväg + foul/FL för båda dragen

- **Scenarion bedöms redan i kön:** varje scenario räknas på Noggrann medan det väntar, så bedömningen är klar så fort du låst ditt drag. Är kön tom spelas ett scenario fram först (ingen längre väntan än förut). Tar du ett scenario mitt i bedömningen räknas det som förut
- **Foul % och FL % visas alltid** under både "Ditt drag" och "★ Bästa draget" (Scenarion, coachens ark och sparade drag). Foul ≥ 25 % är röd

## 2026-10-14 — Nytt kort syns tydligt + panelen täcker inte bottenraden

- **Nytt kort flyger in:** när du får ett enda kort att lägga (Hel hand, Spela, Scenarion/Joker) visas det först stort mitt på skärmen och flyger sedan ner i handen. Där glöder det svagt i guld tills det är lagt. Öppning och Pineapple som förut. "Minska rörelse" hoppar över animationen
- **Panelen täckte ibland bottenraden:** panelen kan växa efter att turen börjat (coachens bricka, längre tips). Nu scrollas brädet upp igen varje gång panelen växer

## 2026-10-14 — Mindre slumpbrus i solvern

- **Samma läge ger alltid samma svar.** Den simulerade spelarens provframtider startas om för varje simulering, så alla drag som jämförs får exakt samma slump (tidigare fortsatte slumpen mellan körningar)
- **Okänd motståndare:** varje färdigt bräde jämförs mot 64 pool-händer i stället för 1. Det tar ingen märkbar extra tid
- Mätt med nya `scripts/variance.ts`: standardfelet för EV-skillnaden mellan dragen blev 2–8 % lägre i vanliga lägen och upp till 28 % lägre när två drag är nästan likadana

## 2026-10-14 — Dold öppning mot datorn, datorn hänger sig inte, bästa draget = högst EV

- **Hel hand:** datorns öppning är dold under runda 1 (husregeln, som i Spela) och visas först när du lagt din. Datorn och coachen räknar inte heller med en öppning man inte får se
- **Datorn kunde hänga sig** ("Datorn tänker" för evigt) när solvern blev klar väldigt snabbt. Varje körning har nu ett eget id, så svaret kan aldrig missas
- **Solverns bästa drag är alltid finalisten med högst EV.** Tidigare kunde ett drag med högre EV (t.ex. ditt) hamna efter när tiden tog slut, eftersom draget med flest spel valdes. Nu räknas finalisterna turvis så att de har lika många spel

## 2026-10-13 — Dela i Solver + öppningshanden markerad

- **Dela-knapp i Solver-fliken:** med ett förslag delas förslaget inlagt på brädet (streckade kort) + "Solverns förslag · EV · FL · Foul" (FL i lila, Foul i rött) och ev. kastade kort. Utan förslag delas läget + korten att lägga, som ett pussel
- **Öppningshanden har en fast mörk ram** hela handen (Hel hand, Spela och dela-bilden), så att man alltid ser vad som var starthanden. Öppningen streckas inte längre som "senaste drag" (inte heller i "Ditt drag" eller Solverns förslag). Ramen följer med när man tittar tillbaka: arket för äldre drag (listan "Dina drag"), ställningen och sammanfattningen (minibräden per hand) och sparade drag från Hel hand
- Dela-bildens textrad krymper så att den får plats även när bilden bara har ett bräde

## 2026-10-13 — Senaste korten streckade + Toppen / Mitten / Botten

- **Senaste dragets kort har streckad ram** på brädet: datorns senaste kort i Hel hand, dina egna medan du väntar på datorn och när handen är klar, och motståndarens i Spela (när brädet syns). Samma markering på dela-bilden. Fantasy Land-drag markeras inte
- Raderna heter nu **Toppen / Mitten / Botten** överallt (bräden, Solver, handresultat, "Varför?", dela-bilden), så att alla tre står i samma form. T / M / B i listorna är kvar

## 2026-10-13 — Ditt drag visas streckat

- I alla ark med "Ditt drag / Bästa draget" (coachen, efter scenario, sammanfattningen, Sparade drag) visas korten från ditt drag streckade, som bästa draget, så att man ser vilka kort som lades just då

## 2026-10-13 — Dela brädena som bild

- **Dela-knapp** (fyrkant med pil upp) i hörnet av ditt bräde i Hel hand, Spela och Scenarion. Ritar båda brädena som en bild med loggan, FOUL och intjänad royalty per rad
- Arket visar bilden först och kopierar till urklipp först när man trycker **Kopiera bild** (så att man inte skriver över urklipp av misstag). Webbläsare som inte kan kopiera bilder får **Spara bild**
- **Sparade drag → Dela läget:** läget före draget + korten att lägga ("Hur lägger du?"), utan svaret, så att någon annan kan lösa samma problem
- Spela delar bara motståndarens bräde om det syns (dold öppning / Fantasy Land avslöjas inte)

## 2026-10-13 — Träna: draglista, förklaring och sparade drag

- **Draglista "Dina drag"** i Hel hand, Scenarion och ★ Joker: alla drag i sessionen med betyg, korten du la (T/M/B) och EV-förlust, grupperade per hand med senaste överst. Tryck på ett drag för brädet med bästa draget och "Räkna om noggrant". På bred skärm i högerkolumnen, på telefon under brädena
- **"Varför?"** (regelbaserad, ingen AI): vilka kort som ligger olika mot bästa draget, foul-risk och FL-chans för båda dragen och en slutsats (t.ex. "offrar lite FL-chans för att minska risken att foula"). Visas i coach-arket, efter varje scenario och i scenariosammanfattningen
- Coachbrickan i Hel hand ligger kvar tills nästa drag i stället för att försvinna efter några sekunder
- **☆ Spara drag för analys** i alla lägen (Hel hand även utan coach, Scenarion, Joker och Spela). Sparade drag finns under **Sparade drag** på Träna-startsidan; saknas bedömning räknar solvern fram den på Noggrann (2000 sim, ditt drag låst). Sparas på enheten (localStorage)
- Spela: draglista utan betyg för den som har turen, så att drag kan stjärnmärkas
- **Sparade drag räknas direkt i bakgrunden** på Noggrann nivå (egen worker, oavsett flik), så analysen ligger färdig när du öppnar den. Drag som inte hann räknas tas nästa gång appen öppnas

## 2026-10-13 — FL-värde omräknat med royalty-regeln

- `FL_VALUE` omräknat med husregeln att royalty bara går till radens vinnare (1000 händer per kortantal, 3 varv): 13 kort 19,5 → 19,7 p, 14 kort 25,9 → 26,3 p, 15 kort 33,3 → 33,8 p, 16 kort 41,4 → 42,2 p. Nästan oförändrat, eftersom en FL-hand vinner de flesta rader och då ändå får sina royalties

## 2026-10-13 — Dra lagda kort + sortera Fantasy Land-handen

- **Dra ett lagt kort:** till en ledig plats = flytta, på ett annat eget kort = byt plats, utanför brädet (eller till handen) = ta bort. Släpps det på brädet mellan raderna händer ingenting. Gäller Solver, Träna och Spela (där bara kort från det aktuella draget). Två tryck för att ta bort finns kvar
- Kortet blir rött med ✕ medan det hålls utanför brädet, så att man ser att det tas bort vid släpp
- **Sortera i Fantasy Land:** knapparna Färg / Värde under handen (Hel hand, Spela och Solver → Fantasy Land). Färg = ♠ ♥ ♣ ♦, högst först; Värde = A → 2; jokrar först. Tryck igen för att gå tillbaka till utdelad ordning. Varje ny hand börjar osorterad

## 2026-10-13 — Husregel: royalty bara till den som vinner raden

- Den som förlorar en rad får ingen royalty för den (t.ex. en färg i botten som förlorar mot fyrtal ger 0 p). Lika rad ger ingen royalty. Vid foul vinner motståndaren alla rader och får alla sina royalties som förut
- Gäller överallt: poängen i Spela och Hel hand (`engine/scoring.ts`) och solverns EV, datorns spel och FL-lösaren (`core/eval.ts`, `core/fl.ts`)
- När handen är klar visar brädena bara den royalty som tjänades in per rad
- FL-värdet räknas om med den nya regeln (kommer i en egen uppdatering)

## 2026-10-13 — Spela: tillbaka till "visa mina kort" vid Fantasy Land

- Nedräkningen före Fantasy Land är borttagen. FL-spelaren trycker själv "Jag är Anna — visa mina kort" i panelen, som tidigare

## 2026-10-13 — Test: Fantasy Land dolt tills båda lagt klart

- Nytt test som låser regeln att ett FL-bräde är dolt för motståndaren tills båda spelarna lagt klart sina händer (oavsett vem som börjar). Regeln gäller redan i Spela och Hel hand mot datorn

## 2026-10-13 — Ny flik: Spela (2 spelare)

- **2 spelare på samma telefon** i en ny tredje flik "Spela": namn, variant, längd och FL-regel. Turbanner och skärmkant i spelarens färg (grön/blå), eget bräde alltid nederst, "Klar – ge till …"
- Motståndarens öppningshand är dold tills båda lagt sin, kastade kort visas aldrig och Fantasy Land-brädet döljs tills handen är klar (med "visa mina kort"-skärm för FL-spelaren)
- Partiet sparas efter varje drag och kan fortsättas från startsidan. Slutresultat med vinnare och handlista
- Ny spelmotor `src/match/` (actions + kontroll av drag + vy per spelare), förberedd för online-spel. Handens logik (`startHand`/`played`) flyttad från HandRun till `training/game.ts` och delas av båda lägena
- Toppraden kunde skjutas åt sidan på smala skärmar (glöden var bredare än raden) — rättat

## 2026-10-13 — Hel hand slutar som standard även vid FL

- Standardvalet för "Fantasy Land i slutet" är nu **Får sluta i FL**, och det alternativet står först i inställningsarket. "Spelas ut" går fortfarande att välja
- Tidigare sparade val nollställs en gång till den nya standarden, eftersom det gamla standardvalet sparades automatiskt

## 2026-10-13 — Jokern räknas rätt vid handens slut

- **Fel foul med joker:** poängräkningen valde jokern för varje rad för sig (t.ex. ★74 i topp blev 77), så brädet kunde räknas som foul fast jokern kunde ha hållit det giltigt (★ = A → A74). Nu väljs jokrarna för hela brädet med samma regel som solvern (`src/engine/resolveJokers.ts`) innan raderna jämförs
- **Fel Fantasy Land med joker:** FL-kollen läste också toppen för sig, så Q★6 gav QQ och FL. Nu används jokern som husregeln valde (här K → KQ6, ingen FL). Gäller både Hel hand och Solver-fliken
- Royalties per rad på brädet ("Topp +2p") räknas på samma sätt när brädet är fullt

## 2026-10-13 — Säkrare Fantasy Land-värden

- `FL_VALUE` (`src/core/flValue.ts`) omräknat med 1000 händer per kortantal i stället för 60: 13 kort 19 → 19,5 p, 14 kort 28 → 25,9 p, 15 kort 35 → 33,3 p, 16 kort 41 → 41,4 p. Värdet inkluderar upprepade repeat-FL (geometrisk serie). Repeat-chans: 30 % / 41 % / 52 % / 67 %. Påverkar både solvern, FL-lösaren och träningens bedömning
- README och CLAUDE.md beskriver hur FL-värdet räknas (inkl. upprepade repeat) och hur det räknas om

## 2026-10-12 — Hel hand: välj datorns styrka, räkna om coachen noggrant

- **Datorns styrka** i Hel hand-inställningarna: Snabb (300 sim, ≤ 3 s), Normal (800 sim, ≤ 3 s) eller Noggrann (2000 sim, ≤ 10 s per drag). Tidigare spelade datorn alltid Normal, och nivåvalet uppe till höger påverkar fortfarande bara Solver-fliken
- **"Räkna om noggrant"** i coach-arket: räknar om just det draget på Noggrann nivå (2000 sim) med ditt drag låst och ersätter bedömningen. Coachen räknar annars på Normal som förut

## 2026-10-12 — Coachen i Hel hand räknar ditt drag lika noga som solverns

- Ditt drag låses nu i solvern (`pinned`) när coachen och foul/FL-mätaren räknar. Tidigare kunde ditt drag sållas bort tidigt med få simuleringar och då få en slumpmässigt för hög EV, så att "Ditt drag" visades som bättre än "Bästa draget"
- Får ditt drag ändå lite högre EV (slumpbrus) heter alternativet "Solverns val" i stället för "Bästa draget", med en notis om att dragen är lika bra

## 2026-10-12 — Hel hand: foul/FL-mätare även för datorn

- Bredvid "Datorn" visas nu foul-risk och FL-chans efter varje datordrag, samma mätare som för dig. Siffrorna kommer direkt från solverns beräkning av datorns valda drag, så det kostar ingen extra räkning. Döljs när datorn spelar Fantasy Land (brädet är dolt) och när brädet är fullt

## 2026-10-12 — Hel hand: sessioner, ställning, bättre coach och foul/FL-mätare

- **Sessioner** (`src/training/session.ts`): välj längd som antal händer (5/10/20 eller eget 1–99), minuter (10/20/30 eller eget 5–180) eller fritt spel. I tidsläget räknas klockan ner i toppraden och står still när appen inte syns. Handen som pågår spelas alltid klart
- **Fantasy Land i slutet:** "Spelas ut" (FL och repeat-FL spelas klart först, som vid bordet, lila "★ FL spelas ut") eller "Får sluta i FL"
- **Inställningar** bakom kugghjulet på startsidan för Hel hand (bottenark med längd, FL-regel och coach-läge)
- **Ställning under sessionen:** varje hands poäng står som små brickor under poängraden. Tryck på poängen (eller "Ställning") för ett ark med Du mot Datorn, vinster och alla händer med poäng och löpande total. Tryck på en hand för att se båda slutbrädena
- **Coachen visar bästa draget:** brickan visar solverns kort per rad direkt, och ett tryck öppnar ett ark där man växlar mellan "Ditt drag" och "Bästa draget" på brädet. Efter handen finns en prick per drag att trycka på
- **Foul-risk och FL-chans** bredvid "Du" efter varje drag (räknas även utan coach, då på Snabb-nivå)
- ✕ under en session frågar: visa resultat, fortsätt eller avsluta utan resultat. Topplistan gäller bara fullständiga sessioner med antal händer. Slutresultatet visar speltid och poäng per hand

## 2026-10-12 — Datorn i Hel hand spelar på Normal-nivå

- `CPU_OPTIONS` (`src/training/game.ts`): 800 sim, max 3 s per drag (tidigare 300 sim). Samma nivå som scenariogeneratorn, där mätningen visade ungefär en femtedel så stora misstag. Varje datordrag tar nu 1–3 s

## 2026-10-12 — Scenariokö, bättre spelad dator och Perfekt = 100 p

- **Scenariokö** (`src/training/useScenarioPool.ts`): 3 scenarion hålls redo per variant och läge. Kön fylls redan på startsidan (prickar visar hur många som är redo), så första scenariot visas direkt. Överblivna scenarion sparas till nästa omgång, och kön pausas när Solver-fliken visas
- **Datorn spelar fram scenarion bättre:** generatorn kör nu Normal-nivå (800 sim, max 3 s per drag) i stället för 300 sim / 1,2 s. Mätt mot noggrann omräkning med låst drag sjönk snittförlusten från 1,21 till 0,24 EV på öppningar och från 0,28 till 0,07 EV på enkortsdrag
- **Perfekt ger alltid 100 p** (tidigare t.ex. 99 p vid 0,01 EV). Texten säger "Lika bra som bästa draget (inom felmarginalen)" när draget skiljer sig från solverns
- Motståndarens minibräde flödar inte längre över i smal liggande layout

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
