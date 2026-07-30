import { useEffect, useMemo, useState } from "react";

const percentual=(parte,total)=>total>0?(parte/total)*100:0;
const numero=value=>Number(value||0);

export default function EquipmentBillingReports({
  data,
  monthly,
  matrix,
  period,
  periodLabel,
  periodOptions,
  onPeriodChange,
  ownerName,
  logoSrc,
  formatCurrency,
  formatDate,
  formatComposition,
  onPrintManagement,
  onPrintWork,
  onExportManagement,
  onExportWork,
}) {
  const [mode,setMode]=useState("gerencial");
  const worksWithMovement=useMemo(()=>matrix.obras.filter(obra=>{
    const total=matrix.totaisPorObra[obra.id];
    return total?.unidadeDias>0||total?.receita>0||total?.custoDono>0;
  }),[matrix]);
  const [workId,setWorkId]=useState(worksWithMovement[0]?.id||"");

  useEffect(()=>{
    if(!worksWithMovement.some(obra=>obra.id===workId)){
      setWorkId(worksWithMovement[0]?.id||"");
    }
  },[worksWithMovement,workId]);

  const details=useMemo(()=>matrix.linhas.flatMap(line=>
    matrix.obras.flatMap(obra=>(line.porObra[obra.id]?.detalhes||[]).map(detail=>({
      ...detail,
      obra,
      equipamento:line.equip,
    })))
  ),[matrix]);
  const selectedWork=worksWithMovement.find(obra=>obra.id===workId)||null;
  const selectedTotal=selectedWork?matrix.totaisPorObra[selectedWork.id]:null;
  const selectedDetails=useMemo(()=>details
    .filter(detail=>detail.obra.id===workId)
    .sort((a,b)=>String(a.equipamento.nome||"").localeCompare(String(b.equipamento.nome||""))
      ||String(a.inicio||"").localeCompare(String(b.inicio||""))),[details,workId]);

  const daysInPeriod=matrix.inicio&&matrix.fim
    ?Math.floor((Date.parse(`${matrix.fim}T00:00:00Z`)-Date.parse(`${matrix.inicio}T00:00:00Z`))/86400000)+1
    :0;
  const fleetUnits=(data.equipamentos||[])
    .filter(item=>item.ativo!==false)
    .reduce((sum,item)=>sum+Math.max(1,numero(item.quantidadeTotal)),0);
  const capacity=fleetUnits*daysInPeriod;
  const utilization=percentual(matrix.total.unidadeDias,capacity);
  const margin=percentual(monthly.total.lucro,monthly.total.receita);
  const ownRevenue=monthly.proprios.reduce((sum,line)=>sum+numero(line.receita),0);
  const thirdPartyRevenue=monthly.terceiros.reduce((sum,line)=>sum+numero(line.receita),0);
  const withoutRate=details.filter(detail=>detail.semTarifa);
  const activeEquipment=matrix.linhas.filter(line=>line.total.unidadeDias>0).length;

  const workRanking=worksWithMovement
    .map(obra=>{
      const total=matrix.totaisPorObra[obra.id];
      const workDetails=details.filter(detail=>detail.obra.id===obra.id);
      return {
        obra,
        ...total,
        locacoes:workDetails.length,
        equipamentos:new Set(workDetails.map(detail=>detail.equipamento.id)).size,
        margem:percentual(total.lucro,total.receita),
      };
    })
    .sort((a,b)=>b.receita-a.receita);
  const equipmentRanking=monthly.linhas
    .filter(line=>line.receita>0||line.custo>0||line.diasTotais>0)
    .slice()
    .sort((a,b)=>b.receita-a.receita);

  const workEquipmentCount=new Set(selectedDetails.map(detail=>detail.equipamento.id)).size;
  const workMargin=selectedTotal?percentual(selectedTotal.lucro,selectedTotal.receita):0;

  return (
    <section className="equipment-billing-report" aria-label="Relatórios de cobrança de locações">
      <header className="equipment-report-toolbar">
        <div>
          <p>Relatórios de cobrança</p>
          <small>Visão gerencial da operação e memória detalhada de cada obra.</small>
        </div>
        <label className="equipment-billing-field">
          <span>Competência</span>
          <select value={period} onChange={event=>onPeriodChange(event.target.value)}>
            {periodOptions.map(option=><option key={option.v} value={option.v}>{option.l}</option>)}
          </select>
        </label>
      </header>

      <div className="equipment-report-brand">
        <img src={logoSrc} alt="Logomarca da empresa"/>
        <div>
          <span>ARCD · CONTROLE DE LOCAÇÕES</span>
          <strong>{data.config?.companyName||"ARCD Construtech"}</strong>
          <small>Competência {periodLabel} · dados operacionais e financeiros conciliados pelo motor de equipamentos</small>
        </div>
        <div className="equipment-report-brand__stamp">
          <span>FECHAMENTO</span>
          <strong>{period.replace("-","/")}</strong>
        </div>
      </div>

      <nav className="equipment-report-switch" aria-label="Tipo de relatório">
        <button type="button" data-active={mode==="gerencial"} onClick={()=>setMode("gerencial")}>
          <span>01</span><strong>Gerencial</strong><small>Resultado, utilização e ranking</small>
        </button>
        <button type="button" data-active={mode==="obra"} onClick={()=>setMode("obra")}>
          <span>02</span><strong>Por obra</strong><small>Memória completa da cobrança</small>
        </button>
      </nav>

      {mode==="gerencial"&&<>
        <div className={`equipment-report-status ${withoutRate.length?"is-warning":"is-ready"}`}>
          <div>
            <strong>{withoutRate.length
              ?`${withoutRate.length} locação(ões) sem tarifa na competência`
              :"Fechamento pronto para conferência"}</strong>
            <small>{withoutRate.length
              ?"Esses registros permanecem visíveis, mas não geram cobrança até a tarifa ser informada."
              :`${details.length} locação(ões) distribuídas em ${worksWithMovement.length} obra(s).`}</small>
          </div>
          <span>{withoutRate.length?"REVISAR":"CONFERIDO"}</span>
        </div>

        <div className="equipment-management-kpis">
          {[
            ["Receita líquida",formatCurrency(monthly.total.receita),"Cobrança após descontos","positive"],
            ["Custo total",formatCurrency(monthly.total.custo),`${formatCurrency(monthly.total.custoDono)} repasses + ${formatCurrency(monthly.total.manut)} manutenção`,"negative"],
            ["Resultado",formatCurrency(monthly.total.lucro),`${margin.toFixed(1)}% de margem`,monthly.total.lucro>=0?"positive":"negative"],
            ["Utilização",`${utilization.toFixed(1)}%`,`${matrix.total.unidadeDias} de ${capacity} diárias-unidade`,"neutral"],
            ["Descontos",formatCurrency(monthly.total.descontos),"Concedidos na competência","warning"],
            ["Operação",`${activeEquipment} equip.`,`${fleetUnits} unidade(s) na frota · ${details.length} locação(ões)`,"neutral"],
          ].map(([label,value,detail,tone])=><article key={label} data-tone={tone}>
            <span>{label}</span><strong>{value}</strong><small>{detail}</small>
          </article>)}
        </div>

        <div className="equipment-management-split">
          <article>
            <span>Equipamentos próprios</span>
            <strong>{formatCurrency(ownRevenue)}</strong>
            <small>{percentual(ownRevenue,monthly.total.receita).toFixed(1)}% da receita · resultado {formatCurrency(monthly.lucroProprios)}</small>
          </article>
          <article>
            <span>Equipamentos de terceiros</span>
            <strong>{formatCurrency(thirdPartyRevenue)}</strong>
            <small>{percentual(thirdPartyRevenue,monthly.total.receita).toFixed(1)}% da receita · resultado {formatCurrency(monthly.lucroTerceiros)}</small>
          </article>
        </div>

        <div className="equipment-report-actions">
          <button type="button" className="is-secondary" onClick={onExportManagement}>Exportar dados gerenciais</button>
          <button type="button" className="is-primary" onClick={onPrintManagement}>Imprimir / salvar PDF gerencial</button>
        </div>

        <div className="equipment-report-section">
          <div className="equipment-report-section__heading">
            <div><span>DESEMPENHO POR CENTRO DE RESULTADO</span><h3>Ranking de obras</h3></div>
            <small>Ordenado pela receita líquida de locação</small>
          </div>
          <div className="equipment-report-table">
            <table>
              <thead><tr><th>Obra</th><th className="num">Locações</th><th className="num">Equip.</th><th className="num">Diárias-un.</th><th className="num">Cobrança</th><th className="num">Repasse</th><th className="num">Resultado</th><th className="num">Margem</th></tr></thead>
              <tbody>{workRanking.length?workRanking.map(row=><tr key={row.obra.id}>
                <td><strong>{row.obra.name}</strong><small>{row.obra.address||row.obra.endereco||"Endereço não informado"}</small></td>
                <td className="num">{row.locacoes}</td><td className="num">{row.equipamentos}</td><td className="num">{row.unidadeDias}</td>
                <td className="num positive">{formatCurrency(row.receita)}</td><td className="num">{formatCurrency(row.custoDono)}</td>
                <td className={`num ${row.lucro>=0?"positive":"negative"}`}>{formatCurrency(row.lucro)}</td><td className="num">{row.margem.toFixed(1)}%</td>
              </tr>):<tr><td colSpan="8" className="empty">Nenhuma obra com movimentação em {periodLabel}.</td></tr>}</tbody>
            </table>
          </div>
        </div>

        <div className="equipment-report-section">
          <div className="equipment-report-section__heading">
            <div><span>RENTABILIDADE DA FROTA</span><h3>Resultado por equipamento</h3></div>
            <small>Inclui repasse ao proprietário e manutenção paga pela empresa</small>
          </div>
          <div className="equipment-report-table">
            <table>
              <thead><tr><th>Equipamento</th><th>Propriedade</th><th className="num">Dias</th><th className="num">Receita</th><th className="num">Descontos</th><th className="num">Repasse</th><th className="num">Manutenção</th><th className="num">Resultado</th><th className="num">Margem</th></tr></thead>
              <tbody>{equipmentRanking.length?equipmentRanking.map(line=><tr key={line.equip.id}>
                <td><strong>{line.equip.nome}</strong><small>{line.equip.patrimonio||line.equip.categoria||"Sem patrimônio"}</small></td>
                <td>{line.proprio?"Empresa":ownerName(line.equip.proprietarioId)}</td><td className="num">{line.diasTotais}</td>
                <td className="num positive">{formatCurrency(line.receita)}</td><td className="num">{formatCurrency(line.descontos)}</td>
                <td className="num">{formatCurrency(line.custoDono)}</td><td className="num">{formatCurrency(line.manut)}</td>
                <td className={`num ${line.lucro>=0?"positive":"negative"}`}>{formatCurrency(line.lucro)}</td>
                <td className="num">{percentual(line.lucro,line.receita).toFixed(1)}%</td>
              </tr>):<tr><td colSpan="9" className="empty">Nenhum equipamento faturado em {periodLabel}.</td></tr>}</tbody>
            </table>
          </div>
        </div>
      </>}

      {mode==="obra"&&<>
        {worksWithMovement.length?<>
          <div className="equipment-work-selector">
            <label className="equipment-billing-field">
              <span>Obra do relatório</span>
              <select value={workId} onChange={event=>setWorkId(event.target.value)}>
                {worksWithMovement.map(obra=><option key={obra.id} value={obra.id}>{obra.name}</option>)}
              </select>
            </label>
            <div className="equipment-work-selector__rail" aria-label="Selecionar obra">
              {worksWithMovement.map(obra=>{
                const total=matrix.totaisPorObra[obra.id];
                return <button type="button" key={obra.id} data-active={obra.id===workId} onClick={()=>setWorkId(obra.id)}>
                  <strong>{obra.name}</strong><span>{formatCurrency(total.receita)}</span><small>{total.unidadeDias} diárias-unidade</small>
                </button>;
              })}
            </div>
          </div>

          <div className="equipment-work-report-head">
            <div>
              <span>RELATÓRIO DE COBRANÇA POR OBRA</span>
              <h3>{selectedWork?.name}</h3>
              <p>{selectedWork?.address||selectedWork?.endereco||"Endereço não informado"}{selectedWork?.engineer?` · Responsável: ${selectedWork.engineer}`:""}</p>
            </div>
            <div><span>COMPETÊNCIA</span><strong>{periodLabel}</strong></div>
          </div>

          <div className="equipment-work-kpis">
            {[
              ["Cobrança líquida",formatCurrency(selectedTotal?.receita)],
              ["Valor bruto",formatCurrency(numero(selectedTotal?.receita)+numero(selectedTotal?.descontos))],
              ["Descontos",formatCurrency(selectedTotal?.descontos)],
              ["Repasse a terceiros",formatCurrency(selectedTotal?.custoDono)],
              ["Resultado da locação",formatCurrency(selectedTotal?.lucro)],
              ["Margem",`${workMargin.toFixed(1)}%`],
              ["Equipamentos",String(workEquipmentCount)],
              ["Diárias-unidade",String(selectedTotal?.unidadeDias||0)],
            ].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}
          </div>

          <div className="equipment-report-actions">
            <button type="button" className="is-secondary" onClick={()=>onExportWork(selectedWork)}>Exportar memória da obra</button>
            <button type="button" className="is-primary" onClick={()=>onPrintWork(selectedWork)}>Imprimir / salvar PDF da obra</button>
          </div>

          <div className="equipment-report-section">
            <div className="equipment-report-section__heading">
              <div><span>MEMÓRIA DE CÁLCULO</span><h3>Locações faturadas</h3></div>
              <small>1 mês tarifário = 30 dias; 31 dias = 1 mês + 1 diária</small>
            </div>
            <div className="equipment-report-table is-detailed">
              <table>
                <thead><tr><th>Equipamento</th><th>Proprietário</th><th>Período</th><th className="num">Qtd.</th><th className="num">Dias</th><th className="num">Diárias-un.</th><th>Composição</th><th className="num">Bruto</th><th className="num">Desconto</th><th className="num">Cobrança</th><th className="num">Repasse</th><th className="num">Resultado</th></tr></thead>
                <tbody>{selectedDetails.map(detail=><tr key={`${detail.equipamento.id}-${detail.locacaoId}`}>
                  <td><strong>{detail.equipamento.nome}</strong><small>{detail.equipamento.patrimonio||detail.equipamento.categoria||"Sem patrimônio"}{detail.observacao?` · ${detail.observacao}`:""}</small></td>
                  <td>{detail.equipamento.proprietarioId?ownerName(detail.equipamento.proprietarioId):"Empresa (próprio)"}</td>
                  <td>{formatDate(detail.inicio)} a {formatDate(detail.fim)}<small>{detail.status==="em_andamento"?"Em andamento":"Encerrada"}{detail.tarifaNegociada?" · tarifa negociada":""}</small></td>
                  <td className="num">{detail.quantidade}</td><td className="num">{detail.dias}</td><td className="num">{detail.unidadeDias}</td>
                  <td>{detail.semTarifa?<span className="negative">Sem tarifa</span>:formatComposition(detail.composicao)}</td>
                  <td className="num">{formatCurrency(detail.bruto)}</td><td className="num">{formatCurrency(detail.descontos)}</td>
                  <td className="num positive">{formatCurrency(detail.receita)}</td><td className="num">{formatCurrency(detail.custoDono)}</td>
                  <td className={`num ${detail.lucro>=0?"positive":"negative"}`}>{formatCurrency(detail.lucro)}</td>
                </tr>)}</tbody>
                <tfoot><tr><td colSpan="5"><strong>Total da obra</strong></td><td className="num">{selectedTotal?.unidadeDias||0}</td><td>—</td><td className="num">{formatCurrency(numero(selectedTotal?.receita)+numero(selectedTotal?.descontos))}</td><td className="num">{formatCurrency(selectedTotal?.descontos)}</td><td className="num positive">{formatCurrency(selectedTotal?.receita)}</td><td className="num">{formatCurrency(selectedTotal?.custoDono)}</td><td className={`num ${numero(selectedTotal?.lucro)>=0?"positive":"negative"}`}>{formatCurrency(selectedTotal?.lucro)}</td></tr></tfoot>
              </table>
            </div>
          </div>
        </>:<div className="equipment-report-empty">
          <strong>Nenhuma cobrança nesta competência</strong>
          <p>Não há locações com permanência registrada em {periodLabel}.</p>
        </div>}
      </>}
    </section>
  );
}
