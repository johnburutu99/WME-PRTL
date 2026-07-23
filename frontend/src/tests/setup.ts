import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ─── Mock next/navigation globally ───────────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter:      () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn().mockReturnValue(null) }),
  redirect:        vi.fn(),
}));

// ─── Mock next/headers (used by server-side createClient) ────────────────────
vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll:  () => [],
    set:     vi.fn(),
    get:     vi.fn(),
  }),
}));

// ─── Polyfill crypto.randomUUID for jsdom ─────────────────────────────────────
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => '00000000-0000-0000-0000-000000000001',
      subtle: {},
    },
  });
}
