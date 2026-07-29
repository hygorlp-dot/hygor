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

  let anos = dataDem.getFullYear() - dataAdm.getFullYear();
  let meses = dataDem.getMonth() - dataAdm.getMonth();
  let dias = dataDem.getDate() - dataAdm.getDate();
  if (dias < 0) { meses -= 1; dias += 30; }
  if (meses < 0) { anos -= 1; meses += 12; }
  const totalMeses = anos * 12 + meses;
  const diasResto = dias;
  const avos13 = totalMeses + (diasResto >= 15 ? 1 : 0);
  const avosFerias = avos13;

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
