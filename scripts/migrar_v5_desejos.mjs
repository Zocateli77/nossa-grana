// Migracao v5 - cria a tabela desejos (idempotente).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function cred() {
  const txt = readFileSync(join(ROOT, 'env.Supabase.txt'), 'utf8')
  const out = {}
  for (const l of txt.split(/\r?\n/)) {
    const i = l.indexOf(':')
    if (i > 0) out[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim()
  }
  return out
}

const sql = `
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

create or replace function set_atualizado_em() returns trigger as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_atualizado_em_desejos on desejos;
create trigger trg_atualizado_em_desejos
  before update on desejos
  for each row execute function set_atualizado_em();

alter table desejos enable row level security;
drop policy if exists casal_full_access on desejos;
create policy casal_full_access on desejos for all to authenticated using (true) with check (true);
`

async function main() {
  const c = cred()
  const ref = new URL(c['url']).hostname.split('.')[0]
  const { Client } = pg
  const client = new Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: 'postgres',
    password: c['senha'],
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  })
  await client.connect()
  await client.query(sql)
  const check = await client.query("select to_regclass('public.desejos') as tabela")
  console.log(`Tabela desejos: ${check.rows[0].tabela}`)
  await client.end()
}

main().catch((e) => {
  console.error('Falhou:', e)
  process.exit(1)
})
