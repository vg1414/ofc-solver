/**
 * ofc-photo – Cloudflare Worker som läser av ett fotat OFC-bräde med Gemini.
 *
 *   POST /read   body: JPEG-bilden som base64-text (Content-Type: text/plain)
 *     → svarar med NDJSON, en rad i taget medan arbetet pågår:
 *         {"stage":"reading"}                       snabb modell läser
 *         {"stage":"checking"}                      svaret dubbelkollas av noggrannare modell
 *         {"result":{rows,loose,uncertain,model}}   klart
 *         {"error":"..."}                           gick inte
 *
 * Gemini-nyckeln ligger som secret GEMINI_KEY (npx wrangler secret put GEMINI_KEY).
 * Gratisnivå utan fakturering: tom kvot = fel tills nästa dygn, aldrig en kostnad.
 *
 * Flöde: Flash Lite (≈4 s, 500/dygn) först. Bryter svaret mot reglerna (dubbla kort,
 * >5 kort i en rad, >2 jokrar …) eller har modellen osäkra kort, frågas nästa modell i
 * RESERV. Kort där modellerna inte är överens markeras som osäkra, så att appen kan
 * be användaren titta extra på just dem.
 *
 * Processortid: bilden JSON-tolkas aldrig här (den klistras in i anropet som text),
 * så Workern håller sig långt under gratisplanens 10 ms. Väntan på Gemini räknas inte.
 */

const ALLOWED_ORIGINS = ['https://vg1414.github.io', 'http://localhost', 'http://127.0.0.1'];
const FAST = { model: 'gemini-3.1-flash-lite', timeout: 30_000 };
const RESERV = [
  { model: 'gemini-3.8-flash', timeout: 75_000 },
  { model: 'gemma-4-31b-it', timeout: 100_000 },
];
const MAX_BASE64 = 3_000_000; // ≈ 2,2 MB bild – appen skickar ≈ 300 kB
// Enkel broms per IP och Worker-instans (räknas i minnet – KV har för få gratisskrivningar)
const PER_IP_PER_HOUR = 40;
const hits = new Map();

const PROMPT = `This photo shows one player's board in Open Face Chinese Poker, lying on a table.
Cards are arranged in up to three horizontal rows (top row max 3 cards, middle max 5, bottom max 5).
Cards within a row overlap; read each card from its corner index (rank + suit). Some cards may lie upside down: read the index the right way up (a 6 and a 9 are easy to mix up).
The deck has 2 jokers: a joker shows a black star in the corner (and a jester picture).
A single card lying apart from the rows (e.g. far to the right or left) is NOT part of the board - list it under "loose".
If all cards lie in one single row, that row is a hand still to be placed: list it as one row.
It can also be a Fantasy Land hand: 13-16 cards laid out freely, often in one or two long rows. Then rows may hold more than 5 cards - list every card in the row where it lies.

Return JSON only:
{"rows": [[...cards in the first row from the top of the photo, left to right...], [...next row...], ...],
 "loose": [...],
 "uncertain": [...cards you could not read with confidence...]}
Card format: rank (A K Q J T 9 8 7 6 5 4 3 2) + suit (s h d c), e.g. "Ts", "9h". Joker = "JK".
Only list rows that actually contain cards. Never invent cards you cannot see. Every card appears at most once (only the joker can appear twice). If a card is mostly hidden, still list your best guess and also put it in "uncertain".`;

