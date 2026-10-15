// ============================================================
// photoRead.ts — Krymper fotot och skickar det till foto-Workern
// ============================================================
// Workern (worker/photo-worker.js) svarar med en rad JSON i taget:
//   {"stage":"reading"} → {"stage":"checking"} → {"result":{…}} eller {"error":"…"}
// så att arket kan visa vad som händer medan den noggrannare modellen tänker.
// ============================================================

import type { PhotoAnswer } from './photoLayout';

const PHOTO_URL = (import.meta.env.VITE_PHOTO_URL as string | undefined) ?? 'https://ofc-photo.davhef.workers.dev';
const MAX_SIDE = 1600; // testat: räcker för att läsa korthörnen, ≈ 300 kB

export type PhotoStage = 'reading' | 'checking';

/** Krymper bilden till max 1600 px och gör om den till JPEG (base64 utan "data:"-början) */
export async function shrinkPhoto(file: Blob): Promise<string> {
  // createImageBitmap vänder bilden rätt efter kamerans EXIF-läge
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const url = canvas.toDataURL('image/jpeg', 0.85);
  return url.slice(url.indexOf(',') + 1);
}

/** Skickar bilden och väntar på svaret. `onStage` anropas när Workern byter steg. */
export async function readPhoto(base64: string, onStage: (s: PhotoStage) => void, signal?: AbortSignal): Promise<PhotoAnswer> {
  let res: Response;
  try {
    res = await fetch(`${PHOTO_URL}/read`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: base64, signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error('Kunde inte nå tjänsten. Kolla nätet och försök igen.');
  }
  if (!res.ok || !res.body) {
    const msg = await res.json().then((j) => j.error as string).catch(() => '');
    throw new Error(msg || `Tjänsten svarade med fel (${res.status}).`);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    buf += dec.decode(value ?? new Uint8Array(), { stream: !done });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.stage) onStage(msg.stage);
      if (msg.result) return msg.result as PhotoAnswer;
      if (msg.error) throw new Error(friendly(msg.error));
    }
    if (done) throw new Error('Svaret bröts av. Försök igen.');
  }
}

function friendly(err: string): string {
  if (/dagskvoten/.test(err)) return 'Dagens gratisförbrukning är slut. Den fylls på kl 09 – fyll i för hand så länge.';
  if (/överbelastad/.test(err)) return 'Googles tjänst är överbelastad just nu. Försök igen om en stund.';
  return `Kunde inte läsa korten (${err}). Försök igen.`;
}
