/**
 * Message Topic extraction (docs/03 §PUBLISHES/SUBSCRIBES; founder
 * "message topics"). Deterministic heuristic detection over source files →
 * MessageTopic nodes + PUBLISHES/SUBSCRIBES edges.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { Graph } from '../../../../packages/graph-core/src/index.ts';
import type { GraphEdge, FileEvidence, EdgeType } from '../../../../packages/shared-types/src/index.ts';

const SKIP_DIRS = new Set(['node_modules', '.git', '.atlas', 'dist', 'build', '.next']);
const SRC_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.rb', '.java']);

const repoNodeId = (r: string) => `repo:${r}`;
const topicNodeId = (t: string) => `topic:${t}`;

export type Access = 'PUBLISHES' | 'SUBSCRIBES';
export interface TopicAccess { repoId: string; topic: string; access: Access; file: string; line: number; quote: string }

function* walkSource(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) yield* walkSource(join(dir, e.name)); }
    else if (e.isFile()) {
      const ext = e.name.slice(e.name.lastIndexOf('.'));
      if (SRC_EXT.has(ext)) yield join(dir, e.name);
    }
  }
}

// Regex to capture topics (e.g. `producer.send({ topic: 'foo' })` or `@Subscribe('foo')`)
const PUBLISH_PATTERNS = [
  /\b(?:send|publish|emit)\s*\([\s\S]{0,100}?topic\s*:\s*['"]([a-zA-Z0-9_.-]+)['"]/gi,
];
const SUBSCRIBE_PATTERNS = [
  /\b(?:subscribe|consume)\s*\([\s\S]{0,100}?topic\s*:\s*['"]([a-zA-Z0-9_.-]+)['"]/gi,
  /@Subscribe\s*\(['"]([a-zA-Z0-9_.-]+)['"]\)/gi,
];

export function extractTopicAccess(text: string): { topic: string; access: Access; index: number; quote: string }[] {
  const out: { topic: string; access: Access; index: number; quote: string }[] = [];
  const run = (patterns: RegExp[], access: Access) => {
    for (const re of patterns) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        out.push({ topic: m[1]!, access, index: m.index, quote: m[0] });
      }
    }
  };
  run(PUBLISH_PATTERNS, 'PUBLISHES');
  run(SUBSCRIBE_PATTERNS, 'SUBSCRIBES');
  return out;
}

export interface MessagingGraphResult {
  graph: Graph;
  accesses: TopicAccess[];
  sharedTopics: { topic: string; repos: string[] }[];
}

export function buildMessagingGraph(orgDir: string, tenantId = 'fixture-tenant'): MessagingGraphResult {
  const repoDirs = readdirSync(orgDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  const graph = new Graph();
  const accesses: TopicAccess[] = [];

  for (const repoId of repoDirs) {
    graph.addNode({ id: repoNodeId(repoId), type: 'Repo', name: repoId, tenantId, repoIds: [repoId] });
    for (const abs of walkSource(join(orgDir, repoId))) {
      const text = readFileSync(abs, 'utf8');
      const rel = relative(join(orgDir, repoId), abs).split(sep).join('/');
      const seen = new Set<string>();
      for (const a of extractTopicAccess(text)) {
        const line = text.slice(0, a.index).split('\n').length;
        accesses.push({ repoId, topic: a.topic, access: a.access, file: rel, line, quote: a.quote });
        graph.addNode({ id: topicNodeId(a.topic), type: 'MessageTopic', name: a.topic, tenantId, repoIds: [repoId], props: { broker_kind: 'unknown' } });
        const key = `${a.access}:${a.topic}`;
        if (seen.has(key)) continue;
        seen.add(key);
        graph.addEdge(edge(repoNodeId(repoId), topicNodeId(a.topic), a.access, 'messaging-heuristic', repoId, rel, line, a.quote));
      }
    }
  }

  // Cross-repo tracking: if multiple repos touch the same topic, it's shared.
  const sharedTopics: { topic: string; repos: string[] }[] = [];
  for (const n of graph.allNodes()) {
    if (n.type !== 'MessageTopic' || n.repoIds.length < 2) continue;
    const repos = [...n.repoIds].sort();
    sharedTopics.push({ topic: n.name, repos });
    // Note: MessageTopic pub/sub isn't inherently a pairwise edge between repos like SHARES_SCHEMA;
    // the graph connects Repo -> PUBLISHES -> MessageTopic <- SUBSCRIBES <- Repo
  }

  return { graph, accesses, sharedTopics };
}

function edge(src: string, dst: string, type: EdgeType, mechanism: string, repoId: string, path: string, line: number, quote: string): GraphEdge {
  const evidence: FileEvidence[] = [{ kind: 'file', repo: repoId, path, startLine: line, endLine: line, quote }];
  return { srcId: src, dstId: dst, type, mechanism, confidence: 0.85, evidence, firstSeenCommit: 'WORKINGDIR', lastSeenCommit: 'WORKINGDIR', repoIds: [repoId] };
}
