import * as SecureStore from 'expo-secure-store';
import {criarProtecaoPin} from '../logica/pin.js';
const CHAVE='ponto_protecao_pin_v1';
export const protecaoPin=criarProtecaoPin({
  ler:()=>SecureStore.getItemAsync(CHAVE),
  gravar:valor=>SecureStore.setItemAsync(CHAVE,valor),
});
