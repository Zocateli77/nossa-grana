# 🐷 Nossa Grana

App de **controle financeiro do casal** (Pessoa A & Pessoa B) — orçamento por **envelopes**, com visão de
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

**Login:** conta única compartilhada do casal (e-mail + senha definidos no Supabase Auth; a senha fica
em `env.Supabase.txt`, fora do git).

### Variáveis de ambiente (`.env.local`)
```
VITE_SUPABASE_URL=https://epiudtrblgeljjmogaho.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```
> O frontend usa **apenas** a publishable key. A `service_role` e a senha do banco ficam só nos scripts
> locais (`env.Supabase.txt`, fora do git) e nunca vão para o bundle.

## Banco de dados / seed

```bash
npm run setup      # cria schema + RLS + triggers, semeia os dados e importa o CSV de julho
```

O `scripts/setup.mjs` conecta direto no Postgres (lendo a senha de `env.Supabase.txt`), aplica
`scripts/schema.sql` (tabelas, RLS, trigger que recalcula o progresso das metas), semeia pessoas/contas/
categorias/metas/orçamentos e importa **79 lançamentos** de `CONTROLE FINANCEIRO(JULHO).csv`
(parser em `scripts/import-csv.mjs`, com auto-categorização). É **idempotente** (faz `truncate` e
recria). Os lançamentos são datados em **julho/2026**; ajuste a constante `MES` no script para mudar.

## Estrutura

```
src/
  lib/        supabase, calc (regras de negócio), format, dates, nav
  hooks/      useDados (busca tudo), useMutations (gravações)
  contexts/   AuthContext, AppContext (mês, salário base, tema)
  components/  ui/ (shadcn), EnvelopeCard, MoneyInput, CategoriaIcon, layout/
  features/   dashboard, lancamentos, orcamentos, contas, metas, futuro, massa, config, auth
scripts/      schema.sql, setup.mjs, import-csv.mjs
```

## Telas
- **Início** — disponível livre do mês, reservas (investimento/impostos), mesadas, envelopes (mês +
  ritmo semanal), parcelas e metas.
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
- **Itens "A classificar":** lançamentos ambíguos da planilha (ex.: "Mercado Livre", "Amazon BR",
  "Pix Crédito") ficam na categoria *A classificar* para revisão no Extrato.
