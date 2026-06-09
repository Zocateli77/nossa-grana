-- =====================================================================
--  Nossa Grana — schema (Seção 4 da spec) + RLS + triggers
--  Idempotente: pode rodar várias vezes sem quebrar.
-- =====================================================================

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

-- ---------------------------------------------------------------------
--  RLS — app doméstico do casal: usuário autenticado acessa tudo
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['pessoas','categorias','contas','metas','orcamentos','lancamentos','rendas'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists casal_full_access on %I', t);
    execute format(
      'create policy casal_full_access on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

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
