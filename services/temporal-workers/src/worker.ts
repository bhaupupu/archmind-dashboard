import { Worker } from '@temporalio/worker';
import * as activities from './activities.ts';

async function run() {
  // Step 1: Initialize the Worker
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows.ts'),
    activities,
    taskQueue: 'ingestion-queue',
  });

  // Step 2: Start accepting tasks on the `ingestion-queue` queue
  console.log('Worker is starting...');
  await worker.run();
}

run().catch((err) => {
  console.error('Worker failed to start', err);
  process.exit(1);
});
