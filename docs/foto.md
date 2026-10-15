# Fota brädet

Läs detta innan du ändrar i `src/photo/`, `components/solver/PhotoSheet.tsx`, `worker/` eller fotoknappen i `SolverView`.

## Flöde

1. "📷 Fota brädet" (Solver-fliken, raden ovanför brädet) öppnar `PhotoSheet` för det bräde som visas.
2. Fotot krymps till max 1600 px JPEG i telefonen (`photoRead.shrinkPhoto`) och skickas som base64-text till Workern.
3. Workern svarar en rad JSON i taget (NDJSON): `reading` → ev. `checking` → `result`/`error`. Arket visar stegen och räknar sekunder.
4. "Stämmer det här?": raderna gissas av `photoLayout.guessRows`, osäkra kort får gul ring. Tryck ett kort = byt/ta bort, "+" = lägg till, chipsen flyttar raden (Toppen/Mitten/Botten/Att lägga). `problems()` stoppar omöjliga lägen (överfull rad, dubbletter, >2 jokrar, även mot det andra brädet).
5. Mitt bräde: "Fota motståndaren också" eller "Räkna bara på mitt bräde" (ny hand, korten läggs ut, ett löst kort lyfts som nästa kort). Fullt bräde + 1–3 lösa kort → "Lös Fantasy Land" (alla 14–16 kort till FL-läget). Motståndaren: hens bräde byts ut, mitt lyfta kort ligger kvar.

## Fotokonventionen (Davids)

Raderna på bordet = brädet uppifrån och ner. Ett kort som ligger för sig självt = kortet att lägga. Alla kort i en enda rad utan bräde = öppningshand. Två rader är tvetydiga: gissningen är topp+mitten om första raden har ≤ 3 kort, annars mitten+botten.

## Workern (`worker/photo-worker.js`, `ofc-photo.davhef.workers.dev`)

- Deploy: `cd worker && npx wrangler deploy`. Nyckeln: `npx wrangler secret put GEMINI_KEY` (Gemini-projekt "OFC Solver", gratisnivå, **ingen fakturering** – klicka aldrig "Set up billing").
- Lokalt: `npx wrangler dev` i `worker/` (läser `worker/.dev.vars`, gitignorerad) + `.env.local` med `VITE_PHOTO_URL=http://localhost:8787`. Utan `.env.local` använder appen den riktiga Workern.
- Modeller: `gemini-3.1-flash-lite` först (≈ 2 s, 500/dygn, `mediaResolution: HIGH` är avgörande). Regelbrott eller osäkra kort → `gemini-3.8-flash` (20/dygn) → `gemma-4-31b-it` (långsam, 1–3 min). Kort där modellerna inte är överens markeras osäkra. Svarar ingen reserv visas snabba svaret med en notis.
- Skydd: bara anrop från `vg1414.github.io` och localhost (403 annars), 40 foton/timme per IP (räknas i minnet, inte KV – KV har bara 1 000 skrivningar/dygn på kontot), max ≈ 2 MB.
- Processortid: bilden JSON-tolkas aldrig i Workern utan klistras in i Gemini-anropet som text.
- Kvoter delas med andra projekt: se `KVOTER.md` i Claude-mappen.

## Testa träffsäkerheten

`OFC/foto-test/` (utanför repot): 11 foton + facit (`score.py`). 2026-10-15 via Workern: 9/11 helt rätt, ≈ 1,5 s. Missarna var nästan helt dolda kort och ett ensamt kort ovanför raderna som lästes som en egen rad.

Testa i förhandsvisningen utan kamera: lägg en bild i `public/`, och sätt `input[type=file]` via `DataTransfer` i javascript_tool (ta bort bilden efteråt).
