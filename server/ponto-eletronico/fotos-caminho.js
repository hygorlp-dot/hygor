// Caminho das fotos do Ponto de Obra no bucket privado (Supabase Storage).
// Fonte ÚNICA: o servidor grava com estas funções e o backup
// (scripts/backup-ponto/) usa as mesmas para conferir banco x Storage.
export const BUCKET_FOTOS_PONTO = "ponto-obra";

// marcadoEm como o PostgREST devolve (ISO em UTC): a data do caminho é a
// data UTC da marcação. Quem lê direto do banco normaliza antes
// (new Date(x).toISOString()).
export const caminhoFotoMarcacao = (obraId, marcadoEm, id) => `marcacoes/${obraId}/${String(marcadoEm).slice(0, 10)}/${id}.jpg`;
export const caminhoFotoCadastro = (employeeId, biometriaId, i) => `biometria/${employeeId}/${biometriaId}-${i + 1}.jpg`;
