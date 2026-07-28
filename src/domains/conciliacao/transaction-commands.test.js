import { describe, expect, it } from "vitest";
import {
  applyBankTransactionCommand,
  BANK_TRANSACTION_COMMAND,
} from "./transaction-commands.js";

const actor={actorId:"fin-1",actorName:"Financeiro"};
const command=(type,payload,key="bank-transaction-command-0001")=>({
  type,payload,idempotencyKey:key,...actor,
});
const transaction=(overrides={})=>({
  id:"tx-1",extratoId:"ext-1",data:"2026-07-20",
  descricao:"Pix enviado",valor:-100,chave:"2026-07-20|-100|pix",
  status:"pendente",version:0,...overrides,
});

describe("comandos de transações bancárias",()=>{
  it("importa extrato e fatos pendentes com autoria e histórico",()=>{
    const result=applyBankTransactionCommand(
      {transacoes:[],extratos:[],historicoConc:[]},
      command(BANK_TRANSACTION_COMMAND.BANK_TRANSACTIONS_IMPORTED,{
        statement:{id:"ext-1",arquivo:"extrato.ofx",banco:"Banco",hashArquivo:"hash"},
        transactions:[transaction()],
      }),
      "2026-07-28T12:00:00.000Z",
    );
    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({imported:1,duplicates:0});
    expect(result.data.extratos[0]).toMatchObject({
      id:"ext-1",qtd:1,qtdDuplicadas:0,status:"ativo",
      importadoPorId:"fin-1",version:1,
    });
    expect(result.data.transacoes[0]).toMatchObject({
      id:"tx-1",extratoId:"ext-1",status:"pendente",version:1,
      createdById:"fin-1",
    });
    expect(result.data.historicoConc[0]).toMatchObject({
      acao:"extrato_importado",extratoId:"ext-1",valor:100,
    });
  });

  it("deduplica novamente no servidor sem criar extrato vazio",()=>{
    const data={
      transacoes:[transaction()],extratos:[],historicoConc:[],
    };
    const result=applyBankTransactionCommand(data,command(
      BANK_TRANSACTION_COMMAND.BANK_TRANSACTIONS_IMPORTED,{
        statement:{id:"ext-2",arquivo:"repetido.ofx",hashArquivo:"hash-2"},
        transactions:[transaction({id:"tx-2",extratoId:"ext-2"})],
      },
    ));
    expect(result.ok).toBe(true);
    expect(result.summary).toEqual({imported:0,duplicates:1});
    expect(result.data.extratos).toHaveLength(0);
    expect(result.data.transacoes).toHaveLength(1);
  });

  it("rejeita o arquivo inteiro quando uma transação é inválida",()=>{
    const result=applyBankTransactionCommand(
      {transacoes:[],extratos:[],historicoConc:[]},
      command(BANK_TRANSACTION_COMMAND.BANK_TRANSACTIONS_IMPORTED,{
        statement:{id:"ext-1",arquivo:"extrato.ofx"},
        transactions:[transaction({data:"20/07/2026"})],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/inválido/i);
  });

  it("ignora e reabre o lote preservando versão e motivo anterior",()=>{
    const data={
      transacoes:[transaction(),transaction({
        id:"tx-2",chave:"2026-07-20|-200|pix",valor:-200,
      })],
      historicoConc:[],
    };
    const ignored=applyBankTransactionCommand(data,command(
      BANK_TRANSACTION_COMMAND.BANK_TRANSACTIONS_IGNORED,{
        targets:[
          {id:"tx-1",expectedVersion:0},
          {id:"tx-2",expectedVersion:0},
        ],
        reason:"Movimentos pessoais",
      },
    ),"2026-07-28T12:00:00.000Z");
    expect(ignored.ok).toBe(true);
    expect(ignored.data.transacoes.every(item=>item.status==="ignorado")).toBe(true);
    expect(ignored.data.transacoes.every(item=>item.version===1)).toBe(true);
    expect(ignored.data.historicoConc).toHaveLength(2);

    const reopened=applyBankTransactionCommand(ignored.data,command(
      BANK_TRANSACTION_COMMAND.BANK_TRANSACTIONS_REOPENED,{
        targets:[
          {id:"tx-1",expectedVersion:1},
          {id:"tx-2",expectedVersion:1},
        ],
      },"bank-transaction-command-0002",
    ),"2026-07-28T13:00:00.000Z");
    expect(reopened.ok).toBe(true);
    expect(reopened.data.transacoes.every(item=>item.status==="pendente")).toBe(true);
    expect(reopened.data.historicoConc.at(-1).detalhes)
      .toContain("Movimentos pessoais");
  });

  it("não aplica parcialmente quando status ou versão divergem",()=>{
    const data={
      transacoes:[
        transaction(),
        transaction({id:"tx-2",chave:"outra",status:"conciliado"}),
      ],
      historicoConc:[],
    };
    const wrongStatus=applyBankTransactionCommand(data,command(
      BANK_TRANSACTION_COMMAND.BANK_TRANSACTIONS_IGNORED,{
        targets:[
          {id:"tx-1",expectedVersion:0},
          {id:"tx-2",expectedVersion:0},
        ],
        reason:"Duplicidade bancária",
      },
    ));
    expect(wrongStatus.ok).toBe(false);
    expect(wrongStatus.data).toBeUndefined();
    expect(data.transacoes[0].status).toBe("pendente");

    const wrongVersion=applyBankTransactionCommand(data,command(
      BANK_TRANSACTION_COMMAND.BANK_TRANSACTIONS_IGNORED,{
        targets:[{id:"tx-1",expectedVersion:9}],
        reason:"Duplicidade bancária",
      },
    ));
    expect(wrongVersion.ok).toBe(false);
    expect(wrongVersion.reason).toMatch(/alterada por outra pessoa/i);
  });

  it("exige usuário e motivo auditável",()=>{
    expect(applyBankTransactionCommand({},{
      type:BANK_TRANSACTION_COMMAND.BANK_TRANSACTIONS_REOPENED,
      payload:{targets:[{id:"tx-1",expectedVersion:0}]},
    }).reason).toMatch(/sessão/i);
    expect(applyBankTransactionCommand({
      transacoes:[transaction()],
    },command(BANK_TRANSACTION_COMMAND.BANK_TRANSACTIONS_IGNORED,{
      targets:[{id:"tx-1",expectedVersion:0}],reason:"",
    })).reason).toMatch(/motivo/i);
  });
});
