import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
    // Astro reads SUPABASE_URL etc. via import.meta.env at module load.
    // The lib/ code under test reads them lazily, but provide a safe
    // fallback so any future eager check doesn't blow up the suite.
    env: {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    },
  },
});
