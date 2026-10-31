const readActions={
 '/api/data':new Set(['profiles','auth-login','auth-refresh','load','financial-annual-dre-report','financial-dre-report','financial-company-dre-report','financial-management-report','financial-closing-preview','obras-custo-acumulado','labor-projection-report','financial-shadow-report','core-registry-report','equipment-registry-report','procurement-registry-report','attendance-registry-report','purchase-requests-report','list-quinzena-archives','load-quinzena-archive']),
 '/api/presence':new Set(['list','chat-list','ranking-list']),
 '/api/ai-agent':new Set(['status']),
 '/api/upload':new Set(['signed-url']),
 '/api/microsoft/onedrive':new Set(['status','file','file-link','list-folder']),
};
export function canReviewRequest(path,method,action){
 if(method==='GET')return path==='/api/microsoft/onedrive'&&action==='file';
 return method==='POST'&&Boolean(readActions[path]?.has(action));
}
// Algumas leituras do ERP tentam atualizar índices em segundo plano. A trava
// de saída também impede esses writes, além dos comandos bloqueados na entrada.
export function canReviewDatabaseRequest(path,method){
 if(['GET','HEAD'].includes(method))return true;
 return method==='POST'&&/^\/rest\/v1\/rpc\/auth_rate_limit_(?:status|success|failure)$/.test(path);
}
