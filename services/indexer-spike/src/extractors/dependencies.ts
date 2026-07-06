/**
 * Dependency manifest extraction (docs/03 §extraction, docs/04 §dependency
 * tracking). Deterministic — no LLM. Phase 0 covers npm (package.json) and a
 * best-effort Python (requirements.txt); the full ten ecosystems + lockfiles are
 * the productionization. Output is a normalized manifest the org builder matches
 * against internal package coordinates to synthesize cross-repo DEPENDS_ON edges.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface DepRef { name: string; line: number }

export interface RepoManifest {
  repoId: string;
  ecosystem: 'npm' | 'python' | 'unknown';
  manifestPath: string; // repo-relative
  publishes: string | null;
  deps: DepRef[];
}

/** 1-indexed line of the first occurrence of a quoted key, else 1. */
function lineOf(raw: string, needle: string): number {
  const idx = raw.indexOf(needle);
  if (idx < 0) return 1;
  return raw.slice(0, idx).split('\n').length;
}

function parsePackageJson(raw: string, repoId: string): RepoManifest {
  let json: { name?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try { json = JSON.parse(raw); } catch { json = {}; }
  const depNames = [
    ...Object.keys(json.dependencies ?? {}),
    ...Object.keys(json.devDependencies ?? {}),
  ];
  return {
    repoId,
    ecosystem: 'npm',
    manifestPath: 'package.json',
    publishes: json.name ?? null,
    deps: depNames.map((name) => ({ name, line: lineOf(raw, `"${name}"`) })),
  };
}

function parseRequirements(raw: string, repoId: string): RepoManifest {
  const deps: DepRef[] = [];
  raw.split('\n').forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const name = trimmed.split(/[=<>!~ \[]/)[0]?.trim();
    if (name) deps.push({ name, line: i + 1 });
  });
  return { repoId, ecosystem: 'python', manifestPath: 'requirements.txt', publishes: null, deps };
}

export function extractManifests(repoDir: string, repoId: string): RepoManifest[] {
  const out: RepoManifest[] = [];
  const pkg = join(repoDir, 'package.json');
  if (existsSync(pkg)) out.push(parsePackageJson(readFileSync(pkg, 'utf8'), repoId));
  const req = join(repoDir, 'requirements.txt');
  if (existsSync(req)) out.push(parseRequirements(readFileSync(req, 'utf8'), repoId));
  return out;
}
