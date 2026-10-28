import {describe,expect,it} from "vitest";
import {applyPatrimonyCommand,PATRIMONY_COMMAND} from "./commands.js";

const command=(type,payload,expectedVersion=0)=>({type,payload,expectedVersion,idempotencyKey:"asset-test-00000001",actorId:"admin",actorName:"Admin"});

describe("patrimônio corporativo",()=>{
  it("cadastra bem com NF-e e histórico sem obra obrigatória",()=>{
    const result=applyPatrimonyCommand({},command(PATRIMONY_COMMAND.ASSET_SAVED,{asset:{
      id:"a1",assetTag:"PAT-001",name:"Notebook Dell",category:"Informática",serialNumber:"SN123",
      acquisitionValue:5890,acquisitionDate:"2026-10-27",
      invoice:{number:"1234",series:"1",accessKey:"1".repeat(44),issueDate:"2026-10-27",supplierName:"Fornecedor",supplierDocument:"12345678000199",itemNumber:1,itemDescription:"Notebook",itemValue:5890,source:"xml"},
    }}),"2026-10-27T23:00:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.data.companyAssets[0]).toMatchObject({id:"a1",assetTag:"PAT-001",name:"Notebook Dell",version:1,active:true});
    expect(result.data.companyAssets[0].operationalHistory[0].type).toBe("ASSET_CREATED");
  });

  it("gera código patrimonial sequencial no servidor",()=>{
    const base={companyAssets:[{id:"old",assetTag:"PAT-000009",name:"Antigo",active:true,version:1}]};
    const first=applyPatrimonyCommand(base,command(PATRIMONY_COMMAND.ASSET_SAVED,{asset:{id:"a1",name:"Notebook"}}),"2026-10-27T23:00:00.000Z");
    expect(first.ok).toBe(true);
    expect(first.data.companyAssets.find(a=>a.id==="a1").assetTag).toBe("PAT-000010");
    const batch=applyPatrimonyCommand(first.data,command(PATRIMONY_COMMAND.ASSETS_IMPORTED,{assets:[
      {id:"a2",name:"Celular A"},{id:"a3",name:"Celular B"},
    ]}),"2026-10-27T23:01:00.000Z");
    expect(batch.ok).toBe(true);
    expect(batch.data.companyAssets.filter(a=>["a2","a3"].includes(a.id)).map(a=>a.assetTag)).toEqual(["PAT-000011","PAT-000012"]);
  });

  it("impede patrimônio, série e IMEI duplicados",()=>{
    const base={companyAssets:[{id:"a1",assetTag:"PAT-001",name:"Celular",serialNumber:"SN1",imei:"353101869075423/01",active:true,version:1}]};
    for(const asset of [
      {id:"a2",assetTag:"pat-001",name:"Outro"},
      {id:"a2",assetTag:"PAT-002",name:"Outro",serialNumber:"sn1"},
      {id:"a2",assetTag:"PAT-003",name:"Outro",imei:"35310186907542301"},
    ]){
      expect(applyPatrimonyCommand(base,command(PATRIMONY_COMMAND.ASSET_SAVED,{asset}),"2026-10-27T23:00:00.000Z").ok).toBe(false);
    }
  });

  it("não reutiliza código, série ou IMEI de bem já baixado",()=>{
    const base={companyAssets:[{id:"a1",assetTag:"PAT-001",name:"Celular antigo",serialNumber:"SN1",imei:"35310186907542301",active:false,status:"baixado",version:2}]};
    const result=applyPatrimonyCommand(base,command(PATRIMONY_COMMAND.ASSET_SAVED,{asset:{id:"a2",assetTag:"PAT-001",name:"Celular novo"}}),"2026-10-27T23:00:00.000Z");
    expect(result.ok).toBe(false);
  });

  it("importa lote da NF atomicamente: todos entram ou nenhum entra",()=>{
    const invoice={number:"10",accessKey:"2".repeat(44),issueDate:"2026-10-27",supplierName:"Fornecedor",itemNumber:1,itemDescription:"Notebook",itemValue:3000,source:"xml"};
    const assets=[
      {id:"a1",assetTag:"PAT-001",name:"Notebook 1",serialNumber:"SN-A",invoice:{...invoice,unitIndex:1}},
      {id:"a2",assetTag:"PAT-002",name:"Notebook 2",serialNumber:"SN-B",invoice:{...invoice,unitIndex:2}},
    ];
    const ok=applyPatrimonyCommand({},command(PATRIMONY_COMMAND.ASSETS_IMPORTED,{assets,invoiceAccessKey:invoice.accessKey}),"2026-10-27T23:00:00.000Z");
    expect(ok.ok).toBe(true);
    expect(ok.data.companyAssets.map(a=>a.id)).toEqual(["a1","a2"]);

    const invalid=[
      {id:"b1",assetTag:"PAT-010",name:"Celular 1",imei:"111",invoice:{...invoice,itemNumber:2,unitIndex:1}},
      {id:"b2",assetTag:"PAT-011",name:"Celular 2",imei:"111",invoice:{...invoice,itemNumber:2,unitIndex:2}},
    ];
    const failed=applyPatrimonyCommand({},command(PATRIMONY_COMMAND.ASSETS_IMPORTED,{assets:invalid,invoiceAccessKey:invoice.accessKey}),"2026-10-27T23:00:00.000Z");
    expect(failed.ok).toBe(false);
    expect(failed.reason).toMatch(/Item 2/);
    expect(failed.data).toBeUndefined();
  });

  it("movimenta custodiante/local sem transformar o bem em patrimônio da obra",()=>{
    const base={companyAssets:[{id:"a1",assetTag:"PAT-001",name:"Furadeira",status:"ativo",active:true,version:1,operationalHistory:[]}]};
    const result=applyPatrimonyCommand(base,{...command(PATRIMONY_COMMAND.ASSET_MOVED,{assetId:"a1",location:{type:"obra",label:"H2 04",referenceId:"h204"},custodian:{type:"employee",id:"e1",name:"João"},reason:"Uso temporário"}),expectedVersion:1},"2026-10-27T23:05:00.000Z");
    expect(result.ok).toBe(true);
    expect(result.data.companyAssets[0]).toMatchObject({status:"em_uso",location:{type:"obra",label:"H2 04",referenceId:"h204"}});
    expect(result.data.companyAssets[0].operationalHistory.at(-1).type).toBe("ASSET_MOVED");
  });

  it("impede alteração silenciosa de status/localização pelo cadastro",()=>{
    const base={companyAssets:[{id:"a1",assetTag:"PAT-001",name:"Notebook",status:"ativo",active:true,version:1,location:{type:"empresa",label:"Sede",referenceId:""},custodian:{type:"",id:"",name:""},invoice:{},operationalHistory:[]}]};
    const directStatus=applyPatrimonyCommand(base,{...command(PATRIMONY_COMMAND.ASSET_SAVED,{asset:{...base.companyAssets[0],status:"baixado"}}),expectedVersion:1});
    expect(directStatus.ok).toBe(false);
    expect(directStatus.reason).toMatch(/situação/i);
    const directMove=applyPatrimonyCommand(base,{...command(PATRIMONY_COMMAND.ASSET_SAVED,{asset:{...base.companyAssets[0],location:{type:"obra",label:"H2 04",referenceId:"h204"}}}),expectedVersion:1});
    expect(directMove.ok).toBe(false);
    expect(directMove.reason).toMatch(/movimente/i);
  });

  it("voltar para sede/almoxarifado tira o bem de em uso",()=>{
    const base={companyAssets:[{id:"a1",name:"Furadeira",status:"em_uso",active:true,version:2,location:{type:"obra",label:"H2 04"},custodian:{type:"external",id:"",name:"João"},operationalHistory:[]}]};
    const result=applyPatrimonyCommand(base,{...command(PATRIMONY_COMMAND.ASSET_MOVED,{assetId:"a1",location:{type:"almoxarifado",label:"Almoxarifado central"},custodian:{type:"",id:"",name:""},reason:"Retorno da obra"}),expectedVersion:2});
    expect(result.ok).toBe(true);
    expect(result.data.companyAssets[0]).toMatchObject({status:"ativo",location:{type:"almoxarifado",label:"Almoxarifado central"}});
  });

  it("bem baixado não pode ser reativado silenciosamente",()=>{
    const base={companyAssets:[{id:"a1",name:"Notebook antigo",status:"baixado",active:false,version:3,operationalHistory:[]}]};
    const result=applyPatrimonyCommand(base,{...command(PATRIMONY_COMMAND.ASSET_STATUS_CHANGED,{assetId:"a1",status:"ativo",reason:"voltar"}),expectedVersion:3});
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/não pode ser reativado/i);
  });

  it("baixa exige motivo e mantém registro",()=>{
    const base={companyAssets:[{id:"a1",name:"Notebook",status:"ativo",active:true,version:1,operationalHistory:[]}]};
    expect(applyPatrimonyCommand(base,{...command(PATRIMONY_COMMAND.ASSET_STATUS_CHANGED,{assetId:"a1",status:"baixado",reason:""}),expectedVersion:1}).ok).toBe(false);
    const ok=applyPatrimonyCommand(base,{...command(PATRIMONY_COMMAND.ASSET_STATUS_CHANGED,{assetId:"a1",status:"baixado",reason:"Venda autorizada"}),expectedVersion:1});
    expect(ok.data.companyAssets[0]).toMatchObject({status:"baixado",active:false});
  });
});
