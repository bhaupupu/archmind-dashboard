import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import type { ImpactReport } from '../../../packages/shared-types/src/index.ts';
import { randomUUID } from 'node:crypto';
import { cache } from '../../../packages/config/src/index.ts';

const DB_PATH = resolve(process.cwd(), '.data', 'pg');
let pg: PGlite;

export const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000000';
export const DEFAULT_USER = '11111111-1111-1111-1111-111111111111';

export async function loadDb() {
  if (!existsSync(dirname(DB_PATH))) {
    mkdirSync(dirname(DB_PATH), { recursive: true });
  }

  pg = new PGlite(DB_PATH);
  await pg.waitReady;

  const res = await pg.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'analysis_runs'
    );
  `);

  if (!(res.rows[0] as any).exists) {
    const ddlPath = resolve(process.cwd(), 'infra/migrations/0001_init.sql');
    if (existsSync(ddlPath)) {
      const ddl = readFileSync(ddlPath, 'utf8');
      try {
        await pg.exec(ddl);
        console.log('Migration 0001_init.sql applied successfully.');

        // Seed the default tenant and user so foreign keys don't fail
        await pg.query('INSERT INTO tenants (id, name, tier) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [DEFAULT_TENANT, 'Default Tenant', 'cloud']);
        await pg.query('INSERT INTO users (id, tenant_id, github_login) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [DEFAULT_USER, DEFAULT_TENANT, 'local-dev']);
      } catch (e: any) {
        console.error('Migration failed:', e.message);
        throw e;
      }
    } else {
      console.error('Could not find migration 0001_init.sql');
    }
  }

  // Check for audit_logs table
  const auditRes = await pg.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'audit_logs'
    );
  `);

  if (!(auditRes.rows[0] as any).exists) {
    const ddlPath = resolve(process.cwd(), 'infra/migrations/0002_audit.sql');
    if (existsSync(ddlPath)) {
      const ddl = readFileSync(ddlPath, 'utf8');
      try {
        await pg.exec(ddl);
        console.log('Migration 0002_audit.sql applied successfully.');
      } catch (e: any) {
        console.error('Migration failed:', e.message);
        throw e;
      }
    }
  }
}

export async function saveDb() {
  // no-op for postgres
}

function resolveTenantId(id: string) {
  if (id === 'default' || !id || !id.includes('-')) return DEFAULT_TENANT;
  return id;
}

export async function logAudit(tenantId: string, userId: string, action: string, resource: string, payload: any) {
  const tid = resolveTenantId(tenantId);
  const uid = userId || DEFAULT_USER;
  try {
    await pg.query(
      'INSERT INTO audit_logs (tenant_id, user_id, action, resource, payload) VALUES ($1, $2, $3, $4, $5)',
      [tid, uid, action, resource, JSON.stringify(payload)]
    );
  } catch (err) {
    console.error('Failed to log audit event', err);
  }
}

export async function saveAnalysis(report: ImpactReport, tenantId: string = DEFAULT_TENANT) {
  const tid = resolveTenantId(tenantId);
  let analysisId = report.analysisId;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(analysisId);
  if (!isUuid) {
    // Generate a valid UUID if the report uses a mock agent ID
    analysisId = randomUUID();
    report.analysisId = analysisId;
  }
  
  await pg.exec('BEGIN');
  try {
    await pg.query("SELECT set_config('app.tenant_id', $1, true)", [tid]);
    
    // Check if run exists, if not, create it
    const existing = await pg.query('SELECT id FROM analysis_runs WHERE id = $1', [analysisId]);
    if (existing.rows.length === 0) {
      await pg.query('INSERT INTO analysis_runs (id, tenant_id, user_id, prompt, mode, status) VALUES ($1, $2, $3, $4, $5, $6)',
        [analysisId, tid, DEFAULT_USER, report.prompt, 'advisory', 'succeeded']);
    }
    
    await pg.query('INSERT INTO impact_reports (id, tenant_id, analysis_id, body) VALUES (gen_random_uuid(), $1, $2, $3)', 
      [tid, analysisId, JSON.stringify(report)]);

    await pg.exec('COMMIT');
    
    // Write-through to cache
    await cache.set(`analysis:${tid}:${analysisId}`, report, 3600);
  } catch (err) {
    await pg.exec('ROLLBACK');
    console.error('Failed to save analysis', err);
  }
}

export async function getAnalysis(id: string, tenantId: string = DEFAULT_TENANT): Promise<ImpactReport | undefined> {
  const tid = resolveTenantId(tenantId);
  
  // Read-through from cache
  const cached = await cache.get<ImpactReport>(`analysis:${tid}:${id}`);
  if (cached) {
    return cached;
  }
  
  try {
    await pg.exec('BEGIN');
    await pg.query("SELECT set_config('app.tenant_id', $1, true)", [tid]);
    const res = await pg.query('SELECT body FROM impact_reports WHERE analysis_id = $1 ORDER BY created_at DESC LIMIT 1', [id]);
    await pg.exec('COMMIT');
    if (res.rows.length > 0) {
      const report = (res.rows[0] as any).body as ImpactReport;
      await cache.set(`analysis:${tid}:${id}`, report, 3600);
      return report;
    }
  } catch(e) {
    await pg.exec('ROLLBACK');
    console.error('Failed to get analysis', e);
  }
  return undefined;
}

export async function savePromptHistory(tenantId: string, prompt: string, at: string) {
  const tid = resolveTenantId(tenantId);
  try {
    await pg.exec('BEGIN');
    await pg.query("SELECT set_config('app.tenant_id', $1, true)", [tid]);
    await pg.query('INSERT INTO prompt_history (tenant_id, user_id, prompt, created_at) VALUES ($1, $2, $3, $4)', 
      [tid, DEFAULT_USER, prompt, at]);
    await pg.exec('COMMIT');
  } catch(e) {
    await pg.exec('ROLLBACK');
    console.error(e);
  }
}

export async function getPromptHistory(tenantId: string) {
  const tid = resolveTenantId(tenantId);
  try {
    await pg.exec('BEGIN');
    await pg.query("SELECT set_config('app.tenant_id', $1, true)", [tid]);
    const res = await pg.query('SELECT prompt, created_at as at FROM prompt_history WHERE tenant_id = $1 ORDER BY created_at DESC', [tid]);
    await pg.exec('COMMIT');
    return res.rows.map((r: any) => ({ tenantId: tid, prompt: r.prompt, at: r.at }));
  } catch(e) {
    await pg.exec('ROLLBACK');
    console.error(e);
    return [];
  }
}
