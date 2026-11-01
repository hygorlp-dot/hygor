import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const baselinePath='scripts/design-system-baseline.json';
const typography=/^(fontSize|fontFamily|fontWeight|lineHeight|letterSpacing)$/;
const spacing=/^(gap|rowGap|columnGap|padding(?:Top|Right|Bottom|Left|Inline|Block)?|margin(?:Top|Right|Bottom|Left|Inline|Block)?)$/;
const isLiteral=node=>ts.isStringLiteral(node)||ts.isNumericLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node);

// Detecta exceções diretas em JSX. CSS, estilos indiretos e qualidade de fluxo
// continuam exigindo revisão humana; a checagem não substitui inspeção visual.
export function inspectUiSource(source,file='screen.jsx'){
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const findings=[];
  const add=(rule,node)=>findings.push({rule,line:ast.getLineAndCharacterOfPosition(node.getStart(ast)).line+1});
  function visit(node){
    if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
      const tag=node.tagName.getText(ast);
      if(['button','input','select','textarea'].includes(tag)){
        const hiddenFile=tag==='input'&&node.attributes.properties.some(a=>ts.isJsxAttribute(a)&&a.name.getText(ast)==='type'&&a.initializer&&ts.isStringLiteral(a.initializer)&&['file','hidden'].includes(a.initializer.text));
        if(!hiddenFile)add('native-control',node);
      }
      for(const attribute of node.attributes.properties){
        if(!ts.isJsxAttribute(attribute)||attribute.name.getText(ast)!=='style'||!attribute.initializer||!ts.isJsxExpression(attribute.initializer))continue;
        const object=attribute.initializer.expression;
        if(!object||!ts.isObjectLiteralExpression(object))continue;
        for(const property of object.properties){
          if(!ts.isPropertyAssignment(property)||!isLiteral(property.initializer))continue;
          const name=property.name.getText(ast).replace(/['"]/g,'');
          const value=property.initializer.text;
          if(typography.test(name)&&value!=='0'&&!value.startsWith('var('))add('literal-typography',property);
          if(spacing.test(name)&&value!=='0'&&value!=='auto'&&!value.startsWith('var('))add('literal-spacing',property);
          if(/^(color|background|backgroundColor|border|borderColor|boxShadow)/.test(name)&&/(#[\da-f]{3,8}\b|\brgba?\(|\bhsla?\()/i.test(value))add('literal-color',property);
        }
      }
    }
    ts.forEachChild(node,visit);
  }
  visit(ast);return findings;
}

export function growthAgainstBaseline(current,baseline){
  return Object.entries(current).flatMap(([file,rules])=>Object.entries(rules).filter(([rule,count])=>count>(baseline[file]?.[rule]||0)).map(([rule,count])=>({file,rule,count,allowed:baseline[file]?.[rule]||0})));
}

function main(){
  const current={};const locations={};
  const files=readdirSync('src',{recursive:true}).map(String).filter(f=>/\.[jt]sx?$/.test(f)&&!/[\\/](?:__tests__|fixtures)[\\/]|\.(?:test|spec|stories)\.[jt]sx?$/.test(f)).sort();
  for(const name of files){
    const file=relative(process.cwd(),resolve('src',name)).replaceAll('\\','/');
    // Infraestrutura aprovada cria os controles. Telas de negócio os consomem.
    if(/^src\/(?:design-system\/|components\/ui\/|legacy\/ui\.jsx$)/.test(file))continue;
    const findings=inspectUiSource(readFileSync(file,'utf8'),file);
    if(!findings.length)continue;
    locations[file]=findings;current[file]={};
    for(const {rule} of findings)current[file][rule]=(current[file][rule]||0)+1;
  }
  if(process.argv.includes('--write-baseline')){
    writeFileSync(baselinePath,JSON.stringify({version:1,limits:current},null,2)+'\n');
    console.log('Baseline do legado registrada. Não atualizar para liberar novas exceções.');return;
  }
  const baseline=JSON.parse(readFileSync(baselinePath,'utf8'));
  if(baseline.version!==1)throw new Error('Versão de baseline desconhecida.');
  const growth=growthAgainstBaseline(current,baseline.limits);
  if(growth.length){
    for(const {file,rule,count,allowed} of growth){
      const lines=locations[file].filter(f=>f.rule===rule).map(f=>f.line).join(', ');
      console.error(`${file}:${lines} — ${rule}: ${count} ocorrência(s), limite legado ${allowed}. Use componentes/tokens compartilhados; consulte docs/PADRAO-INTERFACE.md.`);
    }
    process.exitCode=1;return;
  }
  console.log(`Padrão de interface: sem aumento de exceções diretas em ${files.length} arquivos JS/JSX/TS/TSX. Legado registrado, revisão visual continua obrigatória.`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
