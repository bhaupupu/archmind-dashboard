/**
 * @atlas/graph-core — the org knowledge graph (Tier 1, docs/03), in memory.
 *
 * Production Tier 1 is Neo4j projected from Postgres edge assertions; this module
 * implements the same query SEMANTICS (dependents, blast radius) and — critically
 * — the permission-scoped serving model from docs/03 §6.4: every node and edge
 * carries `repoIds`, and traversals filter by the caller's visible repo set so a
 * user cannot enumerate structure of repos they cannot read in GitHub.
 */
import type { EdgeType, NodeType, GraphEdge } from '../../shared-types/src/index.ts';
import { assertSoftEdgeConfidence } from '../../shared-types/src/index.ts';

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  tenantId: string;
  /** repos whose assertions justify this node — powers ACL filtering (docs/03 §6.4) */
  repoIds: string[];
  props?: Record<string, unknown>;
}

export interface GraphStats {
  nodes: number;
  edges: number;
  byNodeType: Record<string, number>;
  byEdgeType: Record<string, number>;
}

function edgeKey(e: { srcId: string; dstId: string; type: string; mechanism: string }): string {
  return `${e.srcId}${e.type}${e.dstId}${e.mechanism}`;
}

function visible(repoIds: string[], scope?: Set<string>): boolean {
  if (!scope) return true;
  for (const r of repoIds) if (r === '*public' || scope.has(r)) return true;
  return false;
}

export class Graph {
  private readonly nodes = new Map<string, GraphNode>();
  private readonly edgeSet = new Map<string, GraphEdge>();
  private readonly outIndex = new Map<string, GraphEdge[]>();
  private readonly inIndex = new Map<string, GraphEdge[]>();

  addNode(node: GraphNode): void {
    const existing = this.nodes.get(node.id);
    if (existing) {
      existing.repoIds = [...new Set([...existing.repoIds, ...node.repoIds])];
      if (node.props) existing.props = { ...existing.props, ...node.props };
      return;
    }
    this.nodes.set(node.id, { ...node, repoIds: [...new Set(node.repoIds)] });
  }

  addEdge(edge: GraphEdge): void {
    assertSoftEdgeConfidence(edge.mechanism, edge.confidence);
    const key = edgeKey(edge);
    const prior = this.edgeSet.get(key);
    if (prior) {
      // merge evidence + repoIds; widen the seen-commit range
      prior.evidence = [...prior.evidence, ...edge.evidence];
      prior.repoIds = [...new Set([...prior.repoIds, ...edge.repoIds])];
      prior.lastSeenCommit = edge.lastSeenCommit || prior.lastSeenCommit;
      return;
    }
    this.edgeSet.set(key, edge);
    this.pushIndex(this.outIndex, edge.srcId, edge);
    this.pushIndex(this.inIndex, edge.dstId, edge);
  }

  private pushIndex(index: Map<string, GraphEdge[]>, id: string, edge: GraphEdge): void {
    const list = index.get(id);
    if (list) list.push(edge);
    else index.set(id, [edge]);
  }

  getNode(id: string): GraphNode | undefined { return this.nodes.get(id); }
  allNodes(): GraphNode[] { return [...this.nodes.values()]; }
  allEdges(): GraphEdge[] { return [...this.edgeSet.values()]; }

  outgoing(id: string, type?: EdgeType): GraphEdge[] {
    const es = this.outIndex.get(id) ?? [];
    return type ? es.filter((e) => e.type === type) : es;
  }
  incoming(id: string, type?: EdgeType): GraphEdge[] {
    const es = this.inIndex.get(id) ?? [];
    return type ? es.filter((e) => e.type === type) : es;
  }

  /** Direct dependents: nodes that DEPENDS_ON `id`, filtered by ACL scope. */
  dependents(id: string, scope?: Set<string>): GraphNode[] {
    const out: GraphNode[] = [];
    for (const e of this.incoming(id, 'DEPENDS_ON')) {
      const n = this.nodes.get(e.srcId);
      if (n && visible(n.repoIds, scope) && visible(e.repoIds, scope)) out.push(n);
    }
    return out;
  }

  /**
   * Blast radius: transitive dependents over reverse DEPENDS_ON up to maxHops,
   * ACL-scoped. Returns node ids reachable as "things that break if `id` changes".
   */
  blastRadius(id: string, maxHops = 5, scope?: Set<string>): Set<string> {
    const seen = new Set<string>();
    let frontier = [id];
    for (let hop = 0; hop < maxHops && frontier.length; hop++) {
      const next: string[] = [];
      for (const cur of frontier) {
        for (const e of this.incoming(cur, 'DEPENDS_ON')) {
          const n = this.nodes.get(e.srcId);
          if (!n || !visible(n.repoIds, scope) || !visible(e.repoIds, scope)) continue;
          if (!seen.has(e.srcId)) { seen.add(e.srcId); next.push(e.srcId); }
        }
      }
      frontier = next;
    }
    return seen;
  }

  stats(): GraphStats {
    const byNodeType: Record<string, number> = {};
    const byEdgeType: Record<string, number> = {};
    for (const n of this.nodes.values()) byNodeType[n.type] = (byNodeType[n.type] ?? 0) + 1;
    for (const e of this.edgeSet.values()) byEdgeType[e.type] = (byEdgeType[e.type] ?? 0) + 1;
    return { nodes: this.nodes.size, edges: this.edgeSet.size, byNodeType, byEdgeType };
  }

  toJSON(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return { nodes: this.allNodes(), edges: this.allEdges() };
  }
}
