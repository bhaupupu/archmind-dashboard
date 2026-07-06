-- Atlas — initial schema (subset of docs/06-data-architecture.md).
-- Postgres 16. Every tenant-scoped table carries tenant_id and FORCE ROW LEVEL
-- SECURITY; the app sets `SET LOCAL app.tenant_id` per transaction. missing_ok
-- is FALSE so a forgotten SET raises rather than silently disabling the fence.
--
-- Apply (once Postgres is available):
--   psql "$DATABASE_URL" -f infra/migrations/0001_init.sql

BEGIN;



-- --- Tenancy / identity -----------------------------------------------------
CREATE TABLE tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  tier          text NOT NULL DEFAULT 'cloud' CHECK (tier IN ('cloud','vpc','byoc')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  github_login  text NOT NULL,
  email         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, github_login)
);

CREATE TABLE memberships (
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('viewer','member','approver','admin','owner')),
  PRIMARY KEY (tenant_id, user_id)
);

-- --- SCM install / repos ----------------------------------------------------
CREATE TABLE scm_installations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider          text NOT NULL DEFAULT 'github' CHECK (provider IN ('github','gitlab','bitbucket')),
  external_install_id text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_install_id)
);

CREATE TABLE repositories (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  installation_id   uuid NOT NULL REFERENCES scm_installations(id) ON DELETE CASCADE,
  full_name         text NOT NULL,
  default_branch    text NOT NULL DEFAULT 'main',
  last_indexed_commit text,
  scip_status       text NOT NULL DEFAULT 'none' CHECK (scip_status IN ('none','pending','indexed','failed')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, full_name)
);

-- Mirror of GitHub repo read permissions (docs/08 §3.2). Canonical name.
CREATE TABLE repo_access_mirror (
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_id     uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  permission  text NOT NULL CHECK (permission IN ('read','triage','write','maintain','admin')),
  synced_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id, repo_id)
);
CREATE INDEX idx_ram_staleness ON repo_access_mirror (tenant_id, synced_at);

-- --- Indexing ---------------------------------------------------------------
CREATE TABLE index_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  repo_id       uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  commit        text NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('full','incremental')),
  status        text NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed')),
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz
);

CREATE TABLE files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  repo_id       uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  path          text NOT NULL,
  language      text NOT NULL,
  content_sha   text NOT NULL,  -- git blob sha: identity/dedupe ONLY, NOT a read path
  redacted_sha  text,           -- hash of POST-redaction bytes; keys the ONLY served S3 blob
  redaction_spans jsonb NOT NULL DEFAULT '[]',
  UNIQUE (tenant_id, repo_id, path)
);
CREATE INDEX idx_files_blob ON files (tenant_id, content_sha);
CREATE INDEX idx_files_redacted ON files (tenant_id, redacted_sha);

CREATE TABLE chunks (
  id            text PRIMARY KEY,  -- content-addressed = sha256(normalized redacted content)
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  repo_id       uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  file_id       uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  kind          text NOT NULL,
  symbol        text,
  start_line    int NOT NULL,
  end_line      int NOT NULL,
  qdrant_point_id uuid NOT NULL   -- vector lives in Qdrant, not here
);
CREATE INDEX idx_chunks_repo ON chunks (tenant_id, repo_id);

-- Relational mirror of graph dependency edges for bulk joins (docs/03, docs/06).
CREATE TABLE dependency_edges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  src_repo_id   uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  dst_repo_id   uuid REFERENCES repositories(id) ON DELETE CASCADE,
  edge_type     text NOT NULL,
  mechanism     text NOT NULL,
  confidence    real NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  evidence      jsonb NOT NULL DEFAULT '[]',
  first_seen_commit text,
  last_seen_commit  text,
  ended_at      timestamptz
);
CREATE INDEX idx_depedges_src ON dependency_edges (tenant_id, src_repo_id, edge_type);

