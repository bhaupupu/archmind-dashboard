/**
 * @atlas/config — typed environment access (PROJECT_HANDOFF §16).
 * Dependency-free for the Phase-0 bootstrap; swap for zod-env later. Fail loud
 * on missing REQUIRED vars, allow optional ones to be undefined.
 */

function req(name: string): string {
  const v = process.env[name];
  if (v === undefined || v === '') throw new Error(`missing required env var: ${name}`);
  return v;
}
function opt(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

export interface AtlasConfig {
  voyage: { apiKey?: string; embedModel: string; rerankModel: string };
  anthropic: { apiKey?: string };
  gemini: { apiKey?: string };
  github: { appId?: string; privateKey?: string; webhookSecret?: string; clientId?: string; clientSecret?: string };
  postgres: { url?: string };
  qdrant: { url?: string };
  neo4j: { uri?: string; user?: string; password?: string };
  redis: { url?: string };
  temporal: { address?: string };
  s3: { bucket?: string; endpoint?: string; region?: string };
}

/** Non-throwing loader for services that degrade gracefully (like the spike). */
export function loadConfig(): AtlasConfig {
  return {
    voyage: { apiKey: opt('VOYAGE_API_KEY'), embedModel: opt('VOYAGE_EMBED_MODEL', 'voyage-code-3')!, rerankModel: opt('VOYAGE_RERANK_MODEL', 'rerank-2.5')! },
    anthropic: { apiKey: opt('ANTHROPIC_API_KEY') },
    gemini: { apiKey: opt('GEMINI_API_KEY') },
    github: { appId: opt('GITHUB_APP_ID'), privateKey: opt('GITHUB_APP_PRIVATE_KEY'), webhookSecret: opt('GITHUB_WEBHOOK_SECRET'), clientId: opt('GITHUB_CLIENT_ID'), clientSecret: opt('GITHUB_CLIENT_SECRET') },
    postgres: { url: opt('DATABASE_URL') },
    qdrant: { url: opt('QDRANT_URL') },
    neo4j: { uri: opt('NEO4J_URI'), user: opt('NEO4J_USER'), password: opt('NEO4J_PASSWORD') },
    redis: { url: opt('REDIS_URL') },
    temporal: { address: opt('TEMPORAL_ADDRESS') },
    s3: { bucket: opt('S3_BUCKET'), endpoint: opt('S3_ENDPOINT'), region: opt('AWS_REGION', 'us-east-1') },
  };
}

/** Strict loader for the production API — call at boot so misconfig fails fast. */
export function requireProductionConfig(): AtlasConfig {
  req('DATABASE_URL'); req('ANTHROPIC_API_KEY'); req('VOYAGE_API_KEY'); req('GITHUB_APP_ID');
  return loadConfig();
}
export { cache } from './cache.ts';