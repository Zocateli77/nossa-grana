// Migração v3 — backfill: marca lançamentos de meses FUTUROS como 'previsto'.
// Não destrutivo, idempotente. Não toca em 'quitado'.
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
  console.log('✓ Conectado. Backfill de status previsto (meses futuros) ...')
  const r = await client.query(
    `update lancamentos set status = 'previsto'
     where status = 'pago' and date_trunc('month', data) > date_trunc('month', current_date)`
  )
  console.log(`✓ ${r.rowCount} lançamentos futuros marcados como 'previsto'`)
  const resumo = await client.query(
    `select status, count(*) from lancamentos group by status order by status`
  )
  console.log('Distribuição:', JSON.stringify(resumo.rows))
  await client.end()
  console.log('✅ Migração v3 concluída.')
}

main().catch((e) => {
  console.error('✗ Falhou:', e)
  process.exit(1)
})
