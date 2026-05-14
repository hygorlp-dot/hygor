import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DATA_KEY = 'arced_ponto_empresa_v1';

export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.error('Erro ao buscar usuário:', error);
    return null;
  }

  return data.user;
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
  return await supabase.auth.signOut();
};

export const loadData = async () => {
  try {
    const user = await getCurrentUser();

    if (!user) {
      console.warn('Nenhum usuário logado. Dados não carregados.');
      return null;
    }

    const { data, error } = await supabase
      .from('app_data')
      .select('value')
      .eq('key', DATA_KEY)
      .maybeSingle();

    if (error) {
      console.error('Erro ao carregar dados da empresa:', error);
      return null;
    }

    if (!data) return null;

    return JSON.parse(data.value);
  } catch (err) {
    console.error('Erro inesperado ao carregar dados:', err);
    return null;
  }
};

export const saveData = async (payload) => {
  try {
    const user = await getCurrentUser();

    if (!user) {
      console.warn('Nenhum usuário logado. Dados não salvos.');
      return false;
    }

    const { error } = await supabase
      .from('app_data')
      .upsert(
        {
          key: DATA_KEY,
          value: JSON.stringify(payload),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'key',
        }
      );

    if (error) {
      console.error('Erro ao salvar dados da empresa:', error);
      return false;
    }

    console.log('Dados da empresa salvos com sucesso.');
    return true;
  } catch (err) {
    console.error('Erro inesperado ao salvar dados:', err);
    return false;
  }
};
