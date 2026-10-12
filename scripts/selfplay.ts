// Mäter policyns kvalitet: foul-%, royalties, FL-% och hastighet
import { playFullHand, shuffled, rng, FULL_DECK } from '../src/core/sim';
const variant = (process.argv[2] as any) || 'regular';
const N = Number(process.argv[3] || 3000);
const rand = rng(1);
let foul = 0, roy = 0, fl = 0;
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const { s } = playFullHand(shuffled(FULL_DECK, rand), 0, variant);
  if (s.foul) foul++; else { roy += s.roy; if (((s.top >> 20) === 1 && ((s.top >> 16) & 15) >= 12) || (s.top >> 20) === 3) fl++; }
}
const ms = Date.now() - t0;
console.log(`${variant}: foul ${(100*foul/N).toFixed(1)}%  royalty/hand ${(roy/N).toFixed(2)}  FL ${(100*fl/N).toFixed(1)}%  ${(ms/N*1000).toFixed(0)}µs/hand`);
