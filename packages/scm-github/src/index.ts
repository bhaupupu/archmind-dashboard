import * as crypto from 'crypto';
import type {
  ScmProvider,
  InstallationToken,
  RepoRef,
  NormalizedWebhookEvent,
  PullRequestInput,
  PullRequestResult
} from '@atlas/scm-provider';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { verify } from '@octokit/webhooks-methods';

export interface GitHubProviderConfig {
  appId: string;
  privateKey: string;
  webhookSecret: string;
  clientId: string;
  clientSecret: string;
}

export class GitHubProvider implements ScmProvider {
  public readonly name = 'github';
  private config: GitHubProviderConfig;

  constructor(config: GitHubProviderConfig) {
    this.config = config;
  }

  private getAppAuth() {
    return createAppAuth({
      appId: this.config.appId,
      privateKey: this.config.privateKey,
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
    });
  }

  // 1. Auth Port
  async mintInstallationToken(installationId: string, repoScope: string[]): Promise<InstallationToken> {
    const auth = this.getAppAuth();
    const installationAuthentication = await auth({
      type: 'installation',
      installationId: parseInt(installationId, 10),
      repositoryIds: repoScope.map(id => parseInt(id, 10)),
    });

    return {
      token: installationAuthentication.token,
      expiresAt: installationAuthentication.expiresAt,
      repoScope: repoScope,
    };
  }


  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const hmac = crypto.createHmac('sha256', this.config.webhookSecret);
    const digest = 'sha256=' + hmac.update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
    } catch {
      return false;
    }
  }

  // 2. Repos Port
  async listRepos(installationId: string): Promise<RepoRef[]> {
    const auth = this.getAppAuth();
    const { token } = await auth({ type: 'installation', installationId: parseInt(installationId, 10) });
    const octokit = new Octokit({ auth: token });
    
    const repos = await octokit.paginate(octokit.apps.listReposAccessibleToInstallation);
    return repos.map(repo => ({
      id: repo.id.toString(),
      fullName: repo.full_name,
      defaultBranch: repo.default_branch,
      private: repo.private,
    }));
  }

  async getRepo(installationId: string, repoId: string): Promise<RepoRef> {
    const auth = this.getAppAuth();
    const { token } = await auth({ type: 'installation', installationId: parseInt(installationId, 10) });
    const octokit = new Octokit({ auth: token });

    const { data: repo } = await octokit.request('GET /repositories/{repository_id}', {
      repository_id: parseInt(repoId, 10),
    });

    return {
      id: repo.id.toString(),
      fullName: repo.full_name,
      defaultBranch: repo.default_branch,
      private: repo.private,
    };
  }

  async listUserReadableRepos(userToken: string): Promise<string[]> {
    const octokit = new Octokit({ auth: userToken });
    const installations = await octokit.paginate(octokit.apps.listInstallationsForAuthenticatedUser);
    
    const repoIds: string[] = [];
    for (const inst of installations) {
      const repos = await octokit.paginate(octokit.apps.listInstallationReposForAuthenticatedUser, {
        installation_id: inst.id,
      });
      for (const repo of repos) {
        repoIds.push(repo.id.toString());
      }
    }
    return repoIds;
  }

  // 3. Clone Port
  async cloneUrl(token: InstallationToken, repoId: string): Promise<string> {
    // To generate the clone url, we need the repo full name. 
    // Wait, cloneUrl only receives token and repoId. We might need to fetch the repo details to get the full_name.
    // Let's instantiate octokit with the token and get the repo.
    const octokit = new Octokit({ auth: token.token });
    const { data: repo } = await octokit.request('GET /repositories/{repository_id}', {
      repository_id: parseInt(repoId, 10),
    });
    
    return `https://x-access-token:${token.token}@github.com/${repo.full_name}.git`;
  }

  // 4. Webhook Port
  normalize(headers: Record<string, string>, body: any): NormalizedWebhookEvent {
    const event = headers['x-github-event'] || headers['X-GitHub-Event'];
    const action = body?.action;
    
    let kind: NormalizedWebhookEvent['kind'] = 'Unknown';
    if (event === 'push') kind = 'RepoChanged';
    else if (event === 'repository' && action === 'created') kind = 'RepoAdded';
    else if (event === 'repository' && (action === 'deleted' || action === 'archived')) kind = 'RepoRemoved';
    else if (event === 'installation_repositories' && action === 'added') kind = 'RepoAdded';
    else if (event === 'installation_repositories' && action === 'removed') kind = 'RepoRemoved';
    else if (event === 'member') kind = 'MembershipChanged';

    return {
      kind,
      installationId: body?.installation?.id?.toString() || '',
      repoId: body?.repository?.id?.toString(),
      headCommit: body?.after, // for push events
      raw: body,
    };
  }

  // 5. Pull Request Port
  async openPullRequest(token: InstallationToken, input: PullRequestInput): Promise<PullRequestResult> {
    const octokit = new Octokit({ auth: token.token });
    
    // 1. Get repo details
    const { data: repo } = await octokit.request('GET /repositories/{repository_id}', {
      repository_id: parseInt(input.repoId, 10),
    });
    const owner = repo.owner.login;
    const repoName = repo.name;

    // 2. Get base branch ref
    const { data: baseRef } = await octokit.git.getRef({
      owner,
      repo: repoName,
      ref: `heads/${input.baseBranch}`,
    });

    // 3. Create head branch
    await octokit.git.createRef({
      owner,
      repo: repoName,
      ref: `refs/heads/${input.headBranch}`,
      sha: baseRef.object.sha,
    });

    // 4. Create blobs and tree
    const tree = await Promise.all(
      input.changes.map(async change => {
        const { data: blob } = await octokit.git.createBlob({
          owner,
          repo: repoName,
          content: change.content,
          encoding: 'utf-8',
        });
        return {
          path: change.path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha,
        };
      })
    );

    const { data: newTree } = await octokit.git.createTree({
      owner,
      repo: repoName,
      base_tree: baseRef.object.sha,
      tree,
    });

    // 5. Create commit
    const { data: commit } = await octokit.git.createCommit({
      owner,
      repo: repoName,
      message: input.title,
      tree: newTree.sha,
      parents: [baseRef.object.sha],
    });

    // 6. Update head branch ref
    await octokit.git.updateRef({
      owner,
      repo: repoName,
      ref: `heads/${input.headBranch}`,
      sha: commit.sha,
    });

    // 7. Open PR
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo: repoName,
      title: input.title,
      head: input.headBranch,
      base: input.baseBranch,
      body: input.body,
    });

    return {
      url: pr.html_url,
      number: pr.number,
      committedContentHash: commit.sha,
    };
  }
}
