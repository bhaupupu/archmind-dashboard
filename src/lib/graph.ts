export type NodeType = 'Repo' | 'ApiEndpoint' | 'Database' | 'MessageQueue' | 'Component' | 'Unknown';
export type EdgeType = 'DEPENDS_ON' | 'CALLS' | 'READS' | 'WRITES' | 'PUBLISHES' | 'IMPLEMENTS';

export interface FileEvidence {
  kind: 'file';
  repo: string;
  path: string;
  startLine: number;
  endLine: number;
  quote?: string;
}

export interface MetricEvidence {
  kind: 'metric';
  metricId: string;
  threshold: number;
  observed: number;
}

export interface GraphEdge {
  srcId: string;
  dstId: string;
  type: EdgeType;
  mechanism: string;
  confidence: number;
  evidence: (FileEvidence | MetricEvidence)[];
  firstSeenCommit: string;
  lastSeenCommit: string;
  repoIds: string[];
}

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  tenantId: string;
  repoIds: string[];
  props?: Record<string, unknown>;
}

function edgeKey(e: { srcId: string; dstId: string; type: string; mechanism: string }): string {
  return `${e.srcId} ${e.type} ${e.dstId} ${e.mechanism}`;
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
    const key = edgeKey(edge);
    const prior = this.edgeSet.get(key);
    if (prior) {
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
}
