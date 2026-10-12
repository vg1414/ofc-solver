// ============================================================
// splash.ts — "Från tusen framtider till ett drag"
// ============================================================
// Berättelsen på ca 5 sekunder:
//  1. Giv: 13 kort med gröna baksidor flyger i en båge ur leken till brädet (3/5/5).
//  2. Vändning: korten vänds i en diagonal våg och visar en riktig OFC-hand —
//     QQ i toppen (glöder guld = Fantasy Land), färg i mitten, fyrtal i botten.
//  3. Simulering: korten lyfter till en ring som snurrar allt fortare medan
//     valörerna flimrar (slumpade framtider).
//  4. Klick: korten vänds tillbaka, rusar in mot mitten och slår ihop till en
//     lek med ett fjädrande tvärstopp och en pulsring. Det översta kortet —
//     grönt med vit spader — växer och blir appikonen. Ett penndrag skriver
//     fram "OFC Solver". Budskapet: tusentals framtider blir ett svar.
//
// Allt ritas som vanliga DOM-element vars transform sätts varje bildruta
// (requestAnimationFrame) från en enda tidslinje render(t). Därför går det
// att hoppa till vilket ögonblick som helst, t.ex. slutläget vid "minska rörelse".
// Tempot läses från CSS-variabeln --splash-k så att JS och CSS följs åt.
// ============================================================

import './splash.css';

type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

// Samma symboler som SuitIcon.tsx (24 × 24-rutnät)
const SUIT_PATH: Record<Suit, string> = {
  hearts:
    'M12 21.3c-.3 0-.6-.1-.8-.3C6.6 17.1 2 13.4 2 8.6 2 5.5 4.4 3 7.4 3c1.9 0 3.6 1 4.6 2.6C13 4 14.7 3 16.6 3 19.6 3 22 5.5 22 8.6c0 4.8-4.6 8.5-9.2 12.4-.2.2-.5.3-.8.3z',
  diamonds: 'M12 1.8l8.2 10.2L12 22.2 3.8 12z',
  spades:
    'M12 1.8c-.3 0-.5.1-.7.3C7.2 6.2 2.6 9.6 2.6 14c0 2.8 2.1 4.8 4.7 4.8 1.5 0 2.8-.6 3.6-1.6-.3 1.6-1 3-2.2 4.3-.2.2 0 .5.2.5h6.2c.3 0 .4-.3.2-.5-1.2-1.3-1.9-2.7-2.2-4.3.8 1 2.1 1.6 3.6 1.6 2.6 0 4.7-2 4.7-4.8 0-4.4-4.6-7.8-8.7-11.9-.2-.2-.4-.3-.7-.3z',
  clubs:
    'M12 2.2a4.6 4.6 0 0 0-4.3 6.3A4.6 4.6 0 1 0 10.6 17c-.3 1.6-1 3-2.1 4.3-.2.2 0 .5.2.5h6.6c.3 0 .4-.3.2-.5-1.1-1.3-1.8-2.7-2.1-4.3a4.6 4.6 0 1 0 2.9-8.5A4.6 4.6 0 0 0 12 2.2z',
};
const SUIT_VAR: Record<Suit, string> = { spades: 'spade', hearts: 'heart', diamonds: 'diamond', clubs: 'club' };
const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Handen som visas: topp QQ (Fantasy Land), mitt ruterfärg, botten fyrtal nior.
// Rad för rad, vänster till höger.
const HAND: [string, Suit][] = [
  ['Q', 'hearts'], ['Q', 'clubs'], ['4', 'spades'],
  ['2', 'diamonds'], ['5', 'diamonds'], ['8', 'diamonds'], ['J', 'diamonds'], ['K', 'diamonds'],
  ['9', 'spades'], ['9', 'hearts'], ['9', 'diamonds'], ['9', 'clubs'], ['A', 'clubs'],
];

// Tidslinje i ms (gånger --splash-k)
export const T = {
  deal0: 120, dealGap: 46, dealDur: 520,   // given, ett kort i taget
  flip0: 1020, flipGap: 58, flipDur: 380,  // vändningen, diagonal våg
  glow0: 1620, glow1: 2250,                // QQ lyser guld
  swirl0: 2150, swirl1: 2650,              // brädet lyfter till en ring
  strobe0: 2380, strobe1: 2880,            // valörerna flimrar
  back0: 2820, backGap: 18, backDur: 260,  // korten vänds tillbaka
  conv0: 2950, click: 3380,                // ringen rusar ihop … klick!
  grow0: 3430, grow1: 3980,                // översta kortet blir ikonen
  write0: 3850, write1: 4550,              // penndraget skriver "OFC Solver"
  end: 5400,                               // börja tona ut
};

