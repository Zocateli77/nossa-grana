# Estudo de Segurança — Nossa Grana

> App React + Vite + Supabase de controle financeiro de casal.
> Repositório **público**: `github.com/Zocateli77/nossa-grana` · Deploy: Vercel.
> Data da auditoria: 2026-07-03.

## Sumário executivo

O app tem uma base de segurança **sólida** (rotas protegidas por autenticação, RLS habilitada
em todas as tabelas, sem XSS, sem segredos hardcoded no código-fonte). Porém, por estar **público**,
dois problemas exigem ação:

1. **CRÍTICO** — Um CSV com dados financeiros **reais** (nomes, salários, contas bancárias) ainda é
   recuperável do histórico do git, mesmo tendo sido "removido" num commit posterior.
2. **ALTO** — Uma falha de autorização na RLS de workspaces permitia que qualquer usuário
   cadastrado acessasse os dados de outro casal, caso conhecesse o UUID do workspace-alvo.

Ambos foram tratados nesta entrega (ver "Status" em cada item). Chaves administrativas
(`service_role`, senha do Postgres) **NÃO** vazaram publicamente — foi um mito das primeiras
análises; confirmado que aparecem em **zero** commits.

## Metodologia

Três varreduras paralelas (segredos/histórico git, Supabase/RLS/multi-tenant, frontend/infra) +
verificação manual dos achados load-bearing diretamente no repositório e no histórico do git.

## Achados

| # | Achado | Gravidade | Status |
|---|--------|-----------|--------|
| 1 | CSV financeiro real recuperável do histórico público | **CRÍTICO** | Corrigido (purga de histórico) |
| 2 | Broken access control: auto-inserção em qualquer workspace | **ALTO** | Corrigido (RLS + client) |
| 3 | Aceite de convite não revalidava e-mail/status | MÉDIO | Corrigido (client) |
| 4 | Headers de segurança HTTP ausentes | MÉDIO | Corrigido (`vercel.json`) |
| 5 | Credenciais reais em arquivos locais (não commitados) | MÉDIO (operacional) | Orientação |
| 6 | URL do Supabase / e-mail do autor no histórico | BAIXO | Aceitável |

---

### 1. CSV financeiro real recuperável do histórico público — CRÍTICO

- **Arquivo:** `CONTROLE FINANCEIRO(JULHO).csv`, adicionado no commit `fc67bd1`, removido em `984150f`.
- **Verificação:** `git show fc67bd1:"CONTROLE FINANCEIRO(JULHO).csv"` ainda retorna o conteúdo —
  nomes reais dos membros da família, salário (~R$ 21.000), contas bancárias reais,
  gastos pessoais (terapia, academia, aniversário).
- **Cenário:** remover o arquivo num commit novo **não** apaga do histórico. Em repo público,
  qualquer pessoa recupera via `git show`/`git log` ou pela API de commits do GitHub.
- **Correção:** purga do arquivo de **todo** o histórico com `git filter-repo` + `git push --force`,
  e solicitação ao GitHub para expirar o cache de commits antigos. Ver "Como executar a purga".
- **Ressalva honesta:** o dado ficou público por um período; assuma que pode já ter sido copiado
  por terceiros/crawlers. A purga estanca a exposição contínua, não desfaz cópias já feitas.

### 2. Broken access control no isolamento de workspace — ALTO

- **Onde:** `scripts/schema.sql`, policy `ws_members_insert`; `src/hooks/useWorkspace.ts`.
- **Causa:** a policy permitia `with check (... or user_id = auth.uid())`, ou seja, qualquer usuário
  autenticado podia inserir a si mesmo como membro de **qualquer** workspace.
