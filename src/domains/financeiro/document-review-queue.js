import {isDateInClosedPeriod} from './workflows.js';
import {isFinancialDate} from './dates.js';
export const documentReviewStatus=status=>({recebida:'Recebida',conferencia:'Em conferência',aprovada:'Aprovada',rejeitada:'Rejeitada',cancelada:'Cancelada',paga:'Paga'}[status]||'Aguardando conferência');

export function documentReviewEligibility(row,data,user){
 if(!['admin','financeiro'].includes(user?.role))return 'Perfil sem acesso à ficha fiscal';
 if(row.type!=='nota_fiscal')return 'Conferência pela origem do registro';
 if(user.obraId&&String(row.record.obraId)!==String(user.obraId))return 'Obra fora do acesso atual';
 if(!['recebida','conferencia',''].includes(row.record.status||''))return 'Fora da fila de conferência';
 if(!row.record.obraId)return 'Defina a obra na ficha fiscal';
 const date=row.record.emissao||row.record.dataEmissao||row.entry.date;
 if(!isFinancialDate(date))return 'Data pendente de conferência individual';
 if(isDateInClosedPeriod(data,date)||isDateInClosedPeriod(data,`${row.period}-01`))return 'Período fechado';
 return '';
}
