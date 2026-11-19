import { describe, expect, it } from "vitest";
import { validateOperationalCommandScope } from "../../../server/operational-command-policy.js";
import { aplicarRecebimentoMedicao } from "../conciliacao/calculations.js";
import { clientMeasurementBankIds } from "./client-measurement-bank.js";
import { buildFinancialLedger, selectAccountsReceivable, selectDRE } from "./ledger.js";
import { applyClientMeasurementCommand, CLIENT_MEASUREMENT_COMMAND as CMD } from "./measurement-commands.js";

const date = "2026-11-19";
const user = { id:"finance", role:"financeiro", nome:"Financeiro QA", obraId:"work" };
const run = (data, type, payload, expectedVersion) => applyClientMeasurementCommand(
  data, { type, payload, expectedVersion, actorId:user.id, actorName:user.nome }, `${date}T12:00:00Z`,
);
const initial = () => ({
  obras:[{id:"work", contractValue:10000},{id:"other", contractValue:5000}],
  comercial:{contratos:[{id:"contract", obraId:"work", numero:"CTR-1", valor:10000, status:"assinado"}]},
  medicoesObra:[{id:"technical", obraId:"work", numero:"BM-1", status:"aprovada", data:date, avancoFisico:10}],
});
const issue = data => run(data, CMD.CLIENT_MEASUREMENT_BILLED, {medicaoTecnicaId:"technical"});
const receipt = (data, expectedVersion, valor, dataPagamento = date) => run(data, CMD.CLIENT_MEASUREMENT_RECEIPTS_CHANGED, {
  changes:[{measurementId:"fat-technical", expectedVersion, action:"receive", receipt:{id:"manual", valor, data:dataPagamento}}],
});
const reverse = data => run(data, CMD.CLIENT_MEASUREMENT_RECEIPTS_CHANGED, {
  changes:[{measurementId:"fat-technical", action:"reverse_all", reason:"Correção de teste"}],
});
function expectPosition(data, balanceCents) {
  const ledger = buildFinancialLedger(data);
  expect(selectDRE(ledger,{obraId:"work",competence:"2026-11"})).toMatchObject({revenueCents:100000});
  expect(ledger.events.filter(item=>item.effect==="revenue")).toHaveLength(1);
  expect(selectAccountsReceivable(ledger)).toMatchObject({balanceCents});
}

describe("fluxo da medição ao recebimento", () => {
  it("liga contrato, boletim e cobrança e preserva uma receita após baixa e estorno", () => {
    const billed = issue(initial());
    expect(billed.data.medicoes[0]).toMatchObject({medicaoTecnicaId:"technical", snapshotTecnico:{contrato:{sourceId:"contract"}}});
    expect(issue(billed.data)).toMatchObject({ok:false});
    const updated = run(billed.data, CMD.CLIENT_MEASUREMENT_SAVED, {measurement:{
      id:"fat-technical", obraId:"work", billingDetails:{documento:"NFS-e 12", emissao:"2026-11-20", vencimento:"2026-11-30", retencao:100},
    }}, billed.data.medicoes[0].version);
    expect(updated.data.medicoes[0]).toMatchObject({dataEmissao:date,dataVencimento:"2026-11-30",billingDetails:{documento:"NFS-e 12",retencao:100}});
    expectPosition(updated.data,100000);
    const version = updated.data.medicoes[0].version;
    expect(receipt(updated.data, version, 900, "2026-11-31")).toMatchObject({ok:false});
    const partial = receipt(updated.data,version,900);
    expectPosition(partial.data,10000);
    const reversed = reverse(partial.data);
    expect(reversed.data.medicoes[0].recebimentos[0]).toMatchObject({status:"estornado",motivoEstorno:"Correção de teste"});
    expectPosition(reversed.data,100000);
  });

  it("mantém a referência bancária de uma baixa legada e protege a baixa vinculada", () => {
    const {data} = issue(initial());
    const legacy = {...data.medicoes[0],valorRecebido:100,dataPagamento:date,transacaoId:"bank-1"};
    const partial = aplicarRecebimentoMedicao(legacy,{id:"second",valor:200,data:date,origem:"manual"});
    expect(partial.valorRecebido).toBe(300);
    expect(clientMeasurementBankIds(data,partial)).toEqual(["bank-1"]);
    expect(reverse({...data,medicoes:[partial]})).toMatchObject({ok:false,reason:expect.stringContaining("conciliação")});
    const paid = receipt(data,data.medicoes[0].version,300).data;
    const linked = {...paid,reconciliationLinks:[{
      kind:"existing_cash_allocation",status:"active",eventId:"medicao:fat-technical:receipt:manual:cash",transactionId:"bank-2",amountCents:30000,
    }]};
    expect(clientMeasurementBankIds(linked,linked.medicoes[0])).toEqual(["bank-2"]);
    expect(reverse(linked)).toMatchObject({ok:false,reason:expect.stringContaining("conciliação")});
    expectPosition(linked,70000);
  });

  it("recusa dados de outra obra e lote de baixas que mistura escopos", () => {
    const {data} = issue(initial());
    const records = {...data,medicoes:[...data.medicoes,{id:"foreign",obraId:"other",valorPrevisto:100}]};
    expect(run(records,CMD.CLIENT_MEASUREMENT_SAVED,{measurement:{
      id:"foreign",obraId:"work",billingDetails:{documento:"inconsistente"},
    }})).toMatchObject({ok:false});
    expect(validateOperationalCommandScope({user,data:records,command:{
      type:CMD.CLIENT_MEASUREMENT_RECEIPTS_CHANGED,payload:{changes:[{measurementId:"fat-technical"},{measurementId:"foreign"}]},
    }})).toMatchObject({ok:false});
  });
});
