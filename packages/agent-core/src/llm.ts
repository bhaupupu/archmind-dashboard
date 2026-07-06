/**
 * @atlas/agent-core — the LLM boundary for the agent runtime (docs/05).
 *
 * Every agent asks for a SCHEMA-CONSTRAINED result (docs/05: structured outputs,
 * enforced at the tool-call layer). Three implementations behind one interface:
 *   - AnthropicClient: real Claude via the Messages API with forced tool-use.
 *   - GeminiClient:    Gemini via generateContent with a responseSchema, for
 *                      self-hosted/cost-conscious deployments that want a
 *                      no-cost-tier provider instead of Claude (docs/05 canon
 *                      is still Claude three-tier routing; this is an opt-in
 *                      alternative, selected only when GEMINI_API_KEY is set
 *                      and ANTHROPIC_API_KEY is not). SECURITY (docs/08 T-09):
 *                      the free-tier Gemini API has NO zero-data-retention /
 *                      no-training commitment — Google may use free-tier
 *                      prompts to improve its products. Do not select this
 *                      provider for any tenant/repo carrying real customer
 *                      code; it's for prototyping and non-sensitive/fixture
 *                      data only, until wired to a paid Gemini project with
 *                      negotiated ZDR terms.
 *   - MockLLMClient:   returns the request's deterministic `fallback()` — so the
 *                      whole pipeline runs and is testable with no API key.
 *
 * Model routing (docs/05): Opus for Scope/Synthesis/Planning, Sonnet for per-repo
 * Analysis/CodeGen/Review, Haiku for classification. Ids are overridable by env.
 */

export type ModelTier = 'opus' | 'sonnet' | 'haiku';

export const MODEL_IDS: Record<ModelTier, string> = {
  opus: process.env.ATLAS_OPUS_MODEL ?? 'claude-opus-4-8',
  sonnet: process.env.ATLAS_SONNET_MODEL ?? 'claude-sonnet-5',
  haiku: process.env.ATLAS_HAIKU_MODEL ?? 'claude-haiku-4-5-20251001',
};

/**
 * Gemini tier mapping. Defaults are Flash-family only, on purpose: Google removed
 * Pro models (2.5 Pro, 3.1 Pro) from the free tier in April 2026, so an 'opus'
 * default of a Pro model would silently start billing. Override via env if you're
 * on a paid Gemini plan and want Pro for the opus tier.
 */
export const GEMINI_MODEL_IDS: Record<ModelTier, string> = {
  opus: process.env.ATLAS_GEMINI_OPUS_MODEL ?? 'gemini-3.5-flash',
  sonnet: process.env.ATLAS_GEMINI_SONNET_MODEL ?? 'gemini-2.5-flash',
  haiku: process.env.ATLAS_GEMINI_HAIKU_MODEL ?? 'gemini-2.5-flash-lite',
};

export interface StructuredRequest<T> {
  tier: ModelTier;
  system: string;
  user: string;
  toolName: string;
  schema: object;        // JSON schema (input_schema for the forced tool)
  fallback: () => T;     // deterministic result for the mock / offline path
  maxTokens?: number;
}

export interface StructuredResult<T> { value: T; source: 'llm' | 'mock' }

export interface LLMClient {
  readonly kind: 'anthropic' | 'gemini' | 'mock';
  structured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>>;
}

/** Deterministic offline client — returns each request's fallback. */
export class MockLLMClient implements LLMClient {
  readonly kind = 'mock' as const;
  async structured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    return { value: req.fallback(), source: 'mock' };
  }
}

/** Real Claude via the Anthropic Messages API with forced tool-use. */
export class AnthropicClient implements LLMClient {
  readonly kind = 'anthropic' as const;
  private readonly apiKey: string;
  constructor(apiKey: string) { this.apiKey = apiKey; }

  async structured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL_IDS[req.tier],
        max_tokens: req.maxTokens ?? 2048,
        system: req.system,
        tools: [{ name: req.toolName, description: `Return the ${req.toolName} result.`, input_schema: req.schema }],
        tool_choice: { type: 'tool', name: req.toolName },
        messages: [{ role: 'user', content: req.user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { content: { type: string; input?: unknown }[] };
    const tool = json.content.find((c) => c.type === 'tool_use');
    if (!tool || tool.input === undefined) throw new Error('no tool_use block in Anthropic response');
    return { value: tool.input as T, source: 'llm' };
  }
}

/**
 * Free-tier Gemini via generateContent, using responseSchema for structured JSON output.
 * No ZDR/no-training commitment on this path (docs/08 T-09) — warns loudly on construction
 * so it's never silently mistaken for the Anthropic path's contractual guarantee.
 */
export class GeminiClient implements LLMClient {
  readonly kind = 'gemini' as const;
  private readonly apiKey: string;
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    console.warn(
      '[atlas] GeminiClient selected: the free-tier Gemini API has NO zero-data-retention ' +
      'or no-training commitment (docs/08 T-09) — do not use on tenants/repos with real ' +
      'customer code. Prototyping/fixture data only, or switch to a paid Gemini project ' +
      'with negotiated ZDR terms.'
    );
  }

  async structured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const model = GEMINI_MODEL_IDS[req.tier];
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: 'user', parts: [{ text: req.user }] }],
          generationConfig: {
            maxOutputTokens: req.maxTokens ?? 2048,
            responseMimeType: 'application/json',
            responseSchema: req.schema,
          },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('no text part in Gemini response');
    return { value: JSON.parse(text) as T, source: 'llm' };
  }
}

export function makeLLMClient(): LLMClient {
  const provider = process.env.ATLAS_LLM_PROVIDER;
  if (provider === 'gemini' && process.env.GEMINI_API_KEY) return new GeminiClient(process.env.GEMINI_API_KEY);
  if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) return new AnthropicClient(process.env.ANTHROPIC_API_KEY);
  if (process.env.ANTHROPIC_API_KEY) return new AnthropicClient(process.env.ANTHROPIC_API_KEY);
  if (process.env.GEMINI_API_KEY) return new GeminiClient(process.env.GEMINI_API_KEY);
  return new MockLLMClient();
}
