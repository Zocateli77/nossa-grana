// Setup completo do Supabase: schema + RLS + triggers + seed + import do CSV + usuário de login.
// Conexão direta no Postgres (IPv6) usando a senha do arquivo env.Supabase.txt.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import { parseFinanceCsv } from './import-csv.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ---------- credenciais ----------
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
const LOGIN_EMAIL = cred.loginEmail
const LOGIN_SENHA = cred.senha
const MES = '2026-07-01'

const { Client } = pg
const client = new Client({
  host: DB_HOST,
  port: 5432,
  user: 'postgres',
  password: cred.senha,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
})

const round2 = (n) => Math.round(n * 100) / 100
const ceilTo = (n, step) => Math.ceil(n / step) * step
const addMonths = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().slice(0, 10)
}

async function main() {
  console.log(`→ Conectando em ${DB_HOST} ...`)
  await client.connect()
  console.log('✓ Conectado')

  // ---------- schema ----------
  console.log('→ Aplicando schema.sql ...')
  await client.query(readFileSync(join(__dirname, 'schema.sql'), 'utf8'))
  console.log('✓ Schema/RLS/triggers aplicados')

  // ---------- limpa dados (idempotente) ----------
  await client.query(
    'truncate desejos, lancamentos, orcamentos, metas, categorias, contas, pessoas restart identity cascade'
  )

  // ---------- pessoas ----------
  const pessoas = [
    ['Pessoa A', '#0ea5e9'],
    ['Pessoa B', '#ec4899'],
    ['Pessoa C', '#f59e0b'],
    ['Compartilhado', '#14b8a6'],
  ]
  const pessoaId = {}
  for (const [nome, cor] of pessoas) {
    const r = await client.query('insert into pessoas (nome, cor) values ($1,$2) returning id', [nome, cor])
    pessoaId[nome] = r.rows[0].id
  }
  console.log(`✓ ${pessoas.length} pessoas`)

  // ---------- contas ----------
  const contas = [
    ['Cartão Amazon', 'cartao_credito', 'Compartilhado', '#ff9900'],
    ['Cartão Mercado Pago', 'cartao_credito', 'Compartilhado', '#00b1ea'],
    ['Cartão Compartilhado', 'cartao_credito', 'Compartilhado', '#7c3aed'],
    ['Conta Pessoa A', 'cartao_credito', 'Pessoa A', '#ff7a00'],
    ['Nubank - Pessoa B', 'cartao_credito', 'Pessoa B', '#820ad1'],
    ['Nubank - Pessoa A', 'cartao_credito', 'Pessoa A', '#820ad1'],
    ['Nubank - Pessoa C', 'cartao_credito', 'Pessoa C', '#820ad1'],
    ['Pix/Dinheiro', 'dinheiro', 'Compartilhado', '#16a34a'],
    ['Empréstimo', 'emprestimo', 'Compartilhado', '#f43f5e'],
  ]
  const contaId = {}
  const contaDono = {}
  for (const [nome, tipo, dono, cor] of contas) {
    const r = await client.query(
      'insert into contas (nome, tipo, dono_id, cor) values ($1,$2,$3,$4) returning id',
      [nome, tipo, pessoaId[dono], cor]
    )
    contaId[nome] = r.rows[0].id
    contaDono[nome] = dono
  }
  console.log(`✓ ${contas.length} contas`)

  // ---------- categorias ----------
  // [nome, grupo, tipo_reserva, dono, cor, icone]
  const categorias = [
    ['Mercado', 'essencial', 'gasto', null, '#22c55e', 'shopping-cart'],
    ['Roupas', 'pessoal', 'gasto', null, '#f472b6', 'shirt'],
    ['Moradia', 'essencial', 'gasto', null, '#6366f1', 'home'],
    ['Saúde', 'saude', 'gasto', null, '#ef4444', 'heart-pulse'],
    ['Educação', 'educacao', 'gasto', null, '#3b82f6', 'graduation-cap'],
    ['Assinaturas', 'assinaturas', 'gasto', null, '#a855f7', 'repeat'],
    ['Pets', 'pets', 'gasto', null, '#f59e0b', 'paw-print'],
    ['Lazer', 'lazer', 'gasto', null, '#06b6d4', 'party-popper'],
    ['Cuidados Pessoais', 'pessoal', 'gasto', null, '#ec4899', 'sparkles'],
    ['Mesada Pessoa A', 'pessoal', 'mesada', 'Pessoa A', '#0ea5e9', 'wallet'],
    ['Mesada Pessoa B', 'pessoal', 'mesada', 'Pessoa B', '#ec4899', 'wallet'],
    ['Investimento', 'investimento', 'investimento', null, '#10b981', 'trending-up'],
    ['Previdência', 'investimento', 'investimento', null, '#14b8a6', 'piggy-bank'],
    ['Impostos', 'imposto', 'imposto', null, '#64748b', 'landmark'],
    ['Empréstimo', 'divida', 'gasto', null, '#f43f5e', 'credit-card'],
    ['A classificar', 'outro', 'gasto', null, '#94a3b8', 'circle-help'],
  ]
  const catId = {}
  for (const [nome, grupo, tipo, dono, cor, icone] of categorias) {
    const r = await client.query(
      'insert into categorias (nome, grupo, tipo_reserva, dono_id, cor, icone) values ($1,$2,$3,$4,$5,$6) returning id',
      [nome, grupo, tipo, dono ? pessoaId[dono] : null, cor, icone]
    )
    catId[nome] = r.rows[0].id
  }
  console.log(`✓ ${categorias.length} categorias`)

  // ---------- metas ----------
  const metas = [
    ['Reserva de Emergência', 'reserva_emergencia', 60000, '2026-12-01', '#14b8a6', 'shield',
      'Colchão de segurança — ~6 meses de custos.'],
    ['Carteira de Investimentos', 'investimento', 100000, '2027-12-01', '#10b981', 'trending-up',
      'Acumular aportes mensais e ver o patrimônio crescer.'],
    ['Quitar Empréstimo', 'quitacao_divida', round2(300 * 12), '2026-12-01', '#f43f5e', 'credit-card',
      'Sair da dívida do empréstimo (12 parcelas de R$ 300).'],
  ]
  const metaId = {}
  for (const [nome, tipo, alvo, dataAlvo, cor, icone, desc] of metas) {
    const r = await client.query(
      'insert into metas (nome, tipo, valor_alvo, data_alvo, cor, icone, descricao) values ($1,$2,$3,$4,$5,$6,$7) returning id',
      [nome, tipo, alvo, dataAlvo, cor, icone, desc]
    )
    metaId[nome] = r.rows[0].id
  }
  console.log(`✓ ${metas.length} metas`)

  // ---------- import do CSV ----------
  const csvPath = join(__dirname, 'sample-financeiro.csv')
  const { transacoes, totaisConta, salario } = parseFinanceCsv(csvPath)

  const RECORR = /aluguel|condominio|\bluz\b|internet|academia|muay|natacao|terapia|ingles|canva|previdencia|investimento|impostos|google one|mounjaro|globoplay|chat gpt|chatgpt|claude/i
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  let nImport = 0
  for (const t of transacoes) {
    const donoNome = t.donoNome ?? contaDono[t.contaNome] ?? 'Compartilhado'
    const parcelado = t.parcelaAtual != null && t.parcelaTotal != null
    const dataPrimeira = parcelado ? addMonths(MES, -(t.parcelaAtual - 1)) : null
    const recorrente = !parcelado && RECORR.test(norm(t.descricao))
    await client.query(
      `insert into lancamentos
       (descricao, valor, data, tipo, conta_id, categoria_id, dono_id, meta_id,
        parcela_atual, parcela_total, valor_total, data_primeira_parcela, recorrente, frequencia, privado, observacao)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        t.descricao,
        t.valor,
        MES,
        t.tipo,
        t.contaNome ? contaId[t.contaNome] : null,
        catId[t.categoria] ?? catId['A classificar'],
        pessoaId[donoNome],
        t.metaNome ? metaId[t.metaNome] : null,
        t.parcelaAtual,
        t.parcelaTotal,
        parcelado ? round2(t.valor * t.parcelaTotal) : null,
        dataPrimeira,
        recorrente,
        'mensal',
        false,
        t.observacao,
      ]
    )
    nImport++
  }
  console.log(`✓ ${nImport} lançamentos importados`)

  // ---------- orçamentos (envelopes) julho/2025 ----------
  const orcFixos = {
    Mercado: 1000, Roupas: 500, Moradia: 1497, Lazer: 500,
    'Mesada Pessoa A': 500, 'Mesada Pessoa B': 500,
    Investimento: 5000, Previdência: 320, Impostos: 1200, Empréstimo: 300,
  }
  // categorias inferidas: orçamento = gasto real arredondado p/ cima (passo 50, mín 100)
  const gastoPorCat = {}
  for (const t of transacoes) gastoPorCat[t.categoria] = (gastoPorCat[t.categoria] ?? 0) + t.valor
  const inferidas = ['Saúde', 'Educação', 'Assinaturas', 'Pets', 'Cuidados Pessoais']
  const orcInferidos = {}
  for (const c of inferidas) orcInferidos[c] = Math.max(100, ceilTo(round2(gastoPorCat[c] ?? 0), 50))

  const todosOrc = { ...orcFixos, ...orcInferidos }
  for (const [cat, valor] of Object.entries(todosOrc)) {
    await client.query(
      'insert into orcamentos (categoria_id, mes_referencia, valor_estabelecido, recorrente) values ($1,$2,$3,true)',
      [catId[cat], MES, valor]
    )
  }
  console.log(`✓ ${Object.keys(todosOrc).length} envelopes (orçamentos)`)

  // ---------- renda prevista (padrão recorrente) ----------
  await client.query(
    'insert into rendas (mes_referencia, valor, recorrente) values ($1, $2, true) on conflict (mes_referencia) do nothing',
    [MES, salario ?? 8000]
  )
  console.log('✓ renda prevista padrão')

  // ---------- meta de quitação: valor_atual = parcelas já pagas ----------
  await client.query('update metas set valor_atual = $1 where id = $2', [round2(300 * 3), metaId['Quitar Empréstimo']])

  // ---------- verificação: totais por conta ----------
  const somaConta = await client.query(
    `select c.nome, coalesce(sum(l.valor),0)::numeric(12,2) as total
     from contas c left join lancamentos l on l.conta_id = c.id group by c.nome order by c.nome`
  )
  console.log('\n— Conferência de totais por conta (importado vs planilha) —')
  const totalMap = Object.fromEntries(totaisConta.map((x) => [x.nome, x.total]))
  for (const row of somaConta.rows) {
    const esperado = totalMap[row.nome]
    const ok = esperado != null && Math.abs(Number(row.total) - esperado) < 0.01
    console.log(`  ${ok ? '✓' : '·'} ${row.nome}: importado R$ ${row.total}` + (esperado != null ? ` | planilha R$ ${esperado.toFixed(2)}` : ''))
  }
  console.log(`  Salário (planilha): R$ ${salario}`)

  await client.end()

  // ---------- usuário de login ----------
  console.log('\n→ Criando usuário de login ...')
  const supa = createClient(cred.url, cred.serviceRole, { auth: { persistSession: false } })
  const { error } = await supa.auth.admin.createUser({
    email: LOGIN_EMAIL,
    password: LOGIN_SENHA,
    email_confirm: true,
  })
  if (error) {
    if (/already|registered|exists/i.test(error.message)) console.log(`· Usuário já existe (${LOGIN_EMAIL})`)
    else console.log(`! Erro ao criar usuário: ${error.message}`)
  } else {
    console.log(`✓ Usuário criado: ${LOGIN_EMAIL}`)
  }

  console.log('\n✅ Setup concluído.')
}

main().catch((e) => {
  console.error('✗ Falhou:', e)
  process.exit(1)
})
