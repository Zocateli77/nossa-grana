// Migração v4 — materializa séries em linhas reais.
//  • adiciona a coluna grupo_id (idempotente);
//  • parcelas: cria as parcelas futuras que faltam (atual+1 .. total) ligadas por grupo_id;
//  • recorrências: materializa cópias mensais até o mês atual + 12 (janela rolante).
// Não destrutivo e idempotente: linhas já migradas têm grupo_id e são ignoradas.
//
// Uso:
//   node scripts/migrar_v4.mjs --dry-run   → só LÊ e mostra o que seria criado (não grava nada)
//   node scripts/migrar_v4.mjs             → aplica (dentro de uma transação)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DRY = process.argv.includes('--dry-run')
const MESES_ADIANTE = 12

function cred() {
  const txt = readFileSync(join(ROOT, 'env.Supabase.txt'), 'utf8')
  const out = {}
  for (const l of txt.split(/\r?\n/)) {
    const i = l.indexOf(':')
    if (i > 0) out[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim()
  }
  return out
}

// ---- helpers de data (yyyy-mm-dd) ----
function addMonthsISO(isoStr, n) {
  const [y, m, d] = isoStr.slice(0, 10).split('-').map(Number)
  const base = new Date(Date.UTC(y, m - 1 + n, 1))
  const year = base.getUTCFullYear()
  const month = base.getUTCMonth()
  const diasNoMes = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const day = Math.min(d, diasNoMes)
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
const mesRefOf = (isoStr) => `${isoStr.slice(0, 7)}-01`
function currentMonthRef() {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`
}
const FIM = addMonthsISO(currentMonthRef(), MESES_ADIANTE)
const statusFor = (isoStr, tipo) =>
  tipo === 'receita' ? 'previsto' : mesRefOf(isoStr) > currentMonthRef() ? 'previsto' : 'pago'

const COLS = [
  'descricao', 'valor', 'data', 'tipo', 'conta_id', 'categoria_id', 'dono_id', 'meta_id',
  'parcela_atual', 'parcela_total', 'valor_total', 'data_primeira_parcela',
  'recorrente', 'frequencia', 'status', 'pago', 'privado', 'grupo_id', 'observacao',
]
async function inserir(client, row) {
  const vals = COLS.map((c) => (row[c] === undefined ? null : row[c]))
  const ph = COLS.map((_, i) => `$${i + 1}`).join(',')
  await client.query(`insert into lancamentos (${COLS.join(',')}) values (${ph})`, vals)
}

async function temColunaGrupo(client) {
  const r = await client.query(
    `select 1 from information_schema.columns where table_name = 'lancamentos' and column_name = 'grupo_id'`
  )
  return r.rowCount > 0
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
  console.log(`✓ Conectado. Modo: ${DRY ? 'DRY-RUN (somente leitura)' : 'APLICAR'} · janela até ${FIM}`)

  const colExiste = await temColunaGrupo(client)
  const filtroGrupo = colExiste ? 'and grupo_id is null' : ''
  if (!colExiste) console.log('  (coluna grupo_id ainda não existe — será criada na aplicação)')

  const SELECT = `select id, descricao, valor, data::text as data, tipo, conta_id, categoria_id, dono_id,
    meta_id, parcela_atual, parcela_total, valor_total, data_primeira_parcela::text as data_primeira_parcela,
    recorrente, frequencia, status, pago, privado, observacao from lancamentos`

  const parcelas = await client.query(
    `${SELECT} where parcela_total is not null and parcela_total > 1 and status <> 'quitado' ${filtroGrupo}`
  )
  const recorrentes = await client.query(
    `${SELECT} where recorrente = true and (parcela_total is null or parcela_total <= 1) and status <> 'quitado' ${filtroGrupo}`
  )

  // pré-calcula quantas linhas seriam criadas (sem gravar)
  let plParcelas = 0
  for (const l of parcelas.rows) plParcelas += Math.max(0, l.parcela_total - (l.parcela_atual ?? 1))
  let plRecorr = 0
  for (const l of recorrentes.rows) {
    for (let k = 1; k <= 240; k++) {
      if (mesRefOf(addMonthsISO(l.data, k)) > FIM) break
      plRecorr++
    }
  }

  console.log(`\nResumo do que ${DRY ? 'seria' : 'será'} criado:`)
  console.log(`  • Parcelas:    ${parcelas.rows.length} séries → ${plParcelas} parcelas futuras`)
  console.log(`  • Recorrências: ${recorrentes.rows.length} séries → ${plRecorr} meses`)
  if (parcelas.rows[0]) {
    const s = parcelas.rows[0]
    console.log(`  ex. parcela: "${s.descricao}" ${s.parcela_atual}/${s.parcela_total} (${s.data})`)
  }
  if (recorrentes.rows[0]) {
    const s = recorrentes.rows[0]
    console.log(`  ex. recorrência: "${s.descricao}" a partir de ${s.data}`)
  }

  if (DRY) {
    console.log('\n🔎 DRY-RUN: nada foi gravado. Rode sem --dry-run para aplicar.')
    await client.end()
    return
  }

  // ---- APLICAÇÃO (transação) ----
  await client.query('begin')
  try {
    await client.query('alter table lancamentos add column if not exists grupo_id uuid')
    await client.query('create index if not exists idx_lanc_grupo on lancamentos (grupo_id)')

    let criadasParcelas = 0
    for (const l of parcelas.rows) {
      const grupoId = randomUUID()
      const atual = l.parcela_atual ?? 1
      const total = l.parcela_total
      const primeira = l.data_primeira_parcela ?? addMonthsISO(l.data, -(atual - 1))
      await client.query('update lancamentos set grupo_id = $1, data_primeira_parcela = $2 where id = $3', [grupoId, primeira, l.id])
      for (let k = atual + 1; k <= total; k++) {
        const data = addMonthsISO(l.data, k - atual)
        await inserir(client, {
          descricao: l.descricao, valor: l.valor, data, tipo: l.tipo,
          conta_id: l.conta_id, categoria_id: l.categoria_id, dono_id: l.dono_id,
          meta_id: null, parcela_atual: k, parcela_total: total, valor_total: l.valor_total,
          data_primeira_parcela: primeira, recorrente: false, frequencia: l.frequencia ?? 'mensal',
          status: statusFor(data, l.tipo), pago: true, privado: l.privado ?? false,
          grupo_id: grupoId, observacao: l.observacao,
        })
        criadasParcelas++
      }
    }

    let criadasRecorr = 0
    for (const l of recorrentes.rows) {
      const grupoId = randomUUID()
      await client.query('update lancamentos set grupo_id = $1 where id = $2', [grupoId, l.id])
      for (let k = 1; k <= 240; k++) {
        const data = addMonthsISO(l.data, k)
        if (mesRefOf(data) > FIM) break
        await inserir(client, {
          descricao: l.descricao, valor: l.valor, data, tipo: l.tipo,
          conta_id: l.conta_id, categoria_id: l.categoria_id, dono_id: l.dono_id,
          meta_id: null, parcela_atual: null, parcela_total: null, valor_total: null,
          data_primeira_parcela: null, recorrente: true, frequencia: l.frequencia ?? 'mensal',
          status: statusFor(data, l.tipo), pago: true, privado: l.privado ?? false,
          grupo_id: grupoId, observacao: l.observacao,
        })
        criadasRecorr++
      }
    }

    await client.query('commit')
    console.log(`\n✓ Parcelas criadas: ${criadasParcelas}`)
    console.log(`✓ Meses de recorrência criados: ${criadasRecorr}`)
    const resumo = await client.query('select count(*)::int as n, count(grupo_id)::int as com_grupo from lancamentos')
    console.log('Total de lançamentos:', JSON.stringify(resumo.rows[0]))
    console.log('✅ Migração v4 concluída.')
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('✗ Falhou:', e)
  process.exit(1)
})
