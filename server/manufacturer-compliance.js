const PBQPH_URL="https://pbqp-h.cidades.gov.br/sistemas/simac/empresas-qualificadas/?tabela=show";
const PBQPH_PAGE="https://pbqp-h.cidades.gov.br/sistemas/simac/empresas-qualificadas/";
const INMETRO_BASE="https://registro.inmetro.gov.br/consulta/";
const INMETRO_SEARCH=`${INMETRO_BASE}Default.aspx`;
const INMETRO_AUTOCOMPLETE="https://registro.inmetro.gov.br/Ajax/AjaxAutoCompleteRazaoSocial.ashx";

export const COMPLIANCE_SOURCES={PBQPH_URL,PBQPH_PAGE,INMETRO_BASE};

export const digits=value=>String(value||"").replace(/\D/g,"");
export const normalizeSearch=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").replace(/\s+/g," ").trim();

const decodeHtml=value=>String(value||"")
  .replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi,(_,code)=>String.fromCodePoint(Number.parseInt(code,16)))
  .replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">");

const textFromHtml=value=>decodeHtml(String(value||"").replace(/<br\s*\/?\s*>/gi," ").replace(/<[^>]+>/g," "))
  .replace(/\s+/g," ").trim();

export const filterPbqphRows=(rows,query,limit=50)=>{
  const term=normalizeSearch(query),taxId=digits(query);
  return (Array.isArray(rows)?rows:[]).filter(row=>{
    if(taxId.length===14&&digits(row?.cnpj)===taxId)return true;
    return [row?.nome_da_empresa,row?.cnpj,row?.marca,row?.nome_comercial,row?.produto_alvo,row?.psq]
      .some(value=>normalizeSearch(value).includes(term));
  }).slice(0,limit).map(row=>({
    program:row.psq||"",company:row.nome_da_empresa||"",cnpj:row.cnpj||"",city:row.cidade||"",uf:row.uf||"",
    product:row.produto_alvo||row.nome_comercial||"",brand:row.marca||"",classification:row.classificacao||"",
    validUntil:row.validade||"",entity:row.nome_entidade||"",officialUrl:PBQPH_PAGE,
  }));
};

export const parseInmetroHtml=html=>{
  const total=Number(String(html||"").match(/LbTotalRegistros2[^>]*[^<]*<[^>]*>(\d+)/i)?.[1]||0);
  const body=String(html||"").match(/<tbody[^>]*class=["']corpo["'][^>]*>([\s\S]*?)<\/tbody>/i)?.[1]||"";
  const results=[];
  for(const match of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)){
    const cells=[...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(cell=>textFromHtml(cell[1]));
    if(cells.length<5)continue;
    const href=match[1].match(/href=["']([^"']*detalhe\.aspx[^"']*)["']/i)?.[1]||"";
    results.push({registration:cells[0],status:cells[1],certificate:cells[2],product:cells[3],company:cells[4],address:cells[5]||"",officialUrl:href.startsWith("http")?href:new URL(href,INMETRO_BASE).toString()});
  }
  return {total:total||results.length,results};
};

export const buildInmetroUrl=({query,company=""})=>{
  const taxId=digits(query),params=new URLSearchParams({
    pag:"1",acao:"pesquisar",NumeroRegistro:"",
    "ctl00$MainContent$ControlPesquisa1$Situacao":"",dataConcessaoInicio:"",dataConcessaoFinal:"",
    "ctl00$MainContent$ControlPesquisa1$SelectPacs":"",
    "ctl00$MainContent$ControlPesquisa1$SelectModeloAvaliacaoConformidade":"",MarcaModelo:"",
    Fornecedor:taxId.length===14?"":company||String(query||"").trim(),
    CNPJ:taxId.length===14?String(query||"").trim():"",
    "ctl00$MainContent$ControlPesquisa1$SelectUF":"",Municipio:"",CodigodeBarra:"",
  });
  return `${INMETRO_SEARCH}?${params}`;
};

const fetchWithTimeout=async(url,{timeout=12000,...options}={})=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{return await fetch(url,{...options,signal:controller.signal,headers:{accept:"application/json,text/html;q=0.9,*/*;q=0.8","user-agent":"ARCD-Compliance/1.0",...(options.headers||{})}});}
  finally{clearTimeout(timer);}
};

export const searchPbqph=async query=>{
  const response=await fetchWithTimeout(PBQPH_URL);
  if(!response.ok)throw new Error(`PBQP-H respondeu ${response.status}`);
  const rows=await response.json();
  return {status:"ok",total:filterPbqphRows(rows,query,Number.MAX_SAFE_INTEGER).length,results:filterPbqphRows(rows,query),officialUrl:PBQPH_PAGE};
};

export const searchInmetro=async query=>{
  const taxId=digits(query);let companies=[];
  if(taxId.length!==14){
    const suggestionResponse=await fetchWithTimeout(`${INMETRO_AUTOCOMPLETE}?${new URLSearchParams({term:String(query).trim()})}`);
    if(suggestionResponse.ok)companies=(await suggestionResponse.json()).slice(0,4);
  }
  if(!companies.length)companies=[""];
  const pages=await Promise.all(companies.map(async company=>{
    const url=buildInmetroUrl({query,company}),response=await fetchWithTimeout(url);
    if(!response.ok)throw new Error(`Inmetro respondeu ${response.status}`);
    return {...parseInmetroHtml(await response.text()),searchUrl:url};
  }));
  const unique=new Map();
  pages.flatMap(page=>page.results).forEach(item=>unique.set(item.registration,item));
  const results=[...unique.values()].slice(0,50);
  return {status:"ok",total:results.length,results,officialUrl:pages[0]?.searchUrl||buildInmetroUrl({query})};
};

export const searchManufacturerCompliance=async query=>{
  const [inmetro,pbqph]=await Promise.allSettled([searchInmetro(query),searchPbqph(query)]);
  const unavailable=(source,error,url)=>({status:"unavailable",total:0,results:[],officialUrl:url,message:`A fonte ${source} não respondeu. Use o link oficial e tente novamente.` ,diagnostic:error?.name||"upstream_error"});
  return {
    query:String(query).trim(),searchedAt:new Date().toISOString(),
    sources:{
      inmetro:inmetro.status==="fulfilled"?inmetro.value:unavailable("do Inmetro",inmetro.reason,INMETRO_BASE),
      pbqph:pbqph.status==="fulfilled"?pbqph.value:unavailable("do PBQP-H",pbqph.reason,PBQPH_PAGE),
    },
  };
};
