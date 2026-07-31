import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EQUIPMENT_IMAGE_OPTIONS,
  equipmentImageFor,
  inferEquipmentImageType,
} from "./images";

describe("imagens da frota",()=>{
  it("reconhece automaticamente os equipamentos mais comuns",()=>{
    expect(inferEquipmentImageType({nome:"BETONEIRA 400 L"})).toBe("betoneira");
    expect(inferEquipmentImageType({nome:"Placa vibratória reversível"})).toBe("compactador");
    expect(inferEquipmentImageType({sinapiDescricao:"MINI ESCAVADEIRA SOBRE ESTEIRAS"})).toBe("escavadeira");
  });

  it("prioriza a foto original e respeita a seleção manual",()=>{
    expect(equipmentImageFor({nome:"Gerador",imagemUrl:"https://cdn.example.com/eq.webp"}))
      .toMatchObject({src:"https://cdn.example.com/eq.webp",source:"original"});
    expect(equipmentImageFor({nome:"Item genérico",imagemTipo:"andaime"}))
      .toMatchObject({src:"/assets/equipment/andaime.webp",source:"ai",type:"andaime"});
    expect(equipmentImageFor({nome:"Gerador",imagemUrl:"javascript:alert(1)"}))
      .toMatchObject({src:"/assets/equipment/gerador.webp",source:"ai"});
  });

  it("não inventa uma categoria visual quando não reconhece o nome",()=>{
    expect(equipmentImageFor({nome:"Equipamento especial"}))
      .toMatchObject({src:"",source:"missing"});
  });

  it("mantém todos os arquivos da biblioteca disponíveis no build",()=>{
    const options=EQUIPMENT_IMAGE_OPTIONS.filter(option=>option.v!=="auto");
    expect(options).toHaveLength(8);
    options.forEach(option=>{
      expect(existsSync(resolve(process.cwd(),`public/assets/equipment/${option.v}.webp`))).toBe(true);
    });
  });
});
