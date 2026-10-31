import { podeAcessarAba } from "../src/domains/administracao/abas-acesso.js";
import { engineeringProjectForCommand, ENGINEERING_COMMAND } from "../src/domains/projetos/commands.js";

export function validateEngineeringScope({ user = {}, data = {}, command = {} }) {
  if (!podeAcessarAba(user, "projetos")) return { ok: false, error: "Seu perfil não tem acesso aos projetos de engenharia." };
  const current = engineeringProjectForCommand(data, command);
  if (!current && command.type !== ENGINEERING_COMMAND.ENG_PROJECT_SAVED) return { ok: false, error: "Projeto não encontrado ou indisponível para seu perfil." };
  const obraId = String(current?.obraId ?? command.payload?.project?.obraId ?? "");
  if (user.role !== "admin" && user.obraId && String(user.obraId) !== obraId) return { ok: false, error: "Este projeto está fora da obra autorizada para seu perfil." };
  if (obraId && !(data.obras || []).some(obra => obra.id === obraId)) return { ok: false, error: "Obra do projeto não encontrada." };
  return { ok: true, obraId, scope: obraId ? "work" : "company" };
}
