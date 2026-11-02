import {readRealFinanceData} from './finance-real-data-source.mjs';
import {buildFinancialLedger} from '../src/domains/financeiro/ledger.js';
import {documentRegister} from '../src/domains/financeiro/document-register.js';
import {financialEntry,todayQueues} from '../src/domains/financeiro/workspace.js';
import {financialDocumentUrl} from '../src/domains/financeiro/document-links.js';

const {data,canonical}=await readRealFinanceData(),ledger=buildFinancialLedger(data,{supplementalEvents:canonical.events});
const collections=['obras','notasFiscais','medicoes','outrasDesp','despesasEmpresa','pedidos','documentosMovimentacoes'];
const docs=documentRegister(data);
const events=ledger.events.filter(e=>['cost','revenue'].includes(e.effect));
const missingSources=events.map(e=>financialEntry(data,e)).filter(e=>!e.record);
const shape=Object.fromEntries(collections.map(k=>[k,{count:(data[k]||[]).length,fields:[...new Set((data[k]||[]).flatMap(Object.keys))].sort()}]));
const legacyDocuments=Object.fromEntries(collections.map(k=>[k,(data[k]||[]).filter(r=>Object.entries(r).some(([key,v])=>/url|anexo|comprovante|arquivo/i.test(key)&&typeof v==='string'&&financialDocumentUrl(v))).length]));
const queue=todayQueues(data,ledger,'all',new Date().toISOString().slice(0,10));
console.log(JSON.stringify({shape,legacyDocuments,events:events.length,missingSourceTypes:[...new Set(missingSources.map(e=>e.sourceType))],missingSourceCount:missingSources.length,documents:docs.length,documentIssues:Object.fromEntries(['review','missing','work','category','duplicate','mismatch'].map(k=>[k,docs.filter(d=>d.issues.includes(k)).length])),undatedTitles:queue.find(q=>q.id==='undated').items.length},null,2));
