# Nossa Grana

App de **controle financeiro do casal** — orçamento por **envelopes**, com visão de
**mês e semana**, reservas de investimento/impostos, parcelas, recorrências, metas, mesada e projeção de
futuro. Mobile-first, em português, com Supabase. Tom calmo e clean — paz com o dinheiro.

## Stack
React + Vite + TypeScript · Tailwind + componentes estilo shadcn/ui · lucide-react · Recharts ·
date-fns (pt-BR) · @tanstack/react-query · @supabase/supabase-js · PWA (vite-plugin-pwa).

## Como rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build de produção (PWA incluso)
npm run preview    # serve o build
```

**Login:** conta única compartilhada (e-mail + senha definidos no Supabase Auth; credenciais ficam
em `env.Supabase.txt`, fora do git).

### Variáveis de ambiente (`.env.local`)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
```

### Variaveis server-only (Vercel Functions)
```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-your-key
RESEND_API_KEY=re_your-key
EMAIL_FROM="Nossa Grana <relatorios@example.com>"
APP_URL=https://nossa-grana.vercel.app
CRON_SECRET=change-me
OPENAI_CHAT_MODEL=gpt-5.4-mini
OPENAI_CHEAP_MODEL=gpt-5.4-nano
```
Essas chaves ficam somente no ambiente da Vercel. Elas alimentam `/api/ai/chat`, confirmacao de acoes,
preview do relatorio e o cron dominical (`0 11 * * 0`, 08:00 em America/Sao_Paulo).

> O frontend usa **apenas** a publishable key. A `service_role` e a senha do banco ficam só nos scripts
> locais (`env.Supabase.txt`, fora do git) e nunca vão para o bundle.

## Banco de dados / seed

```bash
npm run setup      # cria schema + RLS + triggers, semeia os dados e importa o CSV de exemplo
```

O `scripts/setup.mjs` conecta direto no Postgres (lendo credenciais de `env.Supabase.txt`), aplica
`scripts/schema.sql` (tabelas, RLS, trigger que recalcula o progresso das metas), semeia pessoas/contas/
categorias/metas/orçamentos e importa lançamentos de `scripts/sample-financeiro.csv`
(parser em `scripts/import-csv.mjs`, com auto-categorização). É **idempotente** (faz `truncate` e
recria). Os lançamentos de exemplo são datados em **julho/2026**; ajuste a constante `MES` no script para mudar.

> **Dados reais:** planilhas CSV com finanças pessoais **não devem ser versionadas**. O `.gitignore` bloqueia
> `*.csv` exceto o arquivo de exemplo em `scripts/`.

### `env.Supabase.txt` (local, fora do git)
```
Url:https://your-project.supabase.co
senha:sua-senha-do-banco
service_role:eyJ...
login_email:seu-email@exemplo.com
```

## Estrutura

```
src/
  lib/        supabase, calc (regras de negócio), format, dates, nav
  hooks/      useDados (busca tudo), useMutations (gravações)
  contexts/   AuthContext, AppContext (mês, salário base, tema)
  components/  ui/ (shadcn), EnvelopeCard, MoneyInput, CategoriaIcon, layout/
  features/   dashboard, lancamentos, orcamentos, contas, metas, futuro, massa, config, auth
scripts/      schema.sql, setup.mjs, import-csv.mjs, sample-financeiro.csv
```

## Telas
- **Início** — disponível livre do mês, reservas (investimento/impostos), mesadas, envelopes (mês +
  ritmo semanal), parcelas e metas.
- **Dashboard** — análise consolidada, quanto ainda pode gastar sem afetar investimento, gráficos.
- **Extrato** — lista (recente no topo), busca, filtros, editar/duplicar/excluir.
- **Novo lançamento** — entrada rápida, parcelas (valor da parcela X/Y **ou** total ÷ parcelas),
  recorrente, meta vinculada.
- **Envelopes** — editar orçamento por mês, recorrência, criar categoria, soma vs renda.
- **Contas & Cartões** — total por conta no mês + detalhe.
- **Metas** — progresso, ritmo necessário, histórico e registro de aportes.
- **Futuro** — saldo projetado 3–12 meses + dívidas e cronograma.
- **Entrada em massa** — grade editável + colar da planilha.

## Regras principais (`src/lib/calc.ts`)
Envelopes (mês/semana), disponível livre, reservas de investimento/impostos, mesada, parcelas e
cronograma, recorrências, progresso de metas e projeção de futuro. Detalhes nas Seções 5 da spec.

## Notas
- Privacidade da **mesada** é tratada na interface (mostra só o total, sem exigir justificativa).
- **Recorrências:** orçamentos recorrentes herdam para os meses seguintes e os lançamentos recorrentes
  entram na projeção de futuro (não são copiados fisicamente ao virar o mês — simplificação consciente).
- **Itens "A classificar":** lançamentos ambíguos da planilha (ex.: marketplaces genéricos) ficam na
  categoria *A classificar* para revisão no Extrato.
