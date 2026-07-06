/**
 * @atlas/scm-provider — the five ports every SCM backend must implement
 * (docs/01 §SCM provider abstraction). Core services depend ONLY on these
 * interfaces so adding GitLab/Bitbucket is a new adapter package + a registry
 * entry, with zero core changes. `@atlas/scm-github` is the sole Phase-1 adapter.
 */

export interface RepoRef {
  id: string;            // provider-stable id
  fullName: string;      // e.g. "acme/billing-service"
  defaultBranch: string;
  private: boolean;
}

export interface InstallationToken {
  token: string;
  expiresAt: string;     // ISO; short-lived (docs/04 token lifecycle)
  repoScope: string[];   // repo ids this token may touch (least privilege)
}

export interface NormalizedWebhookEvent {
  kind: 'RepoChanged' | 'RepoAdded' | 'RepoRemoved' | 'MembershipChanged' | 'Unknown';
  installationId: string;
  repoId?: string;
  headCommit?: string;
  raw: unknown;
}

export interface PullRequestInput {
  repoId: string;
  baseBranch: string;
  headBranch: string;
  title: string;
  body: string;
  /** exact reviewed file set — the adapter MUST reject commits outside this (docs/01 §2.2) */
  changes: { path: string; content: string; contentHash: string }[];
  reviewedDiffHash: string;
}

export interface PullRequestResult {
  url: string;
  number: number;
  committedContentHash: string;
}

/** 1. Auth. */
export interface ScmAuthPort {
  mintInstallationToken(installationId: string, repoScope: string[]): Promise<InstallationToken>;
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
}

/** 2. Repository enumeration. */
export interface ScmReposPort {
  listRepos(installationId: string): Promise<RepoRef[]>;
  getRepo(installationId: string, repoId: string): Promise<RepoRef>;
  /** repos a given user identity can read — feeds permission mirroring (docs/08 §3.2) */
  listUserReadableRepos(userToken: string): Promise<string[]>;
}

/** 3. Clone access. */
export interface ScmClonePort {
  /** returns an authenticated clone URL for a blobless partial clone (docs/04 §clone) */
  cloneUrl(token: InstallationToken, repoId: string): Promise<string>;
}

/** 4. Webhooks. */
export interface ScmWebhookPort {
  normalize(headers: Record<string, string>, body: unknown): NormalizedWebhookEvent;
}

/** 5. Pull requests. */
export interface ScmPullRequestPort {
  openPullRequest(token: InstallationToken, input: PullRequestInput): Promise<PullRequestResult>;
}

export interface ScmProvider
  extends ScmAuthPort, ScmReposPort, ScmClonePort, ScmWebhookPort, ScmPullRequestPort {
  readonly name: 'github' | 'gitlab' | 'bitbucket';
}

/** Provider registry — resolve the adapter for a connected account. */
export class ScmProviderRegistry {
  private readonly providers = new Map<string, ScmProvider>();
  register(p: ScmProvider): void { this.providers.set(p.name, p); }
  get(name: string): ScmProvider {
    const p = this.providers.get(name);
    if (!p) throw new Error(`no SCM provider registered for "${name}"`);
    return p;
  }
}
