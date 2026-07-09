-- =====================================================================
--  Nossa Grana — schema (Seção 4 da spec) + RLS + triggers + multi-tenant
--  Idempotente: pode rodar várias vezes sem quebrar.
-- =====================================================================

-- ---------------------------------------------------------------------
--  0) Workspaces / multi-tenant
-- ---------------------------------------------------------------------
create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_por uuid references auth.users(id),
  criado_em timestamptz default now()
);

create table if not exists workspace_members (
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  papel text not null default 'membro' check (papel in ('dono', 'membro')),
  criado_em timestamptz default now(),
  primary key (workspace_id, user_id)
);

create index if not exists idx_ws_members_user on workspace_members (user_id);

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_workspace_id uuid references workspaces(id),
  nome text,
  criado_em timestamptz default now()
);

create table if not exists workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  email text not null,
  token uuid default gen_random_uuid(),
  papel text not null default 'membro' check (papel in ('dono', 'membro')),
  status text not null default 'pendente' check (status in ('pendente', 'aceito', 'revogado')),
  convidado_por uuid references auth.users(id),
  criado_em timestamptz default now()
);

create index if not exists idx_ws_invites_email on workspace_invites (email);
create index if not exists idx_ws_invites_ws on workspace_invites (workspace_id);

-- colunas idempotentes (bancos com tabelas criadas parcialmente)
alter table workspace_members add column if not exists papel text not null default 'membro';
alter table workspace_members add column if not exists criado_em timestamptz default now();
alter table workspace_invites add column if not exists papel text not null default 'membro';
alter table workspace_invites add column if not exists status text not null default 'pendente';
alter table workspace_invites add column if not exists token uuid default gen_random_uuid();
alter table workspace_invites add column if not exists convidado_por uuid references auth.users(id);
alter table profiles add column if not exists nome text;
alter table profiles add column if not exists email text;
update profiles p set email = u.email from auth.users u where p.user_id = u.id and p.email is null;
alter table profiles add column if not exists active_workspace_id uuid references workspaces(id);
-- onboarding: null = ainda não visto; timestamp = concluído/dispensado (uma vez por usuário)
alter table profiles add column if not exists onboarding_em timestamptz;
alter table workspaces add column if not exists criado_por uuid references auth.users(id);
alter table workspaces add column if not exists nome text;
alter table workspaces add column if not exists criado_em timestamptz default now();
update workspaces set nome = coalesce(nome, name, 'Meu espaço') where nome is null;

-- relaxa NOT NULL legado para permitir inserts só com nome
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='workspaces' and column_name='name') then
    alter table workspaces alter column name drop not null;
    alter table workspaces alter column slug drop not null;
  end if;
exception when others then null;
end $$;

-- 1) Pessoas
create table if not exists pessoas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cor text,
  criado_em timestamptz default now()
);

-- 2) Categorias / envelopes
create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  grupo text,
  tipo_reserva text default 'gasto',     -- 'gasto' | 'investimento' | 'imposto' | 'mesada'
  dono_id uuid references pessoas(id),
  cor text,
  icone text,
  ativo boolean default true,
  criado_em timestamptz default now()
);

-- 3) Contas e cartões
create table if not exists contas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null,                    -- 'cartao_credito' | 'conta' | 'dinheiro' | 'emprestimo'
  dono_id uuid references pessoas(id),
  dia_fechamento int,
  dia_vencimento int,
  limite numeric(12,2),
  cor text,
  ativo boolean default true,
  criado_em timestamptz default now()
);

-- 4) Metas
create table if not exists metas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text default 'investimento',      -- 'investimento' | 'compra' | 'reserva_emergencia' | 'quitacao_divida' | 'viagem'
  valor_alvo numeric(12,2) not null,
  valor_atual numeric(12,2) default 0,
  data_alvo date,
  cor text,
  icone text,
  descricao text,
  concluida boolean default false,
  criado_em timestamptz default now()
);

-- 5) Orçamentos (envelope por categoria por mês)
create table if not exists orcamentos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references categorias(id) not null,
  mes_referencia date not null,          -- sempre o 1º dia do mês
  valor_estabelecido numeric(12,2) not null default 0,
  tipo_valor text default 'fixo',        -- 'fixo' | 'percentual'
  percentual numeric(5,2),               -- usado quando tipo_valor = 'percentual'
  recorrente boolean default true,
  observacao text,
  unique (categoria_id, mes_referencia)
);

