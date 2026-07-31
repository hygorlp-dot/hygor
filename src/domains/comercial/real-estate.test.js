import { describe,expect,it } from "vitest";
import {
  createPropertySale,createReservation,normalizeRealEstateCommercial,
  releaseExpiredReservations,selectRealEstateDashboard,updateUnitWithAudit,
} from "./real-estate.js";

const actor={id:"admin-1",nome:"Administrador",role:"admin"};
const base=()=>normalizeRealEstateCommercial({
  leads:[{id:"lead-1",etapa:"qualificado",status:"ativo"}],propostas:[],
  empreendimentos:[{id:"dev-1",nome:"Residencial ARCD"}],
  unidadesImobiliarias:[{id:"unit-1",empreendimentoId:"dev-1",codigo:"A-101",status:"disponivel",valorTabela:500000,valorMinimo:470000,comissaoPct:5}],
});

describe("domínio imobiliário comercial",()=>{
  it("normaliza as novas coleções sem remover o CRM existente",()=>{
    const result=base();
    expect(result.leads).toHaveLength(1);
    expect(result.empreendimentos).toHaveLength(1);
    expect(result.reservasImobiliarias).toEqual([]);
  });

  it("impede duas reservas ativas para a mesma unidade",()=>{
    const first=createReservation({commercial:base(),id:"res-1",actor,now:"2026-07-31T10:00:00.000Z",reservation:{unidadeId:"unit-1",leadId:"lead-1",valor:500000,validade:"2026-08-03"}});
    expect(first.unidadesImobiliarias[0].status).toBe("reservada");
    expect(()=>createReservation({commercial:first,id:"res-2",actor,now:"2026-07-31T11:00:00.000Z",reservation:{unidadeId:"unit-1",leadId:"lead-1",valor:500000,validade:"2026-08-04"}})).toThrow(/reserva ativa/i);
  });

  it("expira reserva e libera a unidade automaticamente",()=>{
    const reserved=createReservation({commercial:base(),id:"res-1",actor,now:"2026-07-20T10:00:00.000Z",reservation:{unidadeId:"unit-1",leadId:"lead-1",valor:500000,validade:"2026-07-25"}});
    const result=releaseExpiredReservations(reserved,"2026-07-31");
    expect(result.reservasImobiliarias[0].status).toBe("expirada");
    expect(result.unidadesImobiliarias[0].status).toBe("disponivel");
  });

  it("exige aprovação para venda abaixo do mínimo e bloqueia revenda",()=>{
    expect(()=>createPropertySale({commercial:base(),id:"sale-1",actor,sale:{unidadeId:"unit-1",valor:450000}})).toThrow(/aprovação/i);
    expect(()=>createPropertySale({commercial:base(),id:"sale-1",actor:{id:"seller-1",role:"comercial"},sale:{unidadeId:"unit-1",valor:450000,aprovadoAbaixoMinimo:true}})).toThrow(/administrador/i);
    expect(createPropertySale({commercial:base(),id:"sale-approved",actor,sale:{unidadeId:"unit-1",valor:450000,aprovadoAbaixoMinimo:true}}).vendasImobiliarias[0].valor).toBe(450000);
    const sold=createPropertySale({commercial:base(),id:"sale-1",actor,sale:{unidadeId:"unit-1",leadId:"lead-1",valor:480000}});
    expect(sold.vendasImobiliarias[0].comissaoPrevista).toBe(24000);
    expect(sold.unidadesImobiliarias[0].status).toBe("vendida");
    expect(()=>createPropertySale({commercial:sold,id:"sale-2",actor,sale:{unidadeId:"unit-1",valor:480000}})).toThrow(/já foi vendido/i);
  });

  it("audita preço e status e calcula o painel",()=>{
    const previous=base().unidadesImobiliarias[0];
    const changed=updateUnitWithAudit({previous,actor,now:"2026-07-31T12:00:00.000Z",unit:{...previous,valorTabela:520000,status:"em_negociacao",motivoAlteracaoPreco:"Nova tabela"}});
    expect(changed.historicoPrecos.at(-1)).toMatchObject({valorAnterior:500000,valor:520000});
    expect(changed.historicoStatus.at(-1)).toMatchObject({de:"disponivel",para:"em_negociacao"});
    const dashboard=selectRealEstateDashboard({...base(),unidadesImobiliarias:[changed]});
    expect(dashboard.metrics.vgvNegotiation).toBe(520000);
    expect(dashboard.metrics.activeLeads).toBe(1);
  });
});
