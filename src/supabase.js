import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DATA_KEY = 'arced_ponto_v1';

export const loadData = async () => {
  try {
    const { data, error } = await supabase
      .from('app_data')
      .select('value')
      .eq('key', DATA_KEY)
      .single();

    if (error) {
      console.error('Erro ao carregar dados do Supabase:', error);
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
    const { error } = await supabase
      .from('app_data')
      .upsert(
        { key: DATA_KEY, value: JSON.stringify(payload) },
        { onConflict: 'key' }
      );

    if (error) {
      console.error('Erro ao salvar dados no Supabase:', error);
      return false;
    }

    console.log('Dados salvos no Supabase com sucesso');
    return true;
  } catch (err) {
    console.error('Erro inesperado ao salvar dados:', err);
    return false;
  }
};
