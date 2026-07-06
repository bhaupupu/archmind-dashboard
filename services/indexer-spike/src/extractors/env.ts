/**
 * Environment-variable extraction (docs/03 §REFERENCES_ENV; founder "repository
 * understanding: environment variables"). Deterministic regex over source files
 * finds env references (process.env.X, os.environ['X'], os.getenv/Getenv) →
 * EnvVar nodes + REFERENCES_ENV edges. An EnvVar referenced by more than one repo
 * is an IMPLICIT cross-repo config coupling — a common, invisible source of
 * breakage (rotate JWT_SECRET in one place, break every reader). Production adds
 * .env / Helm / Terraform / K8s manifest parsing; the graph shape is stable.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { Graph } from '../../../../packages/graph-core/src/index.ts';
import type { GraphEdge, FileEvidence } from '../../../../packages/shared-types/src/index.ts';

const SKIP_DIRS = new Set(['node_modules', '.git', '.atlas', 'dist', 'build', '.next']);
const SRC_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go']);

const repoNodeId = (r: string) => `repo:${r}`;
const envNodeId = (name: string) => `env:${name}`;

export interface EnvRef { repoId: string; name: string; file: string; line: number }

function* walkSource(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) yield* walkSource(join(dir, e.name)); }
    else if (e.isFile()) {
      const ext = e.name.slice(e.name.lastIndexOf('.'));
      if (SRC_EXT.has(ext)) yield join(dir, e.name);
    }
  }
}

const PATTERNS = [
  /process\.env\.([A-Z_][A-Z0-9_]*)/g,                              // process.env.FOO
  /process\.env\[\s*['"]([A-Z_][A-Z0-9_]*)['"]\s*\]/g,             // process.env['FOO']
  /os\.environ(?:\.get)?[\[(]\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,      // os.environ['FOO'] / os.environ.get('FOO')
  /os\.getenv\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,                    // python os.getenv('FOO')
  /os\.Getenv\(\s*['"]([A-Z_][A-Z0-9_]*)['"]/g,                    // go os.Getenv("FOO")
];

export function extractEnvRefs(text: string): { name: string; index: number }[] {
  const out: { name: string; index: number }[] = [];
  const seen = new Set<string>();
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const dedupeKey = `${m[1]}@${m.index}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push({ name: m[1]!, index: m.index });
    }
  }
  return out;
}

export interface EnvGraphResult {
  graph: Graph;
  refs: EnvRef[];
  /** env vars referenced by more than one repo — the cross-repo config couplings */
  sharedEnvVars: { name: string; repos: string[] }[];
}

export function buildEnvGraph(orgDir: string, tenantId = 'fixture-tenant'): EnvGraphResult {
  const repoDirs = readdirSync(orgDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  const graph = new Graph();
  const refs: EnvRef[] = [];

  for (const repoId of repoDirs) {
    graph.addNode({ id: repoNodeId(repoId), type: 'Repo', name: repoId, tenantId, repoIds: [repoId] });
    for (const abs of walkSource(join(orgDir, repoId))) {
      const text = readFileSync(abs, 'utf8');
      const rel = relative(join(orgDir, repoId), abs).split(sep).join('/');
      // one edge per (repo, envvar); accumulate evidence for repeated refs
      const perRepoSeen = new Set<string>();
      for (const ref of extractEnvRefs(text)) {
        const line = text.slice(0, ref.index).split('\n').length;
        refs.push({ repoId, name: ref.name, file: rel, line });
        graph.addNode({ id: envNodeId(ref.name), type: 'EnvVar', name: ref.name, tenantId, repoIds: [repoId] });
        if (perRepoSeen.has(ref.name)) continue;
        perRepoSeen.add(ref.name);
        graph.addEdge(envEdge(repoNodeId(repoId), envNodeId(ref.name), repoId, rel, line, ref.name));
      }
    }
  }

  const sharedEnvVars = graph.allNodes()
    .filter((n) => n.type === 'EnvVar' && n.repoIds.length > 1)
    .map((n) => ({ name: n.name, repos: [...n.repoIds].sort() }));

  return { graph, refs, sharedEnvVars };
}

function envEdge(src: string, dst: string, repoId: string, path: string, line: number, name: string): GraphEdge {
  const evidence: FileEvidence[] = [{ kind: 'file', repo: repoId, path, startLine: line, endLine: line, quote: name }];
  return { srcId: src, dstId: dst, type: 'REFERENCES_ENV', mechanism: 'env-ref', confidence: 0.9, evidence, firstSeenCommit: 'WORKINGDIR', lastSeenCommit: 'WORKINGDIR', repoIds: [repoId] };
}
