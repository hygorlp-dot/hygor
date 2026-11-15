import PDFDocument from 'pdfkit';
import {portalCategory,portalMoney,portalDate,portalPeriod} from '../src/client-portal/format.js';

const plain=value=>String(value??'').replaceAll('\u00a0',' ').replaceAll('−','-');
const amount=value=>value==null?'Em apuração':plain(portalMoney(value));
export async function createClientStatementPdf(report){
 const doc=new PDFDocument({size:'A4',margin:42,bufferPages:true,info:{Title:`Prestação de contas - ${report.projectName}`,Author:'MARCELL Engenharia'}}),chunks=[];
 const result=new Promise((resolve,reject)=>{doc.on('data',chunk=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
 const width=doc.page.width-84,ink='#0D1B2E',muted='#536171',line='#D9DDE2';
 const ensure=height=>{if(doc.y+height>doc.page.height-60)doc.addPage();};
 const paragraph=text=>{const s=plain(text);doc.font('Helvetica').fontSize(10);ensure(doc.heightOfString(s,{width})+12);doc.fillColor(ink).text(s,42,doc.y,{width,lineGap:3});doc.moveDown(.6);};
 const heading=text=>{ensure(100);doc.moveDown(.6);doc.font('Helvetica-Bold').fontSize(14).fillColor(ink).text(plain(text),42,doc.y,{width});doc.moveDown(.5);};
 const table=(headers,rows,widths)=>{
  const draw=(cells,header=false)=>{
   doc.font(header?'Helvetica-Bold':'Helvetica').fontSize(9);
   const heights=cells.map((cell,index)=>doc.heightOfString(plain(cell),{width:widths[index]-14,lineGap:2}));const height=Math.max(24,...heights.map(h=>h+14));
   if(doc.y+height>doc.page.height-60){doc.addPage();if(!header)draw(headers,true);}
   const top=doc.y;let x=42;
   if(header)doc.rect(42,top,width,height).fill('#EDF3F7');
   cells.forEach((cell,index)=>{const color=plain(cell).startsWith('+ R$')?'#2E6652':plain(cell).startsWith('- R$')?'#A63B3B':ink;doc.font(header?'Helvetica-Bold':'Helvetica').fillColor(color).text(plain(cell),x+7,top+7,{width:widths[index]-14,lineGap:2});x+=widths[index];});
   doc.moveTo(42,top+height).lineTo(42+width,top+height).strokeColor(line).lineWidth(.5).stroke();doc.y=top+height;doc.x=42;
  };
  draw(headers,true);if(!rows.length)draw(['Nenhum registro neste recorte.',...headers.slice(1).map(()=> '—')]);else rows.forEach(row=>draw(row));doc.moveDown(.5);
 };
 doc.font('Helvetica-Bold').fontSize(23).fillColor(ink).text('MARCELL');
 doc.font('Helvetica').fontSize(10).fillColor(muted).text('Engenharia | Portal do cliente');doc.moveDown();
 heading('Prestação de contas da obra');paragraph(`${report.projectName}\n${portalPeriod(report.month)} | ${portalDate(report.start)} a ${portalDate(report.asOf)}`);
 if(report.simulation)paragraph('SIMULAÇÃO LOCAL - valores e documentos fictícios. Nenhuma cobrança foi emitida ou mensagem enviada.');
 if(report.partial)paragraph('Período em andamento: os valores podem mudar.');
 heading('Gastos por categoria');table(['Categoria','Custo registrado','Pagamentos'],report.categories.map(row=>[portalCategory(row.category),amount(row.recognized),amount(row.paid)]),[width*.48,width*.26,width*.26]);
 paragraph(`Total registrado: ${amount(report.recognized)}. Pagamentos no período: ${amount(report.paid)}. Pagamentos podem liquidar custos de outros meses e não devem ser somados novamente ao custo.`);
 heading('Equipe e reservas');
 table(['Composição','Valor'],[['Custo registrado da equipe',amount(report.workforce?.recognized)],['Encargos complementares previstos',amount(report.workforce?.additionalCharges)],['Reserva adicional prevista',amount(report.workforce?.additionalReserve)],['Repasse previsto de todos os custos + complementos',amount(report.passThrough)]],[width*.72,width*.28]);
 paragraph('EPI, uniformes e exames admissionais/demissionais são compras ou despesas reais da obra; não compõem reserva automática. O complemento desconta reservas e encargos já incluídos no custo.');
 heading('Taxa de administração');
 table(['Composição','Valor'],[['Taxa contratual',report.administration?.rate==null?'Não disponível':`${report.administration.rate}%`],['Base prevista',amount(report.administration?.base)],['Administração prevista',amount(report.administration?.calculated)],['Já emitida como administração',amount(report.administration?.issued)],['Administração a emitir - estimativa',amount(report.administration?.toIssue)]],[width*.72,width*.28]);
 paragraph(`Incidência sobre equipamentos/locação: ${report.options.equipment?'incluída':'excluída'}. Engenharia de campo: ${report.options.fieldEngineering?'incluída':'excluída'}${report.options.fieldEngineeringCategory?`; categoria vinculada: ${report.options.fieldEngineeringCategory}`:'; categoria ainda não identificada'}. Estas opções alteram a taxa, preservando o custo da obra.`);
 heading('Cobranças emitidas no período');table(['Cobrança','Vencimento','Emitido','Em aberto'],report.charges.map(row=>[row.description,portalDate(row.dueDate,'A confirmar'),amount(row.amount),amount(row.balance)]),[width*.4,width*.2,width*.2,width*.2]);
 paragraph('A estimativa da administração não é uma cobrança emitida. O saldo acima é a posição de cada cobrança até a data da consulta; nada é emitido ou quitado por este relatório.');
 heading('Extrato do caixa da obra');
 if(report.cash){
  paragraph(`Saldo anterior: ${amount(report.cash.opening)} | Entradas: ${amount(report.cash.entries)} | Saídas: ${amount(report.cash.exits)} | Saldo final: ${amount(report.cash.closing)}`);
  table(['Data','Lançamento / nota fiscal','Entrada / saída','Saldo'],[...report.cash.movements].reverse().map(row=>[portalDate(row.date),`${row.description||'Movimento da obra'}${row.invoiceNumber?` | NF ${row.invoiceNumber}`:''}`,`${String(row.type).toLowerCase()==='aporte'?'+':'-'} ${amount(row.amount)}`,amount(row.balance)]),[width*.17,width*.4,width*.22,width*.21]);
 }else paragraph('Extrato não liberado para este acesso.');
 heading('Notas fiscais e anexos');table(['Nota / fornecedor','Valor líquido','Anexos liberados'],report.invoices.map(row=>[`${row.number||'Sem número'} | ${row.supplierName||'Fornecedor'}`,amount(row.netAmount??row.grossAmount),row.documents?.map(doc=>doc.title).join('\n')||'Sem anexo liberado']),[width*.42,width*.23,width*.35]);
 paragraph('Os anexos originais são consultados em Compras e notas fiscais no portal autenticado. Este PDF lista os documentos e não comprova pagamento ou autenticidade fiscal.');
 if(report.limitations.length){heading('Pontos para conferência');report.limitations.forEach(paragraph);}
 heading('Contato do financeiro');paragraph(`${report.channels.email} | WhatsApp (81) 98975-1300. Entrega automática não ativada nesta revisão local.`);
 const pages=doc.bufferedPageRange();for(let i=0;i<pages.count;i++){doc.switchToPage(i);const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;doc.font('Helvetica').fontSize(8).fillColor(muted).text(`MARCELL | ${report.month} | Página ${i+1} de ${pages.count}`,42,doc.page.height-36,{width,align:'right',lineBreak:false});doc.page.margins.bottom=bottom;}
 doc.end();return result;
}

export function createStatementEmail(report,recipient,pdf){
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient))throw new Error('Destinatário inválido.');
 const boundary='marcell_statement_boundary',subject=Buffer.from(`Prestação de contas - ${report.projectName} - ${report.month}`).toString('base64');
 const body=`Olá! Segue a prestação de contas de ${report.month}. Confira o PDF e o extrato. Este arquivo é um rascunho local; nenhuma mensagem foi enviada. Financeiro MARCELL: ${report.channels.email}.`;
 return [`From: ${report.channels.email}`,`To: ${recipient}`,`Subject: =?UTF-8?B?${subject}?=`,'X-Unsent: 1','MIME-Version: 1.0',`Content-Type: multipart/mixed; boundary="${boundary}"`,'',`--${boundary}`,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',Buffer.from(body).toString('base64'),`--${boundary}`,'Content-Type: application/pdf',`Content-Disposition: attachment; filename="prestacao-contas-${report.month}.pdf"`,'Content-Transfer-Encoding: base64','',pdf.toString('base64').match(/.{1,76}/g).join('\r\n'),`--${boundary}--`,''].join('\r\n');
}
