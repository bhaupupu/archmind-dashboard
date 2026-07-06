import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { join } from 'node:path';
import { buildSymbolGraph } from '../src/extractors/symbols.ts';

describe('SCIP Symbol Extractor', () => {
  it('extracts exported symbols and creates USES_SYMBOL edges', () => {
    const orgDir = join(process.cwd(), '..', '..', 'fixtures', 'sample-org');
    const { graph } = buildSymbolGraph(orgDir, 'test-tenant');

    const edges = graph.allEdges();
    
    // Check that billing-svc uses symbols from auth-lib
    const usesAuth = edges.filter(e => e.type === 'USES_SYMBOL' && e.srcId === 'repo:billing-svc' && e.dstId === 'repo:auth-lib');
    
    assert.strictEqual(usesAuth.length, 1, 'Should have 1 symbol edge between billing-svc and auth-lib');
    
    const evidenceExcerpts = usesAuth[0].evidence.map(ev => (ev as any).quote).sort();
    
    assert.deepStrictEqual(evidenceExcerpts, [
      "Imports 'hasScope' from '@acme/auth-lib'",
      "Imports 'verifyToken' from '@acme/auth-lib'"
    ]);
  });
});
