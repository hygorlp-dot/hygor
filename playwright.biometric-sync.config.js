import base from './playwright.rh-readiness.config.js';
export default {...base,testMatch:'biometric-sync.spec.js',use:{...base.use,baseURL:'http://127.0.0.1:42876'},
 webServer:{...base.webServer,command:'npx vite --host 127.0.0.1 --port 42876 --strictPort',url:'http://127.0.0.1:42876'}};
