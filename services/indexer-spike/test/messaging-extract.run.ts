import assert from 'node:assert';
import { resolve } from 'node:path';
import { buildMessagingGraph } from '../src/extractors/messaging.ts';

const fixture = resolve('fixtures/sample-org');

export async function run() {
  console.log('\n▶ messaging-extract tests\n');
  let passed = 0;
  let failed = 0;

  const { graph, accesses, sharedTopics } = buildMessagingGraph(fixture, 'test-tenant');

  function check(name: string, fn: () => void) {
    try {
      fn();
      console.log(`  ✔ ${name}`);
      passed++;
    } catch (e: any) {
      console.log(`  ✘ ${name}`);
      console.error(e.stack.split('\n').map((l: string) => `      ${l}`).join('\n'));
      failed++;
    }
  }

  check('extractTopicAccess finds publish and subscribe patterns', () => {
    assert.ok(accesses.some(a => a.topic === 'payment.events' && a.access === 'PUBLISHES' && a.repoId === 'billing-svc'));
    assert.ok(accesses.some(a => a.topic === 'payment.events' && a.access === 'SUBSCRIBES' && a.repoId === 'web-app'));
  });

  check('MessageTopic nodes are created', () => {
    const topicNode = graph.getNode('topic:payment.events');
    assert.ok(topicNode, 'MessageTopic node not found');
    assert.equal(topicNode.type, 'MessageTopic');
    assert.ok(topicNode.repoIds.includes('billing-svc'));
    assert.ok(topicNode.repoIds.includes('web-app'));
  });

  check('PUBLISHES and SUBSCRIBES edges are created with evidence', () => {
    const pubEdge = graph.outgoing('repo:billing-svc', 'PUBLISHES').find(e => e.dstId === 'topic:payment.events');
    assert.ok(pubEdge, 'PUBLISHES edge not found');
    assert.equal(pubEdge.repoIds[0], 'billing-svc');
    assert.ok(pubEdge.evidence.length > 0);
    assert.equal(pubEdge.evidence[0]!.kind, 'file');

    const subEdge = graph.outgoing('repo:web-app', 'SUBSCRIBES').find(e => e.dstId === 'topic:payment.events');
    assert.ok(subEdge, 'SUBSCRIBES edge not found');
    assert.equal(subEdge.repoIds[0], 'web-app');
    assert.ok(subEdge.evidence.length > 0);
  });

  check('sharedTopics detects topics touched by multiple repos', () => {
    const shared = sharedTopics.find(t => t.topic === 'payment.events');
    assert.ok(shared, 'payment.events not detected as shared topic');
    assert.deepEqual(shared.repos.sort(), ['billing-svc', 'web-app']);
  });

  console.log(`\n  summary: ${accesses.length} topic accesses, shared: ${sharedTopics.map(t => t.topic).join(', ')}`);

  if (failed > 0) {
    console.log(`\n✘ ${failed} failed, ${passed} passed`);
    process.exit(1);
  } else {
    console.log(`\n✔ all passed`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('messaging-extract.run.ts')) {
  run().catch(console.error);
}
