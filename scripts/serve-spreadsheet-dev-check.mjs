import {createServer} from 'vite';

const server=await createServer({
 cacheDir:'node_modules/.vite-bundle-integration',
 server:{host:'127.0.0.1',port:4282,strictPort:true,hmr:false,watch:null},
});
await server.listen();
