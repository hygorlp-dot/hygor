const SHA512=require("sha.js/sha512.js");
const {Buffer}=require("buffer");

// Algoritmo de proteção de planilhas do ExcelJS 4.4.0 (MIT), preservado
// byte a byte: senha UTF-16LE, salt e contador little-endian a cada rodada.
// A única chamada de Worksheet.protect usa SHA512; o salt continua vindo
// de um gerador criptográfico, nunca de Math.random ou de um valor fixo.
const Encryptor={
  hash(algorithm,...buffers){
    if(algorithm.toLowerCase()!=="sha512")throw new Error("Algoritmo de proteção de planilha inválido.");
    return Buffer.from(new SHA512().update(Buffer.concat(buffers)).digest());
  },
  convertPasswordToHash(password,algorithm,saltValue,spinCount){
    let key=this.hash(algorithm,Buffer.from(saltValue,"base64"),Buffer.from(password,"utf16le"));
    for(let index=0;index<spinCount;index++){
      const iterator=Buffer.alloc(4);
      iterator.writeUInt32LE(index,0);
      key=this.hash(algorithm,key,iterator);
    }
    return key.toString("base64");
  },
  randomBytes(size){
    return Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(size)));
  },
};
module.exports=Encryptor;
