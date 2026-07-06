/**
 * Unified org graph + multi-mechanism impact (docs/03). Composes the three
 * deterministic subgraphs — package dependencies (DEPENDS_ON), HTTP APIs
 * (EXPOSES/CALLS), and shared config (REFERENCES_ENV) — into one graph, then
 * answers "what breaks if repo X changes?" across ALL coupling mechanisms.
 *
 * This is the point of the whole exercise: DEPENDS_ON alone misses impact that
 * flows through API calls and shared configuration. A repo with zero package
 * dependents can still break its API callers and its config co-readers.
 *
 * New composition only — imports the existing extractors and uses graph-core's
 * public API; it does not modify org.ts or graph-core.
 */
import { Graph } from '../../../packages/graph-core/src/index.ts';
import { buildOrgGraph } from './org.ts';
import { buildApiGraph } from './extractors/apis.ts';
import { buildEnvGraph } from './extractors/env.ts';
import { buildDatastoreGraph } from './extractors/datastore.ts';
import { buildMessagingGraph } from './extractors/messaging.ts';
import { buildSymbolGraph } from './extractors/symbols.ts';

const repoNodeId = (r: string) => `repo:${r}`;
const repoNameOf = (nodeId: string): string | null => (nodeId.startsWith('repo:') ? nodeId.slice(5) : null);
const uniq = (xs: string[]) => [...new Set(xs)].sort();

function merge(dst: Graph, src: Graph): void {
  for (const n of src.allNodes()) dst.addNode(n);
  for (const e of src.allEdges()) dst.addEdge(e);
}

export interface FullGraphResult {
  graph: Graph;
  repos: string[];
  stats: ReturnType<Graph['stats']>;
}

export function buildFullGraph(orgDir: string, tenantId = 'fixture-tenant'): FullGraphResult {
  const graph = new Graph();
  const org = buildOrgGraph(orgDir, tenantId);
  merge(graph, org.graph);
  merge(graph, buildApiGraph(orgDir, tenantId).graph);
  merge(graph, buildEnvGraph(orgDir, tenantId).graph);
  merge(graph, buildDatastoreGraph(orgDir, tenantId).graph);
  merge(graph, buildMessagingGraph(orgDir, tenantId).graph);
  merge(graph, buildSymbolGraph(orgDir, tenantId).graph);
  return { graph, repos: org.repos, stats: graph.stats() };
}

export interface ImpactBreakdown {
  repoId: string;
  viaDepends: string[];   // repos that DEPENDS_ON this repo (package coupling)
  viaCalls: string[];     // repos that CALL this repo's API (service coupling)
  viaConfig: string[];    // repos sharing an EnvVar with this repo (config coupling)
  viaDatastore: string[]; // repos sharing a Table with this repo (schema coupling)
  viaMessaging: string[]; // repos subscribing to a MessageTopic this repo publishes
  viaSymbols: string[];   // repos that USE_SYMBOL exported by this repo (SCIP resolution)
  all: string[];          // union — the true blast radius
}

/**
 * Multi-mechanism blast radius for a single repo, ACL-scoped optionally by a
 * visible-repo set (docs/03 §6.4). Direct (1-hop) impact across all three
 * mechanisms; transitive expansion is a follow-up (compose per hop).
 */
export function computeImpact(graph: Graph, repoId: string, scope?: Set<string>): ImpactBreakdown {
  const rid = repoNodeId(repoId);
  const inScope = (name: string | null): name is string => !!name && name !== repoId && (!scope || scope.has(name));

  const viaDepends = uniq(graph.incoming(rid, 'DEPENDS_ON').map((e) => repoNameOf(e.srcId)).filter(inScope));
  const viaCalls = uniq(graph.incoming(rid, 'CALLS').map((e) => repoNameOf(e.srcId)).filter(inScope));

  // Config coupling: repos that reference any EnvVar this repo also references.
  const config = new Set<string>();
  for (const envEdge of graph.outgoing(rid, 'REFERENCES_ENV')) {
    for (const back of graph.incoming(envEdge.dstId, 'REFERENCES_ENV')) {
      const name = repoNameOf(back.srcId);
      if (inScope(name)) config.add(name);
    }
  }
  const viaConfig = uniq([...config]);

  // Schema coupling: repos sharing a Table (SHARES_SCHEMA is emitted symmetric).
  const viaDatastore = uniq(graph.outgoing(rid, 'SHARES_SCHEMA').map((e) => repoNameOf(e.dstId)).filter(inScope));

  // Messaging coupling: if this repo PUBLISHES to a topic, who SUBSCRIBES to it?
  const messaging = new Set<string>();
  for (const pubEdge of graph.outgoing(rid, 'PUBLISHES')) {
    for (const subEdge of graph.incoming(pubEdge.dstId, 'SUBSCRIBES')) {
      const name = repoNameOf(subEdge.srcId);
      if (inScope(name)) messaging.add(name);
    }
  }
  const viaMessaging = uniq([...messaging]);

  // SCIP Symbol coupling: repos that use a specific exported symbol from this repo.
  const viaSymbols = uniq(graph.incoming(rid, 'USES_SYMBOL').map((e) => repoNameOf(e.srcId)).filter(inScope));

  const all = uniq([...viaDepends, ...viaCalls, ...viaConfig, ...viaDatastore, ...viaMessaging, ...viaSymbols]);
  return { repoId, viaDepends, viaCalls, viaConfig, viaDatastore, viaMessaging, viaSymbols, all };
}

export interface TransitiveImpact {
  repoId: string;
  impacted: string[];              // full blast radius across all mechanisms
  hops: Record<string, number>;    // repo -> shortest hop distance from the origin
  causalPaths: Record<string, string>; // repo -> the parent repo that pulled it into the blast radius
}

/**
 * Transitive multi-mechanism blast radius: BFS over the 1-hop `computeImpact`
 * expander so impact propagates through chains (A depends on B depends on C ⇒
 * changing C reaches A). Depth-bounded and ACL-scopable; the `seen` set prevents
 * cycles from looping. This is the "true blast radius" a reviewer wants before a
 * cross-repo change.
 */
export function computeImpactTransitive(graph: Graph, repoId: string, maxHops = 5, scope?: Set<string>): TransitiveImpact {
  const seen = new Set<string>();
  const hops: Record<string, number> = {};
  const causalPaths: Record<string, string> = {};
  let frontier = [repoId];
  for (let hop = 1; hop <= maxHops && frontier.length; hop++) {
    const next: string[] = [];
    for (const cur of frontier) {
      for (const r of computeImpact(graph, cur, scope).all) {
        if (r === repoId || seen.has(r)) continue;
        seen.add(r);
        hops[r] = hop;
        causalPaths[r] = cur;
        next.push(r);
      }
    }
    frontier = next;
  }
  return { repoId, impacted: [...seen].sort(), hops, causalPaths };
}
