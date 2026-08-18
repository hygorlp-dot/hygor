export const RESCISSION_TYPES = Object.freeze([
  { v:"sem_justa_causa", l:"Dispensa sem justa causa (empregador)" },
  { v:"justa_causa", l:"Dispensa por justa causa" },
  { v:"pedido_demissao", l:"Pedido de demissão (funcionário)" },
  { v:"acordo_mutuo", l:"Acordo mútuo (art. 484-A CLT)" },
  { v:"termino_contrato", l:"Término de contrato de prazo determinado" },
  { v:"acordo_interno", l:"Acordo interno - valor fixo x tempo ativo" },
]);

export const RESCISSION_TYPE_LABEL = Object.freeze(
  Object.fromEntries(RESCISSION_TYPES.map(item => [item.v, item.l])),
);

export const calculateRescission = (form = {}) => {
  const {
    admissao, demissao, valorMensal, diasNoMes, tipo,
    incluirSaldo, incluir13, incluirFerias, incluirAviso,
    valorFixoAcordo, descAdiantamento, descOutros,
  } = form;
  if (!admissao || !demissao) return null;

  const dataAdm = new Date(`${admissao}T12:00:00`);
  const dataDem = new Date(`${demissao}T12:00:00`);
  if (Number.isNaN(dataAdm.getTime()) || Number.isNaN(dataDem.getTime()) || dataDem < dataAdm) return null;

  // anos/meses/dias entre admissão e demissão - só para exibir "tempo de
  // casa" e para o modo acordo_interno (valor fixo × tempo ativo). NÃO é a
  // base de avos de 13º/férias (ver abaixo) - achado de bug de 18/08/2026:
  // usar esse total cru como avos fazia um funcionário com 18 meses de casa
  // ter 18 avos (sem limite de 12) e fazia 13º e férias compartilharem o
  // mesmo número, embora sejam dois períodos aquisitivos diferentes.
  const diffMeses = (inicio, fim) => {
    let anosDiff = fim.getFullYear() - inicio.getFullYear();
    let mesesDiff = fim.getMonth() - inicio.getMonth();
    let diasDiff = fim.getDate() - inicio.getDate();
    if (diasDiff < 0) { mesesDiff -= 1; diasDiff += 30; }
    if (mesesDiff < 0) { anosDiff -= 1; mesesDiff += 12; }
    return { anos: anosDiff, totalMeses: anosDiff * 12 + mesesDiff, dias: diasDiff };
  };
  const tempoDeCasa = diffMeses(dataAdm, dataDem);
  const anos = tempoDeCasa.anos;
  const totalMeses = tempoDeCasa.totalMeses;
  const diasResto = tempoDeCasa.dias;

  // Avos de 13º: meses trabalhados no ANO CIVIL da rescisão (1º de janeiro,
  // ou a data de admissão se for no mesmo ano), fração ≥15 dias conta como
  // mês cheio, máximo 12. Não acumula anos anteriores - o 13º desses anos já
  // deveria ter sido quitado ao longo do próprio ano (duas parcelas), fora
  // deste cálculo.
  const inicioAno13 = new Date(dataDem.getFullYear(), 0, 1, 12, 0, 0);
  const janela13 = diffMeses(dataAdm > inicioAno13 ? dataAdm : inicioAno13, dataDem);
  const avos13 = Math.min(12, Math.max(0, janela13.totalMeses + (janela13.dias >= 15 ? 1 : 0)));

  // Avos de férias: meses do período aquisitivo em aberto (12 meses a partir
  // do aniversário de admissão mais recente que já passou), fração ≥15 dias
  // conta como mês cheio, máximo 12. Não soma períodos aquisitivos completos
  // e não gozados ("férias vencidas") - o sistema não rastreia esse débito
  // hoje; se existir, é um valor à parte, fora deste cálculo (decisão de
  // produto, não resolvida aqui).
  const aniversarioAdmissao = ano => new Date(ano, dataAdm.getMonth(), dataAdm.getDate(), 12, 0, 0);
  let inicioFerias = aniversarioAdmissao(dataDem.getFullYear());
  if (inicioFerias > dataDem) inicioFerias = aniversarioAdmissao(dataDem.getFullYear() - 1);
  if (inicioFerias < dataAdm) inicioFerias = dataAdm;
  const janelaFerias = diffMeses(inicioFerias, dataDem);
  const avosFerias = Math.min(12, Math.max(0, janelaFerias.totalMeses + (janelaFerias.dias >= 15 ? 1 : 0)));

  const vm = Number(valorMensal || 0);
  const dd = Number(diasNoMes || 0);
  const descAdiant = Number(descAdiantamento || 0);
  const descOut = Number(descOutros || 0);
  const totalDesc = descAdiant + descOut;

  if (tipo === "acordo_interno") {
    const vf = Number(valorFixoAcordo || vm || 0);
    const mesesAtivos = totalMeses + (diasResto / 30);
    const totalBruto = vf * mesesAtivos;
    const totalLiquido = Math.max(0, totalBruto - totalDesc);
    return {
      isAcordoInterno:true,
      anos, totalMeses, diasResto, avos13:0, avosFerias:0,
      mesesAtivos:Number(mesesAtivos.toFixed(4)),
      valorFixoAcordo:vf,
      saldoSalario:0, dec13:0, feriasBruto:0, feriasTotal:0, avisoPrevio:0,
      totalBruto, totalDesc, totalLiquido,
    };
  }

  const saldoSalario = incluirSaldo ? (vm / 30) * dd : 0;
  const dec13 = incluir13 ? (vm / 12) * avos13 : 0;
  const feriasBruto = incluirFerias ? (vm / 12) * avosFerias : 0;
  const feriasTotal = feriasBruto * (4 / 3);
  const aviso = incluirAviso && tipo === "sem_justa_causa" ? vm : 0;
  const avisoAcordo = incluirAviso && tipo === "acordo_mutuo" ? vm * 0.5 : 0;
  const avisoPrevio = aviso + avisoAcordo;
  const totalBruto = saldoSalario + dec13 + feriasTotal + avisoPrevio;
  const totalLiquido = Math.max(0, totalBruto - totalDesc);

  return {
    isAcordoInterno:false,
    anos, totalMeses, diasResto, avos13, avosFerias,
    saldoSalario, dec13, feriasBruto, feriasTotal, avisoPrevio,
    totalBruto, totalDesc, totalLiquido,
  };
};
