import { describe, expect, it } from "vitest";
import {
  applyClientMeasurementCommand,
  CLIENT_MEASUREMENT_COMMAND,
  clientMeasurementCommandObraId,
} from "./measurement-commands.js";

const now="2026-07-28T12:00:00.000Z";
const base=()=>({obras:[{id:"obra-1"}],medicoes:[]});
const command=(type,payload,expectedVersion)=>({
  type,payload,expectedVersion,actorId:"u-1",actorName:"Financeiro",now,
});
const measurement=(extra={})=>({
  id:"m-1",obraId:"obra-1",competencia:"2026-07",tipo:"mensal_fixo",
  valorPrevisto:1000,descricao:"Parcela 1",...extra,
});

describe("comandos das medições financeiras",()=>{
  it("salva criação e edição com versão e escopo da obra",()=>{
    const created=applyClientMeasurementCommand(base(),command(
      CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_SAVED,{measurement:measurement()},0,
    ),now);
    expect(created.data.medicoes[0]).toMatchObject({
      id:"m-1",status:"emitida",version:1,createdById:"u-1",
    });
    const edited=applyClientMeasurementCommand(created.data,command(
      CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_SAVED,{measurement:measurement({valorPrevisto:1200})},1,
    ),now);
    expect(edited.data.medicoes[0]).toMatchObject({valorPrevisto:1200,version:2});
    const stale=applyClientMeasurementCommand(edited.data,command(
      CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_SAVED,{measurement:measurement({valorPrevisto:1300})},1,
    ),now);
    expect(stale).toMatchObject({ok:false});
    expect(stale.reason).toMatch(/alterada por outra pessoa/);
    expect(clientMeasurementCommandObraId(created.data,command(
      CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_CANCELLED,{measurementId:"m-1"},1,
    ))).toBe("obra-1");
  });

  it("gera parcelas em lote e recusa sobrescrever parcela recebida",()=>{
    const generated=applyClientMeasurementCommand(base(),command(
      CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENTS_GENERATED,{
        obraId:"obra-1",overwrite:false,
        measurements:[measurement({id:"g-1",dataVencimento:"2026-07-10",numeroParcela:1})],
      },
    ),now);
    expect(generated.data.medicoes[0]).toMatchObject({
      id:"g-1",origem:"geracao_contrato",version:1,
    });
    const received={...generated.data,medicoes:[{
      ...generated.data.medicoes[0],recebimentos:[{id:"r-1",valor:1000,data:"2026-07-10"}],
    }]};
    const blocked=applyClientMeasurementCommand(received,command(
      CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENTS_GENERATED,{
        obraId:"obra-1",overwrite:true,
        measurements:[measurement({id:"g-2",dataVencimento:"2026-07-10",numeroParcela:1})],
      },
    ),now);
    expect(blocked).toMatchObject({ok:false});
    expect(blocked.reason).toMatch(/já possuem recebimento/);
  });

  it("registra e estorna recebimentos em lote sem ultrapassar o saldo",()=>{
    const initial={...base(),medicoes:[measurement({version:1,status:"emitida",recebimentos:[],valorRecebido:0})]};
    const received=applyClientMeasurementCommand(initial,command(
      CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_RECEIPTS_CHANGED,{changes:[{
        measurementId:"m-1",expectedVersion:1,action:"receive",
        receipt:{id:"r-1",valor:400,data:"2026-07-28",origem:"manual"},
      }]},
    ),now);
    expect(received.data.medicoes[0]).toMatchObject({
      valorRecebido:400,recebido:false,version:2,
    });
    const excess=applyClientMeasurementCommand(received.data,command(
      CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_RECEIPTS_CHANGED,{changes:[{
        measurementId:"m-1",expectedVersion:2,action:"receive",
        receipt:{id:"r-2",valor:700,data:"2026-07-28"},
      }]},
    ),now);
    expect(excess).toMatchObject({ok:false});
    expect(excess.reason).toMatch(/excede o saldo/);
    const reversed=applyClientMeasurementCommand(received.data,command(
      CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_RECEIPTS_CHANGED,{changes:[{
        measurementId:"m-1",expectedVersion:2,action:"reverse_all",reason:"Duplicidade",
      }]},
    ),now);
    expect(reversed.data.medicoes[0]).toMatchObject({
      valorRecebido:0,recebido:false,version:3,
    });
    expect(reversed.data.medicoes[0].recebimentos[0]).toMatchObject({
      status:"estornado",motivoEstorno:"Duplicidade",
    });
  });

  it("fecha administração e cancela apenas uma medição sem recebimento",()=>{
    const initial={...base(),medicoes:[measurement({
      version:1,status:"emitida",valorMOFixo:800,valorAdminPct:0,recebimentos:[],
    })]};
    const closed=applyClientMeasurementCommand(initial,command(
      CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_ADMIN_CLOSED,{measurementId:"m-1",adminAmount:120},1,
    ),now);
    expect(closed.data.medicoes[0]).toMatchObject({
      valorAdminPct:120,valorPrevisto:920,version:2,
    });
    const cancelled=applyClientMeasurementCommand(closed.data,command(
      CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_CANCELLED,{measurementId:"m-1",reason:"Duplicidade"},2,
    ),now);
    expect(cancelled.data.medicoes[0]).toMatchObject({
      status:"cancelada",version:3,motivoCancelamento:"Duplicidade",
    });
  });

  it("recusa obra inexistente e recebimento ligado à conciliação",()=>{
    expect(applyClientMeasurementCommand(base(),{
      type:CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_SAVED,
      payload:{measurement:measurement()},expectedVersion:0,
    },now)).toMatchObject({ok:false,reason:expect.stringMatching(/Sessão/)});
    const missing=applyClientMeasurementCommand(base(),command(
      CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_SAVED,{measurement:measurement({obraId:"obra-x"})},0,
    ),now);
    expect(missing).toMatchObject({ok:false});
    expect(missing.reason).toMatch(/obra.*não existe/i);
    const linked={...base(),medicoes:[measurement({
      version:1,status:"emitida",valorRecebido:1000,recebido:true,
      recebimentos:[{id:"r-1",valor:1000,data:"2026-07-28",transacaoId:"tx-1"}],
    })]};
    const reversed=applyClientMeasurementCommand(linked,command(
      CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_RECEIPTS_CHANGED,{changes:[{
        measurementId:"m-1",expectedVersion:1,action:"reverse_all",reason:"Erro",
      }]},
    ),now);
    expect(reversed).toMatchObject({ok:false});
    expect(reversed.reason).toMatch(/Desfaça a conciliação/);
  });

  it("exige identificador único para cada recebimento",()=>{
    const initial={...base(),medicoes:[measurement({
      version:1,status:"emitida",recebimentos:[{id:"r-1",valor:100,data:"2026-07-20"}],
      valorRecebido:100,
    })]};
    const duplicated=applyClientMeasurementCommand(initial,command(
      CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_RECEIPTS_CHANGED,{changes:[{
        measurementId:"m-1",expectedVersion:1,action:"receive",
        receipt:{id:"r-1",valor:100,data:"2026-07-28"},
      }]},
    ),now);
    expect(duplicated).toMatchObject({ok:false});
    expect(duplicated.reason).toMatch(/já foi utilizado/);
  });

  it("fatura o incremento de uma medição técnica no servidor uma única vez",()=>{
    const initial={
      ...base(),
      obras:[{id:"obra-1",contractValue:100000}],
      medicoesObra:[{
        id:"mt-1",obraId:"obra-1",numero:1,data:"2026-07-28",
        status:"confirmada",avancoFisico:25,itens:[],
      }],
    };
    const billed=applyClientMeasurementCommand(initial,command(
      CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_BILLED,{
        id:"fat-1",medicaoTecnicaId:"mt-1",
        competencia:"2026-07",dataVencimento:"2026-08-05",
      },
    ),now);
    expect(billed.data.medicoes[0]).toMatchObject({
      id:"fat-1",medicaoTecnicaId:"mt-1",valorPrevisto:25000,
      status:"emitida",version:1,createdById:"u-1",
    });
    const duplicate=applyClientMeasurementCommand(billed.data,command(
      CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_BILLED,{
        id:"fat-2",medicaoTecnicaId:"mt-1",competencia:"2026-07",
      },
    ),now);
    expect(duplicate).toMatchObject({ok:false});
    expect(duplicate.reason).toMatch(/já possui faturamento/);
    expect(clientMeasurementCommandObraId(initial,command(
      CLIENT_MEASUREMENT_COMMAND.CLIENT_MEASUREMENT_BILLED,{medicaoTecnicaId:"mt-1"},
    ))).toBe("obra-1");
  });
});
