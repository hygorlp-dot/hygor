import {calculateBudget} from './calculations.js';

// Extraído de OrcamentoView.jsx (26/08/2026): a etapa de importar um
// orçamento externo (planilha código+quantidade cruzada com a base
// SINAPI/ORSE carregada) tinha detecção de coluna por nome de cabeçalho e
// nunca pedia confirmação humana. Uma planilha real com "Nome" em vez de
// "Descrição" perdeu, em silêncio, o nome de toda etapa (Nível/Subnível) e
// de todo item sem código (Produto/Serviço) - a tela agora sempre confirma
// com o usuário onde está cada coluna antes de montar qualquer linha; esta
// detecção automática vira só o palpite inicial pré-preenchido no modal.
export const normalizarCabecalho = valor =>
  String(valor ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

// Varre as primeiras `limite` linhas em busca de uma que pareça cabeçalho
// (tem Código E alguma coluna de Quantidade). Retorna o palpite inicial das
// demais colunas - nunca a fonte da verdade, sempre revisável pelo usuário.
export function detectarColunasImportacao(rows, limite = 30) {
  for (let i = 0; i < Math.min(rows.length, limite); i++) {
    const col = {};
    (rows[i] || []).forEach((cel, j) => {
      const h = normalizarCabecalho(cel);
      if (!h) return;
      if (col.codigo === undefined && (h === "codigo" || h.startsWith("cod"))) col.codigo = j;
      if (col.tipo === undefined && (h === "tipo"||h==='nivel corrigido')) col.tipo = j;
      if ((col.descricao === undefined && h === "item") || h === "nome" || h.startsWith("descri")) col.descricao = j;
      if(col.ordem===undefined&&['ordem','item','numeracao','numero do item'].includes(h))col.ordem=j;
      if(col.nivel===undefined&&['nivel','profundidade'].includes(h))col.nivel=j;
      if (col.unidade === undefined && (h === "un." || h === "un" || h.startsWith("unid"))) col.unidade = j;
      if (col.qtd === undefined && (h.startsWith("qtd") || h.startsWith("quant"))) col.qtd = j;
      const unitario=h.includes('preco unit')||h.includes('p. unit')||h.includes('custo unit')||h==='preco'||h==='valor unitario';
      if(unitario&&h.includes('com bdi')&&col.precoComBdi===undefined)col.precoComBdi=j;
      if(unitario&&!h.includes('com bdi')&&col.preco===undefined)col.preco=j;
      if(col.bdi===undefined&&/^bdi\b/.test(h))col.bdi=j;
      if (col.total === undefined && (h.includes("custo total") || h.includes("valor total") || h.includes("preco total") || h === "total")) col.total = j;
      if (col.composicao === undefined && (h.startsWith("compos") || h.includes("memoria de preco"))) col.composicao = j;
      if (col.fonte === undefined && h === "fonte") col.fonte = j;
    });
    if (col.codigo !== undefined && col.qtd !== undefined) return { hIdx: i, col };
  }
  return { hIdx: -1, col: {} };
}

const vazio=value=>value==null||String(value).trim()==='';
const texto=value=>String(value??'').trim();
const chaveFonte=value=>normalizarCabecalho(value).toUpperCase();
export const referenceFonteOficial=value=>/^(SINAPI(?:-I)?|ORSE)$/.test(chaveFonte(value));
export const codigoReferenciaImportacao=value=>texto(value).toUpperCase()
  .replace(/\s*\/\s*(ORSE|SINAPI(?:-I)?)\s*$/i,'').replace(/\.0$/,'').replace(/^0+(?=\d)/,'');
const unidade=value=>normalizarCabecalho(value).replace(/[²³]/g,c=>c==='²'?'2':'3').replace(/\.$/,'');
const cents=value=>Math.round(value*100);

export function indexarReferenciasImportacao(items){
  const index=new Map();
  for(const entry of items){
    const code=codigoReferenciaImportacao(entry.codigo);
    if(!code)continue;
    if(!index.has(code))index.set(code,[]);
    index.get(code).push(entry);
  }
  return index;
}

function numeroOriginal(raw,parseNumero,{percentual=false,currency=false}={}){
  if(vazio(raw))return null;
  const value=texto(raw).replace(currency?/^R\$\s*/i:/$^/,'').replace(percentual?/%$/:/$^/,'').trim();
  if(typeof raw!=='number'&&!/^[+-]?(?:\d+(?:[.,]\d+)?|\d{1,3}(?:\.\d{3})+,\d+|\d{1,3}(?:,\d{3})+\.\d+)$/.test(value))return null;
  const parsed=typeof raw==='number'?raw:parseNumero(value);
  return Number.isFinite(parsed)&&parsed>=0?parsed:null;
}

export function detectarFormatoBdi(rows,hIdx,col,parseNumero){
  let decimal=0,pontos=0;
  for(const row of rows.slice(hIdx+1)){
    const bdi=row[col.bdi],cost=numeroOriginal(row[col.preco],parseNumero,{currency:true});
    const gross=numeroOriginal(row[col.precoComBdi],parseNumero,{currency:true});
    if(typeof bdi!=='number'||!(bdi>0)||!(cost>0)||!(gross>0))continue;
    const rate=gross/cost-1;
    if(Math.abs(rate-bdi)<0.0001)decimal++;
    if(Math.abs(rate-bdi/100)<0.0001)pontos++;
  }
  return decimal>pontos?'decimal':'pontos';
}

function compararOriginal(r,col,i,parseNumero,percentCells,totalKind,bdiFormat){
  const fields={qtd:'Quantidade',preco:'Custo unitário sem BDI',bdi:'BDI',precoComBdi:'Preço unitário com BDI',total:'Total informado'};
  const valores={},raw={},missing=[];
  for(const [key,label] of Object.entries(fields)){
    const value=r[col[key]];
    raw[key]=value??null;
    const parsed=numeroOriginal(value,parseNumero,{percentual:key==='bdi',currency:['preco','precoComBdi','total'].includes(key)});
    valores[key]=key==='bdi'&&parsed!=null&&typeof value==='number'&&(bdiFormat==='decimal'||percentCells.has(`${i}:${col.bdi}`))?parsed*100:parsed;
    if(valores[key]==null)missing.push(col[key]===undefined?`${label} sem coluna mapeada.`:vazio(value)?`${label} ausente no Excel.`:`${label} inválido no Excel.`);
  }
  const {qtd,preco,bdi,total,precoComBdi}=valores;
  const calculado=qtd!=null&&preco!=null?calculateBudget({bdi:bdi??0,itens:[{quantidade:qtd,precoUnit:preco}]}):null;
  const gross=bdi!=null||totalKind==='gross';
  const comparavel=totalKind==='net'||(gross&&bdi!=null) ? (totalKind==='net'?calculado?.custoDireto:calculado?.total) : null;
  const divergences=[];
  if(total!=null&&comparavel!=null&&cents(total)!==cents(comparavel)){
    const alternate=qtd*preco*(totalKind==='net'?1:1+bdi/100);
    const rounding=cents(total)===cents(alternate)||(gross&&precoComBdi!=null&&cents(total)===cents(qtd*precoComBdi));
    divergences.push(rounding?'Total difere pelo critério de arredondamento.':'Total do Excel difere do recálculo dos dados originais.');
  }
  if(precoComBdi!=null&&preco!=null&&bdi!=null&&cents(precoComBdi)!==cents(preco*(1+bdi/100)))
    divergences.push('Preço unitário com BDI diverge do custo e BDI do Excel.');
  if(total!=null&&comparavel==null)missing.push('Total sem dados suficientes para comparação.');
  if(qtd===0)missing.push('Quantidade zero no Excel.');
  if(preco===0)missing.push('Custo unitário zero no Excel.');
  return {raw,valores,missing,divergences,calculado:calculado?{direto:calculado.custoDireto,total:bdi==null?null:calculado.total}:null};
}

// Monta as linhas (etapa/titulo/item) a partir de um mapeamento de colunas
// JÁ CONFIRMADO pelo usuário - col.{codigo,descricao,qtd,preco} devem estar
// definidos (índices de coluna); tipo/unidade/fonte/composicao são opcionais.
// `basePorCodigo` é um Map código(maiúsculo) -> item da base de referência;
// `precoDoItem(item, orc)` resolve o preço desonerado/não desonerado.
export function montarLinhasImportacao({ rows, hIdx, col, basePorCodigo, precoDoItem, orc, parseNumero, percentCells=new Set(), bdiFormat=detectarFormatoBdi(rows,hIdx,col,parseNumero), precoFoiSubstituido=()=>false }) {
  const linhas = [];
  const totalHeader=normalizarCabecalho(rows[hIdx]?.[col.total]);
  const totalKind=totalHeader.includes('sem bdi')||totalHeader.startsWith('custo total')?'net':totalHeader.includes('com bdi')?'gross':null;
  for (let i = hIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const cod = String(r[col.codigo] ?? "").trim().toUpperCase();
    const tipo = normalizarCabecalho(col.tipo !== undefined ? r[col.tipo] : "");
    const desc = String(col.descricao !== undefined ? r[col.descricao] : "").trim();
    const qtd = numeroOriginal(r[col.qtd],parseNumero)??0;
    const sourceOrder=String(col.ordem!==undefined?r[col.ordem]??'':'').trim().replace(/\.$/,'');
    if (!cod && !desc && !sourceOrder && !['servico','produto','composicao','item'].includes(tipo)) continue;
    if (!cod&&!tipo&&!sourceOrder&&/^(?:total\b|custo direto\b|bdi\s*\(|custo por\b)/.test(normalizarCabecalho(desc))) continue;

    const explicit=tipo.match(/^(?:nivel|subnivel)\s*(\d+)$/);
    const ehNivel = tipo === "nivel" || tipo==='lote'||!!explicit||(!tipo && !cod && qtd <= 0 && !!desc);
    const ehSub = tipo === "subnivel";
    if (ehNivel || ehSub) {
      const ordem=sourceOrder;
      const rawLevel=col.nivel!==undefined?String(r[col.nivel]??'').trim():'';
      const declared=rawLevel?Number(rawLevel):explicit?Number(explicit[1]):null;
      const depth=ordem?ordem.split('.').length:null;
      const nivel=declared??depth??(ehSub?2:1);
      const hierarchyError=ordem&&!/^\d+(?:\.\d+)*$/.test(ordem)?'Numeração de etapa inválida.':
       declared!==null&&depth!==null&&declared!==depth?'Nível e numeração divergentes.':
       ehSub&&nivel<2||tipo==='lote'&&nivel!==1||explicit&&declared!==Number(explicit[1])?'Tipo e nível divergentes.':'';
      linhas.push({ kind: "etapa", nivel, ...(ordem?{ordem}:{}), ...(hierarchyError?{hierarchyError}:{}),nome: desc || "Etapa", _i: i + 1 });
      continue;
    }
    if (tipo === "titulo") { linhas.push({ kind: "titulo", descricao: desc, ...(sourceOrder?{ordem:sourceOrder}:{}), _i: i + 1 }); continue; }

    const original=compararOriginal(r,col,i,parseNumero,percentCells,totalKind,bdiFormat);
    const fonteExcel=texto(r[col.fonte]);
    const unidadeExcel=texto(r[col.unidade]);
    const candidates=cod?basePorCodigo.get(codigoReferenciaImportacao(cod)):null;
    const candidatesList=Array.isArray(candidates)?candidates:candidates?[candidates]:[];
    const matches=fonteExcel?candidatesList.filter(entry=>chaveFonte(entry.fonte)===chaveFonte(fonteExcel)):candidatesList;
    const b=matches.length===1?matches[0]:null;
    const basePreco=b?Number(precoDoItem(b,orc)):null;
    const unitConflict=Boolean(b?.unidade&&unidadeExcel&&unidade(b.unidade)!==unidade(unidadeExcel));
    const preco=basePreco>0&&Number.isFinite(basePreco)&&!unitConflict&&texto(b?.unidade)?basePreco:0;
    if(!cod)original.missing.push('Código ausente no Excel.');
    if(!desc)original.missing.push('Descrição ausente no Excel.');
    if(!unidadeExcel)original.missing.push('Unidade ausente no Excel.');
    if(!fonteExcel)original.missing.push('Fonte ausente no Excel.');
    if(matches.length>1)original.missing.push('Código ambíguo nas referências carregadas.');
    else if(cod&&!b)original.missing.push(fonteExcel?'Código e fonte não encontrados na referência.':'Código não encontrado na referência.');
    if(b&&!b.unidade)original.missing.push('Unidade não informada na referência.');
    if(b&&!(basePreco>0))original.missing.push('Referência sem preço positivo.');
    if(unitConflict)original.divergences.push('Unidade da referência difere da unidade do Excel. Preço não aplicado.');
    if(b&&precoFoiSubstituido(b,orc))original.divergences.push('Preço da referência usa o outro regime de encargos.');
    if(basePreco>0&&!unitConflict&&original.valores.preco!=null&&cents(basePreco)!==cents(original.valores.preco))
      original.divergences.push('Custo unitário do Excel difere do preço da referência.');
    if(original.valores.bdi!=null&&cents(original.valores.bdi)!==cents(Number(orc?.bdi||0)))
      original.divergences.push('BDI do Excel difere do BDI do orçamento.');
    linhas.push({
      kind: "item",
      ...(sourceOrder?{ordem:sourceOrder}:{}),
      codigo: b?.codigo||cod,
      descricao: b ? b.descricao : (desc || "(código não localizado — sem descrição)"),
      unidade: (unitConflict?unidadeExcel:b?.unidade||unidadeExcel)||"UN",
      fonte: b ? (b.fonte || orc?.fonte) : (fonteExcel||"NÃO LOCALIZADO"),
      quantidade: qtd,
      precoUnit: preco,
      composicao: "",
      codigoNaoEncontrado: !cod || !b,
      achou: !!b,
      semQtd: !(qtd > 0),
      semPreco: !(preco > 0),
      original:{...original,codigo:cod,descricao:desc,fonte:fonteExcel,unidade:unidadeExcel},
      referencia:b?{fonte:b.fonte,unidade:b.unidade,preco:basePreco>0?basePreco:null,baseData:b.dataBase||b.baseData||'',baseUf:b.uf||b.baseUf||''}:null,
      _i: i + 1,
    });
  }
  return linhas;
}

export const importacaoComPendencia = row => !row.achou||row.semPreco||row.semQtd;

export function resumoImportacao(linhas, bdi=0, incluirPend=true) {
  const itens = linhas.filter(l => l.kind === "item");
  const selected=incluirPend?itens:itens.filter(row=>!importacaoComPendencia(row));
  const destino=calculateBudget({bdi,itens:selected});
  const suma=values=>values.length?values.reduce((total,value)=>total+cents(value),0)/100:null;
  return {
    etapas: linhas.filter(l => l.kind === "etapa").length,
    itens: itens.length,
    ok: itens.filter(i => i.achou && !i.semPreco && !i.semQtd).length,
    naoAchou: itens.filter(i => !i.achou).length,
    semPreco: itens.filter(i => i.semPreco).length,
    semQtd: itens.filter(i => i.semQtd).length,
    valor: destino.custoDireto,
    total: destino.total,
    origemTotal:suma(itens.map(row=>row.original?.valores.total).filter(value=>value!=null)),
    origemRecalculada:suma(itens.map(row=>row.original?.calculado?.total).filter(value=>value!=null)),
    destinoPorLinha:new Map(calculateBudget({bdi,itens}).items.map(row=>[row._i,row])),
  };
}
