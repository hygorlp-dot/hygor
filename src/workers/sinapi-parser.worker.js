// O arquivo oficial SINAPI é grande demais para ser materializado pelo ExcelJS.
// Este worker lê somente as abas necessárias diretamente da estrutura XML do XLSX.
import { readSelectedXlsxSheets } from "../lib/xlsx-selective-reader";

const lixo = new Set(["", "0", "0.0", "-", "CÓDIGO REPETIDO", "CODIGO REPETIDO"]);
const semAcento = value => String(value || "").toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const cabecalho = value => semAcento(value).toUpperCase().replace(/\s+/g, " ").trim();
const ehLixo = value => lixo.has(String(value ?? "").trim().toUpperCase());

const numeroBR = value => {
  if (typeof value === "number") return value;
  const texto = String(value ?? "").trim();
  if (!texto) return 0;
  const limpo = texto.replace(/[^\d,.-]/g, "");
  const virgula = limpo.lastIndexOf(",");
  const ponto = limpo.lastIndexOf(".");
  const normalizado = virgula >= 0 && ponto >= 0
    ? (virgula > ponto ? limpo.replace(/\./g, "").replace(",", ".") : limpo.replace(/,/g, ""))
    : (virgula >= 0 ? limpo.replace(/\./g, "").replace(",", ".") : limpo);
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
};

const linhasDaAba = sheet => sheet?.__rows || [];
const encodeCell = ({ r, c }) => {
  let column = "";
  for (let value = c + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    column = String.fromCharCode(((value - 1) % 26) + 65) + column;
  }
  return `${column}${r + 1}`;
};

