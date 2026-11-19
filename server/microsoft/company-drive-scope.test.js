import {describe,it,expect,vi} from 'vitest';
import {assertDriveItemInCompanyRoot,driveItemFromGraphPath} from './company-drive-scope.js';
const root={id:'mrc-root',parentReference:{driveId:'shared-drive'}};
describe('fronteira da pasta Microsoft por empresa',()=>{
  it('recusa outra pasta no mesmo drive antes de qualquer operação',async()=>{
    const readParent=vi.fn(async id=>({parentReference:{id:id==='file'?'arcd-root':null}}));
    await expect(assertDriveItemInCompanyRoot({driveId:'shared-drive',itemId:'file',root,readParent})).rejects.toMatchObject({status:403});
  });
  it('aceita descendente comprovado e recusa drive diferente sem consultar',async()=>{
    const readParent=vi.fn(async()=>({parentReference:{id:'mrc-root'}}));
    await expect(assertDriveItemInCompanyRoot({driveId:'shared-drive',itemId:'file',root,readParent})).resolves.toBe(true);
    readParent.mockClear();
    await expect(assertDriveItemInCompanyRoot({driveId:'other',itemId:'file',root,readParent})).rejects.toMatchObject({status:403});expect(readParent).not.toHaveBeenCalled();
  });
  it('não aceita ciclos ou raiz ausente',async()=>{
    await expect(assertDriveItemInCompanyRoot({driveId:'shared-drive',itemId:'file',root,readParent:async()=>({parentReference:{id:'file'}})})).rejects.toMatchObject({status:403});
    await expect(assertDriveItemInCompanyRoot({driveId:'shared-drive',itemId:'file',root:null})).rejects.toMatchObject({status:403});
  });
  it('extrai o ancestral real antes do caminho de criação e de conteúdo',()=>{
    expect(driveItemFromGraphPath('/drives/d/items/root:/folder/file:/content')).toEqual({driveId:'d',itemId:'root'});
    expect(driveItemFromGraphPath('/drives/d/items/file/content')).toEqual({driveId:'d',itemId:'file'});
    expect(driveItemFromGraphPath('/shares/link/driveItem')).toBeNull();
  });
});
