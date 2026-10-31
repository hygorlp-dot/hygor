import {useState} from 'react';
import {Button as UiButton} from '../../components/ui/button.jsx';
import {Button} from '../primitives/Button.jsx';
import {Btn,PageHero} from '../../LegacyApp.jsx';
import {PageHeader} from '../patterns/PageHeader.jsx';
import {Input} from '../primitives/Input.jsx';
import {Select} from '../primitives/Select.jsx';
import {Dialog} from '../primitives/Dialog.jsx';
import {EmptyState,ErrorState,LoadingState} from '../patterns/FeedbackState.jsx';
import {Alert,AlertDescription} from '../../components/ui/alert.jsx';
import '../patterns/workflow-patterns.css';

export default {title:'Fluxo/Padrões compartilhados',parameters:{layout:'fullscreen'},decorators:[Story=><div className="arcd-app-shell" data-tab="wf-patterns"><main className="arcd-main" data-workspace="fin"><Story/></main></div>]};
export function Catalogo(){
 const [query,setQuery]=useState(''),[status,setStatus]=useState('all'),[open,setOpen]=useState(false),[result,setResult]=useState('');
 return <div className="wf-pattern-catalog"><PageHeader title="Padrões de trabalho MARCELL" description="Catálogo local de controles e estados. Os exemplos não gravam operações." primaryAction={<Button onClick={()=>setOpen(true)}>Conferir registro</Button>}/>
 <PageHero headingLevel={2} title="Papéis de ação" description="As APIs existentes usam a mesma implementação visual."/>
 <div className="scroll-x"><table><caption>Compatibilidade entre componentes</caption><thead><tr><th>Papel</th><th>UI</th><th>Design system</th><th>Legado</th></tr></thead><tbody>{['primary','secondary','quiet','destructive'].map(role=><tr key={role}><th scope="row">{role}</th><td><UiButton variant={{primary:"default",secondary:"outline",quiet:"ghost",destructive:"destructive"}[role]}>Conferir registro</UiButton></td><td><Button variant={{primary:"primary",secondary:"secondary",quiet:"ghost",destructive:"danger"}[role]}>Conferir registro</Button></td><td><Btn v={{primary:"primary",secondary:"ghost",quiet:"quiet",destructive:"danger"}[role]}>Conferir registro</Btn></td></tr>)}</tbody></table></div>
 <PageHeader headingLevel={2} title="Estados da ação"/><div className="wf-pattern-catalog__actions"><Button loading loadingLabel="Salvando…">Salvar conferência</Button><Button disabled>Salvar conferência</Button><Button variant="secondary" onClick={()=>setResult('Conferência de demonstração concluída.')}>Concluir demonstração</Button></div>{result&&<p role="status">{result}</p>}
 <PageHeader headingLevel={2} title="Contexto, filtros e registro"/><div className="wf-pattern-catalog__filters"><Input label="Pesquisar registro" value={query} onChange={e=>setQuery(e.target.value)}/><Select label="Situação" value={status} onChange={e=>setStatus(e.target.value)} options={[{value:'all',label:'Todas'},{value:'review',label:'Em conferência'}]}/><Button variant="quiet" onClick={()=>{setQuery('');setStatus('all');}}>Limpar filtros</Button></div>
 <article className="wf-pattern-catalog__record"><div><h3>Documento de demonstração</h3><p>Obra de demonstração · Em conferência · Vencimento não informado</p></div><Button variant="secondary" onClick={()=>setOpen(true)}>Conferir documento</Button></article>
 <Alert variant="warning"><AlertDescription>Vencimento pendente. Confira o dado na origem antes de prosseguir.</AlertDescription></Alert>
 <PageHeader headingLevel={2} title="Resultado da consulta"/><EmptyState headingLevel={3} title="Nenhum registro neste filtro" description="Altere a situação ou limpe a busca." action={<Button variant="secondary" onClick={()=>{setQuery('');setStatus('all');}}>Limpar busca e situação</Button>}/><ErrorState headingLevel={3} title="Não foi possível carregar os registros" description="O preenchimento atual foi mantido." action={<Button variant="secondary">Tentar novamente</Button>}/><LoadingState title="Carregando registros…"/>
 <Dialog open={open} title="Conferir documento" onOpenChange={setOpen}><p>Prévia de demonstração. A confirmação operacional pertence ao comando existente.</p><div className="wf-pattern-catalog__actions"><Button variant="secondary" onClick={()=>setOpen(false)}>Voltar à consulta</Button></div></Dialog>
 </div>;
}