-- 5b) Renda prevista por mês (renda variável PJ, com herança recorrente)
create table if not exists rendas (
  id uuid primary key default gen_random_uuid(),
  mes_referencia date not null unique,
  valor numeric(12,2) not null default 0,
  recorrente boolean default true,
  observacao text,
  criado_em timestamptz default now()
);

-- 6) Lançamentos
create table if not exists lancamentos (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  valor numeric(12,2) not null,
  data date not null default current_date,
  tipo text not null default 'despesa',  -- 'despesa' | 'investimento' | 'imposto' | 'emprestimo' | 'receita'
  conta_id uuid references contas(id),
  categoria_id uuid references categorias(id),
  dono_id uuid references pessoas(id),
  meta_id uuid references metas(id),
  parcela_atual int,
  parcela_total int,
  valor_total numeric(12,2),
  data_primeira_parcela date,
  recorrente boolean default false,
  frequencia text default 'mensal',      -- 'mensal' | 'semanal' | 'anual'
  status text default 'pago',            -- 'pago' | 'previsto' | 'quitado'
  pago boolean default true,
  privado boolean default false,
  grupo_id uuid,                         -- liga as ocorrências de uma mesma série (parcelas / recorrência)
  observacao text,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- coluna de agrupamento de séries (idempotente p/ bancos já existentes)
alter table lancamentos add column if not exists grupo_id uuid;

create index if not exists idx_lanc_data on lancamentos (data);
create index if not exists idx_lanc_categoria on lancamentos (categoria_id);
create index if not exists idx_lanc_conta on lancamentos (conta_id);
create index if not exists idx_lanc_meta on lancamentos (meta_id);
create index if not exists idx_lanc_grupo on lancamentos (grupo_id);

-- 7) Desejos / compras planejadas antes de virarem lancamentos reais
create table if not exists desejos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  status text not null default 'desejo'
    check (status in ('desejo','avaliando','planejado','pronto','comprado','arquivado')),
  valor_total numeric(12,2) not null default 0,
  parcela_total int not null default 1 check (parcela_total >= 1),
  mes_inicio date,
  categoria_id uuid references categorias(id),
  conta_id uuid references contas(id),
  dono_id uuid references pessoas(id),
  prioridade text not null default 'media' check (prioridade in ('baixa','media','alta')),
  lancamento_grupo_id uuid,
  comprado_em timestamptz,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

create index if not exists idx_desejos_status on desejos (status);
create index if not exists idx_desejos_mes_inicio on desejos (mes_inicio);
create index if not exists idx_desejos_categoria on desejos (categoria_id);
create index if not exists idx_desejos_conta on desejos (conta_id);

-- 8) IA concierge / relatorios
create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id),
  titulo text,
  status text not null default 'aberta' check (status in ('aberta','arquivada')),
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  conversation_id uuid references ai_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  model text,
  input_tokens int not null default 0 check (input_tokens >= 0),
  output_tokens int not null default 0 check (output_tokens >= 0),
  action_draft_id uuid,
  criado_em timestamptz default now()
);

create table if not exists ai_memories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  key text not null,
  value text not null,
  status text not null default 'aprovada' check (status in ('aprovada','arquivada')),
  approved_by uuid references auth.users(id),
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now(),
  unique (workspace_id, key)
);

create table if not exists ai_action_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  conversation_id uuid references ai_conversations(id) on delete set null,
  created_by uuid references auth.users(id),
  type text not null check (type in ('orcamento.upsert','lancamento.insert','meta.update','desejo.upsert','conta.upsert')),
  title text not null,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  impact jsonb,
  status text not null default 'pending' check (status in ('pending','confirmed','rejected','failed')),
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  result jsonb,
  error text,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

create table if not exists ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  conversation_id uuid references ai_conversations(id) on delete set null,
  message_id uuid references ai_messages(id) on delete set null,
  model text not null,
  input_tokens int not null default 0 check (input_tokens >= 0),
  output_tokens int not null default 0 check (output_tokens >= 0),
  cost_usd numeric(12,6) not null default 0,
  criado_em timestamptz default now()
);

