import {Button} from '../../components/ui/button.jsx';
export const DOCUMENT_PAGE_SIZE=25;
export function recordPage(count,page=0){return Math.min(Math.max(0,Number.isInteger(page)?page:0),Math.max(0,Math.ceil(count/DOCUMENT_PAGE_SIZE)-1));}
export default function RecordPagination({count,page,onPage,label,anchorLabel=label}){
 const last=Math.max(0,Math.ceil(count/DOCUMENT_PAGE_SIZE)-1),current=recordPage(count,page);
 if(count<=DOCUMENT_PAGE_SIZE)return null;
 const go=(event,next)=>{const root=event.currentTarget.closest('.document-review-queue,.document-center');onPage(next);requestAnimationFrame(()=>{const anchor=[...(root?.querySelectorAll('.document-pagination')||[])].find(node=>node.getAttribute('aria-label')===anchorLabel);anchor?.scrollIntoView?.({block:'start'});anchor?.querySelector('[role=status]')?.focus({preventScroll:true});});};
 return <nav className="document-pagination" aria-label={label}><Button variant="outline" disabled={!current} onClick={event=>go(event,current-1)}>Página anterior</Button><span role="status" tabIndex={-1}>{current*DOCUMENT_PAGE_SIZE+1}–{Math.min((current+1)*DOCUMENT_PAGE_SIZE,count)} de {count} · Página {current+1} de {last+1}</span><Button variant="outline" disabled={current===last} onClick={event=>go(event,current+1)}>Próxima página</Button></nav>;
}
