// Migracao v6 — multi-tenant: aplica schema, cria workspace legado e faz backfill.
// Roda tudo em UMA transacao (schema + backfill atomicos): ou aplica junto, ou
// reverte por completo. Isso evita deixar linhas com workspace_id NULL escondidas
// atras do RLS caso o backfill falhe.
// Busca o user_id direto em auth.users via conexao pg (superuser postgres) — nao
// depende de service_role, que nao esta mais no env.Supabase.txt.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DRY_RUN = process.argv.includes('--dry-run')

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
    loginEmail: out['login_email'] || process.env.LOGIN_EMAIL || null,
  }
}

const cred = lerCredenciais()
if (!cred.url || !cred.senha) {
  console.error('✗ env.Supabase.txt precisa das chaves "Url" e "Senha".')
  process.exit(1)
}
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

  console.log(`→ Conectando em ${DB_HOST} ${DRY_RUN ? '(DRY-RUN)' : ''}...`)
  await client.connect()
  console.log('✓ Conectado')

  try {
    await client.query('begin')

    console.log('→ Aplicando schema.sql ...')
    await client.query(readFileSync(join(__dirname, 'schema.sql'), 'utf8'))
    console.log('✓ Schema aplicado (dentro da transação)')

    // Descobre user_id direto em auth.users (postgres superuser tem acesso).
    let userRow
    if (cred.loginEmail) {
      const { rows } = await client.query(
        'select id, email from auth.users where lower(email) = lower($1) limit 1',
        [cred.loginEmail]
      )
      userRow = rows[0]
    }
    if (!userRow) {
      const { rows } = await client.query('select id, email from auth.users order by created_at asc limit 1')
      userRow = rows[0]
    }

    if (!userRow) {
      console.log('! Nenhum usuário em auth.users — pulando workspace legado e backfill')
    } else {
      const userId = userRow.id
      console.log(`✓ Usuário para migração: ${userRow.email} (${userId})`)

      // Provisiona workspace legado só se ainda não houver profile (idempotente).
      const { rows: existingProfile } = await client.query(
        'select active_workspace_id from profiles where user_id = $1',
        [userId]
      )
      let workspaceId
      if (existingProfile.length > 0) {
        workspaceId = existingProfile[0].active_workspace_id
        console.log(`· Profile já existe, usando workspace ${workspaceId}`)
      } else {
        const wsRes = await client.query(`select provision_workspace($1, 'Nossa Grana') as id`, [userId])
        workspaceId = wsRes.rows[0].id
        console.log(`✓ Workspace legado criado: ${workspaceId}`)
      }

      // Backfill workspace_id nas linhas sem workspace.
      for (const tabela of TABELAS) {
        const res = await client.query(
          `update ${tabela} set workspace_id = $1 where workspace_id is null`,
          [workspaceId]
        )
        if (res.rowCount > 0) console.log(`  ✓ ${tabela}: ${res.rowCount} linhas atualizadas`)
      }

      // Torna workspace_id NOT NULL onde já não há nulos (após backfill).
      for (const tabela of TABELAS) {
        const { rows } = await client.query(`select count(*)::int as n from ${tabela} where workspace_id is null`)
        if (rows[0].n === 0) {
          await client.query(`alter table ${tabela} alter column workspace_id set not null`)
          console.log(`  ✓ ${tabela}.workspace_id → NOT NULL`)
        } else {
          console.log(`  · ${tabela}: ainda tem ${rows[0].n} linhas sem workspace_id`)
        }
      }
    }

    if (DRY_RUN) {
      await client.query('rollback')
      console.log('\n↩️  DRY-RUN: transação revertida, nenhuma mudança persistida.')
    } else {
      await client.query('commit')
      console.log('\n✅ Migração v6 concluída (commit).')
    }
  } catch (e) {
    await client.query('rollback').catch(() => {})
    throw e
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('✗ Falhou (transação revertida):', e)
  process.exit(1)
})
