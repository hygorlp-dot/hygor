import {createHash} from 'node:crypto';
import {parseSync,minifySync} from 'rolldown/utils';
import MagicString from 'magic-string';

// Recharts distribui estes auxiliares do Babel dentro de cada arquivo ES.
// Compartilhamos apenas declarações idênticas e seu grafo de dependências;
// o código dos gráficos, métodos e opções permanece o da biblioteca instalada.
const names=new Set(`_typeof _objectWithoutProperties _objectWithoutPropertiesLoose _extends ownKeys _objectSpread _classCallCheck _defineProperties _createClass _callSuper _possibleConstructorReturn _assertThisInitialized _isNativeReflectConstruct _getPrototypeOf _inherits _setPrototypeOf _defineProperty _toPropertyKey _toPrimitive _slicedToArray _nonIterableRest _unsupportedIterableToArray _arrayLikeToArray _iterableToArrayLimit _arrayWithHoles _toConsumableArray _nonIterableSpread _iterableToArray _arrayWithoutHoles`.split(' '));
const prefix='\0shared-chart-helper:';
const publicPrefix='shared-chart-helper:';
function visit(node,callback){
  if(!node||typeof node!=='object')return;
  if(typeof node.type==='string')callback(node);
  for(const [key,value] of Object.entries(node)){
    if(key==='loc'||key==='range')continue;
    if(Array.isArray(value))value.forEach(child=>visit(child,callback));
    else if(value&&typeof value==='object')visit(value,callback);
  }
}

export function sharedChartHelpers(){
  const modules=new Map();
  return {
    name:'shared-chart-helpers',enforce:'pre',apply:'build',
    buildStart(){modules.clear();},
    resolveId(id){if(id.startsWith(publicPrefix))return '\0'+id;},
    load(id){if(id.startsWith(prefix))return modules.get(id);},
    transform(source,id){
      if(!/\/node_modules\/(recharts|recharts-scale)\/es6\//.test(id.replaceAll('\\','/'))||!id.endsWith('.js'))return;
      const parsed=parseSync(id,source);
      if(parsed.errors.length)throw new Error(`Não foi possível conferir os auxiliares dos gráficos: ${id}`);
      const body=parsed.program.body,boundary=body.findIndex(n=>n.type==='ImportDeclaration'||n.type.startsWith('Export'));
      if(boundary<0)return;
      const helpers=new Map(body.slice(0,boundary).filter(n=>n.type==='FunctionDeclaration'&&names.has(n.id.name)).map(n=>[n.id.name,n]));
      if(!helpers.size)return;
      // Uma função que capture estado do módulo não pode ser compartilhada.
      const bindings=new Set();
      for(const node of body){
        const declaration=node.declaration||node;
        if(declaration.type==='ImportDeclaration')declaration.specifiers.forEach(s=>bindings.add(s.local.name));
        if(declaration.type==='VariableDeclaration')declaration.declarations.forEach(d=>visit(d.id,n=>{if(n.type==='Identifier')bindings.add(n.name);}));
        if(['FunctionDeclaration','ClassDeclaration'].includes(declaration.type)&&!helpers.has(declaration.id?.name))bindings.add(declaration.id?.name);
      }
      const dependencies=new Map();
      for(const [name,node] of helpers){
        const refs=new Set();
        visit(node.body,n=>{if(n.type==='Identifier')refs.add(n.name);});
        if([...refs].some(ref=>bindings.has(ref)))return;
        dependencies.set(name,[...refs].filter(ref=>ref!==name&&helpers.has(ref)).sort());
      }
      for(const node of body){
        if(node.type==='FunctionDeclaration'&&helpers.has(node.id.name))continue;
        let reassigned=false;
        visit(node,n=>{if((n.type==='AssignmentExpression'||n.type==='UpdateExpression')&&helpers.has((n.left||n.argument)?.name))reassigned=true;});
        if(reassigned)return;
      }
      const ids=new Map(),pending=new Set();
      const register=name=>{
        if(ids.has(name))return ids.get(name);
        if(pending.has(name))throw new Error(`Ciclo inesperado nos auxiliares dos gráficos: ${id}`);
        pending.add(name);
        const imports=dependencies.get(name).map(dep=>`import {${dep}} from ${JSON.stringify(register(dep))};`).join('\n');
        const declaration=source.slice(helpers.get(name).start,helpers.get(name).end);
        // Forma canônica determinística: espaços e nomes de parâmetros locais
        // não criam cópias. Sem compressão ou reescrita da lógica; nomes de
        // exports e dependências distintas continuam preservados.
        const normalized=minifySync('chart-helper.js',imports+'\n'+declaration+`\nexport {${name}};`,{module:true,compress:false,mangle:true});
        if(normalized.errors.length)throw new Error(`Auxiliar de gráfico inválido: ${name}`);
        const code=normalized.code;
        const key=publicPrefix+createHash('sha256').update(code).digest('hex');
        modules.set('\0'+key,code);
        ids.set(name,key);pending.delete(name);
        return key;
      };
      const transformed=new MagicString(source);
      for(const [name,node] of helpers)transformed.overwrite(node.start,node.end,`import {${name}} from ${JSON.stringify(register(name))};`);
      return {code:transformed.toString(),map:transformed.generateMap({hires:true,source:id,includeContent:true})};
    },
  };
}
