/** Extension → language detection (docs/04 §parsing table). Phase 0 = by extension. */
import type { Language } from '../../../packages/shared-types/src/index.ts';

const EXT_MAP: Record<string, Language> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.mts': 'typescript', '.cts': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.py': 'python', '.pyi': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.cs': 'csharp',
  '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.hpp': 'cpp', '.h': 'cpp',
  '.php': 'php',
  '.rb': 'ruby',
  '.md': 'markdown', '.markdown': 'markdown',
  '.yaml': 'yaml', '.yml': 'yaml',
  '.json': 'json',
};

export function detectLanguage(path: string): Language {
  const dot = path.lastIndexOf('.');
  if (dot < 0) return 'unknown';
  const ext = path.slice(dot).toLowerCase();
  return EXT_MAP[ext] ?? 'unknown';
}

/** Structure-aware chunking is defined for these; others fall back to fixed windows. */
export function hasStructureAwareChunking(lang: Language): boolean {
  return lang === 'typescript' || lang === 'javascript' || lang === 'python';
}
