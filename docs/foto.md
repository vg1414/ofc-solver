# Fota brädet

Läs detta innan du ändrar i `src/photo/`, `components/solver/PhotoSheet.tsx`, `worker/` eller fotoknappen i `SolverView`.

## Flöde

1. "📷 Fota brädet" (Solver-fliken, raden ovanför brädet) öppnar `PhotoSheet` för det bräde som visas.
2. Fotot krymps till max 1600 px JPEG i telefonen (`photoRead.shrinkPhoto`) och skickas som base64-text till Workern. **Motståndarens foto vänds 180° först** (David fotar hens bräde från sin sida av bordet). "↻ Vänd och läs igen" läser samma fil åt andra hållet.
3. Workern svarar en rad JSON i taget (NDJSON): `reading` → ev. `checking` → `result`/`error`. Arket visar stegen, räknar sekunder och visar ett skämt som byts var 3:e sekund (`JOKES` i PhotoSheet).
4. "Stämmer det här?": raderna gissas av `photoLayout.guessRows`, osäkra kort får gul ring. Tryck ett kort = byt/ta bort, "+" = lägg till, chipsen flyttar raden (Toppen/Mitten/Botten/Att lägga). `problems()` stoppar omöjliga lägen (överfull rad, dubbletter, >2 jokrar, även mot det andra brädet).
5. Mitt bräde: "Fota motståndaren också" eller "Räkna bara på mitt bräde" (ny hand, korten läggs ut, ett löst kort lyfts som nästa kort). **Fantasy Land känns igen på antalet kort:** 14–16 kort, eller 13 utan löst kort, blir en FL-hand oavsett hur de ligger (en lång rad, två rader eller ett fullt bräde + lösa). Arket visar "Lös Fantasy Land (N kort)" och FL-läget får rätt antal (13–16) av sig självt. Mitt i en vanlig hand finns som mest 13 kort i Vanlig (12 + 1) och 14 i Pineapple (11 lagda + 3 lösa, som därför räknas som vanlig hand när de 11 ryms på brädet). Gissar den fel finns knappen "★ Det är Fantasy Land". Motståndaren: hens bräde byts ut, mitt lyfta kort ligger kvar. Efter "Ja – räkna…" startar solvern direkt (`autoRun` i SolverView; med motståndaren först när hens bräde är bekräftat). Arket får en ny `key` varje gång det öppnas, så det börjar alltid om från "Ta foto". Har läget ≤ 5 kort men ser ut som ett bräde finns knappen "Det är en starthand". Vid fel skickar "Försök igen" samma foto igen (korten är ofta redan blandade); "Ta ett nytt foto" går tillbaka till kameran.

## Fotokonventionen (Davids)

Raderna på bordet = brädet uppifrån och ner. Ett kort som ligger för sig självt = kortet att lägga. **Högst 5 kort totalt = öppningshand**, **fler än 13 kort (utom Pineapples 11 + 3) eller 13 utan löst kort = Fantasy Land**, hur raderna än ligger och även om ett kort ligger för sig självt (David lägger ofta öppningen i rader, t.ex. M: 8♠5♣, B: 7♦ joker 4♦, men vill ha bästa öppningen). Ett bräde mitt i handen har alltid ≥ 5 kort + kortet att lägga. Två rader i övrigt: topp+mitten om första raden har ≤ 3 kort, annars mitten+botten. Tre rader där bara den sista ryms i toppen (första > 3, sista ≤ 3) vänds.

**Upp och ner (testat 2026-10-16):** på 11 foton vända 180° läste Flash Lite raderna i fotots ordning (botten först) och gjorde fler läsfel (dubbletter). Att i prompten be modellen avgöra var ägaren sitter, eller åt vilket håll korten överlappar, gav samma svar för vända och ovända foton – modellen ser inte skillnad. Därför vänds bilden i telefonen i stället.

## Workern (`worker/photo-worker.js`, `ofc-photo.davhef.workers.dev`)

- Deploy: `cd worker && npx wrangler deploy`. Nyckeln: `npx wrangler secret put GEMINI_KEY` (Gemini-projekt "OFC Solver", gratisnivå, **ingen fakturering** – klicka aldrig "Set up billing").
- Lokalt: `npx wrangler dev` i `worker/` (läser `worker/.dev.vars`, gitignorerad) + `.env.local` med `VITE_PHOTO_URL=http://localhost:8787`. Utan `.env.local` använder appen den riktiga Workern.
- Modeller: `gemini-3.1-flash-lite` först (≈ 2 s, 500/dygn, `mediaResolution: HIGH` är avgörande). Regelbrott eller osäkra kort → `gemini-3.8-flash` (20/dygn) → `gemma-4-31b-it` (långsam, 1–3 min). Kort där modellerna inte är överens markeras osäkra. Svarar ingen reserv visas snabba svaret med en notis.
- Regelkollen (`check`) struntar i radformen (> 3 rader, > 5 i en rad) när det är 13–16 kort, så en utspridd FL-hand inte skickas vidare till de långsamma reservmodellerna. Prompten säger att FL-händer kan ligga i långa rader.
- Skydd: bara anrop från `vg1414.github.io` och localhost (403 annars), 40 foton/timme per IP (räknas i minnet, inte KV – KV har bara 1 000 skrivningar/dygn på kontot), max ≈ 2 MB.
- Processortid: bilden JSON-tolkas aldrig i Workern utan klistras in i Gemini-anropet som text.
- Kvoter delas med andra projekt: se `KVOTER.md` i Claude-mappen.

## Testa träffsäkerheten

`OFC/foto-test/` (utanför repot): 11 foton + facit (`score.py`, facit finns även för nr 12–17 som inte är sparade än). `python forbered.py` gör `jpg/`, `rot180/` och `rot90/` av nya bilder i `original/`. 2026-10-15 via Workern: 9/11 helt rätt, ≈ 1,5 s. Missarna var nästan helt dolda kort och ett ensamt kort ovanför raderna som lästes som en egen rad.

Testa i förhandsvisningen utan kamera: lägg en bild i `public/`, och sätt `input[type=file]` via `DataTransfer` i javascript_tool (ta bort bilden efteråt).
