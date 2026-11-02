const text=value=>String(value??'').trim();
const bankKey=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toLowerCase();

// A derived view only. Never send this object to any persistence command.
export function previewImportedAccount(data,{suffix='9896',bank='Banco Intermedium S/A'}={}){
 const statements=(data.extratos||[]).filter(s=>bankKey(s.banco)===bankKey(bank)&&text(s.conta).endsWith(suffix));
 const identities=new Set(statements.map(s=>text(s.conta)));
 if(!statements.length||identities.size!==1)return {error:'A conta de origem não pôde ser identificada de forma única nos extratos atuais.'};
 const statementIds=new Set(statements.map(s=>String(s.id)));
 const transactions=(data.transacoes||[]).filter(t=>statementIds.has(String(t.extratoId)));
 if([...statements,...transactions].some(record=>text(record.contaBancariaId)))return {error:'Existem vínculos bancários preenchidos nestes registros. A prévia foi interrompida para preservar os vínculos atuais.'};
 const id=`local_account_preview_${suffix}`;
 if((data.contasBancarias||[]).some(account=>String(account.id)===id))return {error:'O identificador da prévia já está em uso. Nenhum cadastro foi substituído.'};
 const account={id,nome:`${statements[0].banco} · final ${suffix}`,banco:statements[0].banco,conta:text(statements[0].conta),agencia:'',titular:'',documentoTitular:'',tipo:'',pixKey:'',ativa:null,saldoInicial:null,dataReferenciaSaldo:null};
 const previewData={...data,contasBancarias:[...(data.contasBancarias||[]),account],
  extratos:(data.extratos||[]).map(s=>statementIds.has(String(s.id))?{...s,contaBancariaId:id}:s),
  transacoes:(data.transacoes||[]).map(t=>statementIds.has(String(t.extratoId))?{...t,contaBancariaId:id}:t)};
 const movements=previewData.transacoes.filter(t=>statementIds.has(String(t.extratoId)));
 const groups=new Map();
 for(const t of movements){const key=JSON.stringify([t.data,Math.round(Number(t.valor)*100),bankKey(t.descricaoOriginal||t.descricao)]);groups.set(key,[...(groups.get(key)||[]),t]);}
 const repeatedGroups=[...groups.values()].filter(group=>group.length>1);
 return {data:previewData,account,statements:previewData.extratos.filter(s=>statementIds.has(String(s.id))),movements,
  pending:movements.filter(t=>!['conciliado','ignorado'].includes(t.status)),
  reconciled:movements.filter(t=>t.status==='conciliado'),ignored:movements.filter(t=>t.status==='ignorado'),repeatedGroups};
}
