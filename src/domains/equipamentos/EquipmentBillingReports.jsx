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
  onEditRental,
  onDeleteRental,
  onAddRentalToWork,
}) {
  const [mode,setMode]=useState("gerencial");
  const [equipmentQuery,setEquipmentQuery]=useState("");
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
  const ownerWorkRows=useMemo(()=>{
    const grouped=new Map();
    details.filter(detail=>detail.equipamento.proprietarioId).forEach(detail=>{
      const key=`${detail.equipamento.proprietarioId}:${detail.obra.id}`;
      const current=grouped.get(key)||{
        ownerId:detail.equipamento.proprietarioId,
        owner:ownerName(detail.equipamento.proprietarioId),
        obra:detail.obra,
        equipments:new Set(),
        rentals:0,
        unitDays:0,
        amount:0,
      };
      current.equipments.add(detail.equipamento.id);
      current.rentals++;
      current.unitDays+=numero(detail.unidadeDias);
      current.amount+=numero(detail.custoDono);
      grouped.set(key,current);
    });
    return [...grouped.values()].map(row=>({...row,equipmentCount:row.equipments.size}))
      .sort((a,b)=>String(a.owner).localeCompare(String(b.owner))||String(a.obra.name).localeCompare(String(b.obra.name)));
  },[details,ownerName]);

  const workEquipmentCount=new Set(selectedDetails.map(detail=>detail.equipamento.id)).size;
  const selectedEquipment=useMemo(()=>{
    const grouped=new Map();
    selectedDetails.forEach(detail=>{
      const current=grouped.get(detail.equipamento.id)||{
        equipamento:detail.equipamento,
        rentals:0,
        quantity:0,
        unitDays:0,
        revenue:0,
        starts:[],
        ends:[],
        inProgress:false,
      };
      current.rentals++;
      current.quantity+=numero(detail.quantidade);
      current.unitDays+=numero(detail.unidadeDias);
      current.revenue+=numero(detail.receita);
      if(detail.inicio)current.starts.push(detail.inicio);
      if(detail.fim)current.ends.push(detail.fim);
      current.inProgress=current.inProgress||detail.status==="em_andamento";
      grouped.set(detail.equipamento.id,current);
    });
    const query=equipmentQuery.trim().toLocaleLowerCase("pt-BR");
    return [...grouped.values()].filter(row=>!query||[
      row.equipamento.nome,row.equipamento.patrimonio,row.equipamento.categoria,
    ].some(value=>String(value||"").toLocaleLowerCase("pt-BR").includes(query)));
  },[selectedDetails,equipmentQuery]);
  const selectedAddress=selectedWork?.address||selectedWork?.endereco||"";
  const mapUrl=selectedAddress
    ?`https://maps.google.com/maps?q=${encodeURIComponent(selectedAddress)}&output=embed`
    :"";

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
        <button type="button" data-active={mode==="localizacao"} onClick={()=>setMode("localizacao")}>
          <span>03</span><strong>Mapa da frota</strong><small>Equipamentos localizados por obra</small>
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

        <div className="equipment-report-section">
          <div className="equipment-report-section__heading">
            <div><span>CONTAS A PAGAR DE LOCAÇÕES</span><h3>Quanto cada proprietário receberá por obra</h3></div>
            <small>Valores calculados pelas tarifas de custo de cada contrato</small>
          </div>
          <div className="equipment-report-table">
            <table>
              <thead><tr><th>Proprietário</th><th>Obra</th><th className="num">Equip.</th><th className="num">Locações</th><th className="num">Diárias-un.</th><th className="num">Valor a receber</th></tr></thead>
              <tbody>{ownerWorkRows.length?ownerWorkRows.map(row=><tr key={`${row.ownerId}-${row.obra.id}`}>
                <td><strong>{row.owner}</strong></td><td><strong>{row.obra.name}</strong><small>{row.obra.address||row.obra.endereco||"Endereço não informado"}</small></td>
                <td className="num">{row.equipmentCount}</td><td className="num">{row.rentals}</td><td className="num">{row.unitDays}</td>
                <td className={`num ${row.amount>0?"positive":"negative"}`}>{row.amount>0?formatCurrency(row.amount):"Tarifa de custo ausente"}</td>
              </tr>):<tr><td colSpan="6" className="empty">Nenhum equipamento de terceiros movimentado em {periodLabel}.</td></tr>}</tbody>
              {ownerWorkRows.length>0&&<tfoot><tr><td colSpan="5"><strong>Total a pagar aos proprietários</strong></td><td className="num">{formatCurrency(ownerWorkRows.reduce((sum,row)=>sum+row.amount,0))}</td></tr></tfoot>}
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
              ["Equipamentos",String(workEquipmentCount)],
              ["Locações",String(selectedDetails.length)],
              ["Diárias-unidade",String(selectedTotal?.unidadeDias||0)],
            ].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}
          </div>

          <div className="equipment-report-actions">
            <button type="button" className="is-secondary" onClick={()=>onAddRentalToWork?.(selectedWork)}>Adicionar equipamento à obra</button>
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
                <thead><tr><th>Equipamento</th><th>Período</th><th className="num">Qtd.</th><th className="num">Dias</th><th className="num">Diárias-un.</th><th>Composição</th><th className="num">Bruto</th><th className="num">Desconto</th><th className="num">Cobrança</th></tr></thead>
                <tbody>{selectedDetails.map(detail=><tr key={`${detail.equipamento.id}-${detail.locacaoId}`}>
                  <td><strong>{detail.equipamento.nome}</strong><small>{detail.equipamento.patrimonio||detail.equipamento.categoria||"Sem patrimônio"}{detail.observacao?` · ${detail.observacao}`:""}</small><div className="equipment-rental-row-actions">
                    <button type="button" onClick={()=>onEditRental?.(detail.locacaoId)}>Editar locação</button>
                    <button type="button" className="is-danger" onClick={()=>onDeleteRental?.(detail.locacaoId)}>Excluir</button>
                  </div></td>
                  <td>{formatDate(detail.inicio)} a {formatDate(detail.fim)}<small>{detail.status==="em_andamento"?"Em andamento":"Encerrada"}{detail.tarifaNegociada?" · tarifa negociada":""}</small></td>
                  <td className="num">{detail.quantidade}</td><td className="num">{detail.dias}</td><td className="num">{detail.unidadeDias}</td>
                  <td>{detail.semTarifa?<span className="negative">Sem tarifa</span>:formatComposition(detail.composicao)}</td>
                  <td className="num">{formatCurrency(detail.bruto)}</td><td className="num">{formatCurrency(detail.descontos)}</td>
                  <td className="num positive">{formatCurrency(detail.receita)}</td>
                </tr>)}</tbody>
                <tfoot><tr><td colSpan="4"><strong>Total da obra</strong></td><td className="num">{selectedTotal?.unidadeDias||0}</td><td>—</td><td className="num">{formatCurrency(numero(selectedTotal?.receita)+numero(selectedTotal?.descontos))}</td><td className="num">{formatCurrency(selectedTotal?.descontos)}</td><td className="num positive">{formatCurrency(selectedTotal?.receita)}</td></tr></tfoot>
              </table>
            </div>
          </div>
        </>:<div className="equipment-report-empty">
          <strong>Nenhuma cobrança nesta competência</strong>
          <p>Não há locações com permanência registrada em {periodLabel}.</p>
        </div>}
      </>}

      {mode==="localizacao"&&<>
        {worksWithMovement.length? <>
          <div className="equipment-location-summary">
            <div>
              <span>LOCALIZAÇÃO OPERACIONAL</span>
              <strong>{workEquipmentCount} equipamento(s) em {selectedWork?.name}</strong>
              <small>Posição baseada na obra vinculada à locação na competência {periodLabel}.</small>
            </div>
            <label className="equipment-billing-field">
              <span>Obra no mapa</span>
              <select value={workId} onChange={event=>setWorkId(event.target.value)}>
                {worksWithMovement.map(obra=><option key={obra.id} value={obra.id}>{obra.name}</option>)}
              </select>
            </label>
          </div>

          <div className="equipment-location-layout">
            <aside className="equipment-location-works" aria-label="Obras com equipamentos">
              <header><span>OBRAS COM MOVIMENTAÇÃO</span><strong>{worksWithMovement.length} local(is)</strong></header>
              {worksWithMovement.map((obra,index)=>{
                const workDetails=details.filter(detail=>detail.obra.id===obra.id);
                const count=new Set(workDetails.map(detail=>detail.equipamento.id)).size;
                return <button type="button" key={obra.id} data-active={obra.id===workId} onClick={()=>setWorkId(obra.id)}>
                  <span className="equipment-location-works__index">{String(index+1).padStart(2,"0")}</span>
                  <span><strong>{obra.name}</strong><small>{obra.address||obra.endereco||"Endereço não informado"}</small></span>
                  <b>{count}</b>
                </button>;
              })}
            </aside>

            <div className="equipment-location-map">
              {mapUrl?<>
                <iframe src={mapUrl} title={`Mapa da obra ${selectedWork?.name}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/>
                <div className="equipment-location-map__caption">
                  <div><span>LOCAL SELECIONADO</span><strong>{selectedWork?.name}</strong><small>{selectedAddress}</small></div>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedAddress)}`} target="_blank" rel="noreferrer">Abrir rota</a>
                </div>
              </>:<div className="equipment-location-map__empty"><strong>Endereço não cadastrado</strong><p>Informe o endereço da obra para exibi-la no mapa.</p></div>}
            </div>
          </div>

          <div className="equipment-report-section">
            <div className="equipment-report-section__heading equipment-location-heading">
              <div><span>EQUIPAMENTOS NESTE LOCAL</span><h3>Detalhe da frota em {selectedWork?.name}</h3></div>
              <label><span>BUSCAR EQUIPAMENTO</span><input type="search" value={equipmentQuery} onChange={event=>setEquipmentQuery(event.target.value)} placeholder="Nome, patrimônio ou categoria"/></label>
            </div>
            <div className="equipment-location-equipment">
              {selectedEquipment.length?selectedEquipment.map(row=>{
                const first=row.starts.slice().sort()[0];
                const last=row.ends.slice().sort().at(-1);
                return <article key={row.equipamento.id}>
                  <div className="equipment-location-equipment__identity">
                    <span className={`equipment-location-equipment__status ${row.inProgress?"is-active":""}`}/>
                    <div><strong>{row.equipamento.nome}</strong><small>{row.equipamento.patrimonio||"Sem patrimônio"} · {row.equipamento.categoria||"Sem categoria"}</small></div>
                  </div>
                  <div><span>PERMANÊNCIA</span><strong>{first&&last?`${formatDate(first)} — ${formatDate(last)}`:"Período não informado"}</strong><small>{row.inProgress?"Em andamento":"Movimentação encerrada"}</small></div>
                  <div><span>QUANTIDADE</span><strong>{row.quantity}</strong><small>{row.rentals} locação(ões)</small></div>
                  <div><span>DIÁRIAS-UN.</span><strong>{row.unitDays}</strong><small>{formatCurrency(row.revenue)} faturados</small></div>
                  <div><span>PROPRIEDADE</span><strong>{row.equipamento.proprietarioId?ownerName(row.equipamento.proprietarioId):"Empresa"}</strong><small>Local: {selectedWork?.name}</small></div>
                </article>;
              }):<div className="equipment-location-equipment__empty">Nenhum equipamento corresponde à busca.</div>}
            </div>
          </div>
        </>:<div className="equipment-report-empty"><strong>Nenhum equipamento localizado</strong><p>Não há locações vinculadas a obras em {periodLabel}.</p></div>}
      </>}
    </section>
  );
}