const extrairSinapiOficial = (workbook, uf, informar) => {
  const nomeAba = alvo => workbook.SheetNames.find(nome => semAcento(nome).replace(/\s/g, "") === alvo.toLowerCase());

  const lerComposicoes = (alvo, campoPreco) => {
    const nome = nomeAba(alvo);
    if (!nome) return { itens:[], dataBase:"" };
    const sheet = workbook.Sheets[nome];
    const rows = linhasDaAba(sheet);
    const headerRow = rows.findIndex(row => {
      const texto = row.map(value => String(value || "").toUpperCase().replace(/\s+/g, " ")).join(" | ");
      return /C[ÓO]DIGO/.test(texto) && /DESCRI/.test(texto) && /UNIDADE/.test(texto);
    });
    if (headerRow < 0) return { itens:[], dataBase:"" };
    let ufColumn = -1;
    for (let r = headerRow - 1; r >= 0 && ufColumn < 0; r--) {
      ufColumn = (rows[r] || []).findIndex(value => String(value || "").trim().toUpperCase() === uf);
    }
    if (ufColumn < 0) return { itens:[], dataBase:"" };
    const header = (rows[headerRow] || []).map(cabecalho);
    const codigoColumn = header.findIndex(value => value.includes("CODIGO"));
    const descricaoColumn = header.findIndex(value => value.includes("DESCRI"));
    const unidadeColumn = header.findIndex(value => value.includes("UNIDADE"));
    if ([codigoColumn, descricaoColumn, unidadeColumn].some(index => index < 0)) return { itens:[], dataBase:"" };
    const itens = [];
    for (let r = headerRow + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      let codigo = String(row[codigoColumn] ?? "").trim().replace(/\.0$/, "");
      if (ehLixo(codigo)) {
        const cell = sheet[encodeCell({ r, c:codigoColumn })];
        const match = String(cell?.f || "").match(/MATCH\s*\(\s*(\d+)/i);
        if (match) codigo = match[1];
      }
      const descricao = String(row[descricaoColumn] ?? "").trim();
      const preco = numeroBR(row[ufColumn]);
      if (ehLixo(codigo) || ehLixo(descricao) || preco <= 0) continue;
      itens.push({ fonte:"SINAPI", codigo, descricao,
        unidade:String(row[unidadeColumn] ?? "UN").trim() || "UN",
        precoDes:campoPreco === "precoDes" ? preco : 0,
        precoNao:campoPreco === "precoNao" ? preco : 0 });
    }
    let dataBase = "";
    rows.slice(0, headerRow).flat().some(value => {
      const match = String(value || "").trim().match(/^(0[1-9]|1[0-2])\/(\d{4})$/);
      if (!match) return false;
      dataBase = `${match[2]}-${match[1]}`;
      return true;
    });
    return { itens, dataBase };
  };

  const lerInsumos = (alvo, campoPreco) => {
    const nome = nomeAba(alvo);
    if (!nome) return [];
    const rows = linhasDaAba(workbook.Sheets[nome]);
    const headerRow = rows.findIndex(row => {
      const texto = row.map(cabecalho).join(" | ");
      return texto.includes("CODIGO DO INSUMO") && texto.includes("DESCRICAO DO INSUMO");
    });
    if (headerRow < 0) return [];
    let ufColumn = -1;
    for (let r = headerRow - 1; r >= 0 && ufColumn < 0; r--) {
      ufColumn = (rows[r] || []).findIndex(value => String(value || "").trim().toUpperCase() === uf);
    }
    if (ufColumn < 0) return [];
    const header = (rows[headerRow] || []).map(cabecalho);
    const classColumn = header.findIndex(value => value.includes("CLASSIFIC"));
    const codeColumn = header.findIndex(value => value.includes("CODIGO") && value.includes("INSUMO"));
    const descColumn = header.findIndex(value => value.includes("DESCRICAO") && value.includes("INSUMO"));
    const unitColumn = header.findIndex(value => value.includes("UNIDADE"));
    if ([codeColumn, descColumn, unitColumn].some(index => index < 0)) return [];
    return rows.slice(headerRow + 1).map(row => ({
      fonte:"SINAPI", codigo:String(row[codeColumn] ?? "").trim().replace(/\.0$/, ""),
      descricao:String(row[descColumn] ?? "").trim(), unidade:String(row[unitColumn] ?? "UN").trim() || "UN",
      classificacao:classColumn >= 0 ? String(row[classColumn] ?? "").trim() : "",
      precoDes:campoPreco === "precoDes" ? numeroBR(row[ufColumn]) : 0,
      precoNao:campoPreco === "precoNao" ? numeroBR(row[ufColumn]) : 0,
    })).filter(item => !ehLixo(item.codigo) && !ehLixo(item.descricao) && (item.precoDes > 0 || item.precoNao > 0));
  };

  const lerAnalitico = () => {
    const nome = workbook.SheetNames.find(sheet => cabecalho(sheet).replace(/\s/g, "").includes("ANALIT"));
    if (!nome) return [];
    const rows = linhasDaAba(workbook.Sheets[nome]);
    const headerRow = rows.findIndex(row => {
      const texto = row.map(cabecalho).join(" | ");
      return texto.includes("CODIGO") && texto.includes("COMPOSICAO") && texto.includes("TIPO") && texto.includes("COEFICIENTE");
    });
    if (headerRow < 0) return [];
    const header = (rows[headerRow] || []).map(cabecalho);
    const compositionColumn = header.findIndex(value => value.includes("CODIGO") && value.includes("COMPOSICAO"));
    const typeColumn = header.findIndex(value => value.includes("TIPO") && value.includes("ITEM"));
    const itemColumn = header.findIndex(value => value.includes("CODIGO") && (value.includes("ITEM") || value.includes("INSUMO")));
    const descColumn = header.findIndex(value => value.includes("DESCRICAO") && (value.includes("ITEM") || value.includes("INSUMO")));
    const unitColumn = header.findIndex(value => value.includes("UNIDADE") && (value.includes("ITEM") || value.includes("INSUMO")));
    const coefficientColumn = header.findIndex(value => value.includes("COEFICIENTE"));
    const situationColumn = header.findIndex(value => value.includes("SITUAC"));
    const descFinal = descColumn >= 0 ? descColumn : header.findIndex(value => value.includes("DESCRICAO"));
    const unitFinal = unitColumn >= 0 ? unitColumn : header.findIndex(value => value.includes("UNIDADE"));
    if ([compositionColumn, typeColumn, itemColumn, descFinal, unitFinal, coefficientColumn].some(index => index < 0)) return [];
    return rows.slice(headerRow + 1).map(row => ({
      compositionCode:String(row[compositionColumn] ?? "").trim().replace(/\.0$/, ""),
      itemType:cabecalho(row[typeColumn]) === "COMPOSICAO" ? "COMPOSICAO" : "INSUMO",
      itemCode:String(row[itemColumn] ?? "").trim().replace(/\.0$/, ""),
      descricao:String(row[descFinal] ?? "").trim(), unidade:String(row[unitFinal] ?? "UN").trim() || "UN",
      coeficiente:numeroBR(row[coefficientColumn]), situacao:situationColumn >= 0 ? String(row[situationColumn] ?? "").trim() : "",
    })).filter(item => item.compositionCode && item.itemCode && item.descricao && item.coeficiente > 0);
  };

  informar("Lendo composições CSD e CCD em segundo plano...");
  const nao = lerComposicoes("CSD", "precoNao");
  const des = lerComposicoes("CCD", "precoDes");
  const composicoes = new Map();
  [...nao.itens, ...des.itens].forEach(item => {
    const atual = composicoes.get(item.codigo) || { ...item, precoDes:0, precoNao:0 };
    composicoes.set(item.codigo, { ...atual, descricao:item.descricao || atual.descricao,
      unidade:item.unidade || atual.unidade, precoDes:item.precoDes || atual.precoDes,
      precoNao:item.precoNao || atual.precoNao });
  });
  informar("Lendo insumos ICD e ISD em segundo plano...");
  const insumos = new Map();
  [...lerInsumos("ISD", "precoNao"), ...lerInsumos("ICD", "precoDes")].forEach(item => {
    const atual = insumos.get(item.codigo) || { ...item, precoDes:0, precoNao:0 };
    insumos.set(item.codigo, { ...atual, descricao:item.descricao || atual.descricao,
      unidade:item.unidade || atual.unidade, classificacao:item.classificacao || atual.classificacao,
      precoDes:item.precoDes || atual.precoDes, precoNao:item.precoNao || atual.precoNao });
  });
  informar("Lendo relações analíticas em segundo plano...");
  return { itens:[...composicoes.values()], insumos:[...insumos.values()], componentes:lerAnalitico(),
    dataBase:des.dataBase || nao.dataBase,
    abas:[nao.itens.length ? "CSD" : "", des.itens.length ? "CCD" : ""].filter(Boolean) };
};

self.onmessage = async ({ data }) => {
  try {
    self.postMessage({ tipo:"etapa", mensagem:"Abrindo o XLSX em segundo plano..." });
    const workbook = await readSelectedXlsxSheets(data.bytes, {
      sheets:["CSD","CCD","ISD","ICD","ANALIT"],
      onProgress:progresso => self.postMessage({
        tipo:"etapa",
        mensagem:progresso.message,
        progresso,
      }),
    });
    const extraida = extrairSinapiOficial(workbook, data.uf, mensagem => self.postMessage({ tipo:"etapa", mensagem }));
    self.postMessage({ tipo:"concluido", extraida });
  } catch (error) {
    self.postMessage({ tipo:"erro", mensagem:error?.message || "Não foi possível ler o XLSX oficial." });
  }
};
