/**
 * Secret scanning — runs BEFORE chunking/embedding (docs/04 §3.5, docs/08 T-11).
 * This is the load-bearing security invariant: credentials must never reach the
 * vector store, the lexical index, S3 chunk text, or an LLM context. We redact
 * matched spans in-place and hash/embed only the redacted bytes.
 *
 * Phase 0 uses a gitleaks-style regex set. Production adds entropy analysis and
 * the full gitleaks ruleset; the interface (scan → redacted text + span count)
 * is stable.
 */

export interface SecretRule {
  name: string;
  pattern: RegExp;
}

// Each pattern is global + multiline. Where a secret has a prefix we keep the
// prefix and redact the value, so the redaction is legible in review.
const RULES: SecretRule[] = [
  { name: 'aws-access-key-id', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'github-token', pattern: /gh[pousr]_[0-9A-Za-z]{36,}/g },
  { name: 'slack-token', pattern: /xox[baprs]-[0-9A-Za-z-]{10,}/g },
  { name: 'private-key-block', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g },
  { name: 'generic-assigned-secret', pattern: /\b(?:api[_-]?key|secret|token|password|passwd|pwd|access[_-]?token|client[_-]?secret)\b\s*[:=]\s*['"]([^'"\n]{8,})['"]/gi },
  { name: 'bearer-token', pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]{20,}=*/g },
  { name: 'aws-secret-access-key', pattern: /\baws_secret_access_key\b\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi },
];

export interface ScanResult {
  redacted: string;
  spanCount: number;
  hits: { rule: string; start: number; end: number }[];
}

const PLACEHOLDER = '«REDACTED-SECRET»';

/** Redact every secret span; returns post-redaction text (the ONLY bytes we persist/embed). */
export function scanAndRedact(text: string): ScanResult {
  const hits: { rule: string; start: number; end: number }[] = [];

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.pattern.exec(text)) !== null) {
      // For assigned-secret rules we redact the captured value; otherwise the whole match.
      const hasValueGroup = m[1] !== undefined && m[1].length > 0 && m[0].includes(m[1]);
      if (hasValueGroup) {
        const valStart = m.index + m[0].indexOf(m[1]!);
        hits.push({ rule: rule.name, start: valStart, end: valStart + m[1]!.length });
      } else {
        hits.push({ rule: rule.name, start: m.index, end: m.index + m[0].length });
      }
      if (m[0].length === 0) rule.pattern.lastIndex++; // guard against zero-width loops
    }
  }

  if (hits.length === 0) return { redacted: text, spanCount: 0, hits: [] };

  // Apply redactions right-to-left so indices stay valid; merge overlaps.
  hits.sort((a, b) => b.start - a.start);
  let redacted = text;
  let lastStart = Number.POSITIVE_INFINITY;
  let applied = 0;
  for (const h of hits) {
    if (h.end > lastStart) continue; // overlaps a span we already redacted
    redacted = redacted.slice(0, h.start) + PLACEHOLDER + redacted.slice(h.end);
    lastStart = h.start;
    applied++;
  }

  return { redacted, spanCount: applied, hits };
}
