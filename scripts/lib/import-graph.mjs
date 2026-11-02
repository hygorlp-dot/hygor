import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const extensions=['.js','.jsx','.mjs','.cjs','.ts','.tsx'];
const normalized=file=>file.replaceAll('\\','/');
export function auditImportGraph({root=process.cwd(),sourceOverrides=new Map()}={}){
 const files=new Set(sourceOverrides.keys());
 function scan(relative){const absolute=path.join(root,relative);if(!fs.existsSync(absolute))return;for(const entry of fs.readdirSync(absolute,{withFileTypes:true})){
  const file=normalized(path.join(relative,entry.name));
  if(entry.isDirectory()){if(!['node_modules','__tests__','test','tests'].includes(entry.name))scan(file);}
  else if(extensions.includes(path.extname(file))&&!/\.(test|spec|stories)\./.test(file)&&!file.endsWith('.d.ts'))files.add(file);
 }}
 for(const source of ['src','api','server','apps/ponto-obra/src'])scan(source);
 const resolve=(from,specifier)=>{
  if(!specifier.startsWith('.')&&!specifier.startsWith('@/'))return null;
  const location=specifier.startsWith('@/')?path.join(root,'src',specifier.slice(2)):path.resolve(root,path.dirname(from),specifier);
  const candidate=normalized(path.relative(root,location));
  for(const file of [candidate,...extensions.map(ext=>candidate+ext),...extensions.map(ext=>candidate+'/index'+ext)])if(files.has(file))return file;
  return null;
 };
 const graph=new Map();
 for(const file of files){
  const text=sourceOverrides.get(file)??fs.readFileSync(path.join(root,file),'utf8');
  const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),edges=[];
  const add=(value,dynamic)=>{const to=resolve(file,value);if(to&&!edges.some(e=>e.to===to&&e.dynamic===dynamic))edges.push({to,dynamic});};
  function visit(node){
   if(ts.isImportDeclaration(node)&&!node.importClause?.isTypeOnly&&ts.isStringLiteral(node.moduleSpecifier)){
    const clause=node.importClause,bindings=clause?.namedBindings;
    if(!clause||clause.name||!bindings||ts.isNamespaceImport(bindings)||bindings.elements.some(item=>!item.isTypeOnly))add(node.moduleSpecifier.text,false);
   }
   if(ts.isExportDeclaration(node)&&!node.isTypeOnly&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)){
    if(!node.exportClause||!ts.isNamedExports(node.exportClause)||node.exportClause.elements.some(item=>!item.isTypeOnly))add(node.moduleSpecifier.text,false);
   }
   if(ts.isCallExpression(node)&&node.arguments.length===1&&ts.isStringLiteralLike(node.arguments[0])){
    if(node.expression.kind===ts.SyntaxKind.ImportKeyword)add(node.arguments[0].text,true);
    else if(ts.isIdentifier(node.expression)&&node.expression.text==='require')add(node.arguments[0].text,false);
   }
   ts.forEachChild(node,visit);
  }
  visit(source);graph.set(file,edges);
 }
 function cycles(includeDynamic){
  let next=0;const ids=new Map(),low=new Map(),stack=[],active=new Set(),groups=[];
  function visit(id){ids.set(id,next);low.set(id,next++);stack.push(id);active.add(id);
   for(const edge of graph.get(id)||[]){if(!includeDynamic&&edge.dynamic)continue;const to=edge.to;
    if(!ids.has(to)){visit(to);low.set(id,Math.min(low.get(id),low.get(to)));}
    else if(active.has(to))low.set(id,Math.min(low.get(id),ids.get(to)));
   }
   if(low.get(id)===ids.get(id)){const group=[];let item;do{item=stack.pop();active.delete(item);group.push(item);}while(item!==id);
    if(group.length>1||(graph.get(id)||[]).some(e=>e.to===id&&(includeDynamic||!e.dynamic)))groups.push(group.sort());
   }
  }
  for(const id of graph.keys())if(!ids.has(id))visit(id);
  return groups.sort((a,b)=>b.length-a.length||a[0].localeCompare(b[0]));
 }
 return {files:graph.size,edges:[...graph.values()].reduce((n,edges)=>n+edges.length,0),staticCycles:cycles(false),allCycles:cycles(true),graph:Object.fromEntries(graph)};
}
