// ═══════════════════════════════════════════════════════════════════
// /api/data — a única porta de entrada para o banco
//
// POR QUE ISTO EXISTE
//
// Sem o login do Supabase, a alternativa "óbvia" seria o navegador falar
// direto com o banco usando a anon key. Só que a anon key está no bundle
// JavaScript — é pública. Qualquer pessoa abre o DevTools em
// pontosarcd.vercel.app, copia, e baixa CPF, PIX, salário e contrato de
// todo mundo. Nenhuma trava no App.jsx impede isso, porque o atacante nem
// usa o seu app: fala direto com o Supabase.
//
// A saída é o navegador NUNCA tocar no banco. Ele fala com esta função, que
// roda no servidor do Vercel e guarda a SERVICE_ROLE_KEY — chave que nunca
// chega ao navegador.
//
// E o PIN, que antes era só uma tela, vira credencial de verdade: é
// conferido AQUI, no servidor. Sem PIN válido, esta função não devolve dado.
// ═══════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const URL     = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;   // sem REACT_APP_ — server-side
const COMPANY = process.env.COMPANY_ID || "arcd";
const KEY     = "arced_ponto_v1";

const db = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

// Dois carimbos de tempo apontam para o mesmo instante?
// Compara o VALOR, não o texto: "…Z" (JS) e "…+00:00" (Postgres) são o mesmo
// momento escrito de duas formas.
const mesmoInstante = (a, b) => {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (isNaN(ta) || isNaN(tb)) return false;
  return ta === tb;
};

// ── Freio contra força bruta ───────────────────────────────────────
// Um PIN de 4 dígitos tem 10.000 combinações — um script testa tudo em
// minutos se deixarmos. Aqui a memória é por instância (serverless recicla),
// então é um freio, não um cofre. O que realmente protege é PIN de 6 dígitos.
const tentativas = new Map();
const LIMITE = 8;
const JANELA = 5 * 60 * 1000;

const bloqueado = (ip) => {
  const t = tentativas.get(ip);
  if (!t) return false;
  if (Date.now() - t.desde > JANELA) { tentativas.delete(ip); return false; }
  return t.n >= LIMITE;
};

const registrarFalha = (ip) => {
  const t = tentativas.get(ip);
  if (!t || Date.now() - t.desde > JANELA) tentativas.set(ip, { n: 1, desde: Date.now() });
  else t.n += 1;
};

const lerLinha = async () => {
  const { data, error } = await db
    .from("company_app_data")
    .select("value, updated_at")
    .eq("company_id", COMPANY)
    .eq("key", KEY)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { payload: null, updatedAt: null };
  const payload = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
  return { payload, updatedAt: data.updated_at || null };
};

// Confere o PIN contra o hash guardado no próprio dataset
const conferirPin = (payload, userId, pin) => {
  const u = (payload?.usuarios || []).find(x => x.id === userId && x.active !== false);
  if (!u) return null;
  // Comparação em tempo constante: comparar strings com === vaza, pelo tempo
  // de resposta, quantos caracteres iniciais bateram.
  const a = Buffer.from(sha256(pin));
  const b = Buffer.from(String(u.pin || ""));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return u;
};

const conferirToken = async (payload, accessToken) => {
  if (!accessToken) return null;
  const { data, error } = await db.auth.getUser(accessToken);
  if (error || !data?.user) return null;
  const email = String(data.user.email || "").trim().toLowerCase();
  return (payload?.usuarios || []).find(u => u.active !== false &&
    (u.authUserId === data.user.id || String(u.email || "").trim().toLowerCase() === email)) || null;
};

