// Synthetic review data only; never imports application credentials.
export const profile = { id:"pilot-review", nome:"Revisão MARCELL", role:"admin", email:"piloto@local.test", active:true };
export const data = {
  usuarios:[profile], obras:[{ id:"a", name:"Residencial Alameda", status:"active" }, { id:"b", name:"Residencial Horizonte", status:"active" }],
  employees:[], attendance:{}, config:{ companyName:"MARCELL", paymentHolidays:[] },
  materiais:[{ id:"cement", codigo:"MAT-1", descricao:"CIMENTO CP II", unidade:"UN", ativo:true }],
  fornecedores:[{ id:"central", nome:"Depósito Central", ativo:true }],
  solicitacoesCompra:[{ id:"req", numero:"SC-001", obraId:"a", status:"enviada", necessidade:"2026-10-28", criadoEm:"2026-10-20T12:00:00Z", solicitanteNome:"Engenharia", prioridade:"normal", itens:[{ id:"ri", materialId:"cement", descricaoRef:"CIMENTO CP II", unidadeRef:"UN", quantidade:10 }] }],
  cotacoes:[{ id:"quote", numero:"COT-001", obraId:"a", status:"aberta", data:"2026-10-20", materialId:"cement", qtd:10, propostas:[{ id:"p1", fornecedorId:"central", precoUnit:25, prazoDias:2 }] }],
  pedidos:[{ id:"delivery", numero:"PC-001", obraId:"a", fornecedorId:"central", status:"enviado", data:"2026-10-20", previsao:"2026-10-29", origemPagamento:"empresa", pagamentos:[], itens:[{ id:"di", materialId:"cement", qtd:10, precoUnit:25, qtdRecebida:0, unidadeRef:"UN", unidadeCompra:"UN", fatorConversao:1 }] }],
  payments:[], pagamentosFolha:[], caixaObra:[], transacoes:[],
  notasFiscais:[{ id:"nf", obraId:"a", tipo:"nfe", numero:"123", fornecedorNome:"Depósito Central", status:"aprovada", emissao:"2026-10-30", vencimento:"2026-10-30", valorBruto:1000, valorLiquido:1000, documentos:[{ id:"doc", nome:"Nota fiscal de demonstração", url:"https://example.com/nota.pdf" }], pagamentos:[{ id:"pg", data:"2026-10-30", valor:250, origem:"empresa" }] }],
  medicoes:[{ id:"med", obraId:"b", competencia:"2026-10", dataEmissao:"2026-10-30", dataVencimento:"2026-10-30", valorPrevisto:2000, descricao:"Medição Horizonte", documentos:[] }],
};
