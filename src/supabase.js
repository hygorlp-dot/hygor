import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const COMPANY_ID = process.env.REACT_APP_COMPANY_ID || "arcd";
const DATA_KEY = "arced_ponto_v1";

let lastKnownUpdatedAt = null;
let lastLoadedPayload = null;
let conflictAlertVisible = false;

const normalizeValue = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (err) {
      console.error("Erro ao converter value JSON:", err);
      return null;
    }
  }

  return value;
};

const emitDataConflict = (details) => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("arcd:data-conflict", {
      detail: details,
    })
  );

  if (!conflictAlertVisible) {
    conflictAlertVisible = true;

    window.alert(
      "Atenção: os dados foram atualizados por outro usuário antes do seu salvamento.\n\n" +
      "Para evitar sobrescrever informações de obras, funcionários ou pontos já fechados, o salvamento foi bloqueado.\n\n" +
      "Atualize a tela e tente novamente."
    );

    setTimeout(() => {
      conflictAlertVisible = false;
    }, 1500);
  }
};

export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.error("Erro ao buscar usuário:", error);
    return null;
  }

  return data?.user || null;
};

export const onAuthStateChange = (callback) => {
  return supabase.auth.onAuthStateChange(callback);
};

export const signUpEmail = async (email, password) => {
  return await supabase.auth.signUp({
    email,
    password,
  });
};

export const signInEmail = async (email, password) => {
  return await supabase.auth.signInWithPassword({
    email,
    password,
  });
};

export const logout = async () => {
  lastKnownUpdatedAt = null;
  lastLoadedPayload = null;
  return await supabase.auth.signOut();
};

export const getLastKnownUpdatedAt = () => lastKnownUpdatedAt;

export const getLastLoadedPayload = () => lastLoadedPayload;

export const loadDataWithMeta = async () => {
  try {
    const user = await getCurrentUser();

    if (!user) {
      console.warn("Nenhum usuário logado.");
      return {
        data: null,
        updatedAt: null,
      };
    }

    const { data, error } = await supabase
      .from("company_app_data")
      .select("value, updated_at")
      .eq("company_id", COMPANY_ID)
      .eq("key", DATA_KEY)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar dados:", error);
      return {
        data: null,
        updatedAt: null,
      };
    }

    if (!data) {
      lastKnownUpdatedAt = null;
      lastLoadedPayload = null;

      return {
        data: null,
        updatedAt: null,
      };
    }

    const payload = normalizeValue(data.value);

    lastKnownUpdatedAt = data.updated_at || null;
    lastLoadedPayload = payload;

    return {
      data: payload,
      updatedAt: lastKnownUpdatedAt,
    };
  } catch (err) {
    console.error("Erro inesperado ao carregar dados:", err);

    return {
      data: null,
      updatedAt: null,
    };
  }
};

export const loadData = async () => {
  const result = await loadDataWithMeta();
  return result.data;
};

export const forceReloadData = async () => {
  const result = await loadDataWithMeta();
  return result.data;
};

const insertInitialData = async (payload, user) => {
  const { data, error } = await supabase
    .from("company_app_data")
    .insert({
      company_id: COMPANY_ID,
      key: DATA_KEY,
      value: payload,
      updated_by: user?.id || null,
      updated_at: new Date().toISOString(),
    })
    .select("updated_at")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        conflict: true,
        reason: "Linha criada por outro usuário no mesmo momento.",
      };
    }

    console.error("Erro ao inserir dados iniciais:", error);

    return {
      ok: false,
      conflict: false,
      reason: error.message,
    };
  }

  lastKnownUpdatedAt = data?.updated_at || null;
  lastLoadedPayload = payload;

  return {
    ok: true,
    conflict: false,
    updatedAt: lastKnownUpdatedAt,
  };
};

export const saveDataDetailed = async (payload) => {
  try {
    const user = await getCurrentUser();

    if (!user) {
      console.warn("Nenhum usuário logado. Dados não salvos.");

      return {
        ok: false,
        conflict: false,
        reason: "Usuário não autenticado.",
      };
    }

    const { data: currentRow, error: readError } = await supabase
      .from("company_app_data")
      .select("value, updated_at")
      .eq("company_id", COMPANY_ID)
      .eq("key", DATA_KEY)
      .maybeSingle();

    if (readError) {
      console.error("Erro ao verificar versão atual dos dados:", readError);

      return {
        ok: false,
        conflict: false,
        reason: readError.message,
      };
    }

    if (!currentRow) {
      return await insertInitialData(payload, user);
    }

    const currentUpdatedAt = currentRow.updated_at || null;
    const currentPayload = normalizeValue(currentRow.value);

    if (lastKnownUpdatedAt && currentUpdatedAt && currentUpdatedAt !== lastKnownUpdatedAt) {
      const details = {
        ok: false,
        conflict: true,
        reason: "Dados alterados por outro usuário.",
        currentData: currentPayload,
        currentUpdatedAt,
        lastKnownUpdatedAt,
      };

      console.warn("Salvamento bloqueado por conflito de concorrência:", details);
      emitDataConflict(details);

      return details;
    }

    const expectedUpdatedAt = currentUpdatedAt;
    const newUpdatedAt = new Date().toISOString();

    const { data: updatedRow, error: updateError } = await supabase
      .from("company_app_data")
      .update({
        value: payload,
        updated_by: user.id,
        updated_at: newUpdatedAt,
      })
      .eq("company_id", COMPANY_ID)
      .eq("key", DATA_KEY)
      .eq("updated_at", expectedUpdatedAt)
      .select("updated_at")
      .maybeSingle();

    if (updateError) {
      console.error("Erro ao salvar dados:", updateError);

      return {
        ok: false,
        conflict: false,
        reason: updateError.message,
      };
    }

    if (!updatedRow) {
      const { data: latestRow } = await supabase
        .from("company_app_data")
        .select("value, updated_at")
        .eq("company_id", COMPANY_ID)
        .eq("key", DATA_KEY)
        .maybeSingle();

      const details = {
        ok: false,
        conflict: true,
        reason: "Outro usuário salvou dados no mesmo instante.",
        currentData: normalizeValue(latestRow?.value),
        currentUpdatedAt: latestRow?.updated_at || null,
        lastKnownUpdatedAt,
      };

      console.warn("Salvamento bloqueado por conflito simultâneo:", details);
      emitDataConflict(details);

      return details;
    }

    lastKnownUpdatedAt = updatedRow.updated_at || newUpdatedAt;
    lastLoadedPayload = payload;

    return {
      ok: true,
      conflict: false,
      updatedAt: lastKnownUpdatedAt,
    };
  } catch (err) {
    console.error("Erro inesperado ao salvar dados:", err);

    return {
      ok: false,
      conflict: false,
      reason: err?.message || "Erro inesperado.",
    };
  }
};

export const saveData = async (payload) => {
  const result = await saveDataDetailed(payload);

  if (!result.ok && result.conflict) {
    return false;
  }

  return !!result.ok;
};

export const resetConcurrencyControl = () => {
  lastKnownUpdatedAt = null;
  lastLoadedPayload = null;
};
