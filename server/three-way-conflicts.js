const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
const object=value=>Boolean(value)&&typeof value==="object"&&!Array.isArray(value);
const identifiableRows=value=>Array.isArray(value)&&value.every(item=>object(item)&&item.id!=null);
const rows=value=>identifiableRows(value)?value:[];

// Achado ao verificar o cenário real da correção abaixo (31/08/2026):
// praticamente todo comando de escrita deste app carimba um "quem/quando
// mexeu por último" (`updatedAt:new Date().toISOString()`, mesmo padrão em
// dezenas de domínios - orçamento, equipamentos, compras...) a cada save,
// inclusive quando o campo de negócio alterado é outro completamente
// diferente. Sem esta lista, DUAS pessoas fazendo edições genuinamente
// independentes (ex.: cada uma mexendo num item diferente do mesmo
// orçamento) ainda colidiriam - não mais no conteúdo, mas no timestamp em
// si, que é sempre diferente entre dois saves reais. Estes campos nunca
// carregam intenção do usuário que valha a pena proteger de sobrescrita -
// são metadado SOBRE outras mudanças, não a mudança em si; a mudança real
// que os acompanha continua sendo comparada normalmente.
const BOOKKEEPING_KEYS=new Set([
  "updatedAt","atualizadoEm","updatedById","updatedBy","atualizadoPor","atualizadoPorId",
]);

/**
 * Achado real (31/08/2026, relato de "orçamento não salva quando lanço um
 * item"): esta função comparava o REGISTRO INTEIRO (JSON completo) por
 * `id`, então duas pessoas mudando CAMPOS ou ITENS diferentes do MESMO
 * orçamento (ex.: uma adiciona um item em `itens`, outra edita a
 * quantidade de um item DIFERENTE no mesmo array) já bastava para os dois
 * objetos completos divergirem e um conflito de verdade nunca ter
 * acontecido ser sinalizado - mesmo sem nenhuma colisão real de campo. O
 * `mergeThreeWay` (three-way-merge.js) já resolve isso corretamente campo
 * a campo, item a item, mas nunca chegava a rodar: `findSectionConflicts`
 * roda ANTES e barra com 409 sempre que acha esse tipo de divergência
 * grosseira - o merge fino nunca tinha chance de mostrar que não havia
 * conflito nenhum.
 *
 * `findValueConflicts` conserta isso espelhando a MESMA árvore de decisão
 * de `mergeThreeWay`, ramo a ramo, na mesma ordem - a leitura correta é:
 * "aqui existe conflito real exatamente nos pontos em que o merge teria
 * que escolher arbitrariamente entre o que o requerente pediu e o que já
 * está gravado, porque os dois mudaram o MESMO valor-folha para coisas
 * diferentes". Isso preserva as mesmas regras de negócio deliberadas que
 * o merge já aplica sem perguntar (nunca ressuscitar um registro excluído
 * por outro cliente, preservar registros/seções nunca vistos pelo
 * cliente) - a única mudança real é que a checagem agora DESCE pela
 * mesma árvore em vez de comparar o objeto inteiro de uma vez.
 */
const findValueConflicts=(base,incoming,current,path)=>{
  if(same(incoming,base))return [];   // requerente não mudou nada aqui - merge usa `current`, nada se perde
  if(same(current,base))return [];    // servidor não mudou nada aqui - merge usa `incoming`, nada se perde
  // os dois mudaram a partir da MESMA base - só agora vale a pena olhar
  // mais de perto (mesma guarda que existia no nível do registro inteiro,
  // agora aplicada recursivamente a cada nível da árvore).
  if(identifiableRows(base)&&identifiableRows(incoming)&&identifiableRows(current)){
    const baseById=new Map(base.map(item=>[String(item.id),item]));
    const incomingById=new Map(incoming.map(item=>[String(item.id),item]));
    const currentById=new Map(current.map(item=>[String(item.id),item]));
    const ids=new Set([...baseById.keys(),...incomingById.keys(),...currentById.keys()]);
    return [...ids].flatMap(id=>{
      const original=baseById.get(id),requested=incomingById.get(id),stored=currentById.get(id);
      // Requerente excluiu; se o servidor mudou este item nesse meio
      // tempo, o merge mantém a versão do servidor (não ressuscita a
      // exclusão) - é uma escolha real entre duas intenções, sinaliza.
      if(original&&!requested)return same(stored,original)?[]:(stored?[[...path,id]]:[]);
      // Nunca existiu para o requerente nem no base - o servidor só tem
      // algo que o requerente nunca viu; nada da intenção dele se perde.
      if(!requested)return [];
      // Servidor excluiu; se o requerente também não tinha mudado nada
      // (ainda igual ao base), não há intenção real perdida ao respeitar
      // a exclusão. Se ele editou de verdade, é uma colisão real.
      if(!stored)return original&&!same(requested,original)?[[...path,id]]:[];
      return findValueConflicts(original,requested,stored,[...path,id]);
    });
  }
  if(object(incoming)&&object(current)){
    const keys=new Set([...Object.keys(base||{}),...Object.keys(incoming),...Object.keys(current)]);
    return [...keys].flatMap(key=>BOOKKEEPING_KEYS.has(key)
      ?[]:findValueConflicts(base?.[key],incoming[key],current[key],[...path,key]));
  }
  // Folha (ou tipos diferentes de um lado pro outro, ou array não
  // identificável por id) - os dois mudaram e não dá pra descer mais: se
  // ainda assim chegaram no mesmo valor, não é conflito de verdade.
  return same(incoming,current)?[]:[path];
};

export {findValueConflicts};

/**
 * A mesclagem de três vias ainda é útil para coleções independentes, mas dois
 * autores nunca devem ter mudanças combinadas silenciosamente no mesmo fato.
 * O contrato retorna apenas conflitos de agregados identificados por `id`
 * (o primeiro segmento do caminho encontrado por findValueConflicts é
 * sempre o id da linha, por construção do ramo de array acima).
 */
export const findAggregateConflicts=(base,incoming,current,section="")=>{
  const before=rows(base),requested=rows(incoming),stored=rows(current);
  if(!before.length&&!requested.length&&!stored.length)return [];
  const ids=new Set(findValueConflicts(before,requested,stored,[]).map(path=>String(path[0])));
  return [...ids].map(id=>({section,id}));
};

export const findSectionConflicts=(baseSections={},incomingSections={},currentSections={},keys=Object.keys(incomingSections||{}))=>
  (keys||[]).flatMap(section=>findAggregateConflicts(baseSections?.[section],incomingSections?.[section],currentSections?.[section],section));
