/**
 * Hallucination guards (docs/05 §6). The load-bearing rule: an agent claim is
 * only allowed to reference evidence that ACTUALLY EXISTS in the index at
 * repo@commit. We verify every cited file path against the known chunk paths and
 * drop fabricated citations before they can reach a report. A finding left with
 * no valid evidence is downgraded — never emitted as authoritative.
 */
import type { Evidence, RepoFinding } from '../../../../packages/shared-types/src/index.ts';

export interface VerifyResult { finding: RepoFinding; removed: number }

/**
 * @param validPaths repo-relative paths known to exist for this repo (from the index)
 */
export function verifyEvidence(finding: RepoFinding, validPaths: Set<string>): VerifyResult {
  let removed = 0;
  const kept: Evidence[] = [];
  for (const e of finding.evidence) {
    if (e.kind === 'file') {
      if (validPaths.has(e.path)) kept.push(e);
      else removed++; // fabricated / stale path — drop it (docs/05 citation-existence guard)
    } else {
      kept.push(e); // graph evidence is verified against the graph elsewhere
    }
  }
  const hasSupport = kept.length > 0;
  return {
    finding: {
      ...finding,
      evidence: kept,
      // No surviving evidence => cannot be a confident must_change claim.
      disposition: hasSupport ? finding.disposition : 'no_change',
      confidence: hasSupport ? finding.confidence : Math.min(finding.confidence, 0.2),
    },
    removed,
  };
}
