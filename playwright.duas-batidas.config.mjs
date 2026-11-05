import base from './playwright.rh-readiness.config.js';
export default {...base,testMatch:['ponto-duas-batidas.spec.js','ponto-duplicidade.spec.js'],use:{...base.use,baseURL:'http://127.0.0.1:42879'},webServer:{...base.webServer,command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 42879 --strictPort',url:'http://127.0.0.1:42879'}};
