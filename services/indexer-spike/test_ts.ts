import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
import tsBindings from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';

const tsParser = new Parser();
tsParser.setLanguage(tsBindings.typescript);
const tree = tsParser.parse('function foo() { return 1; }');
console.log(tree.rootNode.toString());
