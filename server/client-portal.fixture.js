// Cenário fictício exclusivo de testes e revisão local. Nunca importar no app.
export const portalFixture = () => ({
  config:{},employees:[],fases:[{id:"acabamento",nome:"Acabamento"}],obras:[{id:"obra-local",name:"Casa Aurora · cenário fictício",faseId:"acabamento",startDate:"2026-11-01",contractValue:100000,billingFrequency:"quinzenal",contractEnd:"2026-12-18",status:"active",portalCliente:{ativo:true,publicarFotos:true,publicarCronograma:true,publicarFinanceiro:true,publicarDocumentos:true,publicarCustos:true,publicarOrcamentoEtapas:true,publicarCaixaObra:true,publicarCompras:true,publicarNotasFiscais:true}}],
  medicoes:[{id:"med-local",obraId:"obra-local",descricao:"Medição da quinzena",tipo:"percentual",status:"emitida",competencia:"2026-11",dataEmissao:"2026-11-10",dataVencimento:"2026-11-20",percentualAcumulado:40,percentualPeriodo:10,valorPrevisto:10000,recebimentos:[{id:"rec-local",valor:2500,data:"2026-11-12"}]}],
  planos:[{obraId:"obra-local",tarefas:[{id:"fundacao",nome:"Fundação",inicio:"2026-11-01",fim:"2026-11-10",progresso:100,custo:6000},{id:"alvenaria",nome:"Alvenaria",inicio:"2026-11-11",fim:"2026-12-10",progresso:30,custo:4000}]}],
  medicoesObra:[{id:"boletim-local",obraId:"obra-local",status:"aprovada",dataMedicao:"2026-11-12",avancoFisico:72}],
  budgetBaselines:[{obraId:"obra-local",tipo:"controle",ativo:true,budgetId:"orc-local"}],
  orcamentos:[{id:"orc-local",nome:"Controle aprovado",obraId:"obra-local",etapas:[{id:"fundacao",nome:"Fundação"},{id:"alvenaria",nome:"Alvenaria"}],itens:[{id:"i1",etapaId:"fundacao",descricao:"Materiais da fundação",quantidade:1,precoUnit:6000},{id:"i2",etapaId:"alvenaria",descricao:"Alvenaria",quantidade:1,precoUnit:4000}]}],
  fornecedores:[{id:"f1",nome:"Fornecedor de teste"}],materiais:[{id:"cimento",descricao:"Cimento",unidade:"SC"}],
  pedidos:[{id:"pedido-local",obraId:"obra-local",numero:"PC-001",status:"enviado",data:"2026-11-05",fornecedorId:"f1",itens:[{id:"p1",materialId:"cimento",orcNivel1Id:"fundacao",qtd:20,precoUnit:50,qtdRecebida:20}]}],
  notasFiscais:[{id:"nf-local",pedidoId:"pedido-local",obraId:"obra-local",numero:"1001",status:"aprovada",categoria:"material",emissao:"2026-11-05",competencia:"2026-11",etapaId:"fundacao",fornecedorId:"f1",valorBruto:1000,valorLiquido:1000,pagamentos:[{id:"pg1",data:"2026-11-06",valor:600}],documentos:[{id:"doc-local",nome:"Nota fiscal 1001.pdf",url:"https://files.example.test/nota-1001.pdf"}]}],
  outrasDesp:[{id:"desp-local",obraId:"obra-local",categoria:"outros",data:"2026-11-06",competencia:"2026-11",valor:200,status:"aprovada",etapaId:"alvenaria",descricao:"Despesa de teste"}],
  caixaObra:[{id:"aporte-local",obraId:"obra-local",data:"2026-11-01",tipo:"aporte",valor:10000,descricao:"Aporte inicial"},{id:"caixa-local",obraId:"obra-local",data:"2026-11-06",tipo:"despesa",valor:600,categoria:"material",descricao:"Pagamento de compra",pedidoId:"pedido-local",notaFiscalId:"nf-local",pagamentoId:"pg1",desconsiderarDRE:true}],
  rdos:[{id:"rdo1",obraId:"obra-local",status:"concluido",data:"2026-11-12",descricao:"Etapa de alvenaria",fotos:[{id:"foto1",url:"/brand/marcell/monogram-azul.svg",legenda:"Imagem de teste · alvenaria",publicarCliente:true}]},{id:"rdo2",obraId:"obra-local",status:"concluido",data:"2026-11-11",descricao:"Etapa de fundação",fotos:[{id:"foto2",url:"/brand/marcell/monogram-azul.svg",legenda:"Imagem de teste · fundação",publicarCliente:true}]}],
});

export async function seedPortalSource(db,data){
  await db.pg.exec(`create table if not exists company_app_data(company_id text,key text,value jsonb,updated_at timestamptz default now(),primary key(company_id,key));
    create table if not exists financial_titles(id uuid,company_id text,origin_type text,obra_id text,direction text,competence date,due_date date,created_at timestamptz,original_amount numeric,status text,metadata jsonb);
    create table if not exists settlements(id uuid,company_id text,title_id uuid,bank_transaction_id uuid,amount numeric,settlement_date date,status text);
    create table if not exists bank_transactions(id uuid,company_id text,amount numeric,status text,metadata jsonb);
    create table if not exists reconciliation_links(id uuid,company_id text,bank_transaction_id uuid,amount numeric,status text);`);
  await db.pg.query("insert into company_app_data(company_id,key,value) values('arcd','arced_ponto_v1',$1::jsonb) on conflict(company_id,key) do update set value=excluded.value,updated_at=now()",[JSON.stringify(data)]);
}
