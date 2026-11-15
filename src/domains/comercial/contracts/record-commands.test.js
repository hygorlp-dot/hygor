import {describe,it,expect} from 'vitest';
import model from './administration-template.json';
import metadata from './administration-record-meta.json';
import {RECORD_COMMANDS,applyContractRecordCommand,contractReviewIssues,contractCommandScope} from './record-commands.js';
import {applyOperationalCommand} from '../../sync/operational-commands.js';
import {validateOperationalCommandScope} from '../../../../server/operational-command-policy.js';
import {validateNoPhysicalDeletes} from '../../../../server/section-authorizations.js';
import {projectDataForUser} from '../../../../server/data-projection.js';

import {user,admin,fixture,recordFixture,files} from './record-fixtures.test-helper.js';
let counter=0;
function command(type,payload,expectedVersion=0,actor=user){return {type,payload,expectedVersion,actorId:actor.id,actorRole:actor.role,actorName:actor.nome,actorObraId:actor.obraId||'',idempotencyKey:`contract-test-${++counter}`,now:'2026-11-13T12:00:00Z'};}
function saved(){const result=applyOperationalCommand(fixture(),command(RECORD_COMMANDS.SAVE,{id:'r1',record:recordFixture(),files:files()},0,admin));expect(result.ok).toBe(true);return result.data;}
const execute=(data,type,payload,actor=admin)=>applyOperationalCommand(data,command(type,{id:'r1',...payload},data.commercialContractRecords[0].version,actor));

it('não permite novos anexos apontarem a documentos excluídos ou com exclusão pendente',()=>{
 for(const state of [{deletedAt:'2026-11-15T15:00:00Z'},{trash:{operationId:'pending-trash'}}]){
  const data=fixture();Object.assign(data.workFileCabinets[0].documents[0],state);
  expect(applyOperationalCommand(data,command(RECORD_COMMANDS.SAVE,{id:'r1',record:recordFixture(),files:files()},0,admin)).ok).toBe(false);
 }
});

