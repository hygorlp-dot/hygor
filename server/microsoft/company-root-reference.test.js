import {describe,it,expect} from 'vitest';
import {personalRootReference,sameRootReference} from './company-root-reference.js';
describe('referência da raiz privada pessoal',()=>{
  it.each([
    'https://onedrive.live.com.evil.invalid/?cid=A55D2E2D0945F9E2&id=A55D2E2D0945F9E2!s123',
    'http://onedrive.live.com/?cid=A55D2E2D0945F9E2&id=A55D2E2D0945F9E2!s123',
    'https://onedrive.live.com/?cid=A55D2E2D0945F9E2&id=B55D2E2D0945F9E2!s123',
    'https://onedrive.live.com/?cid=A55D2E2D0945F9E2&id=A55D2E2D0945F9E2!../other',
    'https://onedrive.live.com/?cid=A55D2E2D0945F9E2&id=A55D2E2D0945F9E2!s123&id=other',
    'https://user@onedrive.live.com/?cid=A55D2E2D0945F9E2&id=A55D2E2D0945F9E2!s123',
    'https://1drv.ms/f/legacy',undefined,
  ])('não interpreta URL ambígua ou de compartilhamento como ID: %s',url=>expect(personalRootReference(url)).toBeNull());
  it('não considera raízes distintas equivalentes',()=>{
    expect(sameRootReference('https://1drv.ms/arcd','https://1drv.ms/mrc')).toBe(false);
  });
});
