import { createRequire } from 'node:module';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { globSync } from 'glob';
import { Graph } from '../../../../packages/graph-core/src/index.ts';

const require = createRequire(import.meta.url);
const Parser = require('tree-sitter');
const TypeScript = require('tree-sitter-typescript').typescript;

export interface SymbolRef {
  name: string;
}

export interface ImportRef {
  name: string;
  source: string; // The module imported from, e.g., '@acme/auth-lib'
}

export interface RepoSymbols {
  repoId: string;
  moduleName: string | null;
  exports: SymbolRef[];
  imports: ImportRef[];
}

export function extractSymbols(repoDir: string, repoId: string): RepoSymbols {
  const exports: SymbolRef[] = [];
  const imports: ImportRef[] = [];
  
  let moduleName = null;
  try {
    const pkgPath = join(repoDir, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (pkg.name) moduleName = pkg.name;
    }
  } catch (e) {}
  
  const parser = new Parser();
  parser.setLanguage(TypeScript);

  const files = globSync('src/**/*.{ts,js,tsx,jsx}', { cwd: repoDir, absolute: true });

  for (const file of files) {
    if (!existsSync(file)) continue;
    const content = readFileSync(file, 'utf8');
    const tree = parser.parse(content);
    
    function traverse(node: any) {
      if (node.type === 'export_statement') {
        const decl = node.childForFieldName('declaration');
        if (decl) {
          if (['function_declaration', 'class_declaration'].includes(decl.type)) {
            const nameNode = decl.childForFieldName('name');
            if (nameNode) exports.push({ name: nameNode.text });
          } else if (decl.type === 'lexical_declaration' || decl.type === 'variable_declaration') {
            for (let i = 0; i < decl.namedChildCount; i++) {
              const child = decl.namedChild(i);
              if (child.type === 'variable_declarator') {
                const nameNode = child.childForFieldName('name');
                if (nameNode) exports.push({ name: nameNode.text });
              }
            }
          }
        }
        
        for (let i = 0; i < node.namedChildCount; i++) {
           const child = node.namedChild(i);
           if (child.type === 'export_clause') {
             for (let j = 0; j < child.namedChildCount; j++) {
               const spec = child.namedChild(j);
               if (spec.type === 'export_specifier') {
                 const nameNode = spec.childForFieldName('name');
                 if (nameNode) exports.push({ name: nameNode.text });
               }
             }
           }
        }
      } else if (node.type === 'import_statement') {
        const sourceNode = node.childForFieldName('source');
        if (sourceNode) {
          const source = sourceNode.text.replace(/['"]/g, '');
          
          for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (child.type === 'import_clause') {
              for (let j = 0; j < child.namedChildCount; j++) {
                const inner = child.namedChild(j);
                if (inner.type === 'named_imports') {
                  for (let k = 0; k < inner.namedChildCount; k++) {
                    const spec = inner.namedChild(k);
                    if (spec.type === 'import_specifier') {
                      const nameNode = spec.childForFieldName('name') || spec;
                      imports.push({ name: nameNode.text, source });
                    }
                  }
                } else if (inner.type === 'identifier') {
                  imports.push({ name: inner.text, source });
                }
              }
            }
          }
        }
      }
      for (let i = 0; i < node.namedChildCount; i++) {
        traverse(node.namedChild(i));
      }
    }
    
    traverse(tree.rootNode);
  }

  const uniqueExports = Array.from(new Set(exports.map(e => e.name))).map(name => ({ name }));
  const uniqueImports = [];
  const seenImports = new Set<string>();
  for (const imp of imports) {
    const key = `${imp.source}:${imp.name}`;
    if (!seenImports.has(key)) {
      seenImports.add(key);
      uniqueImports.push(imp);
    }
  }

  return { repoId, moduleName, exports: uniqueExports, imports: uniqueImports };
}

const repoNodeId = (r: string) => `repo:${r}`;

export function buildSymbolGraph(orgDir: string, tenantId = 'fixture-tenant'): { graph: Graph, repos: string[] } {
  const graph = new Graph();
  const repos: string[] = [];

  const repoDirs = readdirSync(orgDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => e.name);
    
  const symbolMap: Record<string, { repoId: string, symbols: Set<string> }> = {};
  const allParsed: RepoSymbols[] = [];

  for (const r of repoDirs) {
    repos.push(r);
    graph.addNode({ id: repoNodeId(r), type: 'Repo', name: r, tenantId, repoIds: [r] });
    
    const parsed = extractSymbols(join(orgDir, r), r);
    allParsed.push(parsed);
    
    if (parsed.moduleName) {
      symbolMap[parsed.moduleName] = {
        repoId: parsed.repoId,
        symbols: new Set(parsed.exports.map(e => e.name))
      };
    }
  }

  for (const parsed of allParsed) {
    for (const imp of parsed.imports) {
      const provider = symbolMap[imp.source];
      if (provider && provider.symbols.has(imp.name)) {
        // Emit cross-repo symbol edge
        graph.addEdge({
          srcId: repoNodeId(parsed.repoId),
          dstId: repoNodeId(provider.repoId),
          type: 'USES_SYMBOL',
          mechanism: 'scip:tree-sitter',
          confidence: 1,
          repoIds: [parsed.repoId],
          firstSeenCommit: 'HEAD',
          lastSeenCommit: 'HEAD',
          evidence: [{
            kind: 'file',
            repo: provider.repoId,
            path: `SCIP Resolution`,
            startLine: 1,
            endLine: 1,
            quote: `Imports '${imp.name}' from '${imp.source}'`
          }]
        });
      }
    }
  }

  return { graph, repos };
}