describe('Persistência dos registros comerciais sem emissão',()=>{
  it('mantém os metadados usados no cadastro sincronizados com a fonte protegida',()=>{
    expect(metadata).toEqual(Object.fromEntries(['id','name','version','sourceSha256','suggestions'].map(key=>[key,model[key]])));
  });
  it('salva e reabre a cópia com número reservado, modelo e contratada',()=>{
    const data=saved(),row=data.commercialContractRecords[0];
    expect(row.number).toBe('CONT-00001');expect(row.version).toBe(1);expect(row.modelo.sourceSha256).toBe(model.sourceSha256);expect(row.contratada.cnpj).toBe(fixture().commercialContractCompany.cnpj);expect(row.anexos).toHaveLength(6);
    expect(JSON.parse(JSON.stringify(data)).commercialContractRecords[0]).toEqual(row);
  });
  it('não altera a cópia quando o cadastro central muda',()=>{
    const data=saved();const result=applyOperationalCommand(data,command(RECORD_COMMANDS.COMPANY,{company:{...fixture().commercialContractCompany,razaoSocial:'Outra identificação'}},1,admin));
    expect(result.ok).toBe(true);expect(result.data.commercialContractRecords[0].contratada.razaoSocial).toBe(fixture().commercialContractCompany.razaoSocial);
  });
  it('salva rascunho sem obra e sem documentos, registrando pendências',()=>{
    const record={titulo:'Rascunho sem obra',dados:{},partes:[]};
    const result=applyOperationalCommand(fixture(),command(RECORD_COMMANDS.SAVE,{id:'empty',record}));expect(result.ok).toBe(true);expect(contractReviewIssues(result.data.commercialContractRecords[0]).length).toBeGreaterThan(0);
  });
  it('deduplica a mesma tentativa confirmada',()=>{
    const c=command(RECORD_COMMANDS.SAVE,{id:'r1',record:recordFixture()});const first=applyOperationalCommand(fixture(),c);const second=applyOperationalCommand(first.data,c);expect(second.idempotent).toBe(true);expect(second.data.commercialContractRecords).toHaveLength(1);
  });
  it('recusa versão antiga e não troca a versão silenciosamente',()=>{
    const result=applyOperationalCommand(saved(),command(RECORD_COMMANDS.SAVE,{id:'r1',record:recordFixture()},0));expect(result.ok).toBe(false);
  });
  it('reserva números distintos para contratos diferentes',()=>{
    const result=applyOperationalCommand(saved(),command(RECORD_COMMANDS.SAVE,{id:'r2',record:recordFixture()}));expect(result.data.commercialContractRecords.map(r=>r.number)).toEqual(['CONT-00001','CONT-00002']);
  });
  it('comercial envia, administrador aprova e nova revisão preserva o original',()=>{
    let data=saved();expect(contractReviewIssues(data.commercialContractRecords[0])).toEqual([]);
    data=execute(data,RECORD_COMMANDS.REVIEW,{},user).data;
    expect(execute(data,RECORD_COMMANDS.DECIDE,{approve:true},user).ok).toBe(false);
    data=execute(data,RECORD_COMMANDS.DECIDE,{approve:true}).data;
    expect(execute(data,RECORD_COMMANDS.SAVE,{record:recordFixture()}).ok).toBe(false);
    const previous=JSON.stringify(data.commercialContractRecords[0]);
    const revised=execute(data,RECORD_COMMANDS.REVISE,{reason:'Ajuste cadastral'});
    expect(revised.ok).toBe(true);expect(revised.data.commercialContractRecords[0].revision).toBe(2);expect(revised.data.commercialContractRecords[0].revisions[0].status).toBe('aprovado');expect(revised.data.commercialContractRecords[0].confirmacoes).toEqual({});expect(JSON.stringify(data.commercialContractRecords[0])).toBe(previous);
  });
  it('registra a via assinada por referência da obra e preserva a revisão assinada',()=>{
    let data=saved();for(const [type,payload] of [[RECORD_COMMANDS.REVIEW,{}],[RECORD_COMMANDS.DECIDE,{approve:true}],[RECORD_COMMANDS.STATE,{status:'aguardando_assinatura',reason:'Documento encaminhado externamente'}],[RECORD_COMMANDS.STATE,{status:'assinado',reason:'Conferência externa',signed:{documentId:'doc6',revisionId:'rev6'},confirmSigned:true}]]){const result=execute(data,type,payload);expect(result.ok).toBe(true);data=result.data;}
    expect(data.commercialContractRecords[0].anexos.at(-1).tipo).toBe('via_assinada');const result=execute(data,RECORD_COMMANDS.REVISE,{reason:'Preparar revisão'});expect(result.data.commercialContractRecords[0].revisions[0].status).toBe('assinado');expect(result.data.commercialContractRecords[0].anexos).toEqual([]);
  });
  it('devolve revisão com motivo e registra autoria',()=>{
    let data=execute(saved(),RECORD_COMMANDS.REVIEW,{},user).data;const result=execute(data,RECORD_COMMANDS.DECIDE,{approve:false,reason:'Conferir cadastro'});expect(result.data.commercialContractRecords[0].status).toBe('rascunho');expect(result.data.commercialContractRecords[0].history.at(-1).actorId).toBe(admin.id);
  });
  it('qualquer alteração devolve a revisão pendente a rascunho',()=>{
    let data=execute(saved(),RECORD_COMMANDS.REVIEW,{},user).data;const result=execute(data,RECORD_COMMANDS.SAVE,{record:{...recordFixture(),titulo:'Ajustado'}},user);expect(result.data.commercialContractRecords[0].status).toBe('rascunho');
  });
  it('não recalcula o CGR manual nem usa o valor da obra como teto',()=>{
    const record=recordFixture();record.dados.comercial.cgr=390000;record.cgrManual=true;record.dados.prazos.motivo_cgr_manual='Negociação registrada';const result=applyOperationalCommand(fixture(),command(RECORD_COMMANDS.SAVE,{id:'manual',record}));expect(result.data.commercialContractRecords[0].dados.comercial.cgr).toBe(390000);expect(result.data.commercialContractRecords[0].dados.comercial.teto).toBe(model.suggestions['comercial.teto']);
  });
  it('cruza área com versão da obra sem gravar a obra nem mudar o CGR',()=>{
    const data=saved(),result=execute(data,RECORD_COMMANDS.LINK_WORK,{fields:['area_construida'],workVersion:2},user);expect(result.ok).toBe(true);expect(result.data.commercialContractRecords[0].dados.obra.area_construida).toBe(120);expect(result.data.commercialContractRecords[0].dados.comercial.cgr).toBe(400000);expect(result.data.obras).toBe(data.obras);
  });
  it('recusa sincronização quando a obra mudou após a consulta',()=>{expect(execute(saved(),RECORD_COMMANDS.LINK_WORK,{fields:['area_construida'],workVersion:1},user).ok).toBe(false);});
  it('bloqueia troca de cliente/obra quando existem documentos preservados',()=>{expect(execute(saved(),RECORD_COMMANDS.SAVE,{record:{...recordFixture(),obraId:'w2',clienteId:'c2'}}).ok).toBe(false);});
  it('não aceita campos de aprovação ou histórico enviados pelo cliente',()=>{
    const record={...recordFixture(),status:'assinado',approvedById:'fake',history:[{actorId:'fake'}],contratada:{razaoSocial:'fake'}};const result=applyOperationalCommand(fixture(),command(RECORD_COMMANDS.SAVE,{id:'r',record}));const row=result.data.commercialContractRecords[0];expect(row.status).toBe('rascunho');expect(row.approvedById).toBeUndefined();expect(row.history).toHaveLength(1);expect(row.contratada.razaoSocial).toBe(fixture().commercialContractCompany.razaoSocial);
  });
  it('não permite documento inexistente nem documento de outra obra',()=>{expect(applyOperationalCommand(fixture(),command(RECORD_COMMANDS.SAVE,{id:'r',record:recordFixture(),files:[{tipo:'para_assinatura',documentId:'foreign',revisionId:'foreign'}]})).ok).toBe(false);});
  it.each(['PJ','multiple','no-condominium'])('sinaliza variante sem aprovação: %s',kind=>{
    const row=saved().commercialContractRecords[0];if(kind==='PJ')row.partes[0].tipoPessoa='PJ';if(kind==='multiple')row.partes.push({...row.partes[0]});if(kind==='no-condominium')row.dados.obra.loteamento='';expect(contractReviewIssues(row).some(v=>v.includes('variante'))).toBe(true);
  });
  it('não aceita área inválida ao salvar',()=>{const record=recordFixture();record.dados.obra.area_construida=-2;expect(applyOperationalCommand(fixture(),command(RECORD_COMMANDS.SAVE,{id:'r',record})).ok).toBe(false);});
});