- **Cadeia de ataque:** cadastro é aberto (`LoginPage` tem "Criar conta") →
  `insert workspace_members(workspace_id = alvo, user_id = eu)` passa na RLS →
  `user_is_workspace_member(alvo)` vira `true` → `update profiles.active_workspace_id = alvo` passa
  no `with check` de `profiles_own` → `current_workspace_id()` retorna o workspace-alvo → todas as
  policies `ws_isolation` liberam leitura/escrita dos dados do casal-alvo (lançamentos, contas,
  saldos, metas, desejos).
- **Fator atenuante:** o atacante precisa do **UUID do workspace-alvo**. UUIDs são aleatórios (v4),
  então não são adivinháveis por força bruta — mas UUIDs vazam por links de convite, prints, logs,
  etc. Trata-se de um controle de autorização quebrado (OWASP A01) que deve ser fechado, não só
  mitigado por obscuridade.
- **Correção aplicada:**
  - `schema.sql`: a policy agora só permite inserção pelo **dono** do workspace, ou pelo próprio
    usuário **quando existe convite pendente** para o e-mail dele naquele workspace.
  - `useAceitarConvite`: revalida o convite no servidor (e-mail + status pendente) antes de inserir.
  - A criação do workspace "dono" continua funcionando: é feita em `provision_workspace()`, uma
    função `SECURITY DEFINER` que não passa por essa policy.
- **Pendência operacional:** a policy vive **no banco**. Editar o `schema.sql` versionado não altera
  a base já provisionada — é preciso rodar o `DROP/CREATE POLICY` no Supabase (ver "Aplicar na base").

### 3. Aceite de convite não revalidava e-mail/status — MÉDIO

