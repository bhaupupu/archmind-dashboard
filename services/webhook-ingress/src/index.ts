import http from 'node:http';
import { ScmProviderRegistry } from '../../../packages/scm-provider/src/index.ts';
import type { ScmProvider } from '../../../packages/scm-provider/src/index.ts';
import { loadConfig } from '../../../packages/config/src/index.ts';
import { GitHubProvider, type GitHubProviderConfig } from '../../../packages/scm-github/src/index.ts';
import { Connection, Client } from '@temporalio/client';

let temporalClient: Client | null = null;
const cfg = loadConfig();
async function getTemporalClient() {
  if (!temporalClient) {
    const connection = await Connection.connect({ address: cfg.temporal.address || 'localhost:7233' });
    temporalClient = new Client({ connection });
  }
  return temporalClient;
}

const dedupeCache = new Set<string>();

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405);
    return res.end();
  }

  const signature = req.headers['x-hub-signature-256'] || req.headers['x-webhook-signature'];
  const eventId = req.headers['x-github-delivery'] || req.headers['x-webhook-id'];

  if (!signature || typeof signature !== 'string') {
    res.writeHead(401);
    return res.end('Missing signature');
  }

  if (eventId && typeof eventId === 'string') {
    if (dedupeCache.has(eventId)) {
      res.writeHead(202);
      return res.end('Duplicate event ignored');
    }
    dedupeCache.add(eventId);
    // In production, use Redis with a TTL instead of in-memory Set.
  }

  const chunks: Buffer[] = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', async () => {
    const payload = Buffer.concat(chunks).toString('utf8');
    
    // In a real scenario, the provider is resolved from tenant configuration.
    // For Phase-0, we mock the GitHub provider here.
    const providerRegistry = new ScmProviderRegistry();
    if (cfg.github && cfg.github.appId) {
      providerRegistry.register(new GitHubProvider(cfg.github as GitHubProviderConfig));
    } else {
      // Fallback mock provider for tests if no config is available
      const mockProvider = {
        name: 'github' as const,
        verifyWebhookSignature: (b: Buffer, s: string) => true,
        normalize: (h: any, b: any) => ({ type: 'push', repoFullName: b.repository?.full_name, repoId: b.repository?.name, headCommit: 'HEAD' })
      } as unknown as ScmProvider;
      providerRegistry.register(mockProvider);
    }
    
    const provider = providerRegistry.get('github');
    if (!provider) {
      res.writeHead(500);
      return res.end('No SCM provider configured');
    }

    try {
      const payloadBuffer = Buffer.concat(chunks);
      const isValid = provider.verifyWebhookSignature(payloadBuffer, signature);
      if (!isValid) {
        res.writeHead(401);
        return res.end('Invalid signature');
      }

      // 4. Normalize the event (e.g. from GitHub push to Atlas internal event).
      // Assuming 'push' event for now.
      const normalizedEvent: any = provider.normalize(req.headers as Record<string, string>, JSON.parse(payload));
      const normalizedEvents = [normalizedEvent]; // wrap in array since previous code assumed array

      // 5. Enqueue each normalized event onto Temporal.
      const client = await getTemporalClient();
      for (const event of normalizedEvents) {
        if (event.type === 'push' || event.kind === 'RepoChanged' || event.kind === 'RepoAdded') {
          const repoId = event.repoId || event.raw?.repository?.name;
          const commitSha = event.headCommit || 'HEAD';
          // In reality, cloneUrl comes from the SCM Provider, but we construct it here for the example
          const cloneUrl = `https://github.com/${event.raw?.repository?.full_name}.git`;
          
          await client.workflow.start('incrementalIndexRepo', {
            args: [{ repoId, cloneUrl, commitSha }],
            taskQueue: 'ingestion-queue',
            workflowId: `index-${repoId}-${commitSha}-${Date.now()}`,
          });
        }
      }

      res.writeHead(202);
      res.end('Accepted');
    } catch (err) {
      console.error(err);
      res.writeHead(500);
      res.end('Internal error processing webhook');
    }
  });
});

const port = process.env.PORT || 3002;
server.listen(port, () => {
  console.log(`Webhook Ingress listening on port ${port}`);
});
