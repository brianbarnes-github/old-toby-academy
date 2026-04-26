// Vitest setup — runs before every test file.
// Node 18 has webcrypto under `node:crypto` but doesn't expose it as
// the global `crypto` object that browser/edge code expects. The
// production runtime (Astro on Netlify edge functions) DOES expose it.
// Polyfill so our tests can exercise the same code path.
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
  // @ts-expect-error — webcrypto is structurally compatible
  globalThis.crypto = webcrypto;
}
