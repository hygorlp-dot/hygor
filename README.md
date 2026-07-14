# ArcD Ponto PRO — como subir sem perder dados

> **Seus dados atuais estão seguros.** As chaves de armazenamento
> (`company_id = "arcd"`, `key = "arced_ponto_v1"`) são as mesmas do código
> antigo. A função nova lê a **mesma linha** do banco. Testado: 3 obras,
> 60 funcionários, ponto lançado, orçamento, medições e despesas passam
> intactos pelo `normalizeData`.

---

## Antes de tudo: um backup em 2 minutos

Não existe backup automático (o README antigo mentia sobre isso). Antes de
mexer, abra o app **como está hoje** e exporte:

- Folha → Excel
- Medições → Excel
- DRE → PDF
- Orçamento → Excel

É sua rede de segurança. Custa 2 minutos.

---

## 1. Arquivos no GitHub

```
📁 raiz do repositório
│
├── api/                    ⚠️ NA RAIZ, nunca dentro de src/
│   ├── data.js             ← NOVO — guarda a chave do banco
│   └── ai-agent.js         ← NOVO — guarda a chave da Anthropic
│
├── public/
│   ├── index.html          ← substituir (carrega a fonte Inter)
│   └── logo-arcd.png
│
├── src/
│   ├── App.jsx             ← substituir
│   ├── api.js              ← NOVO (substitui o supabase.js)
│   ├── ErrorBoundary.jsx   ← NOVO
│   └── index.js            ← substituir
│
├── schema.sql              ← rodar no Supabase (não é código do app)
├── .env.example
├── .gitignore
├── package.json
└── vercel.json
```

**Apagar do repositório:** `Auth.jsx`, `AuthGate.jsx`, `supabase.js`.
Não são mais usados — e o `supabase.js`, se ficar, continua carregando a
anon key à toa.

### A pegadinha da pasta `api/`

O Vercel só reconhece função serverless numa pasta `/api` **de nível raiz**.
Se você puser em `src/api/`, o deploy passa sem erro nenhum e o app fica
**mudo para sempre** — nenhuma tela carrega, porque `/api/data` responde 404.

---

## 2. Banco de dados

Supabase → **SQL Editor** → cole o `schema.sql` e rode.

Ele **não apaga dado nenhum**. O que faz:
- garante que a tabela existe (`create table if not exists`)
- **remove todas as políticas de acesso**

Sem política, o Postgres nega por padrão. É proposital: o único caminho até
os dados passa a ser a função serverless, que usa a `service_role` e confere
o PIN. Se alguém roubar a anon key do bundle, não lê uma linha.

---

## 3. Variáveis no Vercel

**Settings → Environment Variables.** Nenhuma leva `REACT_APP_`:

| Nome | Onde achar |
|---|---|
| `SUPABASE_URL` | `https://qylubfxunnpbbjnmgsdg.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → chave **service_role** |
| `COMPANY_ID` | `arcd` |
| `ANTHROPIC_API_KEY` | opcional, só para o Agente IA |

**A regra do prefixo:** tudo que começa com `REACT_APP_` é embutido no bundle
JavaScript e fica visível para qualquer visitante. A `service_role` ignora
todas as regras de segurança do banco — se ela vazar, é acesso total.
Por isso ela **não** leva o prefixo.

⚠️ Se você já tinha `REACT_APP_COMPANY_ID` com valor **diferente** de `arcd`,
use o **mesmo valor** em `COMPANY_ID` — senão a função procura na linha errada
e a tela vem vazia (os dados não somem, só não são encontrados).

---

## 4. Primeiro acesso

Ao abrir, se não houver usuário com PIN cadastrado, aparece a tela de
**Primeiro acesso**. Pode seguir sem medo: o servidor **mescla** o admin no
que já existe, em vez de sobrescrever. Testado com 3 obras / 60 funcionários /
medições / orçamentos: tudo preservado.

Use **PIN de 6 dígitos**. Quatro dígitos são 10 mil combinações; o servidor
trava tentativas repetidas, mas seis dígitos são cem vezes mais difíceis — e
dá o mesmo trabalho de digitar.

---

## Módulos

| | |
|---|---|
| **Obras** | cadastro, contratos, quadro Kanban com fases editáveis |
| **Orçamento** | SINAPI/ORSE, hierarquia até 5 níveis, BDI (TCU 2622/2013) |
| **Estoque** | saldo por obra, baixa automática por composição, curva ABC |
| **Compras** | cotação, pedido, recebimento, histórico de preços, orçado × comprado |
| **Ponto / Equipe / Folha / Rescisão** | CLT, feriados de Caruaru |
| **Terceirizados** | pagamentos semanais |
| **Medições** | 3 modalidades de cobrança |
| **Conciliação** | extrato OFX/CSV, rateio entre obras, casamento com medições |
| **DRE** | por obra e da empresa (NBC TG 26) |

### Como o dinheiro é contado (importante)

O custo entra no DRE **uma única vez**: quando o dinheiro sai, pela
**Conciliação**.

- **Compras** registra compromisso — não lança no DRE
- **Estoque** registra o físico — não lança no DRE

Se qualquer um dos dois lançasse, o mesmo saco de cimento contaria duas vezes
e seu resultado ficaria inflado.

---

## Dívida técnica conhecida

1. **Blob único** — toda gravação reescreve o dataset inteiro. É a causa dos
   conflitos quando duas pessoas salvam ao mesmo tempo (o app avisa e deixa
   reaplicar, mas não faz merge). Passando de 2–3 pessoas, o certo é quebrar
   em tabelas por módulo.
2. **Sem camada offline** — obra sem sinal não registra ponto.
3. **`react-scripts` 5.0.1** — o Create React App não é mais mantido. Migrar
   para Vite é meio dia e resolve build lento e alertas em cascata.
4. **Sem suíte de regressão** — a lógica de dinheiro (BDI, rescisão, rateio,
   DRE, estoque, compras) foi validada com scripts durante o desenvolvimento,
   mas nada está fixado como teste automatizado.
