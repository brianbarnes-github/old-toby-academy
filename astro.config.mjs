import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

// Hybrid mode: pages are static by default; pages that opt in (export const prerender = false)
// are server-rendered. We'll use SSR for auth-gated pages in Phase 2.
export default defineConfig({
  output: 'hybrid',
  adapter: netlify(),
});
