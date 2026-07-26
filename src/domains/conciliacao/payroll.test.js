import { criarIndicesFinanceiros } from "./selectors";
import { gerarCandidatosConciliacao } from "./matching";
import { registrarPagamentoEConciliar, desfazerConciliacao } from "./mutations";

const operador = { id: "financeiro", nome: "Financeiro" };
const base = () => ({
  employees: [{ id:"e1", name:"Antonio Fulano", cpf:"12345678901", pixKey:"antonio@pix", obra:"o1", active:true }],
  titulosFolha: [{
    id:"tf1", employeeId:"e1", competencia:"2026-01", periodoInicio:"2026-01-01", periodoFim:"2026-01-15", vencimento:"2026-01-20",
    bruto:900, beneficios:100, adiantamentos:0, descontos:0, liquido:1000, valorPago:0, saldo:1000, status:"em_aberto",
    rateiosPorObra:[{obraId:"o1",valor:1000}], liquidacoes:[],
  }],
  transacoes:[{id:"t1",extratoId:"ex1",data:"2026-01-20",valor:-1000,status:"pendente",chavePix:"antonio@pix"}],
  notasFiscais:[], pedidos:[], medicoes:[], medicoesTerc:[], terceirizados:[], caixaObra:[],
  pagamentosFolha:[], outrasDesp:[], despesasEmpresa:[], historicoConc:[], reconciliationLinks:[],
});

describe("título de folha e PIX", () => {
  test("PIX estruturado de Antonio gera título acionável com rateio, sem usar só trecho de descrição", () => {
    const data=base();
    const candidates=gerarCandidatosConciliacao(data.transacoes[0],data,criarIndicesFinanceiros(data));
    const title=candidates.find(item=>item.tipo==="tituloFolha");
    expect(title).toBeDefined();
    expect(title.entidadeId).toBe("tf1");
    expect(title.metadados.payroll.saldo).toBe(1000);
    expect(title.motivos).toContain("Chave PIX exata e exclusiva");
  });

  test("liquida parcialmente sem criar custo no DRE e mantém saldo", () => {
    const data=base();
    const result=registrarPagamentoEConciliar(data,{transacaoId:"t1",tipo:"tituloFolha",entidadeId:"tf1",valor:600,operador});
    expect(result.resumo.ok).toBe(true);
    expect(result.data.titulosFolha[0].status).toBe("parcial");
    expect(result.data.titulosFolha[0].saldo).toBe(400);
    expect(result.data.outrasDesp).toHaveLength(0);
    expect(result.data.despesasEmpresa).toHaveLength(0);
    expect(result.data.reconciliationLinks).toHaveLength(1);
  });

  test("desfazer liquidação de folha preserva o título e reabre apenas sua liquidação", () => {
    const pago=registrarPagamentoEConciliar(base(),{transacaoId:"t1",tipo:"tituloFolha",entidadeId:"tf1",valor:1000,operador}).data;
    const revertido=desfazerConciliacao(pago,"t1",operador,"teste").data;
    expect(revertido.titulosFolha[0].status).toBe("em_aberto");
    expect(revertido.titulosFolha[0].saldo).toBe(1000);
    expect(revertido.reconciliationLinks[0].status).toBe("desfeito");
  });

  test("dois títulos com mesmo valor não são pré-selecionados automaticamente", () => {
    const data=base();
    data.employees.push({id:"e2",name:"Antonio Segundo",pixKey:"segundo@pix",active:true});
    data.titulosFolha.push({...data.titulosFolha[0],id:"tf2",employeeId:"e2",chavePix:"segundo@pix"});
    // O banco não informou chave/documento, só valor: a escolha é humana.
    data.transacoes[0]={...data.transacoes[0],chavePix:"",descricao:"PIX enviado",contraparteNome:""};
    const candidates=gerarCandidatosConciliacao(data.transacoes[0],data,criarIndicesFinanceiros(data));
    const titles=candidates.filter(item=>item.tipo==="tituloFolha");
    expect(titles).toHaveLength(2);
    expect(titles.every(item=>item.preSelecionavel===false)).toBe(true);
  });
});
