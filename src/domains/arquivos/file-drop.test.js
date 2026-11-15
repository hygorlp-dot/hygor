import {expect,it} from 'vitest';
import {droppedFile,isFileDrag} from './file-drop.js';
it('rejeita diretório arrastado antes de abrir cadastro',()=>{expect(droppedFile({files:[],items:[{webkitGetAsEntry:()=>({isDirectory:true})}]}).error).toContain('Pastas não são aceitas');});
it('distingue texto arrastado de arquivo e não trata link como upload',()=>{expect(isFileDrag({types:['text/plain','text/uri-list']})).toBe(false);expect(isFileDrag({types:['Files']})).toBe(true);});
