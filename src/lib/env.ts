import { z } from 'zod';

const envSchema = z.object({
  JWT_SECRET: z.string().min(16, 'must be at least 16 characters'),
  ENCRYPTION_KEY: z.string().length(32, 'must be exactly 32 bytes (32 ASCII characters) — see .env.example'),
  DATABASE_URL: z.string().min(1, 'is required'),
  GITHUB_CLIENT_ID: z.string().min(1, 'is required'),
  GITHUB_CLIENT_SECRET: z.string().min(1, 'is required'),
  // Some hosting dashboards leave unset optional vars as "" rather than absent;
  // treat "" the same as unset so the default actually applies.
  BASE_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().default('http://localhost:3000')),
  GEMINI_API_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  UPSTASH_REDIS_REST_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
  UPSTASH_REDIS_REST_TOKEN: z.preprocess((v) => (v === '' ? undefined : v), z.string().optional()),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Single fail-fast entry point for required config. Validated once (cached after),
 * so a missing/malformed var throws one clear error instead of surfacing as a
 * silent fallback or a cryptic downstream crash (see docs on JWT_SECRET history).
 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}
