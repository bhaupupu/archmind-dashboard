/**
 * Datastore / table extraction (docs/03 §READS/WRITES/SHARES_SCHEMA; founder
 * "database schemas"). Deterministic SQL-shape detection over source files →
 * Table nodes + READS/WRITES edges. When two repos touch the SAME table, they
 * are coupled by a shared schema — the classic invisible cross-repo dependency
 * (one service changes the `users` schema, another silently breaks). We emit
 * SHARES_SCHEMA edges between such repos. Production adds ORM/migration parsing;
 * the graph shape (Table / READS / WRITES / SHARES_SCHEMA) is stable.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { Graph } from '../../../../packages/graph-core/src/index.ts';
import type { GraphEdge, FileEvidence, EdgeType } from '../../../../packages/shared-types/src/index.ts';

const SKIP_DIRS = new Set(['node_modules', '.git', '.atlas', 'dist', 'build', '.next']);
const SRC_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.rb', '.java']);

const repoNodeId = (r: string) => `repo:${r}`;
const tableNodeId = (t: string) => `table:${t}`;

export type Access = 'READS' | 'WRITES';
export interface TableAccess { repoId: string; table: string; access: Access; file: string; line: number }

function* walkSource(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) yield* walkSource(join(dir, e.name)); }
    else if (e.isFile()) {
      const ext = e.name.slice(e.name.lastIndexOf('.'));
      if (SRC_EXT.has(ext)) yield join(dir, e.name);
    }
  }
}

const WRITE_PATTERNS = [
  /INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
  /UPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+SET/gi,
  /DELETE\s+FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
];
const READ_PATTERNS = [
  /SELECT[\s\S]{0,300}?\bFROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,
];

export function extractTableAccess(text: string): { table: string; access: Access; index: number }[] {
  const out: { table: string; access: Access; index: number }[] = [];
  const run = (patterns: RegExp[], access: Access) => {
    for (const re of patterns) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) out.push({ table: m[1]!.toLowerCase(), access, index: m.index });
    }
  };
  run(WRITE_PATTERNS, 'WRITES');
  run(READ_PATTERNS, 'READS');
  return out;
}

export interface DatastoreGraphResult {
  graph: Graph;
  accesses: TableAccess[];
  /** tables touched by more than one repo — the cross-repo schema couplings */
  sharedTables: { table: string; repos: string[] }[];
}

export function buildDatastoreGraph(orgDir: string, tenantId = 'fixture-tenant'): DatastoreGraphResult {
  const repoDirs = readdirSync(orgDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  const graph = new Graph();
  const accesses: TableAccess[] = [];

  for (const repoId of repoDirs) {
    graph.addNode({ id: repoNodeId(repoId), type: 'Repo', name: repoId, tenantId, repoIds: [repoId] });
    for (const abs of walkSource(join(orgDir, repoId))) {
      const text = readFileSync(abs, 'utf8');
      const rel = relative(join(orgDir, repoId), abs).split(sep).join('/');
      const seen = new Set<string>();
      for (const a of extractTableAccess(text)) {
        const line = text.slice(0, a.index).split('\n').length;
        accesses.push({ repoId, table: a.table, access: a.access, file: rel, line });
        graph.addNode({ id: tableNodeId(a.table), type: 'Table', name: a.table, tenantId, repoIds: [repoId] });
        const key = `${a.access}:${a.table}`;
        if (seen.has(key)) continue;
        seen.add(key);
        graph.addEdge(edge(repoNodeId(repoId), tableNodeId(a.table), a.access, 'sql', repoId, rel, line, a.table));
      }
    }
  }

  // Shared tables -> SHARES_SCHEMA edges between every pair of repos touching them.
  const sharedTables: { table: string; repos: string[] }[] = [];
  for (const n of graph.allNodes()) {
    if (n.type !== 'Table' || n.repoIds.length < 2) continue;
    const repos = [...n.repoIds].sort();
    sharedTables.push({ table: n.name, repos });
    for (const a of repos) for (const b of repos) {
      if (a === b) continue;
      graph.addEdge(edge(repoNodeId(a), repoNodeId(b), 'SHARES_SCHEMA', 'shared-table', a, `(table ${n.name})`, 0, n.name));
    }
  }

  return { graph, accesses, sharedTables };
}

function edge(src: string, dst: string, type: EdgeType, mechanism: string, repoId: string, path: string, line: number, quote: string): GraphEdge {
  const evidence: FileEvidence[] = [{ kind: 'file', repo: repoId, path, startLine: line, endLine: line, quote }];
  return { srcId: src, dstId: dst, type, mechanism, confidence: 0.85, evidence, firstSeenCommit: 'WORKINGDIR', lastSeenCommit: 'WORKINGDIR', repoIds: [repoId] };
}
