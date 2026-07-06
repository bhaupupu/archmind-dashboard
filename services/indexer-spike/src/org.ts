/**
 * Org graph builder — turns a directory of repos into the Tier-1 knowledge graph
 * (docs/03). The key move: a declared dependency whose name matches a package
 * PUBLISHED by another repo in the org becomes a cross-repo DEPENDS_ON edge — the
 * relationship that pure vector RAG cannot recover. External packages (express,
 * stripe, react) get a node but no cross-repo edge.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Graph } from '../../../packages/graph-core/src/index.ts';
import type { GraphEdge, FileEvidence } from '../../../packages/shared-types/src/index.ts';
import { extractManifests, type RepoManifest, type DepRef } from './extractors/dependencies.ts';

export interface OrgIndexResult {
  graph: Graph;
  repos: string[];
  crossRepoEdges: number;
}

const repoNodeId = (r: string) => `repo:${r}`;
const pkgNodeId = (p: string) => `pkg:${p}`;

function dependsEdge(srcId: string, dstId: string, m: RepoManifest, dep: DepRef): GraphEdge {
  const evidence: FileEvidence[] = [{
    kind: 'file', repo: m.repoId, path: m.manifestPath,
    startLine: dep.line, endLine: dep.line, quote: dep.name,
  }];
  return {
    srcId, dstId, type: 'DEPENDS_ON',
    mechanism: `${m.ecosystem}-manifest`,
    confidence: 0.95,
    evidence,
    firstSeenCommit: 'WORKINGDIR',
    lastSeenCommit: 'WORKINGDIR',
    repoIds: [m.repoId],
  };
}

export function buildOrgGraph(orgDir: string, tenantId = 'fixture-tenant'): OrgIndexResult {
  const repoDirs = readdirSync(orgDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const graph = new Graph();
  const manifests: RepoManifest[] = [];
  const publisherOf = new Map<string, string>(); // packageName -> repoId

  // Pass 1: nodes + publisher index.
  for (const repoId of repoDirs) {
    graph.addNode({ id: repoNodeId(repoId), type: 'Repo', name: repoId, tenantId, repoIds: [repoId] });
    for (const m of extractManifests(join(orgDir, repoId), repoId)) {
      manifests.push(m);
      if (m.publishes) {
        publisherOf.set(m.publishes, repoId);
        graph.addNode({ id: pkgNodeId(m.publishes), type: 'Package', name: m.publishes, tenantId, repoIds: [repoId] });
      }
    }
  }

  // Pass 2: edges — resolve internal deps to their publishing repo.
  let crossRepoEdges = 0;
  for (const m of manifests) {
    for (const dep of m.deps) {
      const publisher = publisherOf.get(dep.name);
      graph.addNode({
        id: pkgNodeId(dep.name), type: 'Package', name: dep.name, tenantId,
        repoIds: publisher ? [publisher] : ['*public'],
      });
      graph.addEdge(dependsEdge(repoNodeId(m.repoId), pkgNodeId(dep.name), m, dep));
      if (publisher && publisher !== m.repoId) {
        graph.addEdge(dependsEdge(repoNodeId(m.repoId), repoNodeId(publisher), m, dep));
        crossRepoEdges++;
      }
    }
  }

  return { graph, repos: repoDirs, crossRepoEdges };
}

export { repoNodeId, pkgNodeId };
