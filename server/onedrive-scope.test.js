import {describe,expect,it} from 'vitest';
import {findScopedWork} from './onedrive-scope.js';
const a={id:'a',name:'Obra A',oneDriveDriveId:'shared-drive'};
const b={id:'b',name:'Obra B',oneDriveDriveId:'shared-drive'};
const context={user:{role:'admin'},payload:{obras:[a,b]}};
describe('destino de documentos no OneDrive',()=>{
  it('resolve por ID e por nome existentes',()=>{
    expect(findScopedWork(context,{obraId:'b',driveId:'shared-drive'})).toEqual(b);
    expect(findScopedWork(context,{obraName:'Obra B',driveId:'shared-drive'})).toEqual(b);
  });
  it('não redireciona um nome desatualizado para a primeira obra no mesmo drive',()=>{
    expect(findScopedWork(context,{obraName:'Nome antigo da obra',driveId:'shared-drive'})).toBeNull();
  });
  it('não substitui ID negado por outro seletor autorizado',()=>{
    const scoped={...context,user:{role:'engenheiro',obraId:'a'}};
    expect(findScopedWork(scoped,{obraId:'b',obraName:'Obra A',driveId:'shared-drive'})).toBeNull();
    expect(findScopedWork(scoped,{obraName:'Obra B',driveId:'shared-drive'})).toBeNull();
  });
  it('drive compartilhado não identifica uma obra sozinho',()=>{
    expect(findScopedWork(context,{driveId:'shared-drive'})).toBeNull();
    expect(findScopedWork({...context,user:{role:'engenheiro',obraId:'b'}},{driveId:'shared-drive'})).toEqual(b);
  });
});
