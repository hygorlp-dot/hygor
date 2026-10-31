// Pode rodar isoladamente com node --test e na suíte Vitest do repositório.
const {test}=process.env.VITEST ? await import('vitest') : await import('node:test');
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

test('CSS mantém utilitários da aplicação e não observa artefatos locais',async()=>{
 const from=resolve(dirname(fileURLToPath(import.meta.url)),'../src/index.css');
 const result=await postcss([tailwind()]).process(await readFile(from,'utf8'),{from});
 const dependencies=result.messages.filter(message=>['dependency','dir-dependency'].includes(message.type));
 assert.ok(dependencies.length>0,'A compilação deve registrar as fontes reais.');
 assert.equal(dependencies.some(message=>/[/\\](artifacts|analises|e2e)[/\\]/.test(message.file||message.dir||'')),false);
 for(const utility of ['flex','grid','sr-only'])assert.ok(result.css.includes(`.${utility} {`),`Utilitário ${utility} preservado.`);
});
