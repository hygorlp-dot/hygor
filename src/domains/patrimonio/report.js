const STATUS_LABELS={
  ativo:"Ativo",
  em_uso:"Em uso",
  manutencao:"Manutenção",
  extraviado:"Extraviado",
  baixado:"Baixado",
};

const escapeHtml=value=>String(value??"")
  .replace(/&/g,"&amp;")
  .replace(/</g,"&lt;")
  .replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;")
  .replace(/'/g,"&#39;");

const money=value=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const date=value=>{
  const raw=String(value||"");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw||"—";
  const parts=raw.split("-");
  return parts[2]+"/"+parts[1]+"/"+parts[0];
};

const sortAsset=(a,b)=>{
  const tagA=String(a?.assetTag||"").toLocaleLowerCase("pt-BR");
  const tagB=String(b?.assetTag||"").toLocaleLowerCase("pt-BR");
  if(tagA&&tagB&&tagA!==tagB)return tagA.localeCompare(tagB,"pt-BR",{numeric:true,sensitivity:"base"});
  return String(a?.name||"").localeCompare(String(b?.name||""),"pt-BR",{numeric:true,sensitivity:"base"});
};

export const summarizePatrimonyReport=assets=>{
  const rows=(Array.isArray(assets)?assets:[]).filter(Boolean);
  const total=rows.reduce((sum,item)=>sum+Number(item?.acquisitionValue||0),0);
  const withInvoice=rows.filter(item=>item?.invoice?.number||item?.invoice?.document?.path).length;
  const categories=[...rows.reduce((map,item)=>{
    const category=String(item?.category||"Outros").trim()||"Outros";
    const current=map.get(category)||{category,count:0,value:0};
    current.count+=1;
    current.value+=Number(item?.acquisitionValue||0);
    map.set(category,current);
    return map;
  },new Map()).values()].sort((a,b)=>b.value-a.value||a.category.localeCompare(b.category,"pt-BR"));
  return{count:rows.length,total,withInvoice,categories};
};

export const buildPatrimonyReportHtml=({
  assets=[],
  companyName="MARCELL",
  filterLabel="Todos os bens",
  generatedAt=new Date(),
}={})=>{
  const rows=[...(Array.isArray(assets)?assets:[])].filter(Boolean).sort(sortAsset);
  const summary=summarizePatrimonyReport(rows);
  const generated=generatedAt instanceof Date&&!Number.isNaN(generatedAt.valueOf())
    ?generatedAt.toLocaleString("pt-BR")
    :String(generatedAt||"");

  const categoryRows=summary.categories.map(item=>
    "<tr><td>"+escapeHtml(item.category)+"</td><td class=\"num\">"+item.count+"</td><td class=\"num\">"+escapeHtml(money(item.value))+"</td></tr>"
  ).join("");

  const detailRows=rows.map(item=>{
    const invoiceNumber=String(item?.invoice?.number||"").trim();
    const supplier=String(item?.invoice?.supplierName||"").trim();
    const invoice=[invoiceNumber?"NF "+invoiceNumber:"",supplier].filter(Boolean).join(" · ")||"—";
    const location=String(item?.location?.label||"").trim()||"Sede";
    const custodian=String(item?.custodian?.name||"").trim();
    const locationText=[location,custodian?"Resp.: "+custodian:""].filter(Boolean).join(" · ");
    const serial=item?.serialNumber?"<small>Série: "+escapeHtml(item.serialNumber)+"</small>":"";
    const imei=item?.imei?"<small>IMEI: "+escapeHtml(item.imei)+"</small>":"";
    return "<tr>"+
      "<td>"+escapeHtml(item?.assetTag||"—")+"</td>"+
      "<td><b>"+escapeHtml(item?.name||"—")+"</b>"+serial+imei+"</td>"+
      "<td>"+escapeHtml(item?.category||"Outros")+"</td>"+
      "<td>"+escapeHtml(date(item?.acquisitionDate))+"</td>"+
      "<td class=\"num\">"+escapeHtml(money(item?.acquisitionValue||0))+"</td>"+
      "<td>"+escapeHtml(STATUS_LABELS[item?.status]||item?.status||"Ativo")+"</td>"+
      "<td>"+escapeHtml(locationText)+"</td>"+
      "<td>"+escapeHtml(invoice)+"</td>"+
    "</tr>";
  }).join("");

  return "<!doctype html><html><head><meta charset=\"utf-8\"><title>Relatório de Patrimônio da Empresa</title><style>"+
    "*{box-sizing:border-box}body{margin:0;background:#fff;color:#0d1b2e}header{display:flex;justify-content:space-between;gap:24px;align-items:flex-end}"+
    "header h1{margin:0}header p{margin:4px 0 0}main{padding-top:18px}.toolbar{position:fixed;right:16px;top:16px;z-index:2}"+
    ".summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0 0 18px}.summary>div{border:1px solid #d9dde2;border-top:2px solid #b9985b;padding:10px 12px}"+
    ".summary small{display:block;color:#536171;margin-bottom:4px}.summary b{font-size:16px}h2{margin:22px 0 8px}table{width:100%;border-collapse:collapse}"+
    "th,td{border:1px solid #d9dde2;padding:6px 7px;vertical-align:top;text-align:left}td small{display:block;color:#536171;margin-top:2px}.num{text-align:right;white-space:nowrap}"+
    ".category{max-width:620px}.notice{margin:16px 0 0;padding:9px 11px;border-left:3px solid #b9985b;background:#f8f6f1;color:#536171}.meta{font-size:10px;color:#536171;text-align:right}"+
    "tfoot td{font-weight:600;background:#f3f0e9}@media print{.toolbar{display:none}}</style></head><body>"+
    "<button class=\"toolbar\" onclick=\"print()\">Imprimir / salvar PDF</button>"+
    "<header><div><h1>Relatório de Patrimônio da Empresa</h1><p>"+escapeHtml(companyName)+"</p><p>"+escapeHtml(filterLabel)+"</p></div><div class=\"meta\">Gerado em "+escapeHtml(generated)+"</div></header>"+
    "<main><section class=\"summary\">"+
      "<div><small>Bens no relatório</small><b>"+summary.count+"</b></div>"+
      "<div><small>Valor total de aquisição</small><b>"+escapeHtml(money(summary.total))+"</b></div>"+
      "<div><small>Com NF / documento fiscal</small><b>"+summary.withInvoice+" de "+summary.count+"</b></div>"+
    "</section>"+
    "<h2>Resumo por categoria</h2><table class=\"category\"><thead><tr><th>Categoria</th><th class=\"num\">Quantidade</th><th class=\"num\">Valor de aquisição</th></tr></thead>"+
    "<tbody>"+(categoryRows||"<tr><td colspan=\"3\">Nenhum patrimônio no recorte.</td></tr>")+"</tbody>"+
    "<tfoot><tr><td>Total</td><td class=\"num\">"+summary.count+"</td><td class=\"num\">"+escapeHtml(money(summary.total))+"</td></tr></tfoot></table>"+
    "<h2>Relação de bens</h2><table><thead><tr><th>Patrimônio</th><th>Bem</th><th>Categoria</th><th>Data aquisição</th><th class=\"num\">Valor aquisição</th><th>Situação</th><th>Local / responsável</th><th>Nota fiscal / fornecedor</th></tr></thead>"+
    "<tbody>"+(detailRows||"<tr><td colspan=\"8\">Nenhum patrimônio no recorte.</td></tr>")+"</tbody>"+
    "<tfoot><tr><td colspan=\"4\">Valor total de aquisição</td><td class=\"num\">"+escapeHtml(money(summary.total))+"</td><td colspan=\"3\"></td></tr></tfoot></table>"+
    "<p class=\"notice\"><b>Critério:</b> os valores deste relatório correspondem aos valores de aquisição cadastrados para os bens. Não representam depreciação, valor contábil líquido, valor fiscal ou valor de mercado.</p>"+
    "</main></body></html>";
};
