// Permissão de escrita é independente da visibilidade das abas no navegador.
const WORK_FILE_WRITERS = new Set([
  'admin','engenheiro','engenheiro_auditor','compras','financeiro','rh','comercial',
]);

export const canWriteWorkFiles = user => !!user && user.active !== false && WORK_FILE_WRITERS.has(user.role);

export const WORK_FILE_WRITE_ACTIONS = new Set([
  'upload','upload-start','upload-chunk','create-folder','create-workspace',
]);