function cors(origin) {
  const ok = ALLOWED_ORIGINS.some((o) => origin === o || (origin && origin.startsWith(o + ':')));
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

// ── Svaret från modellen ─────────────────────────────────────────────────────

function norm(c) {
  let s = String(c).trim().replace(/^10/, 'T');
  if (/^(jk|joker|x|★)$/i.test(s)) return 'JK';
  if (s.length !== 2) return null;
  s = s[0].toUpperCase() + s[1].toLowerCase();
  return /^[2-9TJQKA][shdc]$/.test(s) ? s : null;
}

/** Städar modellens svar och listar regelbrott. */
export function check(answer) {
  const problems = [];
  const clean = (list) => (Array.isArray(list) ? list : []).map((c) => {
    const n = norm(c);
    if (!n) problems.push(`okänt kort ${c}`);
    return n;
  }).filter(Boolean);
  const rows = (Array.isArray(answer?.rows) ? answer.rows : []).map(clean).filter((r) => r.length);
  const loose = clean(answer?.loose);
  const uncertain = clean(answer?.uncertain);
  const all = [...rows.flat(), ...loose];
  if (!all.length) problems.push('inga kort');
  // 13–16 kort = en Fantasy Land-hand som kan ligga hur som helst, så bara brädesformen kollas annars
  const fantasyLand = all.length >= 13 && all.length <= 16;
  if (all.length > 16) problems.push('fler än 16 kort');
  if (!fantasyLand) {
    if (rows.length > 3) problems.push('fler än 3 rader');
    if (rows.some((r) => r.length > 5)) problems.push('mer än 5 kort i en rad');
    if (rows.length === 3 && rows[0].length > 3) problems.push('mer än 3 kort i toppen');
  }
  if (all.filter((c) => c === 'JK').length > 2) problems.push('fler än 2 jokrar');
  const seen = new Set();
  for (const c of all) {
    if (c !== 'JK' && seen.has(c)) problems.push(`${c} finns två gånger`);
    seen.add(c);
  }
  return { rows, loose, uncertain, problems };
}

/** Kort som finns i det ena svaret men inte i det andra (räknat per rad). */
function disagreements(a, b) {
  const out = new Set();
  const n = Math.max(a.rows.length, b.rows.length);
  const diff = (x, y) => {
    const rest = [...y];
    for (const c of x) {
      const i = rest.indexOf(c);
      if (i >= 0) rest.splice(i, 1);
      else out.add(c);
    }
  };
  for (let i = 0; i < n; i++) diff(b.rows[i] ?? [], a.rows[i] ?? []);
  diff(b.loose, a.loose);
  return [...out];
}

// ── Gemini ──────────────────────────────────────────────────────────────────

async function ask(env, { model, timeout }, base64) {
  const gemma = model.startsWith('gemma');
  const config = gemma
    ? ''
    : ',"generationConfig":{"responseMimeType":"application/json","mediaResolution":"MEDIA_RESOLUTION_HIGH"}';
  // Bilden klistras in som text – JSON.stringify av 300 kB skulle kosta onödig processortid
  const body =
    '{"contents":[{"parts":[{"text":' + JSON.stringify(PROMPT) +
    '},{"inline_data":{"mime_type":"image/jpeg","data":"' + base64 + '"}}]}]' + config + '}';
  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY },
      body,
      signal: AbortSignal.timeout(timeout),
    });
  } catch (e) {
    return { fail: e?.name === 'TimeoutError' ? 'tog för lång tid' : 'nätverksfel' };
  }
  if (!res.ok) {
    const fail = res.status === 429 ? 'dagskvoten är slut' : res.status === 503 ? 'överbelastad' : `fel ${res.status}`;
    return { fail };
  }
  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { fail: 'oläsligt svar' };
  try {
    return { answer: check(JSON.parse(m[0])) };
  } catch {
    return { fail: 'oläsligt svar' };
  }
}

async function read(env, base64, send) {
  send({ stage: 'reading' });
  const fast = await ask(env, FAST, base64);
  const first = fast.answer;
  if (first && !first.problems.length && !first.uncertain.length) {
    return { ...first, model: FAST.model };
  }
  send({ stage: 'checking' });
  const failures = fast.fail ? [`${FAST.model}: ${fast.fail}`] : [];
  for (const r of RESERV) {
    const got = await ask(env, r, base64);
    if (got.fail) {
      failures.push(`${r.model}: ${got.fail}`);
      continue;
    }
    const a = got.answer;
    if (a.problems.length) {
      failures.push(`${r.model}: ${a.problems.join(', ')}`);
      continue;
    }
    // Där snabba och noggranna modellen inte är överens: be användaren titta extra
    const unsure = first ? disagreements(first, a) : [];
    return { ...a, uncertain: [...new Set([...a.uncertain, ...unsure])], model: r.model };
  }
  // Ingen reserv svarade – visa hellre snabba svaret med varningar än inget alls
  if (first) return { ...first, model: FAST.model, note: failures.join(' · ') };
  throw new Error(failures.join(' · ') || 'okänt fel');
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const h = cors(origin);
    if (request.method === 'OPTIONS') return new Response(null, { headers: h });
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/read') {
      return new Response('Not found', { status: 404, headers: h });
    }
    if (!ALLOWED_ORIGINS.some((o) => origin === o || origin.startsWith(o + ':'))) {
      return new Response('Forbidden', { status: 403, headers: h });
    }

    const ip = request.headers.get('CF-Connecting-IP') || '?';
    const hour = Math.floor(Date.now() / 3_600_000);
    const rec = hits.get(ip);
    const count = rec && rec.hour === hour ? rec.count + 1 : 1;
    hits.set(ip, { hour, count });
    if (count > PER_IP_PER_HOUR) {
      return Response.json({ error: 'För många foton den här timmen – försök igen senare.' }, { status: 429, headers: h });
    }

    const base64 = (await request.text()).trim();
    if (!base64 || base64.length > MAX_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(base64.slice(0, 200))) {
      return Response.json({ error: 'Bilden saknas eller är för stor.' }, { status: 400, headers: h });
    }

    // Svara direkt och skicka en rad i taget, så att appen kan visa vad som händer
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const enc = new TextEncoder();
    const send = (o) => writer.write(enc.encode(JSON.stringify(o) + '\n'));
    (async () => {
      try {
        send({ result: await read(env, base64, send) });
      } catch (e) {
        send({ error: String(e?.message || e) });
      } finally {
        writer.close();
      }
    })();
    return new Response(readable, {
      headers: { ...h, 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' },
    });
  },
};
