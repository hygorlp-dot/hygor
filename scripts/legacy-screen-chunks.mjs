import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import MagicString from 'magic-string';

// Split the existing declarations, not a second copy of the UI. The original
// source remains the input to design/manual checks and to unit tests. Build
// tests exercise every generated module, including a cold import in isolation.
export const LEGACY_SCREEN_GROUPS = Object.freeze({
  finance:['Financeiro','DRE','DREEmpresa','CaixaObra','Relatorios'],
  operations:['Obras','Ponto','PontoGeral','Cadastros','CotacoesMaterial','RankingFornecedores','Config','AgenteIA','ConfiguracaoIA','PainelTV'],
});
const prefix='virtual:legacy-screen/';
const idFor=group=>`${prefix}${group}.jsx`;
const namesOf=statement=>ts.isFunctionDeclaration(statement)&&statement.name?[statement.name]
  :ts.isVariableStatement(statement)?statement.declarationList.declarations.flatMap(declaration=>ts.isIdentifier(declaration.name)?[declaration.name]:[]):[];

export function splitLegacyScreens(source,{filename,groups=LEGACY_SCREEN_GROUPS}={}){
  const file=path.resolve(filename||'src/LegacyApp.jsx').replaceAll('\\','/');
  const options={allowJs:true,noResolve:true,noLib:true,jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.Latest};
  const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
  const host=ts.createCompilerHost(options);
  host.getSourceFile=name=>name===file?sf:undefined;
  host.fileExists=name=>name===file;host.readFile=name=>name===file?source:undefined;
  const checker=ts.createProgram([file],options,host).getTypeChecker();
  const locals=new Map(),symbols=new Map(),imports=[];
  for(const statement of sf.statements){
    if(ts.isImportDeclaration(statement)){
      const clause=statement.importClause;if(!clause){imports.push({statement,bindings:[]});continue;}
      const bindings=[];
      if(clause.name)bindings.push({name:clause.name,kind:'default'});
      const named=clause.namedBindings;
      if(named&&ts.isNamespaceImport(named))bindings.push({name:named.name,kind:'namespace'});
      else for(const specifier of named?.elements||[])bindings.push({name:specifier.name,kind:'named',original:(specifier.propertyName||specifier.name).text});
      for(const binding of bindings){const symbol=checker.getSymbolAtLocation(binding.name);if(!symbol)throw Error(`Unbound import: ${binding.name.text}`);symbols.set(symbol,{name:binding.name.text,imported:true});}
      imports.push({statement,bindings});continue;
    }
    for(const name of namesOf(statement)){const meta={name:name.text,statement},symbol=checker.getSymbolAtLocation(name);if(!symbol)throw Error(`Unbound declaration: ${name.text}`);locals.set(name.text,meta);symbols.set(symbol,meta);}
  }
  function references(node){
    const result=new Set();
    function visit(child){
      if(ts.isIdentifier(child)){
        const parent=child.parent;
        const property=(ts.isPropertyAccessExpression(parent)&&parent.name===child)
          ||((ts.isPropertyAssignment(parent)||ts.isMethodDeclaration(parent)||ts.isJsxAttribute(parent))&&parent.name===child);
        if(!property){
          const symbol=checker.resolveName(child.text,child,ts.SymbolFlags.Value|ts.SymbolFlags.Alias,false);
          const meta=symbol&&symbols.get(symbol);if(meta)result.add(meta.name);
        }
      }
      if(ts.isExportSpecifier(child)&&!child.parent.parent.moduleSpecifier)result.add((child.propertyName||child.name).text);
      ts.forEachChild(child,visit);
    }
    visit(node);return result;
  }
  for(const meta of locals.values())meta.refs=references(meta.statement);
  const entryGroups=new Map(Object.entries(groups).flatMap(([group,names])=>names.map(name=>[name,group])));
  for(const name of entryGroups.keys()){
    const meta=locals.get(name);
    if(!meta||!ts.isFunctionDeclaration(meta.statement))throw Error(`Legacy chunk entry is not a function: ${name}`);
    if(meta.statement.modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.ExportKeyword))throw Error(`Cannot change the public export contract: ${name}`);
  }
  const closure=(seeds,group)=>{
    const result=new Set(),queue=[...seeds];
    while(queue.length){const name=queue.pop();if(result.has(name))continue;result.add(name);
      if(entryGroups.has(name)&&entryGroups.get(name)!==group)continue;
      const meta=locals.get(name);if(meta)queue.push(...meta.refs);
    }
    return result;
  };
  const reached=new Map(Object.entries(groups).map(([group,names])=>[group,closure(names,group)]));
  // Only the application and declarations not reached by a deferred screen
  // remain shell roots. Re-export statements keep the original named API.
  const screenLocals=new Set([...reached.values()].flatMap(set=>[...set]).filter(name=>locals.has(name)));
  const roots=[];
  for(const statement of sf.statements){
    if(ts.isImportDeclaration(statement))continue;
    const names=namesOf(statement);
    if(statement.modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.ExportKeyword)||!names.length||names.some(name=>!screenLocals.has(name.text)))roots.push(...references(statement));
  }
  const rootReach=closure(roots,null),shared=new Set();
  for(const name of screenLocals){
    if(entryGroups.has(name))continue;
    const owners=[...reached.values()].filter(set=>set.has(name)).length;
    if(rootReach.has(name)||owners>1)shared.add(name);
  }
  for(const name of closure(shared,null))if(locals.has(name)){
    if(entryGroups.has(name))throw Error(`Shared helper would eagerly depend on screen ${name}`);
    shared.add(name);
  }
  const owner=new Map();
  for(const name of screenLocals){
    if(shared.has(name))owner.set(name,'support');
    else if(entryGroups.has(name))owner.set(name,entryGroups.get(name));
    else owner.set(name,[...reached].find(([,set])=>set.has(name))?.[0]);
  }
  const absolute=specifier=>specifier.startsWith('.')?path.resolve(path.dirname(file),specifier).replaceAll('\\','/'):specifier;
  function relocate(code){
    const tree=ts.createSourceFile('part.jsx',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX),edit=new MagicString(code);
    function visit(node){
      const literal=(ts.isImportDeclaration(node)||ts.isExportDeclaration(node))?node.moduleSpecifier
        :ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword?node.arguments[0]:null;
      if(literal&&ts.isStringLiteral(literal)&&literal.text.startsWith('.'))edit.overwrite(literal.getStart(tree),literal.end,JSON.stringify(absolute(literal.text)));
      ts.forEachChild(node,visit);
    }
    visit(tree);return edit.toString();
  }
  function importedCode(required){
    return imports.flatMap(({statement,bindings})=>{
      if(!bindings.length)return [relocate(source.slice(statement.getStart(sf),statement.end))];
      const used=bindings.filter(binding=>required.has(binding.name.text));if(!used.length)return [];
      const names=[],plain=used.find(binding=>binding.kind==='default'),namespace=used.find(binding=>binding.kind==='namespace');
      if(plain)names.push(plain.name.text);if(namespace)names.push(`* as ${namespace.name.text}`);
      const named=used.filter(binding=>binding.kind==='named');if(named.length)names.push(`{${named.map(binding=>binding.original===binding.name.text?binding.original:`${binding.original} as ${binding.name.text}`).join(',')}}`);
      return [`import ${names.join(',')} from ${JSON.stringify(absolute(statement.moduleSpecifier.text))};`];
    }).join('\n');
  }
  const modules=new Map();
  for(const group of [...Object.keys(groups),'support']){
    const entries=[...locals.values()].filter(meta=>owner.get(meta.name)===group);
    const statements=[...new Set(entries.map(meta=>meta.statement))].sort((a,b)=>a.pos-b.pos);
    for(const statement of statements)for(const name of namesOf(statement))if(owner.get(name.text)!==group)throw Error(`Mixed declaration ownership: ${name.text}`);
    const required=new Set(statements.flatMap(statement=>[...references(statement)]));
    const sharedImports=[...required].filter(name=>owner.get(name)==='support'&&group!=='support');
    const crossEntries=[...required].filter(name=>entryGroups.has(name)&&entryGroups.get(name)!==group);
    if(crossEntries.length)throw Error(`Cross-screen dependency needs an explicit boundary: ${crossEntries.join(',')}`);
    const text=[importedCode(required),sharedImports.length?`import {${sharedImports.join(',')}} from ${JSON.stringify(idFor('support'))};`:'',...statements.map(statement=>relocate(source.slice(statement.getStart(sf),statement.end).replace(/^export\s+(?:default\s+)?/,''))),`export {${entries.map(meta=>meta.name).join(',')}};`].join('\n');
    modules.set(idFor(group),text);
  }
  const edit=new MagicString(source),removed=new Set();
  for(const [name,group] of owner){
    const statement=locals.get(name).statement;if(removed.has(statement))continue;removed.add(statement);
    const replacement=entryGroups.has(name)?`const ${name}=lazy(()=>import(${JSON.stringify(idFor(group))}).then(module=>({default:module.${name}})));`:'';
    edit.overwrite(statement.getStart(sf),statement.end,replacement);
  }
  const needed=new Set(['lazy']);
  const publicMoved=[...owner.keys()].filter(name=>locals.get(name).statement.modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.ExportKeyword));
  for(const name of publicMoved)needed.add(name);
  for(const statement of sf.statements)if(!ts.isImportDeclaration(statement)&&!removed.has(statement))for(const name of references(statement))needed.add(name);
  for(const {statement} of imports)edit.remove(statement.getStart(sf),statement.end);
  const rootShared=[...shared].filter(name=>needed.has(name));
  edit.prepend(importedCode(needed)+'\n'+(rootShared.length?`import {${rootShared.join(',')}} from ${JSON.stringify(idFor('support'))};\n`:'')+(publicMoved.length?`export {${publicMoved.join(',')}};\n`:''));
  return {code:edit.toString(),map:edit.generateMap({hires:true,source:file,includeContent:true}),modules};
}

export function legacyScreenChunks(){
  let filename,parts;
  return {name:'legacy-screen-chunks',apply:'build',enforce:'pre',
    configResolved(config){filename=path.resolve(config.root,'src/LegacyApp.jsx');},
    buildStart(){parts=null;},
    resolveId(id){if(id.startsWith(prefix))return '\0'+id;},
    load(id){if(!id.startsWith('\0'+prefix))return;this.addWatchFile(filename);parts??=splitLegacyScreens(fs.readFileSync(filename,'utf8'),{filename});return parts.modules.get(id.slice(1));},
    transform(source,id){if(path.resolve(id.split('?')[0])!==filename)return;parts=splitLegacyScreens(source,{filename});return {code:parts.code,map:parts.map};},
  };
}
