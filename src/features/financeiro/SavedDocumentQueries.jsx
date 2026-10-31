import {useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {Input} from '../../components/ui/input.jsx';
import {readQueries,restoreQuery,sanitizeQuery} from '../../domains/financeiro/saved-queries.js';

export default function SavedDocumentQueries({storageKey,value,works,restrictedWork,onApply}){
 const [rows,setRows]=useState(()=>{try{return readQueries(window.localStorage,storageKey);}catch{return [];}});
 const [name,setName]=useState(''),[selected,setSelected]=useState(''),[message,setMessage]=useState('');
 function persist(next){try{window.localStorage.setItem(storageKey,JSON.stringify(next));setRows(next);return true;}catch{setMessage('Não foi possível salvar neste navegador. Seus filtros continuam disponíveis nesta sessão.');return false;}}
 function save(){const title=name.trim();if(!title)return;const existing=rows.find(r=>r.name.toLocaleLowerCase('pt-BR')===title.toLocaleLowerCase('pt-BR'));if(!existing&&rows.length>=20){setMessage('Você já tem 20 consultas. Exclua uma consulta ou atualize pelo mesmo nome.');return;}const id=existing?.id||crypto.randomUUID();const next=[...rows.filter(r=>r.id!==id),{id,name:title,value:sanitizeQuery(value)}].slice(-20);if(persist(next)){setSelected(id);setName('');setMessage(existing?'Consulta atualizada neste navegador.':'Consulta salva neste navegador.');}}
 function apply(){const row=rows.find(r=>r.id===selected);if(!row)return;const restored=restoreQuery(row.value,{works,currentWork:value.obraId,restrictedWork});onApply(restored.value);setMessage(restored.message||'Consulta aplicada. Nenhum registro foi alterado.');}
 return <details className="saved-document-queries"><summary>Consultas salvas neste navegador · {rows.length}</summary>{!storageKey?<p>Informe a identificação da empresa para salvar consultas por usuário. Os filtros atuais continuam disponíveis na sessão.</p>:<>
 <p>Salva apenas busca, situação, obra e mês para este usuário e empresa. Não inclui anexos ou rascunhos.</p>
 <div className="saved-document-queries__controls"><div className="document-center__filters"><label>Nome da consulta<Input value={name} maxLength={60} onChange={e=>setName(e.target.value)}/></label><Button variant="outline" disabled={!name.trim()} onClick={save}>Salvar consulta atual</Button></div>
 <div className="document-center__filters"><label>Consulta salva<select aria-label="Consulta salva" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Selecione uma consulta</option>{rows.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><Button variant="outline" disabled={!selected} onClick={apply}>Aplicar consulta</Button><Button variant="ghost" disabled={!selected} onClick={()=>{if(persist(rows.filter(r=>r.id!==selected))){setSelected('');setMessage('Consulta removida deste navegador.');}}}>Excluir consulta</Button></div></div></>}{message&&<p role="status">{message}</p>}</details>;
}
