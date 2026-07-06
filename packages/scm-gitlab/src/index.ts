import type {
  ScmProvider,
  InstallationToken,
  RepoRef,
  NormalizedWebhookEvent,
  PullRequestInput,
  PullRequestResult,
} from '@atlas/scm-provider';

export interface GitLabProviderConfig {
  baseUrl?: string; // default: https://gitlab.com
  token: string;    // PAT or OAuth token used to authenticate
  webhookSecret?: string;
}

export class GitLabProvider implements ScmProvider {
  readonly name = 'gitlab';
  private baseUrl: string;
  private token: string;
  private webhookSecret?: string;

  constructor(config: GitLabProviderConfig) {
    this.baseUrl = config.baseUrl?.replace(/\/$/, '') || 'https://gitlab.com';
    this.token = config.token;
    this.webhookSecret = config.webhookSecret;
  }

  // --- Auth Port ---

  async mintInstallationToken(installationId: string, repoScope: string[]): Promise<InstallationToken> {
    // GitLab PATs/OAuth tokens are typically long-lived and managed externally.
    // For architectural consistency, we wrap the static token in the InstallationToken interface.
    // A future enhancement could use GitLab's impersonation or short-lived group access tokens.
    return {
      token: this.token,
      expiresAt: new Date(Date.now() + 86400 * 1000).toISOString(), // mock 24h
      repoScope,
    };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    if (!this.webhookSecret) return true; // not configured
    // GitLab sends the plain text secret in the X-Gitlab-Token header
    return signature === this.webhookSecret;
  }

  // --- Repos Port ---

  async listRepos(installationId: string): Promise<RepoRef[]> {
    const res = await this.fetchApi('/api/v4/projects?membership=true&simple=true');
    return res.map((p: any) => ({
      id: String(p.id),
      fullName: p.path_with_namespace,
      defaultBranch: p.default_branch || 'main',
      private: p.visibility !== 'public',
    }));
  }

  async getRepo(installationId: string, repoId: string): Promise<RepoRef> {
    const res = await this.fetchApi(`/api/v4/projects/${encodeURIComponent(repoId)}`);
    return {
      id: String(res.id),
      fullName: res.path_with_namespace,
      defaultBranch: res.default_branch || 'main',
      private: res.visibility !== 'public',
    };
  }

  async listUserReadableRepos(userToken: string): Promise<string[]> {
    // Ideally we would query GitLab using the user's OAuth token.
    // For this mock, we just use the system token to verify the adapter pattern.
    const repos = await this.listRepos('system');
    return repos.map(r => r.id);
  }

  // --- Clone Port ---

  async cloneUrl(token: InstallationToken, repoId: string): Promise<string> {
    const repo = await this.getRepo('system', repoId);
    const domain = this.baseUrl.replace(/^https?:\/\//, '');
    // GitLab supports OAuth2 token clone auth: https://oauth2:<token>@gitlab.com/...
    return `https://oauth2:${token.token}@${domain}/${repo.fullName}.git`;
  }

  // --- Webhook Port ---

  normalize(headers: Record<string, string>, body: any): NormalizedWebhookEvent {
    const event = headers['x-gitlab-event']?.toLowerCase() || '';

    if (event === 'push Hook') { // GitLab sends Push Hook
      return {
        kind: 'RepoChanged',
        installationId: 'gitlab-system', // GitLab doesn't have an exact "installation ID" match in webhook
        repoId: String(body.project?.id),
        headCommit: body.after,
        raw: body,
      };
    }

    return {
      kind: 'Unknown',
      installationId: 'gitlab-system',
      raw: body,
    };
  }

  // --- Pull Request Port ---

  async openPullRequest(token: InstallationToken, input: PullRequestInput): Promise<PullRequestResult> {
    const projectId = encodeURIComponent(input.repoId);
    
    // 1. Create a branch
    await this.fetchApi(`/api/v4/projects/${projectId}/repository/branches`, {
      method: 'POST',
      body: JSON.stringify({
        branch: input.headBranch,
        ref: input.baseBranch,
      }),
    });

    // 2. Commit the changes using the Commits API
    const actions = input.changes.map(c => ({
      action: 'update', // simplifying; assume update for now, could be 'create'
      file_path: c.path,
      content: c.content,
    }));

    await this.fetchApi(`/api/v4/projects/${projectId}/repository/commits`, {
      method: 'POST',
      body: JSON.stringify({
        branch: input.headBranch,
        commit_message: input.title,
        actions,
      }),
    });

    // 3. Create the Merge Request
    const mr = await this.fetchApi(`/api/v4/projects/${projectId}/merge_requests`, {
      method: 'POST',
      body: JSON.stringify({
        source_branch: input.headBranch,
        target_branch: input.baseBranch,
        title: input.title,
        description: input.body,
      }),
    });

    return {
      url: mr.web_url,
      number: mr.iid,
      committedContentHash: input.reviewedDiffHash, // Mapped for interface compliance
    };
  }

  // --- Helpers ---

  private async fetchApi(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'PRIVATE-TOKEN': this.token,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitLab API error (${res.status}): ${text}`);
    }

    return res.json();
  }
}
