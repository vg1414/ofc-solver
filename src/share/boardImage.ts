// ============================================================
// boardImage.ts — Ritar brädena som en PNG att dela
// ============================================================
//
// Ingen skärmdump av sidan, utan en egen ritning på en <canvas>:
//  - Överst appikonen (public/favicon.svg) + "OFC Solver".
//  - Brädena sida vid sida i grön filt, med namn, "FOUL" och
//    ev. intjänad royalty per rad (+4p).
//  - Valfritt "hand": korten som ska läggas, under brädena (dela ett
//    läge som pussel — utan svaret).
//  - Korten ritas som i appen: fyrfärgslek, valör uppe till vänster
//    (Barlow Condensed), färgsymbol nere till höger (samma SVG-banor
//    som SuitIcon), joker = gul stjärna.
// Alltid ljust tema, så bilden ser likadan ut för den som tar emot den.
// Ritas i 2× upplösning så att den blir skarp på telefoner.
// ============================================================

import type { Board, Card, RowName, Suit } from '../engine/types';
import { SUIT_PATHS } from '../components/cards/suitPaths';

export interface ShareBoard {
  name: string;
  board: Board;
  fouled?: boolean;
  royalties?: Record<RowName, number>;
  /** Kort från senaste draget (ritas med streckad ram) */
  recent?: { row: RowName; slot: number }[];
}

const SCALE = 2;
const PAD = 20;
const GAP = 14;
const LABEL_W = 46;
const CARD_W = 44;
const CARD_H = CARD_W * 1.4;
const CARD_GAP = 4;
const ROW_GAP = 6;
const PANEL_PAD = 12;
const HEADER_H = 58;

const SUIT_COLORS: Record<Suit | 'joker', { bg: string; fg: string; line: string }> = {
  spades: { bg: '#eceef1', fg: '#1d2127', line: '#c4c8cf' },
  hearts: { bg: '#fde6ea', fg: '#c81d39', line: '#f1b2bd' },
  diamonds: { bg: '#e0ebfd', fg: '#1a55c6', line: '#adc7f3' },
  clubs: { bg: '#def3e6', fg: '#13733b', line: '#a5d6b7' },
  joker: { bg: '#f0e7fc', fg: '#5b3a9e', line: '#ccb6ee' },
};

const ROWS: { name: RowName; label: string; n: number }[] = [
  { name: 'top', label: 'TOPPEN', n: 3 },
  { name: 'middle', label: 'MITTEN', n: 5 },
  { name: 'bottom', label: 'BOTTEN', n: 5 },
];

const PANEL_W = PANEL_PAD * 2 + LABEL_W + 5 * CARD_W + 4 * CARD_GAP;
const NAME_H = 24;
const PANEL_H = PANEL_PAD * 2 + NAME_H + 3 * CARD_H + 2 * ROW_GAP;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawSuit(ctx: CanvasRenderingContext2D, suit: Suit | 'star', x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(SUIT_PATHS[suit]));
  ctx.restore();
}

