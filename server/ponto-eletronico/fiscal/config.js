import { ErroFiscal } from "./campos.js";

// Configuração do desenvolvedor é distinta da identificação do empregador.
// Não há valores padrão de CNPJ/INPI e não se modifica o cadastro do ERP.
export function lerConfiguracaoFiscal(ambiente = process.env) {
  if (!ambiente.PONTO_FISCAL_CONFIG_JSON) return null;
  try {
    const config = JSON.parse(ambiente.PONTO_FISCAL_CONFIG_JSON);
    if (!config || typeof config !== "object" || Array.isArray(config)) throw Error();
    return config;
  } catch { throw new ErroFiscal("CONFIGURACAO_FISCAL_INVALIDA"); }
}