// --- Hjälpfunktioner ---
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutBack = (x: number) => {
  const c = 1.6;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};
// Fjäder efter ett tvärstopp: slår över och dämpas (samma som i Bokis)
const spring = (dt: number, amp: number) => (dt <= 0 ? 0 : amp * Math.sin(dt / 45) * Math.exp(-dt / 90));
// Litet deterministiskt "slumptal" så att varje bildruta inom samma tick ser likadan ut
const rnd = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

const svgIcon = (path: string, cls = '') =>
  `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${path}"/></svg>`;

function faceHTML(rank: string, suit: Suit) {
  const ten = rank === '10' ? ' style="font-size:.74em;letter-spacing:-.06em"' : '';
  return `${svgIcon(SUIT_PATH[suit], 'sp-mark')}<span class="sp-rank"${ten}>${rank}</span>${svgIcon(SUIT_PATH[suit], 'sp-suit')}`;
}
function setSuitVars(el: HTMLElement, suit: Suit) {
  const k = SUIT_VAR[suit];
  el.style.setProperty('--bg', `var(--${k}-bg)`);
  el.style.setProperty('--fg', `var(--${k}-fg)`);
  el.style.setProperty('--line', `var(--${k}-line)`);
}

export interface SplashOptions {
  /** Hoppa direkt till slutläget (används vid "minska rörelse") */
  reduceMotion?: boolean;
  /** Anropas när splashen har tonat ut */
  onDone?: () => void;
  /** Ta inte bort elementet och tona inte ut av sig själv (demosidan) */
  demo?: boolean;
}

