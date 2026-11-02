import {createHash,randomBytes} from "node:crypto";
import {describe,it,expect} from "vitest";
import Encryptor from "./exceljs-encryptor.cjs";

const referenceHash=(password,salt,spins)=>{
  const hash=(...values)=>createHash("sha512").update(Buffer.concat(values)).digest();
  let key=hash(Buffer.from(salt,"base64"),Buffer.from(password,"utf16le"));
  for(let index=0;index<spins;index++){
    const counter=Buffer.alloc(4);counter.writeUInt32LE(index,0);key=hash(key,counter);
  }
  return key.toString("base64");
};

describe("proteção ExcelJS no navegador",()=>{
  for(const password of ["", "Compras-2026", "Cotação çã 日本語 🔒"]){
    for(const spins of [0,1,500])it(`preserva SHA-512 para ${JSON.stringify(password)} / ${spins} rodadas`,()=>{
      const salt=randomBytes(16).toString("base64");
      expect(Encryptor.convertPasswordToHash(password,"SHA512",salt,spins)).toBe(referenceHash(password,salt,spins));
    });
  }
  it("gera salts criptográficos distintos",()=>{
    const first=Encryptor.randomBytes(16),second=Encryptor.randomBytes(16);
    expect(first.length).toBe(16);expect(second.length).toBe(16);expect(first.equals(second)).toBe(false);
  });
  it("rejeita algoritmos inesperados em vez de produzir hash incorreto",()=>{
    expect(()=>Encryptor.hash("SHA256",Buffer.from("senha"))).toThrow(/Algoritmo/);
  });
});
