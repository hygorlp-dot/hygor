import React from 'react';
import {createRoot} from 'react-dom/client';
import '../../src/index.css';
import {abrirSessao} from '../../src/api.js';
import RelatoriosObraView from '../../src/domains/ponto-eletronico/components/RelatoriosObraView.jsx';
abrirSessao('rh-sintetico','0000');
const data={employees:[{id:'p',name:'Pessoa sintética de conferência',workdayHours:8}],obras:[{id:'a',name:'Obra sintética A'},{id:'b',name:'Obra sintética B'}]};
document.body.dataset.theme='marcell-claro';
createRoot(document.getElementById('root')).render(<main className="arcd-main"><p>Cenário de validação local — dados sintéticos</p><RelatoriosObraView data={data} obraId="a" dia="2026-11-03" currentUser={{id:'rh-sintetico',role:'rh'}}/></main>);
