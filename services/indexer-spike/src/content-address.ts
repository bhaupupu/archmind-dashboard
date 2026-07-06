/**
 * Content addressing (docs/04 §content-addressed dedupe, docs/06 files.redacted_sha).
 * Chunk ids are sha256 of the NORMALIZED, POST-REDACTION content, so unchanged
 * chunks are never re-embedded and identical vendored code across repos dedupes.
 */
import { createHash } from 'node:crypto';

/** Normalize so trivial whitespace churn does not change the content hash. */
export function normalize(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function contentHash(content: string): string {
  return createHash('sha256').update(normalize(content), 'utf8').digest('hex');
}
