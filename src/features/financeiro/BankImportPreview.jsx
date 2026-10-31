import {useMemo} from 'react';
import {previewBankImport} from '../../domains/conciliacao/import-preview.js';
import FinancialPreview from './FinancialPreview.jsx';
const money=value=>Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

export default function BankImportPreview({data,prepared,onCancel,onConfirm,pending}) {
  const plan=useMemo(()=>previewBankImport(data,prepared),[data,prepared]);
  const account=(data.contasBancarias||[]).find(item=>item.id===prepared.statement.contaBancariaId);
  const rows=[...plan.rows.map(row=>({id:row.transaction.id,cells:[row.line,row.transaction.data,row.transaction.descricao,money(row.transaction.valor),row.duplicate?'Já existente ou repetida no arquivo — será ignorada':'Novo movimento bancário']})),...(prepared.invalid||[]).map((row,index)=>({id:`invalid-${index}`,cells:[row.linha||index+1,row.data||'Data inválida',row.descricao||'Sem descrição',String(row.valor),'Inválida — corrija o arquivo']}))];
  return <FinancialPreview description={`${prepared.statement.arquivo} · Conta: ${account?.nome||'Sem conta atribuída'} · ${prepared.statement.dataInicio} a ${prepared.statement.dataFim}`}
    columns={['Linha','Data','Descrição','Valor','Resultado']} rows={rows} error={prepared.error||plan.error} pending={pending} disabled={!plan.imported}
    onCancel={onCancel} onConfirm={onConfirm} confirmLabel={`Importar ${plan.imported} novo(s) movimento(s)`}>
    <p>{plan.imported} novo(s) · {plan.duplicates} duplicado(s). Importar o extrato não cria despesas, receitas ou conciliações automaticamente. O servidor verifica duplicidades novamente.</p>
  </FinancialPreview>;
}
