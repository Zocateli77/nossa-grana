// Migracao v6 — multi-tenant: aplica schema, cria workspace legado e faz backfill.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

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
  return {
    url: out['url'],
    senha: out['senha'],
    serviceRole: out['service_role'],
    loginEmail: out['login_email'] || process.env.LOGIN_EMAIL || 'usuario@exemplo.com',
  }
}

const cred = lerCredenciais()
const ref = new URL(cred.url).hostname.split('.')[0]
const DB_HOST = `db.${ref}.supabase.co`

const TABELAS = ['pessoas', 'categorias', 'contas', 'metas', 'orcamentos', 'rendas', 'lancamentos', 'desejos']

async function main() {
  const client = new pg.Client({
    host: DB_HOST,
    port: 5432,
    user: 'postgres',
    password: cred.senha,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  })

  console.log(`→ Conectando em ${DB_HOST} ...`)
  await client.connect()
  console.log('✓ Conectado')

  console.log('→ Aplicando schema.sql ...')
  await client.query(readFileSync(join(__dirname, 'schema.sql'), 'utf8'))
  console.log('✓ Schema aplicado')

  // Descobre user_id do usuário existente
  let userId = null
  const supa = createClient(cred.url, cred.serviceRole, { auth: { persistSession: false } })
  const { data: usersData, error: listErr } = await supa.auth.admin.listUsers({ perPage: 100 })
  if (listErr) throw listErr
  const user =
    usersData.users.find((u) => u.email?.toLowerCase() === cred.loginEmail.toLowerCase()) ??
    usersData.users[0]
  if (user) {
    userId = user.id
    console.log(`✓ Usuário para migração: ${user.email} (${userId})`)
  } else {
    console.log('! Nenhum usuário encontrado — pulando criação de workspace legado')
  }

  if (userId) {
    // Verifica se já existe profile (migração já rodou)
    const { rows: existingProfile } = await client.query('select user_id from profiles where user_id = $1', [userId])
    let workspaceId

    if (existingProfile.length > 0) {
      const { rows } = await client.query('select active_workspace_id from profiles where user_id = $1', [userId])
      workspaceId = rows[0].active_workspace_id
      console.log(`· Profile já existe, usando workspace ${workspaceId}`)
    } else {
      const wsRes = await client.query(`select provision_workspace($1, 'Nossa Grana') as id`, [userId])
      workspaceId = wsRes.rows[0].id
      console.log(`✓ Workspace legado criado: ${workspaceId}`)
    }

    // Backfill workspace_id nos dados sem workspace
    for (const tabela of TABELAS) {
      const res = await client.query(
        `update ${tabela} set workspace_id = $1 where workspace_id is null`,
        [workspaceId]
      )
      if (res.rowCount > 0) console.log(`  ✓ ${tabela}: ${res.rowCount} linhas atualizadas`)
    }

    // Torna workspace_id NOT NULL onde possível (após backfill)
    for (const tabela of TABELAS) {
      const { rows } = await client.query(
        `select count(*)::int as n from ${tabela} where workspace_id is null`
      )
      if (rows[0].n === 0) {
        await client.query(`alter table ${tabela} alter column workspace_id set not null`)
        console.log(`  ✓ ${tabela}.workspace_id → NOT NULL`)
      } else {
        console.log(`  · ${tabela}: ainda tem ${rows[0].n} linhas sem workspace_id`)
      }
    }
  }

  await client.end()
  console.log('\n✅ Migração v6 concluída.')
}

main().catch((e) => {
  console.error('✗ Falhou:', e)
  process.exit(1)
})