describe('Fronteira de autorização e leitura dos contratos',()=>{
  it('o Comercial não pode confirmar a conferência externa reservada ao administrador',()=>{
    const result=applyOperationalCommand(fixture(),command(RECORD_COMMANDS.SAVE,{id:'unreviewed',record:recordFixture(),files:files()},0,user));
    const row=result.data.commercialContractRecords[0];
    expect(row.confirmacoes.documentoExterno).toBe(false);expect(row.externalReviewedById).toBeUndefined();
    expect(contractReviewIssues(row).some(issue=>issue.includes('administrador'))).toBe(true);
  });
  it.each(['engenheiro','financeiro','visualizador'])('recusa comando do perfil %s',role=>{expect(contractCommandScope(fixture(),command(RECORD_COMMANDS.SAVE,{record:recordFixture()}),{...user,role}).ok).toBe(false);});
  it('recusa perfil comercial sem acesso à área',()=>{expect(validateOperationalCommandScope({user:{...user,accessTabs:['home']},data:fixture(),command:command(RECORD_COMMANDS.SAVE,{record:recordFixture()})}).ok).toBe(false);});
  it('recusa contrato de outra obra e criação sem obra por usuário restrito',()=>{
    const scoped={...user,obraId:'w2'};expect(contractCommandScope(saved(),command(RECORD_COMMANDS.REVIEW,{id:'r1'}),scoped).ok).toBe(false);expect(contractCommandScope(fixture(),command(RECORD_COMMANDS.SAVE,{record:{titulo:'sem obra'}}),scoped).ok).toBe(false);
  });
  it('recusa documento de pasta restrita e oculta o contrato com esse vínculo',()=>{
    const data=saved();data.workFileCabinets[0].folders=[{id:'private',access:{restricted:true,readers:[]}}];data.workFileCabinets[0].documents[0].folderId='private';
    expect(validateOperationalCommandScope({user,data,command:command(RECORD_COMMANDS.SAVE,{id:'r1',record:recordFixture(),files:files()},1)}).ok).toBe(false);expect(projectDataForUser(data,user).commercialContractRecords).toEqual([]);
  });
  it('a projeção não vaza cliente, proposta ou contrato de outra obra',()=>{
    const data=saved();data.commercialContractRecords.push({...data.commercialContractRecords[0],id:'r2',obraId:'w2',clienteId:'c2',anexos:[]});const view=projectDataForUser(data,{...user,obraId:'w1'});expect(view.commercialContractRecords.map(r=>r.id)).toEqual(['r1']);expect(view.comercial.clientes.map(c=>c.id)).toEqual(['c1']);expect(projectDataForUser(data,{...user,role:'financeiro'}).commercialContractRecords).toBeUndefined();
  });
  it('protege os agregados de gravação direta, inclusive pelo administrador',()=>{
    const data=saved();expect(validateNoPhysicalDeletes(data,{...data,commercialContractRecords:[]})).toContain('comando comercial');expect(validateNoPhysicalDeletes(data,{...data,commercialContractCompany:{}})).toContain('comando comercial');expect(validateNoPhysicalDeletes(data,{...data,commercialContractRecords:data.commercialContractRecords})).toBe('');
  });
});
