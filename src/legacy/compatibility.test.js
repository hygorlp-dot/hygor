import {describe,expect,it} from 'vitest';
import * as legacy from '../LegacyApp.jsx';
import * as palette from './palette.js';
import * as ui from './ui.jsx';
import * as format from './format.js';
import * as files from './files.js';
import * as financial from '../domains/financeiro/legacy-calculations.js';

describe('compatibilidade das extrações da entrada legada',()=>{
 it('mantém a mesma instância de constantes e componentes para consumidores antigos',()=>{
  for(const name of ['C','TYPO','KB','C_ARCD_SETOR'])expect(legacy[name],name).toBe(palette[name]);
  for(const name of ['Btn','Inp','Sel','Modal','Badge','Ic','PageHero','TabRow','Bloco'])expect(legacy[name],name).toBe(ui[name]);
 });
 it('mantém as funções públicas de formatação, arquivos e projeção de contrato',()=>{
  for(const name of ['today','uid','fmt','fmtDate','fmtDateFull','escapeHtml','maiusculoOrcamento','obraContextoSalvo'])expect(legacy[name],name).toBe(format[name]);
  for(const name of ['carregarXLSX','lerSinapiEmSegundoPlano','comprimirImagem'])expect(legacy[name],name).toBe(files[name]);
  expect(legacy.calcProjecaoContratoObra).toBe(financial.calcProjecaoContratoObra);
 });
});
