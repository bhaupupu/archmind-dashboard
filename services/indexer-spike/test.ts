import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Parser = require('tree-sitter');
const TypeScript = require('tree-sitter-typescript').typescript;

const parser = new Parser();
parser.setLanguage(TypeScript);

const code = `
import { verifyToken, hasScope } from '@acme/auth-lib';
export function charge(token: string) {}
export const MY_CONST = 1;
export class MyClass {}
export { a, b } from './module';
`;
const tree = parser.parse(code);
console.log(tree.rootNode.toString());
