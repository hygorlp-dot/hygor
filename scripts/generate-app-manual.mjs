import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {HELP_GUIDES, HELP_GLOSSARY, HELP_INTERRUPTION_GUIDE, HELP_INTERFACE_GUIDE, HELP_REVIEWED_AT} from '../src/features/help/help-content.js';
import {ROLE_TABS} from '../src/domains/administracao/abas-acesso.js';

export function renderAppManual(){
 const lines=['# Manual de uso do app MARCELL','',`Revisão do conteúdo: ${HELP_REVIEWED_AT}.`,'',
 'Este guia explica o uso das telas em linguagem simples. No aplicativo, clique em **Ajuda**, no cabeçalho, para ler o fluxo da página aberta. Em **Manual completo**, pesquise uma tarefa ou tela. As áreas exibidas no aplicativo respeitam seu perfil de acesso.','',
 'Conteúdo gerado de `src/features/help/help-content.js`, a mesma fonte da ajuda no aplicativo. Atualize essa fonte e execute `npm run manual:generate`; não edite este arquivo diretamente.','',
 '## Primeiros passos','',
 '1. Entre com sua conta individual. Se não conseguir acessar, procure o administrador.','2. Escolha a área de trabalho e confirme a obra e o período.','3. Clique em Ajuda e leia o que preparar e a sequência de ações.','4. Depois de uma alteração, confira a mensagem da ação, o indicador de salvamento e o registro de destino.','5. Se não encontrar um registro, confira a busca, os filtros e o seu acesso.','',
 '## Fluxos que atravessam várias telas','',
 '- Obra: cadastro → orçamento → planejamento → acompanhamento da execução e documentos.','- Compra: necessidade → solicitação/cotação → pedido → recebimento físico e entrada no estoque. Aprovação, documento fiscal e pagamento têm situações próprias e podem ocorrer em outra ordem; pendências geram avisos, sem impedir o avanço manual.','- Financeiro: conferir documento, obrigação e pagamentos anteriores → registrar a quitação real → acompanhar pendências e conciliar o movimento bancário, quando aplicável. Pagar não aprova a conferência fiscal.','- Comercial: contato → oportunidade → proposta → negociação → contrato. Confira os requisitos antes de abrir a execução.','- Equipe: cadastro e lotação → captura ou registro autorizado do ponto → conferência do período → revisão da folha.','',
 '## Índice das telas','',...HELP_GUIDES.map(item=>`- [${item.title}](#guia-${item.id})`),''];
 for(const item of HELP_GUIDES){
  lines.push(`<a id="guia-${item.id}"></a>`,'',`## ${item.title}`,'',item.purpose,'','### Antes de começar','',item.before,'','### Como fazer','',...item.steps.map((step,index)=>`${index+1}. ${step}`),'','### Como conferir se deu certo','',item.result,'','### O que merece atenção','',item.attention,'');
  if(item.example)lines.push('### Exemplo ilustrativo','',item.example,'');
  if(item.responsibilities)lines.push('### Quem cuida de cada parte','',...item.responsibilities.map(([owner,task])=>`- **${owner}:** ${task}`),'');
  if(item.exceptions)lines.push('### Quando o fluxo acontece de outro jeito','',...item.exceptions.map(([situation,action])=>`- **${situation}:** ${action}`),'');
 }
 lines.push('## Aparência, botões e navegação','');
 for(const [situation,action] of HELP_INTERFACE_GUIDE)lines.push(`### ${situation}`,'',action,'');
 lines.push('## Celular, interrupções e recuperação','');
 for(const [situation,action] of HELP_INTERRUPTION_GUIDE)lines.push(`### ${situation}`,'',action,'');
 lines.push('## Dúvidas comuns','','### Não encontrei um botão ou registro','','As ações dependem do seu perfil e da situação do registro. Confira a obra, o período, a busca e os filtros. Se necessário, peça ao administrador para conferir seu acesso.','','### Não sei se foi salvo','','Confira o indicador de salvamento e a mensagem da ação. Leia erros ou conflitos antes de repetir. Abra o registro novamente para conferir o resultado e evitar duplicidade.','','## Glossário','');
 for(const [term,meaning] of HELP_GLOSSARY) lines.push(`- **${term}:** ${meaning}`);
 return lines.join('\n')+'\n';
}

export function checkHelpCoverage(){
 const ids=HELP_GUIDES.map(item=>item.id);
 const missing=ROLE_TABS.admin.filter(id=>!ids.includes(id));
 if(missing.length)throw new Error(`Abas sem ajuda: ${missing.join(', ')}`);
 if(new Set(ids).size!==ids.length)throw new Error('Há identificadores de ajuda duplicados.');
 for(const item of HELP_GUIDES){
  for(const key of ['title','purpose','before','result','attention'])if(!item[key]?.trim())throw new Error(`Guia incompleto: ${item.id}.${key}`);
  if(item.steps.length<3||item.steps.some(step=>!step.trim()))throw new Error(`Passos incompletos: ${item.id}`);
 }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 checkHelpCoverage();
 const destination=new URL('../docs/MANUAL_DO_APP.md',import.meta.url),rendered=renderAppManual();
 if(process.argv.includes('--check')){
  const existing=await readFile(destination,'utf8').catch(()=>'');
  if(existing!==rendered)throw new Error('Manual desatualizado. Execute npm run manual:generate e inclua o manual na alteração.');
  console.log(`Manual atualizado; ${HELP_GUIDES.length} guias cobrem todas as ${ROLE_TABS.admin.length} abas.`);
 }else{await writeFile(destination,rendered);console.log(`Manual gerado com ${HELP_GUIDES.length} guias.`);}
}
