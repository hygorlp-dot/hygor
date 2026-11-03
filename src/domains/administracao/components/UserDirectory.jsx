import {useMemo,useState} from 'react';
import {Button} from '../../../components/ui/button.jsx';
import {Input} from '../../../components/ui/input.jsx';
import {Select} from '../../../design-system/primitives/Select.jsx';
import './user-directory.css';
import {contar} from '../../../design-system/copy.js';

const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export default function UserDirectory({users,works,roles,currentUser,presences,onRefresh,refreshing,presenceError,formatActivity,onAdd,onEdit,onLogin,onPin,onToggle,onAllWorks}){
 const [query,setQuery]=useState(''),[status,setStatus]=useState('all'),[role,setRole]=useState('all');
 const admin=currentUser?.role==='admin';
 const visible=useMemo(()=>users.filter(u=>(status==='all'||(status==='active'?u.active!==false:u.active===false))&&(role==='all'||u.role===role)&&normalize(`${u.nome} ${u.email||''}`).includes(normalize(query).trim())),[users,query,status,role]);
 return <section className="user-directory" aria-label="Minha equipe MARCELL">
  <header><div><h2>Minha equipe</h2><p>Gerencie os membros, perfis e acessos da sua empresa.</p></div>{admin&&<Button onClick={onAdd}>Adicionar membro</Button>}</header>
  <p>{contar(users.length,'membro','membros')} · {contar(users.filter(u=>u.active!==false).length,'ativo','ativos')} · {contar(users.filter(u=>u.active===false).length,'inativo','inativos')}</p>
  <div className="user-directory__filters"><label>Buscar membro<Input type="search" placeholder="Nome ou e-mail" value={query} onChange={e=>setQuery(e.target.value)}/></label><Select label="Situação do membro" value={status} onChange={e=>setStatus(e.target.value)} options={[{value:'all',label:'Todos'},{value:'active',label:'Ativos'},{value:'inactive',label:'Inativos'}]}/><Select label="Perfil do membro" value={role} onChange={e=>setRole(e.target.value)} options={[{value:'all',label:'Todos os perfis'},...roles.map(r=>({value:r.v,label:r.l}))]}/>{admin&&<Button variant="outline" disabled={refreshing} onClick={onRefresh}>{refreshing?'Atualizando…':'Atualizar on-line'}</Button>}</div>
  {presenceError&&admin&&<p role="alert">{presenceError}</p>}
  <div className="user-directory__table"><table><caption>{contar(visible.length,'membro','membros')} no recorte</caption><thead><tr><th>Membro</th><th>Perfil</th><th>Acesso às obras</th><th>Situação</th>{admin&&<><th>Última atividade</th><th>Ações</th></>}</tr></thead><tbody>{visible.map(u=>{
   const sessions=presences.get(u.id)||[],online=sessions.filter(p=>p.online),last=online[0]||sessions[0];
   const roleName=roles.find(r=>r.v===u.role)?.l||'Perfil não identificado';
   return <tr key={u.id}><th scope="row"><div className="user-directory__member"><span className="user-directory__avatar" aria-hidden="true">{String(u.nome||'?').split(/\s+/).filter(Boolean).slice(0,2).map(n=>n[0]).join('').toUpperCase()}</span><div>{admin?<Button variant="link" onClick={()=>onEdit(u)}>{u.nome}</Button>:<strong>{u.nome}</strong>}{u.id===currentUser?.id&&<small>Você</small>}<p>{u.email||'E-mail não informado'}</p></div></div></th><td data-label="Perfil">{roleName}</td><td data-label="Acesso às obras">{u.obraId?works.find(w=>w.id===u.obraId)?.name||'Obra não localizada':'Todas as obras'}</td><td data-label="Situação"><span className="user-directory__status" data-active={u.active!==false}>{u.active===false?'Inativo':'Ativo'}</span><small>{u.authUserId?'Login por e-mail vinculado':'Vínculo de login não informado'}</small>{!u.pin&&<small>PIN não definido</small>}</td>{admin&&<><td data-label="Última atividade">{online.length?`On-line · ${contar(online.length,'sessão','sessões')}`:formatActivity(last?.lastSeen)}</td><td data-label="Ações"><details className="user-directory__actions"><summary aria-label={`Ações de ${u.nome}`}>Ações</summary><div><Button variant="ghost" onClick={()=>onEdit(u)}>Editar membro</Button><Button variant="ghost" onClick={()=>onLogin(u)}>{u.authUserId?'Redefinir senha':'Ativar login'}</Button><Button variant="ghost" onClick={()=>onPin(u)}>Definir PIN</Button>{u.obraId&&<Button variant="ghost" onClick={()=>onAllWorks(u)}>Liberar todas as obras</Button>}<Button variant="ghost" onClick={()=>onToggle(u.id)}>{u.active===false?'Ativar membro':'Inativar membro'}</Button></div></details></td></>}</tr>;
  })}</tbody></table></div>
  {!visible.length&&<p role="status">Nenhum membro encontrado. Revise a busca e os filtros.</p>}
 </section>;
}
