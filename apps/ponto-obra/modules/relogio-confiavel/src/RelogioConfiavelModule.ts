import { NativeModule, requireNativeModule } from 'expo';

export type LeituraRelogio = { monotonicoMs: number; relogioParedeMs: number; bootId: string };

declare class RelogioConfiavelModule extends NativeModule<{}> {
  agora(): LeituraRelogio;
  horaAutomaticaAtiva(): boolean;
  fixarNaTela(): boolean;
}

export default requireNativeModule<RelogioConfiavelModule>('RelogioConfiavel');
