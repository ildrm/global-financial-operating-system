import ts from 'typescript';
import { readdir,readFile } from 'node:fs/promises';
async function walk(path:string):Promise<string[]>{const entries=await readdir(path,{withFileTypes:true});return (await Promise.all(entries.filter(e=>e.name!=='node_modules').map(e=>e.isDirectory()?walk(path+'/'+e.name):Promise.resolve([path+'/'+e.name])))).flat();}
const files=(await Promise.all(['modules/ledger/src/domain','packages/financial-math/src'].map(walk))).flat().filter(f=>f.endsWith('.ts'));
for(const path of files){
 const text=await readFile(path,'utf8');const tree=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true);
 const visit=(node:ts.Node):void=>{
   if(node.kind===ts.SyntaxKind.AnyKeyword)throw new Error('any in financial domain: '+path);
   if(ts.isImportDeclaration(node) && /nest|next|drizzle|pg|redis/.test(node.moduleSpecifier.getText(tree)))throw new Error('Infrastructure imported by financial domain: '+path);
   if(ts.isCallExpression(node) && /^(Number|parseFloat)$/.test(node.expression.getText(tree)))throw new Error('Floating money conversion in domain: '+path);
   ts.forEachChild(node,visit);
 };visit(tree);
}
console.log('Financial domain boundary checks passed ('+files.length+' files).');