create table if not exists email_report_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade not null,
  run_key text not null,
  report_date date not null,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  recipients text[] not null default '{}',
  ai_notes text[] not null default '{}',
  provider_message_id text,
  error text,
  criado_em timestamptz default now(),
  sent_at timestamptz,
  unique (workspace_id, run_key)
);

create table if not exists report_preferences (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  enabled boolean not null default true,
  send_day int not null default 0 check (send_day between 0 and 6),
  send_hour int not null default 8 check (send_hour between 0 and 23),
  provider text not null default 'resend',
  recipients_mode text not null default 'members' check (recipients_mode in ('members','custom')),
  recipients text[] not null default '{}',
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

create index if not exists idx_ai_conversations_workspace on ai_conversations (workspace_id);
create index if not exists idx_ai_messages_conversation on ai_messages (conversation_id);
create index if not exists idx_ai_messages_workspace on ai_messages (workspace_id);
create index if not exists idx_ai_memories_workspace on ai_memories (workspace_id);
create index if not exists idx_ai_action_drafts_workspace_status on ai_action_drafts (workspace_id, status);
create index if not exists idx_ai_usage_events_workspace on ai_usage_events (workspace_id);
create index if not exists idx_email_report_runs_workspace_date on email_report_runs (workspace_id, report_date);

-- ---------------------------------------------------------------------
--  workspace_id nas tabelas de negócio (idempotente)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['pessoas','categorias','contas','metas','orcamentos','rendas','lancamentos','desejos'] loop
    execute format('alter table %I add column if not exists workspace_id uuid references workspaces(id) on delete cascade', t);
    execute format('create index if not exists idx_%s_workspace on %I (workspace_id)', t, t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['ai_conversations','ai_messages','ai_memories','ai_action_drafts','ai_usage_events','email_report_runs','report_preferences'] loop
    execute format('alter table %I add column if not exists workspace_id uuid references workspaces(id) on delete cascade', t);
    execute format('create index if not exists idx_%s_workspace on %I (workspace_id)', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
--  Constraints únicas por workspace (migração idempotente)
-- ---------------------------------------------------------------------
do $$
begin
  -- rendas: unique (mes_referencia) -> unique (workspace_id, mes_referencia)
  if exists (
    select 1 from pg_constraint
    where conrelid = 'rendas'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) like '%mes_referencia%'
      and pg_get_constraintdef(oid) not like '%workspace_id%'
  ) then
    alter table rendas drop constraint if exists rendas_mes_referencia_key;
    -- tenta nome genérico também
    execute (
      select 'alter table rendas drop constraint ' || quote_ident(conname)
      from pg_constraint
      where conrelid = 'rendas'::regclass and contype = 'u'
        and pg_get_constraintdef(oid) like '%mes_referencia%'
        and pg_get_constraintdef(oid) not like '%workspace_id%'
      limit 1
    );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'rendas'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) like '%workspace_id%mes_referencia%'
  ) then
    alter table rendas add constraint rendas_workspace_mes_unique unique (workspace_id, mes_referencia);
  end if;

  -- orcamentos: unique (categoria_id, mes_referencia) -> unique (workspace_id, categoria_id, mes_referencia)
  if exists (
    select 1 from pg_constraint
    where conrelid = 'orcamentos'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) like '%categoria_id%mes_referencia%'
      and pg_get_constraintdef(oid) not like '%workspace_id%'
  ) then
    alter table orcamentos drop constraint if exists orcamentos_categoria_id_mes_referencia_key;
    execute (
      select 'alter table orcamentos drop constraint ' || quote_ident(conname)
      from pg_constraint
      where conrelid = 'orcamentos'::regclass and contype = 'u'
        and pg_get_constraintdef(oid) like '%categoria_id%mes_referencia%'
        and pg_get_constraintdef(oid) not like '%workspace_id%'
      limit 1
    );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'orcamentos'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) like '%workspace_id%categoria_id%mes_referencia%'
  ) then
    alter table orcamentos add constraint orcamentos_workspace_cat_mes_unique unique (workspace_id, categoria_id, mes_referencia);
  end if;
