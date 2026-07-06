/**
 * Structure-aware chunking (docs/02 §chunking). Phase 0 uses tree-sitter queries 
 * for TS/JS/Python and fixed windows for everything else.
 * The output contract (a list of {startLine,endLine,symbol,kind}) is what the 
 * rest of the pipeline consumes.
 */
import { createRequire } from 'node:module';
import type { ChunkKind, Language } from '../../../packages/shared-types/src/index.ts';
import { hasStructureAwareChunking } from './languages.ts';

const require = createRequire(import.meta.url);
const Parser = require('tree-sitter');
const JavaScript = require('tree-sitter-javascript');
const TypeScript = require('tree-sitter-typescript').typescript;
const Python = require('tree-sitter-python');

export interface RawChunk {
  startLine: number; // 1-indexed inclusive
  endLine: number;   // 1-indexed inclusive
  symbol: string | null;
  kind: ChunkKind;
  content: string;
}

const MAX_LINES = 200;
const MIN_LINES = 3;

export function chunk(content: string, language: Language): RawChunk[] {
  const lines = content.split('\n');
  if (lines.length <= MIN_LINES) {
    return [{ startLine: 1, endLine: lines.length, symbol: null, kind: kindForDoc(language), content }];
  }
  if (language === 'python') return capAll(chunkWithTreeSitter(content, lines, Python, 'python'), lines);
  if (language === 'javascript') return capAll(chunkWithTreeSitter(content, lines, JavaScript, 'javascript'), lines);
  if (language === 'typescript') return capAll(chunkWithTreeSitter(content, lines, TypeScript, 'typescript'), lines);
  if (!hasStructureAwareChunking(language)) return capAll(chunkWindows(lines), lines);
  return capAll(chunkWindows(lines), lines);
}

function kindForDoc(language: Language): ChunkKind {
  if (language === 'markdown') return 'doc';
  if (language === 'yaml' || language === 'json') return 'config';
  return 'block';
}

function chunkWithTreeSitter(content: string, lines: string[], langModule: any, language: string): RawChunk[] {
  const parser = new Parser();
  parser.setLanguage(langModule);
  const tree = parser.parse(content);
  
  const chunks: RawChunk[] = [];
  
  // Collect target AST nodes
  const targetNodes: any[] = [];
  
  function traverse(node: any) {
    let isTarget = false;
    if (language === 'python') {
      if (['function_definition', 'class_definition', 'async_function_definition'].includes(node.type)) {
        isTarget = true;
      }
    } else {
      if (['function_declaration', 'class_declaration', 'method_definition'].includes(node.type)) {
        isTarget = true;
      } else if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
        // Find if it has an arrow function
        for (let i = 0; i < node.namedChildCount; i++) {
          const child = node.namedChild(i);
          if (child.type === 'variable_declarator') {
            const val = child.childForFieldName('value');
            if (val && (val.type === 'arrow_function' || val.type === 'function_expression')) {
               isTarget = true;
            }
          }
        }
      }
    }
    
    if (isTarget) {
      targetNodes.push(node);
    }
    
    for (let i = 0; i < node.namedChildCount; i++) {
      traverse(node.namedChild(i));
    }
  }
  
  traverse(tree.rootNode);
  
  if (targetNodes.length === 0) {
    return chunkWindows(lines);
  }
  
  // Sort nodes by line order (just to be safe)
  targetNodes.sort((a, b) => a.startPosition.row - b.startPosition.row);
  
  // We want to capture any code *before* the first node (e.g. imports)
  const firstNodeRow = targetNodes[0].startPosition.row;
  if (firstNodeRow >= MIN_LINES) {
    chunks.push({
      startLine: 1,
      endLine: firstNodeRow,
      symbol: null,
      kind: 'block',
      content: lines.slice(0, firstNodeRow).join('\n')
    });
  }
  
  // Add each target node as a chunk
  for (const node of targetNodes) {
    const startRow = node.startPosition.row;
    const endRow = node.endPosition.row;
    
    // Attempt to extract symbol name
    let symbol = null;
    let kind: ChunkKind = 'block';
    
    if (language === 'python') {
      kind = node.type === 'class_definition' ? 'class' : 'function';
      const nameNode = node.childForFieldName('name');
      if (nameNode) symbol = nameNode.text;
    } else {
      kind = node.type === 'class_declaration' ? 'class' : 'function';
      if (node.type === 'method_definition') kind = 'function';
      
      const nameNode = node.childForFieldName('name');
      if (nameNode) symbol = nameNode.text;
      
      // Variable declaration arrow function
      if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
        for (let i = 0; i < node.namedChildCount; i++) {
          const child = node.namedChild(i);
          if (child.type === 'variable_declarator') {
            const nameNode = child.childForFieldName('name');
            if (nameNode) symbol = nameNode.text;
          }
        }
      }
    }
    
    const endLine = Math.min(endRow + 1, lines.length);
    chunks.push({
      startLine: startRow + 1,
      endLine: endLine,
      symbol: symbol || null,
      kind,
      content: lines.slice(startRow, endLine).join('\n')
    });
  }
  
  return chunks;
}

// --- Fallback: fixed windows ----------------------------------------------------
function chunkWindows(lines: string[], size = 60): RawChunk[] {
  const out: RawChunk[] = [];
  for (let i = 0; i < lines.length; i += size) {
    const end = Math.min(i + size, lines.length);
    out.push({ startLine: i + 1, endLine: end, symbol: null, kind: 'block', content: lines.slice(i, end).join('\n') });
  }
  return out;
}

/** Split any oversize chunk into <= MAX_LINES windows; drop empties. */
function capAll(chunks: RawChunk[], _lines: string[]): RawChunk[] {
  const out: RawChunk[] = [];
  for (const c of chunks) {
    if (c.content.trim().length === 0) continue;
    const len = c.endLine - c.startLine + 1;
    if (len <= MAX_LINES) { out.push(c); continue; }
    const cl = c.content.split('\n');
    for (let i = 0; i < cl.length; i += MAX_LINES) {
      const slice = cl.slice(i, i + MAX_LINES);
      out.push({
        startLine: c.startLine + i,
        endLine: c.startLine + i + slice.length - 1,
        symbol: c.symbol,
        kind: c.kind,
        content: slice.join('\n'),
      });
    }
  }
  return out;
}
