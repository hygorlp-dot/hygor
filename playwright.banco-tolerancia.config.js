import base from './playwright.banco-horas.config.js';
export default {...base,testMatch:['banco-horas-almoco.spec.js','banco-horas-tolerancia.spec.js'],use:{...base.use,baseURL:'http://127.0.0.1:42889'},webServer:{...base.webServer,command:'npx vite --host 127.0.0.1 --port 42889 --strictPort',url:'http://127.0.0.1:42889'}};
