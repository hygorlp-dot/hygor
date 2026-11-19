import {createHash} from 'node:crypto';
import {approvedCompanyCutoverSql} from '../../server/company-cutover-sql.js';
import {cutoverHash,requireCutover,stableJson} from '../../server/company-cutover.js';
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";

// Private versioned migration files, not a remote execution client. Data stays
// out of Git. Each fragment fits the connector limit; the final DO executes the
// exact reviewed body atomically after verifying bytes, SHA-256 and expiry.
export function prepareCompanyCutoverStages(bundle,approval,options){
 const transaction=approvedCompanyCutoverSql(bundle,approval,options),start=transaction.indexOf('\nbegin;\n');
 requireCutover(start>=0&&transaction.endsWith('\ncommit;'),'Envelope transacional inesperado.');
 const body=Buffer.from(transaction.slice(start+'\nbegin;\n'.length,-'\ncommit;'.length),'utf8');
 const sha256=createHash('sha256').update(body).digest('hex'),size=384*1024,parts=[];
 for(let offset=0;offset<body.length;offset+=size)parts.push(body.subarray(offset,offset+size));
 requireCutover(parts.length<=1024,'Carga excede o limite certificado.');
 const attemptId=cutoverHash({packageId:bundle.id,approval});
 const id=literal(attemptId),approvalJson=literal(stableJson(approval))+'::jsonb';
 const registration=`insert into company_cutover_private.staged_runs(id,package_id,payload_sha256,payload_bytes,part_count,approval,expires_at) values (${id},${literal(bundle.id)},${literal(sha256)},${body.length},${parts.length},${approvalJson},${literal(approval.expiresAt)}::timestamptz) on conflict (id) do nothing;
do $register$ begin
 if not exists (select 1 from company_cutover_private.staged_runs where id=${id} and package_id=${literal(bundle.id)} and payload_sha256=${literal(sha256)} and payload_bytes=${body.length} and part_count=${parts.length} and approval=${approvalJson} and expires_at=${literal(approval.expiresAt)}::timestamptz) then raise exception 'Registro de migração divergente'; end if;
end $register$;`;
 const fragments=parts.map((part,ordinal)=>{
  const payload=`decode(${literal(part.toString('base64'))},'base64')`;
  const partHash=literal(createHash('sha256').update(part).digest('hex'));
  return `insert into company_cutover_private.staged_parts(run_id,ordinal,payload) values (${id},${ordinal},${payload}) on conflict (run_id,ordinal) do nothing;
do $part$ begin if not exists (select 1 from company_cutover_private.staged_parts where run_id=${id} and ordinal=${ordinal} and encode(sha256(payload),'hex')=${partHash}) then raise exception 'Fragmento divergente'; end if; end $part$;`;
 });
 const apply=`do $apply_staged$
declare run company_cutover_private.staged_runs%rowtype; payload bytea; n integer; lo integer; hi integer;
begin
 select * into run from company_cutover_private.staged_runs where id=${id} for update;
 if not found then raise exception 'Migração não registrada'; end if;
 if run.package_id<>${literal(bundle.id)} or run.payload_sha256<>${literal(sha256)} or run.approval<>${approvalJson} then raise exception 'Aprovação divergente'; end if;
 if run.applied_at is not null then return; end if;
 if run.expires_at<=clock_timestamp() then raise exception 'Corte expirado; recapturar e conferir'; end if;
 select count(*),min(ordinal),max(ordinal),string_agg(p.payload,''::bytea order by ordinal) into n,lo,hi,payload from company_cutover_private.staged_parts p where run_id=${id};
 if n<>run.part_count or lo<>0 or hi<>run.part_count-1 or octet_length(payload)<>run.payload_bytes or encode(sha256(payload),'hex')<>run.payload_sha256 then raise exception 'Carga incompleta ou adulterada'; end if;
 execute convert_from(payload,'UTF8');
 update company_cutover_private.staged_runs set applied_at=clock_timestamp() where id=${id};
end $apply_staged$;`;
 return {id:attemptId,packageId:bundle.id,sha256,bytes:body.length,registration,fragments,apply};
}