export function runSplash(splash: HTMLElement, opts: SplashOptions = {}) {
  const reduceMotion = opts.reduceMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  const K = parseFloat(getComputedStyle(splash).getPropertyValue('--splash-k')) || 1;

  // --- Bygg scenen ---
  splash.classList.remove('sp-out');
  splash.innerHTML = `
    <div class="sp-stage">
      <div class="sp-felt"></div>
      <div class="sp-ring"></div><div class="sp-ring"></div><div class="sp-ring sp-burst"></div>
      <div class="sp-hero">${svgIcon(SUIT_PATH.spades)}</div>
    </div>
    <div class="sp-text">
      <h1 class="sp-title">OFC <span>Solver</span></h1>
    </div>`;
  const stage = splash.querySelector<HTMLElement>('.sp-stage')!;
  const felt = splash.querySelector<HTMLElement>('.sp-felt')!;
  const rings = splash.querySelectorAll<HTMLElement>('.sp-ring');
  const hero = splash.querySelector<HTMLElement>('.sp-hero')!;
  const title = splash.querySelector<HTMLElement>('.sp-title')!;

  // Scenens storlek: ryms både på smal telefon och i liggande läge
  const S = Math.min(window.innerWidth * 0.92, 420, window.innerHeight * 0.58);
  const CW = S * 0.165;   // kortets bredd
  const HW = S * 0.4;     // ikonkortets bredd (se .sp-hero)
  stage.style.setProperty('--s', `${S}px`);
  stage.style.setProperty('--cw', `${CW}px`);

  // Brädets platser: 3 kort i toppen, 5 i mitten och botten (i px från mitten)
  const gap = S * 0.026;
  const rowY = [-1, 0, 1].map((r) => r * (CW * 1.4 + S * 0.04));
  const cards = HAND.map(([rank, suit], i) => {
    const row = i < 3 ? 0 : i < 8 ? 1 : 2;
    const col = i < 3 ? i : i < 8 ? i - 3 : i - 8;
    const n = row === 0 ? 3 : 5;
    const el = document.createElement('div');
    el.className = 'sp-card';
    el.innerHTML = `<div class="sp-inner"><div class="sp-face sp-front"></div><div class="sp-face sp-back">${svgIcon(SUIT_PATH.spades)}</div></div>`;
    const inner = el.firstElementChild as HTMLElement;
    const front = inner.firstElementChild as HTMLElement;
    front.innerHTML = faceHTML(rank, suit);
    setSuitVars(front, suit);
    stage.insertBefore(el, rings[0]);
    return {
      el, inner, front, rank, suit, row, col, shown: `${rank}${suit}`, faceUp: false,
      x: (col - (n - 1) / 2) * (CW + gap),
      y: rowY[row],
      deckTilt: (rnd(i + 1) - 0.5) * 14,
      stackTilt: (rnd(i + 40) - 0.5) * 10,   // lekens lite slarviga kanter efter klicket
    };
  });
  const deckY = S * 0.78;   // leken ligger nedanför brädet

  // Ringens vinkel: accelererar hela vägen fram till klicket (som Bokis-visarna)
  const spinE = (t: number) => Math.pow(seg(t, T.swirl0, T.click), 2.4);
  const SPIN = Math.PI * 2 * 2.2;

  // --- En bildruta: allt räknas ut från t (ms, redan delat med K) ---
  function render(t: number) {
    const dc = t - T.click; // tid sedan klicket

    // Filten tonar in under given och ut när korten lyfter
    const feltIn = easeOutCubic(seg(t, 0, 400)) * (1 - seg(t, T.swirl0, T.swirl0 + 400));
    felt.style.opacity = String(feltIn);
    felt.style.transform = `scale(${lerp(0.94, 1, feltIn)})`;

    const swirl = easeInOut(seg(t, T.swirl0, T.swirl1));
    const conv = Math.pow(seg(t, T.conv0, T.click), 2.2); // rusar in allt fortare
    const spin = SPIN * spinE(t);
    const speed = (SPIN * (spinE(t) - spinE(t - 16))) / 16; // radianer per ms
    const R = S * 0.37 * (1 - conv);
    const strobeTick = Math.floor(t / 85);
    const strobing = t > T.strobe0 && t < T.strobe1;
    const glow = Math.sin(Math.PI * seg(t, T.glow0, T.glow1));
    // Leken studsar till vid klicket och kanterna glider isär lite efteråt
    const thump = 1 - spring(dc, 0.09);
    const spread = easeOutCubic(seg(dc, 0, 500));
    const blur = Math.min(2.2, speed * 90) * (1 - conv * 0.5);

    cards.forEach((c, i) => {
      // 1. Giv, i en liten båge
      const deal = seg(t, T.deal0 + i * T.dealGap, T.deal0 + i * T.dealGap + T.dealDur);
      const d = easeOutBack(deal);
      const arc = Math.sin(Math.PI * deal) * S * 0.12;
      let x = lerp(0, c.x, d);
      let y = lerp(deckY - i * 0.6, c.y, d) - arc;
      let rot = lerp(c.deckTilt, 0, easeOutCubic(deal));
      let scale = lerp(0.92, 1, deal);

      // 2. Vändning (diagonal våg: rad + kolumn) och 4. tillbaka till baksidan
      const f0 = T.flip0 + (c.row + c.col) * T.flipGap;
      const flip = easeInOut(seg(t, f0, f0 + T.flipDur));
      const b0 = T.back0 + i * T.backGap;
      const back = easeInOut(seg(t, b0, b0 + T.backDur));
      const lift = 1 + 0.14 * Math.sin(Math.PI * flip);

      // 3. Ringen: varje kort får en plats runt cirkeln
      const ang = (i / cards.length) * Math.PI * 2 + spin - Math.PI / 2;
      x = lerp(x, Math.cos(ang) * R, swirl);
      y = lerp(y, Math.sin(ang) * R, swirl);
      // I ringen pekar korten utåt; på väg in vrids de till lekens vinkel
      const ringRot = (ang * 180) / Math.PI + 90;
      rot = lerp(rot, lerp(ringRot, Math.round(ringRot / 360) * 360 + c.stackTilt * spread, conv), swirl);
      scale *= lift * lerp(1, 0.82, swirl) * lerp(1, 1.06, conv);

      // Efter klicket: leken ligger under ikonen, glider isär lite och tonar bort
      if (dc > 0) {
        x += (rnd(i + 80) - 0.5) * S * 0.26 * spread;
        y += (rnd(i + 90) - 0.4) * S * 0.12 * spread;
        rot += c.stackTilt * 2.5 * spread;
        scale *= thump;
      }
      const fade = 1 - seg(dc, 250, 700);

      c.el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`;
      c.el.style.opacity = String(seg(t, 0, 120) * fade);
      c.el.style.zIndex = String(deal > 0 ? 20 + i : i);
      c.el.style.filter = blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : '';
      // Vändningen ritas i 2D: kortet smalnar av till en linje, byter sida och breddas igen
      const turn = Math.PI * (1 - flip + back); // π = baksidan upp, 0 (eller 2π) = framsidan upp
      c.inner.style.transform = `scaleX(${Math.max(0.001, Math.abs(Math.cos(turn))).toFixed(3)})`;
      const faceUp = Math.cos(turn) > 0;
      if (faceUp !== c.faceUp) {
        c.faceUp = faceUp;
        c.inner.classList.toggle('sp-up', faceUp);
      }

      // Fantasy Land: damerna i toppen glöder guld en stund
      if (c.rank === 'Q' && c.row === 0) {
        c.front.style.setProperty(
          '--glow-q',
          glow > 0.001
            ? `0 0 0 ${(2 * glow).toFixed(2)}px var(--gold-line), 0 0 ${(22 * glow).toFixed(1)}px ${(4 * glow).toFixed(1)}px rgba(248,194,84,${(0.7 * glow).toFixed(2)})`
            : '0 0 0 0 transparent',
        );
      }

      // Flimmer: slumpade framtider (byt bara innehåll när det faktiskt ändras)
      let rank = c.rank;
      let suit = c.suit;
      if (strobing) {
        rank = RANKS[Math.floor(rnd(strobeTick * 31 + i * 7) * 13)];
        suit = SUITS[Math.floor(rnd(strobeTick * 17 + i * 3) * 4)];
      }
      if (`${rank}${suit}` !== c.shown) {
        c.shown = `${rank}${suit}`;
        c.front.innerHTML = faceHTML(rank, suit);
        setSuitVars(c.front, suit);
      }
    });

    // Ikonkortet: syns från klicket som lekens översta kort (exakt samma storlek
    // och utseende som en kortbaksida) och växer sedan till appikonen
    const g = seg(t, T.grow0, T.grow1);
    const sc = lerp(CW / HW, 1, easeOutBack(g)) * thump;
    const tilt = lerp(0, -8, easeOutCubic(g)) + spring(t - T.grow1 + 120, 3);
    hero.style.opacity = dc >= 0 ? '1' : '0';
    hero.style.transform = `rotate(${tilt}deg) scale(${sc})`;
    hero.style.setProperty('--sheen', String(lerp(-1, 1, easeInOut(seg(t, T.grow1 - 100, T.grow1 + 600)))));
    hero.style.setProperty('--glow', String(easeOutCubic(g)));

    // Ringar: en kraftig vid klicket, sedan lugna pulser medan rubriken skrivs (som Bokis)
    const burst = seg(dc, 0, 750);
    rings[2].style.opacity = String(dc >= 0 && burst < 1 ? 0.9 * (1 - burst) : 0);
    rings[2].style.transform = `scale(${lerp(0.3, 1.25, easeOutCubic(burst))})`;
    [0, 1].forEach((k) => {
      const dd = dc - 650 - k * 900;
      const ph = dd >= 0 ? (dd % 1800) / 1800 : -1;
      rings[k].style.opacity = String(ph >= 0 ? 0.45 * (1 - ph) : 0);
      rings[k].style.transform = `scale(${lerp(0.75, 1.3, Math.max(0, ph))})`;
    });

    // Penndraget: ett lutande svep från vänster till höger avtäcker rubriken
    const w = seg(t, T.write0, T.write1);
    title.style.setProperty('--wipe', `${lerp(-25, 125, lerp(w, easeInOut(w), 0.5)).toFixed(1)}%`);
  }

  // --- Uppspelning och avslut ---
  let raf = 0;
  let t0 = performance.now();
  let hidden = false;
  function hide() {
    if (hidden || opts.demo) return;
    hidden = true;
    cancelAnimationFrame(raf);
    splash.classList.add('sp-out');
    setTimeout(() => {
      splash.remove();
      document.documentElement.classList.remove('splash-on');
      opts.onDone?.();
      document.dispatchEvent(new Event('splashdone'));
    }, 600 * K);
  }
  splash.onclick = hide; // ett tryck var som helst hoppar över

  const frame = (now: number) => {
    if (!splash.isConnected) return;
    const t = (now - t0) / K;
    render(t);
    if (t >= T.end) hide();
    if (!hidden) raf = requestAnimationFrame(frame);
  };

  if (reduceMotion) {
    // Bara slutläget: ikonen och rubriken, utan rörelse
    render(T.end - 1);
    setTimeout(hide, 1400);
  } else {
    raf = requestAnimationFrame(frame);
  }

  return {
    hide,
    /** Demo: frys på en viss tid */
    seek(t: number) {
      cancelAnimationFrame(raf);
      render(t);
    },
    /** Demo: spela från en viss tid */
    play(from = 0) {
      cancelAnimationFrame(raf);
      t0 = performance.now() - from * K;
      raf = requestAnimationFrame(frame);
    },
  };
}

// Starta direkt om sidan har ett #splash-element (index.html). Demosidan startar själv.
const el = document.getElementById('splash');
if (el && !el.dataset.demo) runSplash(el);
