// Ambiente do servidor do ponto: "producao" (padrão) ou "homologacao".
//
// O endereço do servidor NÃO prova isolamento: uma URL de preview da Vercel
// pode usar o banco de produção. Por isso a homologação só vale quando o
// PRÓPRIO BANCO a declara - a tabela marcadora arcd_ambiente, criada apenas
// pelo provisionamento da homologação (scripts/homologacao/), que recusa
// bancos com cara de produção. Regras:
//   - PONTO_AMBIENTE ausente ou "producao": produção, sem consulta nenhuma
//     (comportamento de sempre);
//   - PONTO_AMBIENTE="homologacao": só com o marcador no banco; sem ele,
//     TODAS as ações do ponto ficam bloqueadas (503) - nunca gravar batida
//     de homologação num banco que pode ser o de produção;
//   - qualquer outro valor: bloqueado (configuração errada não vira produção).
export const AMBIENTES = Object.freeze(["producao", "homologacao"]);
export const TABELA_MARCADOR = "arcd_ambiente";

export function criarAmbiente({ db, declarado }) {
  const valor = declarado === undefined || declarado === null || String(declarado).trim() === "" ? "producao" : String(declarado).trim().toLowerCase();
  let confirmado = null;              // marcador lido uma vez por instância (não muda em execução)
  return async function ambiente() {
    if (!AMBIENTES.includes(valor)) return { erro: "PONTO_AMBIENTE com valor desconhecido." };
    if (valor === "producao") return { ambiente: "producao" };
    if (confirmado) return { ambiente: confirmado };
    let marcador = null;
    try {
      const { data, error } = await db.from(TABELA_MARCADOR).select("ambiente").eq("id", true).maybeSingle();
      if (!error) marcador = data?.ambiente || null;
    } catch { marcador = null; }
    if (marcador !== "homologacao") {
      return { erro: "Servidor configurado como homologação, mas o banco não tem o marcador de homologação (pode ser o banco de produção)." };
    }
    confirmado = "homologacao";
    return { ambiente: confirmado };
  };
}

export const NOME_AMBIENTE = { producao: "PRODUÇÃO", homologacao: "HOMOLOGAÇÃO (não oficial)" };