-- --- Analyses / plans / PRs -------------------------------------------------
CREATE TABLE analysis_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt        text NOT NULL,
  mode          text NOT NULL DEFAULT 'advisory' CHECK (mode IN ('advisory','autonomous')),
  status        text NOT NULL DEFAULT 'running',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE impact_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  analysis_id   uuid NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  body          jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE repo_findings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  analysis_id   uuid NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  repo_id       uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  disposition   text NOT NULL CHECK (disposition IN ('must_change','may_change','no_change')),
  rationale     text NOT NULL,
  evidence      jsonb NOT NULL DEFAULT '[]',
  confidence    real NOT NULL CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE TABLE change_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  analysis_id   uuid NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  repo_id       uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  required_changes      jsonb NOT NULL DEFAULT '[]',
  technical_approach    text NOT NULL,
  side_effects          jsonb NOT NULL DEFAULT '[]',
  testing_requirements  jsonb NOT NULL DEFAULT '[]',
  migration_requirements jsonb NOT NULL DEFAULT '[]'
);

CREATE TABLE generated_prs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  analysis_id   uuid NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  repo_id       uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  url           text,
  plan_hash     text NOT NULL,
  committed_content_hash text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- --- Dashboard / audit ------------------------------------------------------
CREATE TABLE prompt_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prompt        text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE saved_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  state         jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE approvals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  analysis_id   uuid NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  gate          text NOT NULL CHECK (gate IN ('gate0','gate1','gate2')),
  approved_by   uuid REFERENCES users(id),
  decision      text NOT NULL CHECK (decision IN ('approved','rejected','pending')),
  plan_hash     text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id            bigserial PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES users(id),
  action        text NOT NULL,
  target        text,
  metadata      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usage_metering (
  id            bigserial PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  analysis_id   uuid REFERENCES analysis_runs(id) ON DELETE SET NULL,
  model         text,
  input_tokens  bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  usd_estimate  numeric(12,4) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- --- Row-level security -----------------------------------------------------
-- Apply the same policy to every tenant-scoped table. missing_ok = FALSE.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users USING (tenant_id = current_setting('app.tenant_id', false)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON memberships USING (tenant_id = current_setting('app.tenant_id', false)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE scm_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE scm_installations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON scm_installations USING (tenant_id = current_setting('app.tenant_id', false)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE repositories FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON repositories USING (tenant_id = current_setting('app.tenant_id', false)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE repo_access_mirror ENABLE ROW LEVEL SECURITY;
ALTER TABLE repo_access_mirror FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON repo_access_mirror USING (tenant_id = current_setting('app.tenant_id', false)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE index_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE index_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON index_runs USING (tenant_id = current_setting('app.tenant_id', false)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE files FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON files USING (tenant_id = current_setting('app.tenant_id', false)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON chunks USING (tenant_id = current_setting('app.tenant_id', false)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE dependency_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependency_edges FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON dependency_edges USING (tenant_id = current_setting('app.tenant_id', false)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON analysis_runs USING (tenant_id = current_setting('app.tenant_id', false)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE impact_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE impact_reports FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON impact_reports USING (tenant_id = current_setting('app.tenant_id', false)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE repo_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE repo_findings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON repo_findings USING (tenant_id = current_setting('app.tenant_id', false)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE change_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_plans FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON change_plans USING (tenant_id = current_setting('app.tenant_id', false)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE generated_prs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_prs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON generated_prs USING (tenant_id = current_setting('app.tenant_id', false)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE prompt_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_history FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON prompt_history USING (tenant_id = current_setting('app.tenant_id', false)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE saved_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON saved_sessions USING (tenant_id = current_setting('app.tenant_id', false)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON approvals USING (tenant_id = current_setting('app.tenant_id', false)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_log USING (tenant_id = current_setting('app.tenant_id', false)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

ALTER TABLE usage_metering ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metering FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON usage_metering USING (tenant_id = current_setting('app.tenant_id', false)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', false)::uuid);

COMMIT;