exception when others then
  raise notice 'Constraint migration skipped: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
--  Contexto de workspace ativo
-- ---------------------------------------------------------------------
create or replace function current_workspace_id() returns uuid
language sql stable security definer set search_path = public as $$
  select active_workspace_id from profiles where user_id = auth.uid()
$$;

create or replace function user_is_workspace_member(ws_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from workspace_members wm
    where wm.workspace_id = ws_id and wm.user_id = auth.uid()
  )
$$;

create or replace function user_is_workspace_dono(ws_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from workspace_members wm
    where wm.workspace_id = ws_id and wm.user_id = auth.uid() and wm.papel = 'dono'
  )
$$;

-- ---------------------------------------------------------------------
--  Trigger: preenche workspace_id automaticamente no INSERT
-- ---------------------------------------------------------------------
create or replace function set_workspace_id() returns trigger
language plpgsql as $$
begin
  if new.workspace_id is null then
    new.workspace_id := current_workspace_id();
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['pessoas','categorias','contas','metas','orcamentos','rendas','lancamentos','desejos'] loop
    execute format('drop trigger if exists trg_set_workspace_id on %I', t);
    execute format(
      'create trigger trg_set_workspace_id before insert on %I for each row execute function set_workspace_id()', t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['ai_conversations','ai_messages','ai_memories','ai_action_drafts','ai_usage_events','email_report_runs','report_preferences'] loop
    execute format('drop trigger if exists trg_set_workspace_id on %I', t);
    execute format(
      'create trigger trg_set_workspace_id before insert on %I for each row execute function set_workspace_id()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
--  Seed padrão de um workspace (pessoas + categorias)
-- ---------------------------------------------------------------------
create or replace function seed_workspace_defaults(ws_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  p_compartilhado uuid;
begin
  insert into pessoas (nome, cor, workspace_id) values
    ('Pessoa A', '#0ea5e9', ws_id),
    ('Pessoa B', '#ec4899', ws_id),
    ('Compartilhado', '#14b8a6', ws_id)
  on conflict do nothing;

  select id into p_compartilhado from pessoas where workspace_id = ws_id and nome = 'Compartilhado' limit 1;

  insert into categorias (nome, grupo, tipo_reserva, dono_id, cor, icone, workspace_id) values
    ('Mercado', 'essencial', 'gasto', null, '#22c55e', 'shopping-cart', ws_id),
    ('Roupas', 'pessoal', 'gasto', null, '#f472b6', 'shirt', ws_id),
    ('Moradia', 'essencial', 'gasto', null, '#6366f1', 'home', ws_id),
    ('Saúde', 'saude', 'gasto', null, '#ef4444', 'heart-pulse', ws_id),
    ('Educação', 'educacao', 'gasto', null, '#3b82f6', 'graduation-cap', ws_id),
    ('Assinaturas', 'assinaturas', 'gasto', null, '#a855f7', 'repeat', ws_id),
    ('Pets', 'pets', 'gasto', null, '#f59e0b', 'paw-print', ws_id),
    ('Lazer', 'lazer', 'gasto', null, '#06b6d4', 'party-popper', ws_id),
    ('Cuidados Pessoais', 'pessoal', 'gasto', null, '#ec4899', 'sparkles', ws_id),
    ('Investimento', 'investimento', 'investimento', null, '#10b981', 'trending-up', ws_id),
    ('Previdência', 'investimento', 'investimento', null, '#14b8a6', 'piggy-bank', ws_id),
    ('Impostos', 'imposto', 'imposto', null, '#64748b', 'landmark', ws_id),
    ('Empréstimo', 'divida', 'gasto', null, '#f43f5e', 'credit-card', ws_id),
    ('A classificar', 'outro', 'gasto', null, '#94a3b8', 'circle-help', ws_id);
end;
$$;

-- ---------------------------------------------------------------------
--  Provisiona workspace (compatível com schema legado name/slug/role)
-- ---------------------------------------------------------------------
create or replace function provision_workspace(p_user_id uuid, p_nome text default 'Meu espaço')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  ws_id uuid := gen_random_uuid();
  slug_val text;
  has_name boolean;
  has_role boolean;
  has_member_id boolean;
  has_joined_at boolean;
begin
  slug_val := lower(regexp_replace(p_nome, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || left(ws_id::text, 8);

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workspaces' and column_name = 'name'
  ) into has_name;

  if has_name then
    execute
      'insert into workspaces (id, nome, name, slug, criado_por, created_at, criado_em)
       values ($1, $2, $2, $3, $4, now(), now())'
      using ws_id, p_nome, slug_val, p_user_id;
  else
    insert into workspaces (id, nome, criado_por, criado_em)
      values (ws_id, p_nome, p_user_id, now());
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workspace_members' and column_name = 'role'
  ) into has_role;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workspace_members' and column_name = 'id'
  ) into has_member_id;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workspace_members' and column_name = 'joined_at'
  ) into has_joined_at;

  if has_role and has_member_id then
    execute
      'insert into workspace_members (id, workspace_id, user_id, papel, role, joined_at)
       values ($1, $2, $3, ''dono'', ''admin''::member_role, now())'
      using gen_random_uuid(), ws_id, p_user_id;
  elsif has_member_id and has_joined_at then
    execute
      'insert into workspace_members (id, workspace_id, user_id, papel, joined_at)
       values ($1, $2, $3, ''dono'', now())'
      using gen_random_uuid(), ws_id, p_user_id;
  elsif has_member_id then
    execute
      'insert into workspace_members (id, workspace_id, user_id, papel, criado_em)
       values ($1, $2, $3, ''dono'', now())'
      using gen_random_uuid(), ws_id, p_user_id;
  else
    insert into workspace_members (workspace_id, user_id, papel, criado_em)
      values (ws_id, p_user_id, 'dono', now());
  end if;

  insert into profiles (user_id, active_workspace_id, nome, email)
    values (
      p_user_id,
      ws_id,
      coalesce(
        (select raw_user_meta_data->>'nome' from auth.users where id = p_user_id),
        split_part((select email from auth.users where id = p_user_id), '@', 1)
      ),
      (select email from auth.users where id = p_user_id)
    )
    on conflict (user_id) do update set
      active_workspace_id = excluded.active_workspace_id,
      email = coalesce(excluded.email, profiles.email);

  perform seed_workspace_defaults(ws_id);
  return ws_id;
end;
$$;

-- provision_workspace recebe p_user_id como argumento; não deve ser chamável
-- diretamente por clientes (permitiria provisionar em nome de outro usuário).
revoke all on function provision_workspace(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
--  Criar workspace para o próprio usuário (RPC segura p/ o cliente)
--  Usa auth.uid() internamente — nunca aceita um user_id arbitrário.
-- ---------------------------------------------------------------------
create or replace function create_my_workspace(p_nome text default 'Meu espaço')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Usuário não autenticado';
  end if;
  return provision_workspace(uid, coalesce(nullif(trim(p_nome), ''), 'Meu espaço'));
end;
$$;

revoke all on function create_my_workspace(text) from public, anon;
grant execute on function create_my_workspace(text) to authenticated;

-- ---------------------------------------------------------------------
--  Provisionamento no signup (trigger em auth.users)
-- ---------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ws uuid;
  inv record;
begin
  ws := provision_workspace(new.id, 'Meu espaço');

  -- aceita convites pendentes para o e-mail do novo usuário
  for inv in
    select id, workspace_id, papel from workspace_invites
    where lower(email) = lower(new.email) and status = 'pendente'
  loop
    insert into workspace_members (workspace_id, user_id, papel)
      values (inv.workspace_id, new.id, inv.papel)
      on conflict do nothing;
    update workspace_invites set status = 'aceito' where id = inv.id;
  end loop;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
--  Trigger: recalcula metas.valor_atual a partir dos aportes (5.7)
-- ---------------------------------------------------------------------
create or replace function recalc_meta_valor_atual() returns trigger as $$
declare
  alvo uuid;
begin
  if (TG_OP = 'DELETE') then
    alvo := OLD.meta_id;
  else
    alvo := NEW.meta_id;
  end if;

  if alvo is not null then
    update metas m set valor_atual = coalesce((
      select sum(l.valor) from lancamentos l
      where l.meta_id = m.id and l.tipo = 'investimento'
    ), 0) where m.id = alvo;
  end if;

  if (TG_OP = 'UPDATE' and OLD.meta_id is distinct from NEW.meta_id and OLD.meta_id is not null) then
    update metas m set valor_atual = coalesce((
      select sum(l.valor) from lancamentos l
      where l.meta_id = m.id and l.tipo = 'investimento'
    ), 0) where m.id = OLD.meta_id;
  end if;

  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_recalc_meta on lancamentos;
create trigger trg_recalc_meta
  after insert or update or delete on lancamentos
  for each row execute function recalc_meta_valor_atual();

-- ---------------------------------------------------------------------
--  Trigger: atualizado_em
-- ---------------------------------------------------------------------
create or replace function set_atualizado_em() returns trigger as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_atualizado_em on lancamentos;
create trigger trg_atualizado_em
  before update on lancamentos
  for each row execute function set_atualizado_em();

drop trigger if exists trg_atualizado_em_desejos on desejos;
create trigger trg_atualizado_em_desejos
  before update on desejos
  for each row execute function set_atualizado_em();

do $$
declare t text;
begin
  foreach t in array array['ai_conversations','ai_memories','ai_action_drafts','report_preferences'] loop
    execute format('drop trigger if exists trg_atualizado_em on %I', t);
    execute format(
      'create trigger trg_atualizado_em before update on %I for each row execute function set_atualizado_em()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
--  RLS — isolamento por workspace
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  -- tabelas de negócio
  foreach t in array array['pessoas','categorias','contas','metas','orcamentos','lancamentos','rendas','desejos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists casal_full_access on %I', t);
    execute format('drop policy if exists ws_isolation on %I', t);
    execute format(
      'create policy ws_isolation on %I for all to authenticated
       using (workspace_id = current_workspace_id())
       with check (workspace_id = current_workspace_id())', t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['ai_conversations','ai_messages','ai_memories','ai_action_drafts','ai_usage_events','email_report_runs','report_preferences'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists ai_ws_isolation on %I', t);
    execute format(
      'create policy ai_ws_isolation on %I for all to authenticated
       using (workspace_id = current_workspace_id())
       with check (workspace_id = current_workspace_id())', t);
  end loop;
end $$;

-- workspaces
alter table workspaces enable row level security;
drop policy if exists ws_member_select on workspaces;
create policy ws_member_select on workspaces for select to authenticated
  using (user_is_workspace_member(id));
drop policy if exists ws_member_update on workspaces;
create policy ws_member_update on workspaces for update to authenticated
  using (user_is_workspace_dono(id))
  with check (user_is_workspace_dono(id));

-- workspace_members
alter table workspace_members enable row level security;
drop policy if exists ws_members_select on workspace_members;
create policy ws_members_select on workspace_members for select to authenticated
  using (user_is_workspace_member(workspace_id));
drop policy if exists ws_members_insert on workspace_members;
-- Segurança: NÃO permitir auto-inserção livre (or user_id = auth.uid()).
-- Isso deixava qualquer usuário autenticado virar "membro" de qualquer workspace
-- cujo UUID conhecesse, e então ler/escrever os dados daquele workspace.
-- Só o dono pode adicionar membros, ou o próprio usuário SE houver convite
-- pendente endereçado ao e-mail dele naquele workspace.
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

-- profiles
alter table profiles enable row level security;
drop policy if exists profiles_own on profiles;
create policy profiles_own on profiles for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (active_workspace_id is null or user_is_workspace_member(active_workspace_id))
  );

-- workspace_invites
alter table workspace_invites enable row level security;
drop policy if exists ws_invites_dono on workspace_invites;
create policy ws_invites_dono on workspace_invites for all to authenticated
  using (
    user_is_workspace_dono(workspace_id)
    or (lower(email) = lower(auth.jwt() ->> 'email') and status = 'pendente')
  )
  with check (
    user_is_workspace_dono(workspace_id)
    or (lower(email) = lower(auth.jwt() ->> 'email') and status in ('pendente', 'aceito'))
  );

-- ---------------------------------------------------------------------
--  Realtime (opcional) — lancamentos e metas
-- ---------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table lancamentos;
  exception when duplicate_object then null; when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table metas;
  exception when duplicate_object then null; when undefined_object then null;
  end;
end $$;