const igual = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const objeto = value => value && typeof value === "object" && !Array.isArray(value);
const mesclarTresVias = (base, recebido, atual) => {
  if (igual(recebido, base)) return atual;
  if (igual(atual, base)) return recebido;
  if (Array.isArray(recebido) && Array.isArray(atual) && Array.isArray(base)) {
    const identificavel = [...base,...recebido,...atual].every(x => objeto(x) && x.id != null);
    if (!identificavel) return recebido;
    const bm=new Map(base.map(x=>[String(x.id),x])), rm=new Map(recebido.map(x=>[String(x.id),x])), am=new Map(atual.map(x=>[String(x.id),x]));
    const ordem=[...atual.map(x=>String(x.id)),...recebido.map(x=>String(x.id))].filter((id,i,a)=>a.indexOf(id)===i);
    return ordem.flatMap(id => {
      const b=bm.get(id), r=rm.get(id), a=am.get(id);
      if (b && !r) return igual(a,b)?[]:(a?[a]:[]);
      if (!r) return a?[a]:[];
      if (!a) return [r];
      return [mesclarTresVias(b,r,a)];
    });
  }
  if (objeto(recebido) && objeto(atual)) {
    const out={};
    const keys=new Set([...Object.keys(base||{}),...Object.keys(atual),...Object.keys(recebido)]);
    keys.forEach(k=>{out[k]=mesclarTresVias(base?.[k],recebido[k],atual[k]);});
    return out;
  }
  return recebido;
};

