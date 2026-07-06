/**
 * API + service-to-service extraction (docs/03 §APIs and service communication;
 * answers Q5 "how are APIs tracked" and Q6 "service-to-service comms"). Deterministic,
 * framework-aware regex over source files:
 *   - route definitions (Express, FastAPI/Flask)  -> APIEndpoint nodes + EXPOSES edges
 *   - client call sites (fetch/axios/requests)     -> CALLS edges, matched to the
 *     exposing repo by (METHOD, path) so cross-repo service calls become graph edges.
 * Production replaces the regex with tree-sitter queries + OpenAPI/AsyncAPI specs;
 * the graph shape (APIEndpoint / EXPOSES / CALLS) is stable.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { Graph } from '../../../../packages/graph-core/src/index.ts';
import type { GraphEdge, FileEvidence } from '../../../../packages/shared-types/src/index.ts';

const METHODS = 'get|post|put|delete|patch';
const SKIP_DIRS = new Set(['node_modules', '.git', '.atlas', 'dist', 'build', '.next']);
const SRC_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py']);

export interface RouteHit { repoId: string; method: string; path: string; file: string; line: number }
export interface CallHit { repoId: string; method: string; path: string; file: string; line: number }

const repoNodeId = (r: string) => `repo:${r}`;
const endpointId = (method: string, path: string) => `endpoint:${method} ${path}`;
const key = (method: string, path: string) => `${method} ${path}`;

function* walkSource(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) yield* walkSource(join(dir, e.name)); }
    else if (e.isFile()) {
      const ext = e.name.slice(e.name.lastIndexOf('.'));
      if (SRC_EXT.has(ext)) yield join(dir, e.name);
    }
  }
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

/** Server-side route definitions. */
export function extractRoutes(text: string): { method: string; path: string; index: number }[] {
  const out: { method: string; path: string; index: number }[] = [];
  const patterns = [
    new RegExp(`(?:app|router)\\.(${METHODS})\\(\\s*['"\`]([^'"\`]+)['"\`]`, 'gi'), // express
    new RegExp(`@(?:app|router)\\.(${METHODS})\\(\\s*['"\`]([^'"\`]+)['"\`]`, 'gi'), // fastapi
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      out.push({ method: m[1]!.toUpperCase(), path: m[2]!, index: m.index });
    }
  }
  return out;
}

/** Client call sites. */
export function extractCalls(text: string): { method: string; path: string; index: number }[] {
  const out: { method: string; path: string; index: number }[] = [];
  // fetch(url, { method: 'X' }) — method optional, defaults to GET
  const fetchRe = /fetch\(\s*['"`]([^'"`]+)['"`]\s*(?:,\s*\{[^}]*?method\s*:\s*['"`](\w+)['"`])?/gi;
  let m: RegExpExecArray | null;
  while ((m = fetchRe.exec(text)) !== null) {
    out.push({ method: (m[2] ?? 'GET').toUpperCase(), path: m[1]!, index: m.index });
  }
  // axios.get(url) / requests.post(url)
  const clientRe = new RegExp(`(?:axios|requests)\\.(${METHODS})\\(\\s*['"\`]([^'"\`]+)['"\`]`, 'gi');
  while ((m = clientRe.exec(text)) !== null) {
    out.push({ method: m[1]!.toUpperCase(), path: m[2]!, index: m.index });
  }
  return out;
}

export interface ApiGraphResult {
  graph: Graph;
  routes: RouteHit[];
  calls: CallHit[];
  crossRepoCalls: number;
}

/** Build the API subgraph for an org directory. */
export function buildApiGraph(orgDir: string, tenantId = 'fixture-tenant'): ApiGraphResult {
  const repoDirs = readdirSync(orgDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  const graph = new Graph();
  const routes: RouteHit[] = [];
  const calls: CallHit[] = [];
  const providerOf = new Map<string, { repoId: string; endpointId: string }>(); // "METHOD path" -> exposer

  // Pass 1: routes -> APIEndpoint nodes + EXPOSES edges.
  for (const repoId of repoDirs) {
    graph.addNode({ id: repoNodeId(repoId), type: 'Repo', name: repoId, tenantId, repoIds: [repoId] });
    for (const abs of walkSource(join(orgDir, repoId))) {
      const text = readFileSync(abs, 'utf8');
      const rel = relative(join(orgDir, repoId), abs).split(sep).join('/');
      for (const r of extractRoutes(text)) {
        const line = lineOf(text, r.index);
        routes.push({ repoId, method: r.method, path: r.path, file: rel, line });
        const eid = endpointId(r.method, r.path);
        graph.addNode({ id: eid, type: 'APIEndpoint', name: `${r.method} ${r.path}`, tenantId, repoIds: [repoId] });
        graph.addEdge(apiEdge(repoNodeId(repoId), eid, 'EXPOSES', 'route-def', repoId, rel, line, r.path));
        providerOf.set(key(r.method, r.path), { repoId, endpointId: eid });
      }
    }
  }

  // Pass 2: calls -> CALLS edges (to the endpoint and, cross-repo, to its exposer).
  let crossRepoCalls = 0;
  for (const repoId of repoDirs) {
    for (const abs of walkSource(join(orgDir, repoId))) {
      const text = readFileSync(abs, 'utf8');
      const rel = relative(join(orgDir, repoId), abs).split(sep).join('/');
      for (const c of extractCalls(text)) {
        const provider = providerOf.get(key(c.method, c.path));
        if (!provider) continue; // call to an endpoint we don't know — no edge (honest)
        const line = lineOf(text, c.index);
        calls.push({ repoId, method: c.method, path: c.path, file: rel, line });
        graph.addEdge(apiEdge(repoNodeId(repoId), provider.endpointId, 'CALLS', 'http-call', repoId, rel, line, c.path));
        if (provider.repoId !== repoId) {
          graph.addEdge(apiEdge(repoNodeId(repoId), repoNodeId(provider.repoId), 'CALLS', 'http-call', repoId, rel, line, `${c.method} ${c.path}`));
          crossRepoCalls++;
        }
      }
    }
  }

  return { graph, routes, calls, crossRepoCalls };
}

function apiEdge(src: string, dst: string, type: 'EXPOSES' | 'CALLS', mechanism: string, repoId: string, path: string, line: number, quote: string): GraphEdge {
  const evidence: FileEvidence[] = [{ kind: 'file', repo: repoId, path, startLine: line, endLine: line, quote }];
  return { srcId: src, dstId: dst, type, mechanism, confidence: 0.9, evidence, firstSeenCommit: 'WORKINGDIR', lastSeenCommit: 'WORKINGDIR', repoIds: [repoId] };
}
