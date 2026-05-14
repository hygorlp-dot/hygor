# ArcD Ponto PRO — Deploy no Vercel + Supabase

## 1. Criar o banco de dados no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita
2. Crie um novo projeto (pode ser qualquer nome)
3. No painel, vá em **SQL Editor** e execute:

```sql
CREATE TABLE kv_store (
  key  TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

4. Vá em **Settings → API** e copie:
   - `Project URL` → será o `REACT_APP_SUPABASE_URL`
   - `anon public key` → será o `REACT_APP_SUPABASE_ANON_KEY`

---

## 2. Deploy no Vercel

### Opção A — via GitHub (recomendada)

1. Faça upload desta pasta para um repositório GitHub
2. Acesse [vercel.com](https://vercel.com) e importe o repositório
3. Configure as **Environment Variables** no painel do Vercel:
   ```
   REACT_APP_SUPABASE_URL    = https://xxxx.supabase.co
   REACT_APP_SUPABASE_ANON_KEY = eyJ...
   ```
4. Clique em **Deploy** — pronto!

### Opção B — via Vercel CLI

```bash
npm install -g vercel
cd arced-ponto-vercel
npm install
vercel env add REACT_APP_SUPABASE_URL
vercel env add REACT_APP_SUPABASE_ANON_KEY
vercel --prod
```

---

## 3. Como funciona o armazenamento

- Os dados ficam salvos na tabela `kv_store` do Supabase
- Como backup automático, também são salvos no `localStorage` do navegador
- Se o Supabase estiver fora do ar, o app usa o localStorage como fallback
- **Um único conjunto de dados** (como configurado — uso pessoal / uma empresa)

---

## 4. Estrutura de arquivos

```
arced-ponto-vercel/
├── public/
│   └── index.html
├── src/
│   ├── index.js        ← entrada React
│   ├── supabase.js     ← cliente Supabase + loadData/saveData
│   └── App.jsx         ← app completo
├── .env.example        ← modelo das variáveis de ambiente
├── package.json
└── README.md
```

---

## 5. Variáveis de ambiente

Crie um arquivo `.env` na raiz (não commitado no git):

```env
REACT_APP_SUPABASE_URL=https://SEU_PROJETO.supabase.co
REACT_APP_SUPABASE_ANON_KEY=sua_anon_key_aqui
```

---

## Observações

- O **Assistente IA** usa a API do Claude — funciona no Vercel sem configuração extra
- O plano gratuito do Supabase suporta até 500 MB de banco e 50.000 req/mês, mais que suficiente
- Para rodar localmente: `npm install && npm start`