export default async function handler(req, res) {
  if (!URL || !SERVICE) {
    return res.status(503).json({ error: "Banco não configurado no servidor." });
  }

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "desconhecido";
  const { action, userId, pin, accessToken, payload, expectedUpdatedAt, basePayload } = req.body || {};

  try {
    if (action === "client-portal") {
      const { payload: p } = await lerLinha();
      const obraId = String(req.body?.obraId || "");
      const token = String(req.body?.token || "");
      const obra = (p?.obras || []).find(o => String(o.id) === obraId);
      const portal = obra?.portalCliente || {};
      const tokenValido = token && portal.token && token.length === String(portal.token).length &&
        crypto.timingSafeEqual(Buffer.from(token), Buffer.from(String(portal.token)));
      if (!obra || !portal.ativo || !tokenValido) {
        return res.status(404).json({ error: "Portal indisponível ou link inválido." });
      }

      const rdos = (p?.rdos || []).filter(r => r.obraId === obraId && r.status === "concluido")
        .sort((a,b) => String(b.data||"").localeCompare(String(a.data||""))).slice(0, 12);
      const fotos = portal.publicarFotos === false ? [] : rdos.flatMap(r => (r.fotos || [])
        .filter(f => f.publicarCliente !== false).map(f => ({ url:f.url || "", legenda:f.legenda || "", data:r.data, rdoCodigo:r.codigo })))
        .filter(f => f.url).slice(0, 24);
      const plano = (p?.planos || []).find(x => x.obraId === obraId);
      const tarefas = (plano?.tarefas || []).filter(t => !t.titulo).map(t => ({
        id:t.id, nome:t.nome || t.descricao || "Etapa", inicio:t.inicio || "", fim:t.fim || "",
        progresso:Math.max(0,Math.min(100,Number(t.progresso || 0))),
      }));
      const progresso = tarefas.length ? Math.round(tarefas.reduce((s,t)=>s+t.progresso,0)/tarefas.length) : 0;
      const medicoes = portal.publicarFinanceiro ? (p?.medicoes || []).filter(m => m.obraId === obraId).map(m => ({
        id:m.id, descricao:m.descricao || m.competencia || "Medição", competencia:m.competencia || "",
        valorPrevisto:Number(m.valorPrevisto || 0), valorRecebido:Number(m.valorRecebido || 0), recebido:!!m.recebido,
      })) : [];
      const documentos = portal.publicarDocumentos === false ? [] : (obra.documentosOneDrive || [])
        .filter(d => d.publicarCliente === true).map(d => ({ id:d.id, nome:d.nome || "Documento", url:d.url || "" }));
      const atualizacoes = (p?.changeLog || []).filter(e => e.obraId === obraId)
        .slice(-20).reverse().map(e => ({ id:e.id, at:e.at || e.date || "", mensagem:e.message || "Atualização da obra", responsavel:e.operador || "Equipe ArcD" }));
      return res.status(200).json({ portal:{
        obra:{ id:obra.id, nome:obra.name, status:obra.status, capaUrl:obra.capaUrl || "", cliente:obra.cliente || "", engenheiro:obra.engineer || "", endereco:obra.address || "", inicio:obra.contractStart || obra.startDate || "", terminoPrevisto:obra.contractEnd || "" },
        mensagem:portal.mensagem || "Acompanhe aqui a evolução da sua obra.", progresso,
        cronograma:portal.publicarCronograma === false ? [] : tarefas.slice(0,30),
        diarios:rdos.map(r => ({ id:r.id, codigo:r.codigo, data:r.data, descricao:r.descricao || "", clima:r.clima || {}, fotos:(r.fotos||[]).filter(f=>f.publicarCliente!==false).length })),
        fotos, medicoes, documentos, atualizacoes,
        atualizadoEm:portal.atualizadoEm || "",
      }});
    }

    if (action === "auth-login") {
      const email=String(req.body?.email||"").trim().toLowerCase();
      const password=String(req.body?.password||"");
      const {data:auth,error}=await db.auth.signInWithPassword({email,password});
      if(error||!auth?.session)return res.status(401).json({error:"E-mail ou senha inválidos."});
      const {payload:p,updatedAt}=await lerLinha();
      const usuario=await conferirToken(p,auth.session.access_token);
      if(!usuario)return res.status(403).json({error:"Conta sem vínculo com um operador ativo do ArcD."});
      return res.status(200).json({data:p,updatedAt,usuario:{id:usuario.id,nome:usuario.nome,role:usuario.role,email:usuario.email||email},accessToken:auth.session.access_token,refreshToken:auth.session.refresh_token});
    }

    if (action === "auth-refresh") {
      const {data:auth,error}=await db.auth.refreshSession({refresh_token:String(req.body?.refreshToken||"")});
      if(error||!auth?.session)return res.status(401).json({error:"Sessão expirada."});
      return res.status(200).json({accessToken:auth.session.access_token,refreshToken:auth.session.refresh_token});
    }

    // ── 1. Lista de perfis (tela de login) ─────────────────────────
    // Não exige PIN — é o que a tela precisa ANTES de alguém digitar.
    // Devolve só nome e papel. O hash do PIN nunca sai daqui.
    if (action === "profiles") {
      const { payload: p } = await lerLinha();
      const usuarios = (p?.usuarios || [])
        .filter(u => u.active !== false)
        .map(u => ({ id: u.id, nome: u.nome, role: u.role }));
      return res.status(200).json({ usuarios, precisaSetup: usuarios.length === 0 });
    }

    // ── 2. Primeiro acesso: cria o admin inicial ───────────────────
    //
    // ATENÇÃO — este trecho já teve um bug que destruía dados.
    //
    // A versão errada fazia `value = payload`, ou seja, gravava por cima da
    // linha o dataset VAZIO que o navegador manda (só com o admin recém-criado).
    // Se a empresa já tivesse obras, funcionários e pontos lançados, mas ainda
    // nenhum usuário com PIN, o "Primeiro acesso" apagaria TUDO.
    //
    // Agora o admin é MESCLADO no que já existe. A base atual é a verdade;
    // o cliente só contribui com o usuário. Nenhum outro campo é tocado.
    if (action === "setup") {
      const { payload: existente } = await lerLinha();

      if ((existente?.usuarios || []).length > 0) {
        return res.status(409).json({ error: "Já existe usuário. Setup encerrado." });
      }

      const novoUsuario = (payload?.usuarios || [])[0];
      if (!novoUsuario?.id || !novoUsuario?.pin) {
        return res.status(400).json({ error: "Dados do administrador incompletos." });
      }

      // Se já há dados, PRESERVA tudo e só acrescenta o usuário.
      // Se a linha está vazia/inexistente, aí sim usa o payload como base.
      const temDados = existente && Object.keys(existente).length > 0;
      const base = temDados
        ? { ...existente, usuarios: [novoUsuario] }
        : { ...(payload || {}), usuarios: [novoUsuario] };

      const agora = new Date().toISOString();

      if (!existente) {
        await db.from("company_app_data")
          .insert({ company_id: COMPANY, key: KEY, value: base, updated_at: agora });
      } else {
        await db.from("company_app_data")
          .update({ value: base, updated_at: agora })
          .eq("company_id", COMPANY).eq("key", KEY);
      }

      const novo = await lerLinha();
      return res.status(200).json({ data: novo.payload, updatedAt: novo.updatedAt });
    }

    // ── Daqui pra baixo, sessão individual ou PIN de transição ─────
    if (bloqueado(ip)) {
      return res.status(429).json({ error: "Muitas tentativas. Aguarde 5 minutos." });
    }

    const { payload: atual, updatedAt } = await lerLinha();
    const usuario = await conferirToken(atual,accessToken) || conferirPin(atual, userId, pin);

    if (!usuario) {
      registrarFalha(ip);
      return res.status(401).json({ error: "Sessão inválida ou PIN incorreto." });
    }

    if (action === "auth-provision") {
      if(usuario.role!=="admin")return res.status(403).json({error:"Apenas administradores podem ativar contas."});
      const alvo=(atual.usuarios||[]).find(u=>u.id===req.body?.targetUserId);
      const email=String(alvo?.email||"").trim().toLowerCase(), password=String(req.body?.password||"");
      if(!alvo||!email)return res.status(400).json({error:"Cadastre um e-mail válido para o operador."});
      if(password.length<8)return res.status(400).json({error:"A senha temporária deve ter ao menos 8 caracteres."});
      let authId=alvo.authUserId||"";
      if(authId){
        const {error}=await db.auth.admin.updateUserById(authId,{email,password,email_confirm:true,user_metadata:{arcdUserId:alvo.id,nome:alvo.nome}});
        if(error)return res.status(400).json({error:error.message});
      }else{
        // A conta pode ter sido criada antes da implantação do vínculo
        // authUserId (ou diretamente no painel do Supabase). Nesse caso não
        // tentamos cadastrar o mesmo e-mail novamente: localizamos a conta,
        // redefinimos a senha e passamos a vinculá-la ao operador do ArcD.
        const {data:listagem,error:erroLista}=await db.auth.admin.listUsers({page:1,perPage:1000});
        if(erroLista)return res.status(400).json({error:erroLista.message});
        const existente=(listagem?.users||[]).find(u=>String(u.email||"").trim().toLowerCase()===email);
        if(existente){
          const vinculo=(atual.usuarios||[]).find(u=>u.id!==alvo.id&&u.authUserId===existente.id);
          if(vinculo)return res.status(409).json({error:`Este e-mail já está vinculado ao operador ${vinculo.nome}.`});
          authId=existente.id;
          const {error}=await db.auth.admin.updateUserById(authId,{email,password,email_confirm:true,user_metadata:{...(existente.user_metadata||{}),arcdUserId:alvo.id,nome:alvo.nome}});
          if(error)return res.status(400).json({error:error.message});
        }else{
          const {data:criado,error}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{arcdUserId:alvo.id,nome:alvo.nome}});
          if(error)return res.status(400).json({error:error.message});
          authId=criado.user.id;
        }
      }
      const novo={...atual,usuarios:(atual.usuarios||[]).map(u=>u.id===alvo.id?{...u,authUserId:authId,email}:u)};
      const agora=new Date().toISOString();
      const {data:gravado,error}=await db.from("company_app_data").update({value:novo,updated_at:agora}).eq("company_id",COMPANY).eq("key",KEY).select("updated_at").maybeSingle();
      if(error)throw error;
      return res.status(200).json({ok:true,data:novo,updatedAt:gravado?.updated_at||agora});
    }

    // ── 3. Carregar ────────────────────────────────────────────────
    if (action === "load") {
      return res.status(200).json({
        data: atual,
        updatedAt,
        usuario: { id: usuario.id, nome: usuario.nome, role: usuario.role, email: usuario.email || "" },
      });
    }

    // ── 4. Salvar (com trava otimista) ─────────────────────────────
    if (action === "save") {
      if (!payload) return res.status(400).json({ error: "Nada para salvar." });

      // Se outro salvou depois da sua leitura, recusa — e devolve a versão
      // do servidor + o que você tentou salvar, para o app reaplicar.
      //
      // ⚠️ COMPARAR INSTANTE, NÃO STRING.
      //
      // Este trecho já teve um bug que travava TODO salvamento a partir do
      // segundo. O JS gera "2026-07-14T09:46:11.545Z"; o Postgres, na coluna
      // timestamptz, devolve "2026-07-14T09:46:11.545+00:00". É o MESMO
      // instante, mas são strings diferentes — e comparar com !== dava
      // conflito eterno. O ponto simplesmente não salvava.
      const houveConcorrencia=expectedUpdatedAt&&updatedAt&&!mesmoInstante(expectedUpdatedAt,updatedAt);
      let valor=houveConcorrencia&&basePayload?mesclarTresVias(basePayload,payload,atual):payload;
      if(houveConcorrencia&&!basePayload)return res.status(409).json({conflict:true,reason:"Outro usuário salvou enquanto você trabalhava.",currentData:atual,currentUpdatedAt:updatedAt});

      const agora = new Date().toISOString();

      // .select() devolve a linha COMO O BANCO A GUARDOU. Assim o carimbo que
      // mandamos de volta ao navegador é exatamente o que estará lá na próxima
      // comparação — sem discrepância de formato.
      let { data: gravado, error } = await db
        .from("company_app_data")
        .update({ value: valor, updated_at: agora, updated_by: null })
        .eq("company_id", COMPANY)
        .eq("key", KEY)
        .eq("updated_at",updatedAt)
        .select("updated_at")
        .maybeSingle();

      if (error) throw error;
      // Outra gravação pode entrar entre a leitura e o UPDATE. A condição no
      // updated_at impede sobrescrita; nesse caso relê e reaplica a mesma mescla.
      if(!gravado){
        if(!basePayload)return res.status(409).json({conflict:true,reason:"Outro usuário salvou ao mesmo tempo."});
        const recente=await lerLinha();valor=mesclarTresVias(basePayload,payload,recente.payload);
        const novoAgora=new Date().toISOString();
        const retry=await db.from("company_app_data").update({value:valor,updated_at:novoAgora,updated_by:null}).eq("company_id",COMPANY).eq("key",KEY).eq("updated_at",recente.updatedAt).select("updated_at").maybeSingle();
        if(retry.error)throw retry.error;
        if(!retry.data)return res.status(409).json({conflict:true,reason:"Muitas alterações simultâneas. Tente novamente."});
        gravado=retry.data;
      }
      return res.status(200).json({ ok: true, merged:!!houveConcorrencia||!mesmoInstante(gravado?.updated_at,agora), data:(houveConcorrencia||!mesmoInstante(gravado?.updated_at,agora))?valor:undefined, updatedAt: gravado?.updated_at || agora });
    }

    // ── 5. Quinzenas arquivadas ────────────────────────────────────
    //
    // O dataset principal e UM json so, e a Vercel corta o corpo da
    // requisicao em ~4,5MB. Com 60 funcionarios lancando ponto todo dia,
    // um dia o save simplesmente para de passar. A saida: quinzena
    // finalizada e paga sai do json principal e vira uma LINHA PROPRIA
    // (key `arced_ponto_v1__arq__2026-07-Q1`), consultada sob demanda.
    //
    // A cirurgia acontece AQUI, no servidor, sobre o estado atual do
    // banco: mover os lancamentos e gravar as duas linhas na mesma
    // requisicao elimina a janela em que um conflito perderia dados.
    // O papel (rh/admin) e conferido aqui - a tela apenas esconde o botao.

    const PAPEIS_ARQUIVO = ["admin", "rh"];
    const chaveArquivo = (qid) => `${KEY}__arq__${qid}`;
    const quinzenaValida = (qid) => /^\d{4}-\d{2}-Q[12]$/.test(String(qid || ""));

    if (action === "archive-quinzena") {
      if (!PAPEIS_ARQUIVO.includes(usuario.role)) {
        return res.status(403).json({ error: "Apenas RH e administrador podem arquivar quinzenas." });
      }
      const { quinzenaId, label, dates } = req.body.archive || {};
      if (!quinzenaValida(quinzenaId) || !Array.isArray(dates) || !dates.length) {
        return res.status(400).json({ error: "Quinzena inválida." });
      }
      if ((atual?.quinzenasArquivadas || {})[quinzenaId]) {
        return res.status(409).json({ error: "Esta quinzena já foi arquivada." });
      }
      const { data: jaExiste } = await db.from("company_app_data")
        .select("key").eq("company_id", COMPANY).eq("key", chaveArquivo(quinzenaId)).maybeSingle();
      if (jaExiste) {
        return res.status(409).json({ error: "Esta quinzena já foi arquivada." });
      }

      // Recorta do attendance principal apenas as datas da quinzena.
      const setDatas = new Set(dates);
      const fatia = {};
      const restante = {};
      let totalLanc = 0;
      for (const [empId, mapa] of Object.entries(atual?.attendance || {})) {
        const dentro = {};
        const fora = {};
        for (const [d, reg] of Object.entries(mapa || {})) {
          if (setDatas.has(d)) { dentro[d] = reg; totalLanc += 1; }
          else fora[d] = reg;
        }
        if (Object.keys(dentro).length) fatia[empId] = dentro;
        if (Object.keys(fora).length) restante[empId] = fora;
      }
      if (!totalLanc) {
        return res.status(400).json({ error: "Não há lançamentos nesta quinzena para arquivar." });
      }

      // Fotografia dos funcionarios envolvidos: diaria e beneficios DA EPOCA
      // ficam congelados no arquivo, mesmo que o cadastro mude depois.
      const idsEnvolvidos = new Set(Object.keys(fatia));
      const employeesSnapshot = (atual?.employees || [])
        .filter(e => idsEnvolvidos.has(e.id))
        .map(e => ({
          id: e.id, name: e.name, role: e.role || "", obra: e.obra || "",
          dailyRate: Number(e.dailyRate || 0),
          vtDaily: Number(e.vtDaily || 0), vrDaily: Number(e.vrDaily || 0),
        }));

      const agora = new Date().toISOString();
      const meta = {
        quinzenaId,
        label: String(label || quinzenaId),
        inicio: dates[0],
        fim: dates[dates.length - 1],
        totalLancamentos: totalLanc,
        funcionarios: employeesSnapshot.length,
        archivedAt: agora,
        archivedBy: { id: usuario.id, nome: usuario.nome },
      };

      const { error: errArq } = await db.from("company_app_data")
        .insert({
          company_id: COMPANY,
          key: chaveArquivo(quinzenaId),
          value: { meta, attendance: fatia, employeesSnapshot },
          updated_at: agora,
        });
      if (errArq) throw errArq;

      const novoPrincipal = {
        ...atual,
        attendance: restante,
        quinzenasArquivadas: { ...(atual?.quinzenasArquivadas || {}), [quinzenaId]: meta },
        changeLog: [
          ...(atual?.changeLog || []),
          { id: `arq_${Date.now()}`, date: agora.slice(0, 10), at: agora, type: "quinzena_archived",
            operador: usuario.nome, operadorId: usuario.id,
            message: `${usuario.nome} finalizou e arquivou a quinzena ${meta.label} (${totalLanc} lançamento(s) de ${employeesSnapshot.length} funcionário(s))` },
        ].slice(-200),
      };

      const { data: gravado, error: errMain } = await db.from("company_app_data")
        .update({ value: novoPrincipal, updated_at: agora, updated_by: null })
        .eq("company_id", COMPANY).eq("key", KEY)
        .select("updated_at").maybeSingle();
      if (errMain) throw errMain;

      return res.status(200).json({ ok: true, data: novoPrincipal, updatedAt: gravado?.updated_at || agora, meta });
    }

    if (action === "list-quinzena-archives") {
      if (!PAPEIS_ARQUIVO.includes(usuario.role)) {
        return res.status(403).json({ error: "Sem permissão para ver os arquivos." });
      }
      const { data: linhas, error } = await db.from("company_app_data")
        .select("key, updated_at, value->meta")
        .eq("company_id", COMPANY)
        .like("key", `${KEY}__arq__%`);
      if (error) throw error;
      const arquivos = (linhas || [])
        .map(l => ({ key: l.key, updatedAt: l.updated_at, meta: l.meta || {} }))
        .sort((a, b) => String(b.meta?.inicio || "").localeCompare(String(a.meta?.inicio || "")));
      return res.status(200).json({ ok: true, arquivos });
    }

    if (action === "load-quinzena-archive") {
      if (!PAPEIS_ARQUIVO.includes(usuario.role)) {
        return res.status(403).json({ error: "Sem permissão para ler o arquivo." });
      }
      const { quinzenaId } = req.body || {};
      if (!quinzenaValida(quinzenaId)) return res.status(400).json({ error: "Quinzena inválida." });
      const { data: linha, error } = await db.from("company_app_data")
        .select("value, updated_at")
        .eq("company_id", COMPANY).eq("key", chaveArquivo(quinzenaId)).maybeSingle();
      if (error) throw error;
      if (!linha) return res.status(404).json({ error: "Arquivo não encontrado." });
      return res.status(200).json({ ok: true, arquivo: linha.value, updatedAt: linha.updated_at });
    }

    // Restaurar e ato de ADMIN: desfaz um arquivamento feito por engano.
    // Os lancamentos voltam ao principal SEM sobrescrever o que ja existir la
    // (se alguem relancou um dia, o relancado vence e o do arquivo e descartado).
    if (action === "restore-quinzena") {
      if (usuario.role !== "admin") {
        return res.status(403).json({ error: "Apenas o administrador pode restaurar uma quinzena." });
      }
      const { quinzenaId } = req.body || {};
      if (!quinzenaValida(quinzenaId)) return res.status(400).json({ error: "Quinzena inválida." });
      const { data: linha, error: errLer } = await db.from("company_app_data")
        .select("value")
        .eq("company_id", COMPANY).eq("key", chaveArquivo(quinzenaId)).maybeSingle();
      if (errLer) throw errLer;
      if (!linha) return res.status(404).json({ error: "Arquivo não encontrado." });

      const arq = linha.value || {};
      const attendance = { ...(atual?.attendance || {}) };
      let devolvidos = 0, mantidos = 0;
      for (const [empId, mapa] of Object.entries(arq.attendance || {})) {
        const destino = { ...(attendance[empId] || {}) };
        for (const [d, reg] of Object.entries(mapa || {})) {
          if (destino[d]) { mantidos += 1; continue; }
          destino[d] = reg; devolvidos += 1;
        }
        attendance[empId] = destino;
      }

      const agora = new Date().toISOString();
      const marcadores = { ...(atual?.quinzenasArquivadas || {}) };
      delete marcadores[quinzenaId];
      const novoPrincipal = {
        ...atual,
        attendance,
        quinzenasArquivadas: marcadores,
        changeLog: [
          ...(atual?.changeLog || []),
          { id: `res_${Date.now()}`, date: agora.slice(0, 10), at: agora, type: "quinzena_restored",
            operador: usuario.nome, operadorId: usuario.id,
            message: `${usuario.nome} restaurou a quinzena ${arq.meta?.label || quinzenaId} (${devolvidos} lançamento(s) devolvido(s)${mantidos ? `, ${mantidos} mantido(s) como estavam` : ""})` },
        ].slice(-200),
      };

      const { data: gravado, error: errMain } = await db.from("company_app_data")
        .update({ value: novoPrincipal, updated_at: agora, updated_by: null })
        .eq("company_id", COMPANY).eq("key", KEY)
        .select("updated_at").maybeSingle();
      if (errMain) throw errMain;

      const { error: errDel } = await db.from("company_app_data")
        .delete()
        .eq("company_id", COMPANY).eq("key", chaveArquivo(quinzenaId));
      if (errDel) throw errDel;

      return res.status(200).json({ ok: true, data: novoPrincipal, updatedAt: gravado?.updated_at || agora, devolvidos, mantidos });
    }

    return res.status(400).json({ error: "Ação desconhecida." });
  } catch (err) {
    console.error("Falha em /api/data:", err);
    // Não devolve o erro cru: pode conter nome de tabela, coluna, etc.
    return res.status(500).json({ error: "Erro interno." });
  }
}
