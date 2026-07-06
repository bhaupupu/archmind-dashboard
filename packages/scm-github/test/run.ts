import * as assert from 'assert';
import { GitHubProvider } from '../src/index';
import * as crypto from 'crypto';

function testNormalizeWebhook() {
  const provider = new GitHubProvider({
    appId: 'test',
    privateKey: 'test',
    webhookSecret: 'test_secret',
    clientId: 'test',
    clientSecret: 'test',
  });

  const pushEvent = provider.normalize(
    { 'x-github-event': 'push' },
    { installation: { id: 123 }, repository: { id: 456 }, after: 'commit_sha' }
  );
  assert.strictEqual(pushEvent.kind, 'RepoChanged');
  assert.strictEqual(pushEvent.installationId, '123');
  assert.strictEqual(pushEvent.repoId, '456');
  assert.strictEqual(pushEvent.headCommit, 'commit_sha');

  const repoAddedEvent = provider.normalize(
    { 'x-github-event': 'repository' },
    { action: 'created', installation: { id: 123 }, repository: { id: 456 } }
  );
  assert.strictEqual(repoAddedEvent.kind, 'RepoAdded');

  console.log('✅ testNormalizeWebhook passed');
}

function testVerifyWebhookSignature() {
  const secret = 'test_secret';
  const provider = new GitHubProvider({
    appId: 'test',
    privateKey: 'test',
    webhookSecret: secret,
    clientId: 'test',
    clientSecret: 'test',
  });

  const payload = '{"test": true}';
  const hmac = crypto.createHmac('sha256', secret);
  const signature = 'sha256=' + hmac.update(payload).digest('hex');

  const isValid = provider.verifyWebhookSignature(Buffer.from(payload), signature);
  assert.strictEqual(isValid, true);

  const isInvalid = provider.verifyWebhookSignature(Buffer.from(payload), 'sha256=invalid');
  assert.strictEqual(isInvalid, false);

  console.log('✅ testVerifyWebhookSignature passed');
}

function runAll() {
  console.log('Running GitHub Provider tests...');
  testNormalizeWebhook();
  testVerifyWebhookSignature();
  console.log('All tests passed.');
}

runAll();
