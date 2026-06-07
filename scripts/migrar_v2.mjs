// Migração v2 — NÃO destrutiva (banco em produção).
// Adiciona: lancamentos.status, orcamentos.tipo_valor/percentual, tabela rendas (+RLS +seed).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function lerCredenciais() {
  const txt = readFileSync(join(ROOT, 'env.Supabase.txt'), 'utf8')
  const out = {}
  for (const linha of txt.split(/\r?\n/)) {
    const i = linha.indexOf(':')
    if (i < 0) continue
    out[linha.slice(0, i).trim().toLowerCase()] = linha.slice(i + 1).trim()
  }
  return { url: out['url'], senha: out['senha'] }
}

const cred = lerCredenciais()
const ref = new URL(cred.url).hostname.split('.')[0]

const SQL = `
-- status dos lançamentos
alter table lancamentos add column if not exists status text default 'pago';
update lancamentos set status = 'pago' where status is null;

-- envelopes por percentual
alter table orcamentos add column if not exists tipo_valor text default 'fixo';
alter table orcamentos add column if not exists percentual numeric(5,2);
update orcamentos set tipo_valor = 'fixo' where tipo_valor is null;

-- renda prevista por mês (com herança recorrente, como orcamentos)
create table if not exists rendas (
  id uuid primary key default gen_random_uuid(),
  mes_referencia date not null unique,
  valor numeric(12,2) not null default 0,
  recorrente boolean default true,
  observacao text,
  criado_em timestamptz default now()
);

alter table rendas enable row level security;
drop policy if exists casal_full_access on rendas;
create policy casal_full_access on rendas for all to authenticated using (true) with check (true);

-- seed da renda padrão (só se a tabela estiver vazia)
insert into rendas (mes_referencia, valor, recorrente)
select date '2026-07-01', 21000, true
where not exists (select 1 from rendas);
`

async function main() {
  const { Client } = pg
  const client = new Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: 'postgres',
    password: cred.senha,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  })
  console.log(`→ Conectando em db.${ref}.supabase.co ...`)
  await client.connect()
  console.log('✓ Conectado. Aplicando migração v2 ...')
  await client.query(SQL)

  const cols = await client.query(
    `select table_name, column_name from information_schema.columns
     where (table_name='lancamentos' and column_name='status')
        or (table_name='orcamentos' and column_name in ('tipo_valor','percentual'))
     order by table_name, column_name`
  )
  const rendas = await client.query('select mes_referencia, valor, recorrente from rendas order by mes_referencia')
  console.log('✓ Colunas adicionadas:', cols.rows.map((r) => `${r.table_name}.${r.column_name}`).join(', '))
  console.log('✓ Tabela rendas:', JSON.stringify(rendas.rows))
  await client.end()
  console.log('✅ Migração v2 concluída.')
}

main().catch((e) => {
  console.error('✗ Falhou:', e)
  process.exit(1)
})
