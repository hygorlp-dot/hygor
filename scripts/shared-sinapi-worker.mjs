import {fileURLToPath} from 'node:url';
import MagicString from 'magic-string';

// O worker participa do mesmo grafo do build para compartilhar o codec ZIP.
// Continua sendo uma entrada própria, executada somente em Worker ES module.
export function sharedSinapiWorker(){
 return {name:'shared-sinapi-worker',apply:'build',enforce:'pre',transform(source,id){
  if(!id.replaceAll('\\','/').endsWith('/src/domains/orcamentos/sinapi-import.js'))return;
  const expression=/new URL\((['"])\.\.\/\.\.\/workers\/sinapi-parser\.worker\.js\1,\s*import\.meta\.url\)/;
  const match=expression.exec(source);
  if(!match)throw new Error('Entrada do worker SINAPI mudou; revise seu empacotamento.');
  const reference=this.emitFile({type:'chunk',id:fileURLToPath(new URL('../src/workers/sinapi-parser.worker.js',import.meta.url)),name:'sinapi-parser.worker'});
  const output=new MagicString(source);output.overwrite(match.index,match.index+match[0].length,`import.meta.ROLLUP_FILE_URL_${reference}`);
  return {code:output.toString(),map:output.generateMap({hires:true,source:id,includeContent:true})};
 }};
}