function drawCard(ctx: CanvasRenderingContext2D, card: Card, x: number, y: number) {
  const col = SUIT_COLORS[card.kind === 'joker' ? 'joker' : card.suit];
  roundRect(ctx, x, y, CARD_W, CARD_H, CARD_W * 0.14);
  ctx.fillStyle = col.bg;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = col.line;
  ctx.stroke();
  // Glans överst, som i appen
  const g = ctx.createLinearGradient(x, y, x + CARD_W * 0.4, y + CARD_H * 0.5);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  roundRect(ctx, x, y, CARD_W, CARD_H, CARD_W * 0.14);
  ctx.fill();

  if (card.kind === 'joker') {
    const s = CARD_W * 0.78;
    drawSuit(ctx, 'star', x + (CARD_W - s) / 2, y + CARD_H * 0.42 - s / 2, s, '#e2a812');
    ctx.fillStyle = col.fg;
    ctx.font = `700 ${CARD_W * 0.21}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('JOKER', x + CARD_W / 2, y + CARD_H - CARD_W * 0.1);
    return;
  }
  // Vattenstämpel
  ctx.globalAlpha = 0.12;
  const wm = CARD_W * 0.92;
  drawSuit(ctx, card.suit, x + (CARD_W - wm) / 2, y + (CARD_H - wm) / 2, wm, col.fg);
  ctx.globalAlpha = 1;
  // Valör
  const label = card.rank === 'T' ? '10' : card.rank;
  ctx.fillStyle = col.fg;
  ctx.font = `700 ${CARD_W * (label === '10' ? 0.74 : 0.86)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x + CARD_W * 0.08, y + CARD_W * 0.04);
  // Färgsymbol nere till höger
  const s = CARD_W * 0.46;
  drawSuit(ctx, card.suit, x + CARD_W - s - CARD_W * 0.08, y + CARD_H - s - CARD_W * 0.08, s, col.fg);
}

function drawPanel(ctx: CanvasRenderingContext2D, b: ShareBoard, x: number, y: number) {
  // Filten
  const g = ctx.createRadialGradient(x + PANEL_W / 2, y, 10, x + PANEL_W / 2, y, PANEL_H * 1.3);
  g.addColorStop(0, '#f6fcf8');
  g.addColorStop(0.55, '#e3f4ea');
  g.addColorStop(1, '#cfeadb');
  roundRect(ctx, x, y, PANEL_W, PANEL_H, 22);
  ctx.fillStyle = g;
  ctx.fill();
  if (b.fouled) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(200, 29, 57, 0.45)';
    ctx.stroke();
  }

  // Namn (+ FOUL)
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = '800 13px "Outfit", system-ui, sans-serif';
  ctx.fillStyle = '#0e6a4b';
  const name = b.name.toUpperCase();
  ctx.fillText(name, x + PANEL_PAD + 2, y + PANEL_PAD + NAME_H / 2 - 3);
  if (b.fouled) {
    const w = ctx.measureText(name).width;
    ctx.fillStyle = '#c81d39';
    ctx.fillText(' · FOUL', x + PANEL_PAD + 2 + w, y + PANEL_PAD + NAME_H / 2 - 3);
  }

  ROWS.forEach((r, i) => {
    const ry = y + PANEL_PAD + NAME_H + i * (CARD_H + ROW_GAP);
    ctx.font = '800 10px "Outfit", system-ui, sans-serif';
    ctx.fillStyle = '#0e6a4b';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(r.label, x + PANEL_PAD + 2, ry + CARD_H / 2 - (b.royalties?.[r.name] ? 7 : 0));
    const roy = b.royalties?.[r.name] ?? 0;
    if (roy > 0) {
      ctx.fillStyle = '#b07a0c';
      ctx.font = '800 11px "Outfit", system-ui, sans-serif';
      ctx.fillText(`+${roy}p`, x + PANEL_PAD + 2, ry + CARD_H / 2 + 8);
    }
    for (let k = 0; k < r.n; k++) {
      const cx = x + PANEL_PAD + LABEL_W + k * (CARD_W + CARD_GAP);
      const card = b.board[r.name].cards[k];
      if (card) {
        drawCard(ctx, card, cx, ry);
        if (b.recent?.some((x) => x.row === r.name && x.slot === k)) {
          ctx.save();
          ctx.setLineDash([4, 3]);
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#15936a';
          roundRect(ctx, cx + 1, ry + 1, CARD_W - 2, CARD_H - 2, CARD_W * 0.13);
          ctx.stroke();
          ctx.restore();
        }
      }
      else {
        roundRect(ctx, cx, ry, CARD_W, CARD_H, CARD_W * 0.14);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(17, 131, 93, 0.16)';
        ctx.stroke();
      }
    }
  });
}

let iconPromise: Promise<HTMLImageElement | null> | null = null;
function loadIcon(): Promise<HTMLImageElement | null> {
  iconPromise ??= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `${import.meta.env.BASE_URL}favicon.svg`;
  });
  return iconPromise;
}

export interface ShareHand {
  cards: Card[];
  /** T.ex. "Lägg 1 kort" eller "Lägg 2, kasta 1" */
  label: string;
}

const HAND_H = CARD_H + 38;

/** Rita brädena (1 eller 2), ev. med korten som ska läggas, som PNG */
export async function renderBoardsImage(boards: ShareBoard[], hand?: ShareHand): Promise<Blob> {
  await Promise.all(
    ['700 20px "Barlow Condensed"', '800 20px "Outfit"', '800 20px "Playfair Display"'].map((f) => document.fonts?.load(f).catch(() => null)),
  );
  const icon = await loadIcon();

  const w = PAD * 2 + boards.length * PANEL_W + (boards.length - 1) * GAP;
  const h = PAD + HEADER_H + PANEL_H + (hand ? GAP + HAND_H : 0) + PAD;
  const canvas = document.createElement('canvas');
  canvas.width = w * SCALE;
  canvas.height = h * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  // Bakgrund: krämvit som appen
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#fffaf2');
  bg.addColorStop(1, '#f4eee6');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Logga + namn
  const iconSize = 40;
  if (icon) ctx.drawImage(icon, PAD, PAD, iconSize, iconSize);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '800 25px "Playfair Display", Georgia, serif';
  ctx.fillStyle = '#0f7653';
  ctx.fillText('OFC Solver', PAD + (icon ? iconSize + 10 : 0), PAD + iconSize / 2 + 1);

  boards.forEach((b, i) => drawPanel(ctx, b, PAD + i * (PANEL_W + GAP), PAD + HEADER_H));

  if (hand) {
    const y = PAD + HEADER_H + PANEL_H + GAP;
    roundRect(ctx, PAD, y, w - PAD * 2, HAND_H, 22);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#eadfd2';
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '800 13px "Outfit", system-ui, sans-serif';
    ctx.fillStyle = '#b07a0c';
    ctx.fillText(`DIN TUR · ${hand.label.toUpperCase()}`, PAD + PANEL_PAD + 2, y + 18);
    hand.cards.forEach((c, i) => drawCard(ctx, c, PAD + PANEL_PAD + i * (CARD_W + CARD_GAP + 2), y + 30));
    ctx.textAlign = 'right';
    ctx.font = '600 12px "Outfit", system-ui, sans-serif';
    ctx.fillStyle = '#7a6f65';
    ctx.fillText('Hur lägger du?', w - PAD - PANEL_PAD, y + 30 + CARD_H / 2);
  }

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Bilden kunde inte skapas'))), 'image/png'));
}

/** Kan webbläsaren kopiera bilder till urklipp? */
export function canCopyImage(): boolean {
  return typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
}

export async function copyImage(blob: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
