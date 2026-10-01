package br.com.arcd.relogioconfiavel

import android.os.SystemClock
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Hora confiável do app Ponto de Obra (Portaria 671/2021).
//
// O relógio "de parede" (System.currentTimeMillis) pode ser mudado pelo
// usuário. SystemClock.elapsedRealtime() só anda para frente desde o boot e
// não muda com ajuste de hora - o app soma esse decorrido à hora do servidor
// (ver src/domains/ponto-eletronico/relogio.js). O monotônico zera a cada
// boot; BOOT_COUNT identifica o boot para o app saber se a referência ainda vale.
class RelogioConfiavelModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RelogioConfiavel")

    // Lidos no mesmo instante, para a diferença entre eles ser coerente.
    Function("agora") {
      val resolver = appContext.reactContext?.contentResolver
      val boot = resolver?.let { Settings.Global.getInt(it, Settings.Global.BOOT_COUNT, -1) } ?: -1
      mapOf(
        "monotonicoMs" to SystemClock.elapsedRealtime().toDouble(),
        "relogioParedeMs" to System.currentTimeMillis().toDouble(),
        "bootId" to "boot-$boot"
      )
    }

    // Só informativo (auditoria): a batida usa a hora do servidor de qualquer jeito.
    Function("horaAutomaticaAtiva") {
      val resolver = appContext.reactContext?.contentResolver
      resolver?.let { Settings.Global.getInt(it, Settings.Global.AUTO_TIME, 0) == 1 } ?: false
    }

    // Prende o app na tela. Com o aparelho gerenciado (Android Management API,
    // modo quiosque) entra direto; sem isso o Android pede confirmação de
    // "fixar app".
    Function("fixarNaTela") {
      val atividade = appContext.currentActivity ?: return@Function false
      atividade.runOnUiThread { runCatching { atividade.startLockTask() } }
      true
    }
  }
}
