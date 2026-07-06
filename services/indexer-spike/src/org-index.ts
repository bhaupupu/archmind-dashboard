/**
 * Org impact CLI — the first end-to-end demonstration of the product thesis at
 * small scale: index a directory of repos, build the cross-repo graph, and answer
 * "which repos break if <repo> changes?" with evidence.
 *
 *   node src/org-index.ts <orgDir> [targetRepo]
 */
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { buildOrgGraph, repoNodeId } from './org.ts';

function main(): void {
  const orgDir = resolve(process.argv[2] ?? 'fixtures/sample-org');
  const target = process.argv[3] ?? 'auth-lib';
  if (!existsSync(orgDir)) { console.error(`org dir not found: ${orgDir}`); process.exit(2); }

  const { graph, repos, crossRepoEdges } = buildOrgGraph(orgDir);
  const s = graph.stats();

  console.log(`\n▶ Atlas org impact analysis`);
  console.log(`  org:   ${orgDir}`);
  console.log(`  repos: ${repos.join(', ')}`);
  console.log(`  graph: ${s.nodes} nodes, ${s.edges} edges (${crossRepoEdges} cross-repo DEPENDS_ON)`);
  console.log(`         nodes ${JSON.stringify(s.byNodeType)}  edges ${JSON.stringify(s.byEdgeType)}\n`);

  const targetId = repoNodeId(target);
  if (!graph.getNode(targetId)) { console.error(`no such repo: ${target}`); process.exit(2); }

  const direct = graph.dependents(targetId);
  const blast = [...graph.blastRadius(targetId)];
  console.log(`  "If ${target} changes, what breaks?"`);
  console.log(`  direct dependents: ${direct.map((n) => n.name).join(', ') || '(none)'}`);
  console.log(`  blast radius:      ${blast.map((id) => id.replace('repo:', '')).join(', ') || '(none)'}`);

  console.log(`\n  evidence for each dependent:`);
  for (const dep of direct) {
    const edge = graph.incoming(targetId, 'DEPENDS_ON').find((e) => e.srcId === dep.id);
    const ev = edge?.evidence[0];
    console.log(`    - ${dep.name}  via ${edge?.mechanism} (conf ${edge?.confidence})  @ ${ev?.repo}/${ev?.path}:${ev?.startLine} ("${ev?.quote}")`);
  }

  // ACL demonstration: a user who can only see the target + web-app must not see
  // billing-svc as a dependent (docs/03 §6.4 permission-scoped serving).
  const scoped = graph.dependents(targetId, new Set([target, 'web-app']));
  console.log(`\n  ACL scoped (visible: ${target}, web-app): ${scoped.map((n) => n.name).join(', ') || '(none)'}\n`);
}

main();
