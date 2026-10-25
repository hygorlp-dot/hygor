// Verifica a saída de aapt dump permissions do APK pronto. A configuração
// anterior ao build não basta: dependências também entram no manifesto.
export function conferirPermissoesApk(saidaAapt, bloqueadas) {
  const permissoes = [...new Set([...String(saidaAapt).matchAll(/^uses-permission(?:-sdk-\d+)?:\s+name=['"]([^'"]+)['"]/gm)].map(m => m[1]))].sort();
  const obrigatorias = ["android.permission.CAMERA", "android.permission.ACCESS_FINE_LOCATION"];
  const ausentes = obrigatorias.filter(p => !permissoes.includes(p));
  const indevidas = bloqueadas.filter(p => permissoes.includes(p));
  if (ausentes.length) throw new Error(`APK sem permissões necessárias: ${ausentes.join(", ")}.`);
  if (indevidas.length) throw new Error(`APK contém permissões bloqueadas: ${indevidas.join(", ")}.`);
  return permissoes;
}
