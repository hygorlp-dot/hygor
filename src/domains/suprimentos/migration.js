import { defaultSupplySettings } from "./calculations";

// Migração em memória deliberadamente idempotente para o documento legado.
// Não cria fatos, nem IDs aleatórios, nem reescreve snapshots aprovados.
export const migrateSupplyData = incoming => {
  const data = incoming && typeof incoming === "object" ? incoming : {};
  const settings = data.suprimentosConfig && typeof data.suprimentosConfig === "object" ? data.suprimentosConfig : {};
  const defaults = defaultSupplySettings();
  return {
    ...data,
    schemaVersion:Math.max(Number(data.schemaVersion || 0), 4),
    suprimentosConfig:{ ...defaults, ...settings, abc:{ ...defaults.abc, ...(settings.abc || {}) }, calendario:{ ...defaults.calendario, ...(settings.calendario || {}) }, perfisLeadTime:Array.isArray(settings.perfisLeadTime) && settings.perfisLeadTime.length ? settings.perfisLeadTime : defaults.perfisLeadTime, alertasDias:Array.isArray(settings.alertasDias) ? settings.alertasDias : defaults.alertasDias },
    curvaAbcSnapshots:Array.isArray(data.curvaAbcSnapshots) ? data.curvaAbcSnapshots : [],
    planosSuprimento:Array.isArray(data.planosSuprimento) ? data.planosSuprimento : [],
    marcosSuprimento:Array.isArray(data.marcosSuprimento) ? data.marcosSuprimento : [],
    alertasSuprimento:Array.isArray(data.alertasSuprimento) ? data.alertasSuprimento : [],
    reservasEstoque:Array.isArray(data.reservasEstoque) ? data.reservasEstoque : [],
  };
};
