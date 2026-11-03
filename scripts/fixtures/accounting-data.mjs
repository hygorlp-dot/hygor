import {data as original} from './spi-data.mjs';
export const data=structuredClone(original);
data.config={...data.config,companyName:'MARCELL Engenharia · demonstração contábil fictícia'};
export const accountingFinance={id:'accounting-finance',nome:'Financeiro contábil fictício',role:'financeiro',email:'contabilidade@local.test',active:true};
export const scopedFinance={...accountingFinance,id:'accounting-scoped',email:'financeiro-obra@local.test',obraId:'a'};
export const exampleAccounts=[
 ['1.1.01','Caixa e bancos livres','caixa',40000,83000,78000,45000],
 ['1.1.02','Clientes de curto prazo','recebiveis_curto',60000,100000,80000,80000],
 ['1.1.03','Materiais em estoque','estoques',20000,0,0,20000],
 ['1.1.04','Outros ativos circulantes','outros_ac',10000,0,0,10000],
 ['1.2.01','Recebíveis de longo prazo','realizavel_longo',10000,0,0,10000],
 ['1.2.02','Imobilizado líquido','outros_anc',60000,0,5000,55000],
 ['2.1.01','Fornecedores e obrigações de curto prazo','passivo_curto',-50000,0,0,-50000],
 ['2.2.01','Obrigações de longo prazo','passivo_longo',-50000,0,0,-50000],
 ['2.3.01','Capital e reservas','patrimonio',-100000,0,0,-100000],
 ['3.1.01','Receita bruta de serviços','receita_bruta',0,0,100000,-100000],
 ['3.1.02','Deduções da receita','deducoes',0,10000,0,10000],
 ['3.2.01','Custos dos serviços','custos',0,50000,0,50000],
 ['3.3.01','Despesas operacionais','despesas_operacionais',0,10000,0,10000],
 ['3.3.02','Depreciação e amortização','depreciacao',0,5000,0,5000],
 ['3.4.01','Receitas financeiras','receitas_financeiras',0,0,2000,-2000],
 ['3.4.02','Despesas financeiras','despesas_financeiras',0,3000,0,3000],
 ['3.5.01','Outros ganhos','outros_resultados',0,0,1000,-1000],
 ['3.6.01','Tributos sobre lucro','tributos_lucro',0,5000,0,5000],
];
export const accountingCsv='codigo;conta;grupo;saldo_inicial;debitos;creditos;saldo_final\n'+exampleAccounts.map(row=>row.map((cell,index)=>index<3?cell:`${cell},00`).join(';')).join('\n');
