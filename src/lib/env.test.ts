import { describe, it, expect, beforeEach, vi } from 'vitest';

// getEnv() caches its result on first call, so each test needs a fresh module
// instance to see a different process.env snapshot.
async function freshGetEnv() {
  vi.resetModules();
  const mod = await import('./env');
  return mod.getEnv;
}

describe('getEnv', () => {
  const REQUIRED = {
    JWT_SECRET: 'a-secret-thats-long-enough',
    ENCRYPTION_KEY: '12345678901234567890123456789012', // 32 chars
    DATABASE_URL: 'postgresql://user:pass@host:5432/db',
    GITHUB_CLIENT_ID: 'id',
    GITHUB_CLIENT_SECRET: 'secret',
  };
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  it('returns parsed values when all required vars are present', async () => {
    Object.assign(process.env, REQUIRED);
    const getEnv = await freshGetEnv();
    const env = getEnv();
    expect(env.JWT_SECRET).toBe(REQUIRED.JWT_SECRET);
    expect(env.BASE_URL).toBe('http://localhost:3000'); // default applied
    process.env = originalEnv;
  });

  it('throws a clear error when a required var is missing', async () => {
    Object.assign(process.env, REQUIRED);
    delete process.env.JWT_SECRET;
    const getEnv = await freshGetEnv();
    expect(() => getEnv()).toThrow(/JWT_SECRET/);
    process.env = originalEnv;
  });

  it('throws when ENCRYPTION_KEY is not exactly 32 characters', async () => {
    Object.assign(process.env, REQUIRED, { ENCRYPTION_KEY: 'too-short' });
    const getEnv = await freshGetEnv();
    expect(() => getEnv()).toThrow(/ENCRYPTION_KEY/);
    process.env = originalEnv;
  });
});
