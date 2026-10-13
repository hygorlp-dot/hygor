// Feedback físico do aparelho de parede: vibração, voz e brilho.
// Tudo aqui é "melhor esforço": aparelho sem vibrador, sem voz em português
// ou que recuse o brilho segue normalmente. NADA aqui pode lançar - a batida
// nunca depende de feedback.
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import * as Brightness from "expo-brightness";

const seguro = async fn => { try { await fn(); } catch { /* feedback é opcional */ } };

// leve = rosto reconhecido; registro = ponto gravado; falha = falha crítica.
export const vibrar = tipo => seguro(() => {
  if (tipo === "leve") return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  if (tipo === "registro") return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  if (tipo === "falha") return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  return undefined;
});

// Fala curta em português; interrompe a fala anterior (pessoas em sequência).
export const falar = texto => seguro(async () => {
  await Speech.stop();
  Speech.speak(texto, { language: "pt-BR", rate: 1.0 });
});

// Brilho máximo só da janela do app (sem permissão de sistema) durante a
// captura - ajuda com sol forte e rosto escuro -, depois devolve ao sistema.
export const brilhoMaximo = () => seguro(() => Brightness.setBrightnessAsync(1));
export const brilhoNormal = () => seguro(() => Brightness.restoreSystemBrightnessAsync());
