// @vitest-environment jsdom
// Executa os hooks reais da TelaPonto sem carregar CameraX/TFLite no Node.
// Somente a árvore JSX é omitida; eventos, timers e funções vêm do arquivo real.
import {createRequire} from 'node:module';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {FASE,falhaNaTela,fusoDoCadastro,falaDeConfirmacao} from './apresentacao.js';
import {resumoCadastro} from './cadastro.js';
import {estadoPermissaoCamera,mensagemParaTrabalhador} from './falhas.js';
import {PARAMETROS_FACIAIS as P} from './calibracao.js';
import {RESULTADO as RESULTADO_CALIBRACAO} from './calibracao-campo.js';
import {capturarFotoComPrazo} from './captura-camera.js';

// O teste roda no React DOM do repositório, não no React Native do app.
// Após npm ci no app, a resolução relativa encontraria React 19, enquanto
// react-dom continuaria vindo da raiz (React 18). Mantenha o par da raiz.
const requireRoot=createRequire(path.resolve('package.json'));
const React=requireRoot('react');
const {act}=React;
const {createRoot}=requireRoot('react-dom/client');

let root,container,latest,app,photo,analyse,record,remove,props;
const source=readFileSync('apps/ponto-obra/src/telas/TelaPonto.js','utf8');
const logic=source.slice(source.indexOf('const CAMERA_ESPERA_MAX_MS'),source.indexOf('  if (fluxo.etapa === "sucesso")')).replace('export default function TelaPonto','function TelaPonto');
const granted={granted:true,canAskAgain:true};
beforeEach(async()=>{
 vi.useFakeTimers();globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const listeners=new Set();app={currentState:'active',addEventListener:(_,fn)=>{listeners.add(fn);return {remove:()=>listeners.delete(fn)}},emit(state){this.currentState=state;for(const fn of listeners)fn(state);}};
 photo=vi.fn().mockResolvedValue({uri:'qa-photo'});analyse=vi.fn().mockResolvedValue({vetor:[1],giro:0});record=vi.fn().mockResolvedValue({nome:'QA',marcadoEm:'2026-11-04T17:00:00Z',horaConfiavel:true});remove=vi.fn();
 props={modelos:{modelo:'qa'},cadastro:{funcionarios:[{id:'e',nome:'QA'}],biometrias:[{employeeId:'e',modelo:'qa',vetor:[1]}]},relogio:{agora:()=>({marcadoEmMs:Date.now()})},registrar:record,situacao:{online:true},abrirEncarregado:vi.fn()};
 const env={...React,AppState:app,useCameraPermissions:()=>[granted,vi.fn()],estadoPermissaoCamera,mensagemParaTrabalhador,resumoCadastro,FASE,falhaNaTela,fusoDoCadastro,falaDeConfirmacao,P,RESULTADO_CALIBRACAO,capturarFotoComPrazo,analisarFoto:analyse,identificar:()=>({reconhecido:true,employeeId:'e',confianca:1}),apagarFotoLocal:remove,brilhoNormal:vi.fn(),brilhoMaximo:vi.fn(),falar:vi.fn(),vibrar:vi.fn(),duracaoDoComprovante:()=>3000,probe:value=>{latest=value;}};
 const Component=new Function(...Object.keys(env),`${logic}\n probe({terminalAtivo,fluxo,camera,aoCameraPronta,baterPonto,ativarTerminal});return null;} return TelaPonto;`)(...Object.values(env));
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
 await act(async()=>root.render(React.createElement(Component,props)));latest.camera.current={takePictureAsync:photo};
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.useRealTimers();});
const advance=ms=>act(async()=>{await vi.advanceTimersByTimeAsync(ms);});
const state=value=>act(async()=>app.emit(value));
describe('ciclo da câmera do terminal autônomo',()=>{
 it('não desmonta a câmera em uma interrupção breve do Android e retoma a captura',async()=>{
  await act(async()=>latest.aoCameraPronta());await advance(200);await state('background');
  expect(latest.terminalAtivo).toBe(true);await advance(100);await state('active');
  expect(latest.terminalAtivo).toBe(true);await advance(800);expect(photo).toHaveBeenCalledTimes(1);expect(record).toHaveBeenCalledTimes(1);
 });
 it('desliga a câmera em background persistente e não captura com o app oculto',async()=>{
  await act(async()=>latest.aoCameraPronta());await state('background');await advance(1000);
  expect(latest.terminalAtivo).toBe(false);expect(photo).not.toHaveBeenCalled();expect(record).not.toHaveBeenCalled();
 });
 it('eventos repetidos de câmera pronta geram só uma batida',async()=>{
  await act(async()=>{latest.aoCameraPronta();latest.aoCameraPronta();});await advance(800);expect(photo).toHaveBeenCalledTimes(1);expect(record).toHaveBeenCalledTimes(1);
 });
 it('captura que não responde termina com falha visível e sem fabricar batida',async()=>{
  photo.mockImplementation(()=>new Promise(()=>{}));await act(async()=>latest.aoCameraPronta());await advance(10000);
  expect(latest.fluxo.etapa).toBe('falha');expect(record).not.toHaveBeenCalled();
 });
 it('não fica tentando novamente sozinho após falha e evento transitório de atividade',async()=>{
  photo.mockRejectedValue(new Error('camera'));await act(async()=>latest.aoCameraPronta());await advance(800);
  expect(latest.fluxo.etapa).toBe('falha');await state('background');await advance(100);await state('active');await advance(1000);
  expect(latest.fluxo.etapa).toBe('falha');expect(latest.terminalAtivo).toBe(false);expect(photo).toHaveBeenCalledTimes(1);expect(record).not.toHaveBeenCalled();
 });
 it('volta de suspensão real exige novo sinal de câmera pronta antes de fotografar',async()=>{
  await act(async()=>latest.aoCameraPronta());await state('background');await advance(1000);await state('active');await advance(1000);
  expect(photo).not.toHaveBeenCalled();await act(async()=>latest.aoCameraPronta());await advance(800);expect(record).toHaveBeenCalledTimes(1);
 });
 it('foto que chega depois do prazo é descartada e não registra uma tentativa vencida',async()=>{
  let finish;photo.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));await act(async()=>latest.aoCameraPronta());await advance(10000);
  await act(async()=>finish({uri:'late-photo'}));expect(remove).toHaveBeenCalledWith('late-photo');expect(analyse).not.toHaveBeenCalled();expect(record).not.toHaveBeenCalled();
 });
 it('interrupções curtas repetidas não adiam indefinidamente a captura',async()=>{
  await act(async()=>latest.aoCameraPronta());
  for(let i=0;i<3;i++){await advance(200);await state('background');await advance(100);await state('active');}
  await advance(100);expect(record).toHaveBeenCalledTimes(1);
 });
});
