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
      val monotonico = SystemClock.elapsedRealtime()
      val parede = System.currentTimeMillis()
      val resolver = appContext.reactContext?.contentResolver
      val boot = resolver?.let { runCatching { Settings.Global.getInt(it, Settings.Global.BOOT_COUNT, -1) }.getOrDefault(-1) } ?: -1
      // Sem BOOT_COUNT (alguns fabricantes), o id do boot vira o instante
      // aproximado em que o aparelho ligou (parede - monotônico, em minutos).
      // Se alguém mudar a hora, esse id muda e a batida sai como "hora não
      // confiável" até sincronizar - erra para o lado seguro.
      val bootId = if (boot >= 0) "boot-$boot" else "inicio-" + ((parede - monotonico) / 60_000L)
      mapOf(
        "monotonicoMs" to monotonico.toDouble(),
        "relogioParedeMs" to parede.toDouble(),
        "bootId" to bootId
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
