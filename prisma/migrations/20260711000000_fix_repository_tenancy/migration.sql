-- Repository.githubId was globally unique, so two users selecting the same
-- GitHub repo collided: the second user's upsert updated the first user's row
-- and the repo never appeared in the second user's account. Uniqueness is
-- per-tenant.
DROP INDEX "Repository_githubId_key";

CREATE UNIQUE INDEX "Repository_githubId_userId_key" ON "Repository"("githubId", "userId");

-- Postgres does not auto-index FK columns; these back the per-tenant findMany
-- filters and cascade deletes.
CREATE INDEX "Repository_userId_idx" ON "Repository"("userId");

CREATE INDEX "Analysis_userId_idx" ON "Analysis"("userId");

CREATE INDEX "PullRequest_userId_idx" ON "PullRequest"("userId");

CREATE INDEX "PullRequest_analysisId_idx" ON "PullRequest"("analysisId");
