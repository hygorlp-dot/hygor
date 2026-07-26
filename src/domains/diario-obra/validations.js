import { DAILY_LOG_STATUS } from "./constants.js";
export const validateDailyLog=(log={})=>{const errors=[];if(!log.id||!log.obraId||!/^\d{4}-\d{2}-\d{2}$/.test(String(log.data||"")))errors.push("Diário exige identificação, obra e data.");if(log.status&&!Object.values(DAILY_LOG_STATUS).includes(log.status))errors.push("Status de diário inválido.");return {ok:!errors.length,errors};};
