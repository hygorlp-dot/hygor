// Caminho das fotos do Ponto de Obra no bucket privado (Supabase Storage).
// Fonte ÚNICA: o servidor grava com estas funções e o backup
// (scripts/backup-ponto/) usa as mesmas para conferir banco x Storage.
export const BUCKET_FOTOS_PONTO = "ponto-obra";

// A data do caminho é a data UTC da marcação, qualquer que seja o formato
// recebido (PostgREST, to_jsonb, Date): normalizar aqui - e não em quem
// chama - impede que um fuso diferente no banco faça o servidor gravar num
// caminho e o backup procurar noutro. Com o banco em UTC (padrão do
// Supabase) o resultado é o mesmo de antes.
const dataUtc = marcadoEm => {
  const d = new Date(marcadoEm);
  return Number.isNaN(d.getTime()) ? String(marcadoEm).slice(0, 10) : d.toISOString().slice(0, 10);
};
export const caminhoFotoMarcacao = (obraId, marcadoEm, id) => `marcacoes/${obraId}/${dataUtc(marcadoEm)}/${id}.jpg`;
export const caminhoFotoCadastro = (employeeId, biometriaId, i) => `biometria/${employeeId}/${biometriaId}-${i + 1}.jpg`;
