# ArcD Ponto PRO — Setup no Supabase

## 1. Criar tabela no Supabase

Acesse o painel do seu projeto Supabase → **SQL Editor** e execute:

```sql
-- Cria a tabela que guarda todos os dados do app (um único registro JSON)
CREATE TABLE IF NOT EXISTS app_data (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Permite acesso anônimo (sem login) para leitura e escrita
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON app_data
  FOR ALL USING (true) WITH CHECK (true);
```

## 2. Configurar variáveis de ambiente no Vercel

No painel do Vercel → seu projeto → **Settings → Environment Variables**, adicione:

| Nome                         | Valor                                    |
|------------------------------|------------------------------------------|
| `REACT_APP_SUPABASE_URL`     | `https://XXXXX.supabase.co`             |
| `REACT_APP_SUPABASE_ANON_KEY`| `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

Você encontra esses valores no painel Supabase → **Settings → API**.

## 3. Deploy no Vercel

```bash
# Na pasta do projeto:
npm install
vercel          # segue o assistente interativo
```

Ou conecte o repositório diretamente pelo site vercel.com.

## 4. IA Assistant (opcional)

O botão "IA" chama a API da Anthropic. Para funcionar, você precisa adicionar
uma **API Key** da Anthropic às variáveis de ambiente do Vercel:

| Nome                  | Valor              |
|-----------------------|--------------------|
| `REACT_APP_ANTHROPIC_KEY` | `sk-ant-...`   |

E então no `src/App.jsx`, na função `sendMsg`, adicione o header:
```js
headers: {
  "Content-Type": "application/json",
  "x-api-key": process.env.REACT_APP_ANTHROPIC_KEY,
  "anthropic-version": "2023-06-01",
}
```

> **Atenção:** expor chaves de API no frontend é inseguro em produção.
> Para uso real, crie um endpoint serverless no Vercel (`/api/chat.js`) que
> faça a chamada à Anthropic pelo lado do servidor.