- **Onde:** `src/hooks/useAceitarConvite` (`src/hooks/useWorkspace.ts`).
- **Causa:** inseria a associação a partir do objeto `convite` recebido, sem reconferir se pertencia
  ao usuário. A defesa efetiva passou a ser a RLS (achado #2); esta correção é defesa em profundidade.
- **Correção aplicada:** revalida `id + status='pendente' + email == usuário` no servidor antes de
  qualquer escrita.

### 4. Headers de segurança HTTP ausentes — MÉDIO

- **Onde:** `vercel.json` tinha apenas o rewrite de SPA.
- **Faltavam:** `Content-Security-Policy`, `X-Frame-Options` (clickjacking), `Strict-Transport-Security`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **Correção aplicada:** array `headers` adicionado no `vercel.json` (é suportado para SPA Vite). A CSP
  libera apenas `self` + o domínio do Supabase (HTTPS e WSS para realtime).
- **Atenção:** CSP pode bloquear recursos legítimos. Validar no preview/deploy e ajustar
  `connect-src`/`img-src`/`style-src` se algo quebrar (ex.: erros de CSP no console).

### 5. Credenciais reais em arquivos locais (não commitados) — MÉDIO (operacional)

- **Arquivos:** `env.Supabase.txt` (senha do Postgres + `service_role`) e `.env.local` (anon key).
- **Situação:** ambos estão no `.gitignore` e **nunca** foram commitados (verificado: `git ls-files`
  não os lista; `service_role` aparece em 0 commits). **Não há exposição pública.**
- **Risco residual:** só se a máquina for comprometida ou se forem commitados por engano.
- **Orientação:** mantê-los fora do git (já estão). Rotação de `service_role`/senha do Postgres é
  **precaução opcional**, não emergência.

### 6. URL do Supabase e e-mail do autor no histórico — BAIXO

- A URL do projeto e a **anon key** são públicas por design (vão no bundle JS do cliente). Escondê-las
  não agrega segurança — a defesa real é a RLS. O e-mail do autor consta na metadata dos commits
  (inerente ao git). Nenhuma ação necessária além da RLS já reforçada.

---

## O que já estava correto (não mexer)

- Rotas protegidas por autenticação, incluindo `/dashboard` (guard no `App()` antes de renderizar).
- Sem XSS: zero `dangerouslySetInnerHTML`/`innerHTML`/`eval`; React escapa JSX por padrão.
- Sem `console.log` vazando dados financeiros.
- RLS habilitada em todas as tabelas de negócio; `workspace_id` preenchido por trigger no INSERT.
- Sem funções serverless customizadas (superfície reduzida).
- Dependências atualizadas (Supabase-js, React 18, Vite 6, TanStack Query 5, Zod 3).
- Anon key no client: correto por design (protegida pela RLS).

## Como executar a purga do histórico (achado #1)

Requer `git-filter-repo` (Python disponível na máquina):

```bash
pip install git-filter-repo
# a partir de um clone-espelho, para não tocar na árvore de trabalho atual:
git clone --mirror https://github.com/Zocateli77/nossa-grana.git nossa-grana-mirror
cd nossa-grana-mirror
git filter-repo --force --path "CONTROLE FINANCEIRO(JULHO).csv" --invert-paths
git push --force --all
git push --force --tags
```

Depois:
- Abrir chamado no GitHub Support pedindo expiração do cache dos commits antigos.
- Todos os clones existentes precisam refazer o clone (o histórico foi reescrito).

## Aplicar as correções de RLS na base (achado #2)

O `schema.sql` versionado já está corrigido, mas a base provisionada precisa receber o novo policy:

```sql
drop policy if exists ws_members_insert on workspace_members;
create policy ws_members_insert on workspace_members for insert to authenticated
  with check (
    user_is_workspace_dono(workspace_id)
    or (
      user_id = auth.uid()
      and exists (
        select 1 from workspace_invites wi
        where wi.workspace_id = workspace_members.workspace_id
          and lower(wi.email) = lower(auth.jwt() ->> 'email')
          and wi.status = 'pendente'
      )
    )
  );
```

Rodar no SQL editor do Supabase. Testar em seguida: aceitar um convite legítimo deve continuar
funcionando; tentar entrar em um workspace sem convite deve ser negado.

## Checklist de remediação (prioridade)

- [x] Corrigir policy `ws_members_insert` no `schema.sql`.
- [x] Revalidar convite no client (`useAceitarConvite`).
- [x] Adicionar headers de segurança no `vercel.json`.
- [x] **Purgar o CSV real do histórico git + force-push** (achado #1) — feito com
  `git filter-repo` em clone-espelho; `main` + 2 branches `codex/*` reescritas e force-pushed.
  Clone limpo confirma: 0 linhas financeiras reais, commit `fc67bd1` inacessível.
- [x] **Anonimizar nomes reais** (Lucas/Letícia/Maria) — removidos do `import-csv.mjs` atual e
  redigidos em todo o histórico via `--replace-text`. Clone limpo confirma: 0 nomes reais.
- [ ] **Aplicar o novo policy de RLS na base Supabase** (achado #2) — ver "Aplicar na base".
- [ ] Reconciliar o repositório LOCAL com o histórico reescrito (ver "Repositório local").
- [ ] Solicitar ao GitHub a expiração do cache de commits antigos (o SHA antigo pode ficar
  em cache/forks por um tempo).
- [ ] Validar CSP no preview/deploy e ajustar se algo quebrar.
- [ ] (Opcional/precaução) Rotacionar `service_role` e senha do Postgres.

## Repositório local (importante)

A reescrita foi feita num clone-espelho e o force-push já atualizou o remoto público. **O seu
repositório local ainda contém o histórico antigo** (com o CSV e os nomes) e o seu trabalho em
andamento (migração multi-tenant) não commitado. **NÃO faça `git push --force` do `main` local
antigo** — isso reintroduziria os dados sensíveis. Reconcilie assim (preserva seu trabalho):

```bash
git stash --include-untracked      # guarda WIP + edições de segurança
git fetch origin
git reset --hard origin/main       # main local = histórico limpo
git stash pop                      # reaplica seu trabalho (resolver conflito em import-csv.mjs se houver)
```

Depois, commite as correções de segurança (schema.sql, vercel.json, useWorkspace.ts,
import-csv.mjs, SECURITY_AUDIT.md) junto do seu fluxo normal.
