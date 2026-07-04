// Seed de dados fictícios para uma conta específica (workspace isolado).
// Uso: node scripts/seed-demo-conta.mjs [email] [senha-opcional]
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const EMAIL = process.argv[2] || 'zoclabs@gmail.com'
const SENHA = process.argv[3] || null

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
  }
}

const cred = lerCredenciais()
const ref = new URL(cred.url).hostname.split('.')[0]
const client = new pg.Client({
  host: `db.${ref}.supabase.co`,
  port: 5432,
  user: 'postgres',
  password: cred.senha,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

const round2 = (n) => Math.round(n * 100) / 100
const mesRef = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
const addMonths = (iso, n) => {
  const d = new Date(iso + 'T12:00:00')
  d.setMonth(d.getMonth() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
const diaNoMes = (mesIso, dia) => {
  const [y, m] = mesIso.split('-')
  return `${y}-${m}-${String(dia).padStart(2, '0')}`
}

async function garantirConstraintsRendas() {
  await client.query(`
    do $$
    begin
      if exists (
        select 1 from pg_constraint
        where conrelid = 'rendas'::regclass and contype = 'u'
          and pg_get_constraintdef(oid) like '%mes_referencia%'
          and pg_get_constraintdef(oid) not like '%workspace_id%'
      ) then
        alter table rendas drop constraint if exists rendas_mes_referencia_key;
      end if;
      if not exists (
        select 1 from pg_constraint
        where conrelid = 'rendas'::regclass and contype = 'u'
          and pg_get_constraintdef(oid) like '%workspace_id%mes_referencia%'
      ) then
        alter table rendas add constraint rendas_workspace_mes_unique unique (workspace_id, mes_referencia);
      end if;
    exception when others then
      raise notice 'rendas constraint: %', sqlerrm;
    end $$;
  `)
}

async function main() {
  const supa = createClient(cred.url, cred.serviceRole, { auth: { persistSession: false } })

  await client.connect()
  await garantirConstraintsRendas()
  let { rows: users } = await client.query(
    'select id, email from auth.users where lower(email) = lower($1)',
    [EMAIL]
  )

  if (!users.length) {
    const pwd = SENHA || cred.senha
    console.log(`→ Criando usuário ${EMAIL} ...`)
    const { error } = await supa.auth.admin.createUser({
      email: EMAIL,
      password: pwd,
      email_confirm: true,
    })
    if (error) throw new Error(`Falha ao criar usuário: ${error.message}`)
    ;({ rows: users } = await client.query(
      'select id, email from auth.users where lower(email) = lower($1)',
      [EMAIL]
    ))
    console.log(`✓ Usuário criado (senha: mesma do env.Supabase.txt)`)
  } else {
    console.log(`✓ Usuário encontrado: ${EMAIL}`)
  }

  const userId = users[0].id
  let { rows: prof } = await client.query('select active_workspace_id from profiles where user_id = $1', [userId])

  if (!prof.length || !prof[0].active_workspace_id) {
    const { rows: wsRow } = await client.query(`select provision_workspace($1, 'Demo Zoc Labs') as id`, [userId])
    prof = [{ active_workspace_id: wsRow[0].id }]
    console.log(`✓ Workspace provisionado: ${prof[0].active_workspace_id}`)
  }

  const WS = prof[0].active_workspace_id
  await client.query(`update workspaces set nome = 'Família Demo', name = 'Família Demo' where id = $1`, [WS])
  await client.query(`update profiles set active_workspace_id = $1 where user_id = $2`, [WS, userId])

  // Limpa só dados deste workspace
  const tabelas = ['desejos', 'lancamentos', 'orcamentos', 'metas', 'categorias', 'contas', 'pessoas']
  for (const t of tabelas) {
    await client.query(`delete from ${t} where workspace_id = $1`, [WS])
  }
  console.log('✓ Dados anteriores do workspace limpos')

  const mesAtual = mesRef()
  const mesAnterior = addMonths(mesAtual, -1)
  const mesProximo = addMonths(mesAtual, 1)

  // Pessoas
  const pessoas = [
    ['Ana', '#ec4899'],
    ['Bruno', '#0ea5e9'],
    ['Compartilhado', '#14b8a6'],
  ]
  const pessoaId = {}
  for (const [nome, cor] of pessoas) {
    const r = await client.query(
      'insert into pessoas (nome, cor, workspace_id) values ($1,$2,$3) returning id',
      [nome, cor, WS]
    )
    pessoaId[nome] = r.rows[0].id
  }

  // Contas
  const contas = [
    ['Nubank Ana', 'cartao_credito', 'Ana', '#820ad1'],
    ['Nubank Bruno', 'cartao_credito', 'Bruno', '#820ad1'],
    ['Cartão Compartilhado', 'cartao_credito', 'Compartilhado', '#7c3aed'],
    ['Conta Corrente', 'conta', 'Compartilhado', '#6366f1'],
    ['Pix / Dinheiro', 'dinheiro', 'Compartilhado', '#16a34a'],
  ]
  const contaId = {}
  for (const [nome, tipo, dono, cor] of contas) {
    const r = await client.query(
      'insert into contas (nome, tipo, dono_id, cor, workspace_id) values ($1,$2,$3,$4,$5) returning id',
      [nome, tipo, pessoaId[dono], cor, WS]
    )
    contaId[nome] = r.rows[0].id
  }

  // Categorias
  const categorias = [
    ['Mercado', 'essencial', 'gasto', null, '#22c55e', 'shopping-cart'],
    ['Moradia', 'essencial', 'gasto', null, '#6366f1', 'home'],
    ['Saúde', 'saude', 'gasto', null, '#ef4444', 'heart-pulse'],
    ['Lazer', 'lazer', 'gasto', null, '#06b6d4', 'party-popper'],
    ['Assinaturas', 'assinaturas', 'gasto', null, '#a855f7', 'repeat'],
    ['Transporte', 'essencial', 'gasto', null, '#f59e0b', 'car'],
    ['Educação', 'educacao', 'gasto', null, '#3b82f6', 'graduation-cap'],
    ['Roupas', 'pessoal', 'gasto', null, '#f472b6', 'shirt'],
    ['Investimento', 'investimento', 'investimento', null, '#10b981', 'trending-up'],
    ['Impostos', 'imposto', 'imposto', null, '#64748b', 'landmark'],
    ['A classificar', 'outro', 'gasto', null, '#94a3b8', 'circle-help'],
  ]
  const catId = {}
  for (const [nome, grupo, tipo, dono, cor, icone] of categorias) {
    const r = await client.query(
      'insert into categorias (nome, grupo, tipo_reserva, dono_id, cor, icone, workspace_id) values ($1,$2,$3,$4,$5,$6,$7) returning id',
      [nome, grupo, tipo, dono ? pessoaId[dono] : null, cor, icone, WS]
    )
    catId[nome] = r.rows[0].id
  }

  // Metas
  const metas = [
    ['Reserva de Emergência', 'reserva_emergencia', 30000, addMonths(mesAtual, 8), '#14b8a6', 'shield', '6 meses de despesas'],
    ['Viagem Europa', 'viagem', 25000, addMonths(mesAtual, 14), '#06b6d4', 'plane', 'Férias de julho do ano que vem'],
    ['Quitar Cartão', 'quitacao_divida', 4800, addMonths(mesAtual, 4), '#f43f5e', 'credit-card', '12x de R$ 400'],
  ]
  const metaId = {}
  for (const [nome, tipo, alvo, dataAlvo, cor, icone, desc] of metas) {
    const r = await client.query(
      'insert into metas (nome, tipo, valor_alvo, data_alvo, cor, icone, descricao, workspace_id) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id',
      [nome, tipo, alvo, dataAlvo, cor, icone, desc, WS]
    )
    metaId[nome] = r.rows[0].id
  }

  // Lançamentos fictícios (3 meses)
  const lancamentos = [
    // Mês anterior
    { desc: 'Supermercado Extra', valor: 487.32, data: diaNoMes(mesAnterior, 5), tipo: 'despesa', conta: 'Cartão Compartilhado', cat: 'Mercado', dono: 'Compartilhado' },
    { desc: 'Aluguel', valor: 2200, data: diaNoMes(mesAnterior, 10), tipo: 'despesa', conta: 'Conta Corrente', cat: 'Moradia', dono: 'Compartilhado', recorrente: true },
    { desc: 'Netflix + Spotify', valor: 89.9, data: diaNoMes(mesAnterior, 12), tipo: 'despesa', conta: 'Nubank Ana', cat: 'Assinaturas', dono: 'Compartilhado', recorrente: true },
    { desc: 'Salário Ana', valor: 6500, data: diaNoMes(mesAnterior, 5), tipo: 'receita', conta: 'Conta Corrente', cat: 'A classificar', dono: 'Ana' },
    { desc: 'Salário Bruno', valor: 7200, data: diaNoMes(mesAnterior, 5), tipo: 'receita', conta: 'Conta Corrente', cat: 'A classificar', dono: 'Bruno' },
    { desc: 'Aporte reserva', valor: 1500, data: diaNoMes(mesAnterior, 15), tipo: 'investimento', conta: 'Conta Corrente', cat: 'Investimento', dono: 'Compartilhado', meta: 'Reserva de Emergência' },
    // Mês atual
    { desc: 'Supermercado Pão de Açúcar', valor: 523.18, data: diaNoMes(mesAtual, 3), tipo: 'despesa', conta: 'Cartão Compartilhado', cat: 'Mercado', dono: 'Compartilhado' },
    { desc: 'Aluguel', valor: 2200, data: diaNoMes(mesAtual, 10), tipo: 'despesa', conta: 'Conta Corrente', cat: 'Moradia', dono: 'Compartilhado', recorrente: true },
    { desc: 'Condomínio', valor: 650, data: diaNoMes(mesAtual, 10), tipo: 'despesa', conta: 'Conta Corrente', cat: 'Moradia', dono: 'Compartilhado', recorrente: true },
    { desc: 'Academia Ana', valor: 129.9, data: diaNoMes(mesAtual, 2), tipo: 'despesa', conta: 'Nubank Ana', cat: 'Saúde', dono: 'Ana', recorrente: true },
    { desc: 'Uber / 99', valor: 234.5, data: diaNoMes(mesAtual, 8), tipo: 'despesa', conta: 'Nubank Bruno', cat: 'Transporte', dono: 'Bruno' },
    { desc: 'Restaurante jantar', valor: 189, data: diaNoMes(mesAtual, 14), tipo: 'despesa', conta: 'Cartão Compartilhado', cat: 'Lazer', dono: 'Compartilhado' },
    { desc: 'Cinema + pipoca', valor: 98, data: diaNoMes(mesAtual, 18), tipo: 'despesa', conta: 'Pix / Dinheiro', cat: 'Lazer', dono: 'Compartilhado' },
    { desc: 'Salário Ana', valor: 6500, data: diaNoMes(mesAtual, 5), tipo: 'receita', conta: 'Conta Corrente', cat: 'A classificar', dono: 'Ana' },
    { desc: 'Salário Bruno', valor: 7200, data: diaNoMes(mesAtual, 5), tipo: 'receita', conta: 'Conta Corrente', cat: 'A classificar', dono: 'Bruno' },
    { desc: 'Freelance Bruno', valor: 1800, data: diaNoMes(mesAtual, 20), tipo: 'receita', conta: 'Conta Corrente', cat: 'A classificar', dono: 'Bruno' },
    { desc: 'Aporte reserva', valor: 1500, data: diaNoMes(mesAtual, 15), tipo: 'investimento', conta: 'Conta Corrente', cat: 'Investimento', dono: 'Compartilhado', meta: 'Reserva de Emergência' },
    { desc: 'Aporte viagem', valor: 800, data: diaNoMes(mesAtual, 15), tipo: 'investimento', conta: 'Conta Corrente', cat: 'Investimento', dono: 'Compartilhado', meta: 'Viagem Europa' },
    { desc: 'IOF cartão', valor: 42.3, data: diaNoMes(mesAtual, 25), tipo: 'imposto', conta: 'Cartão Compartilhado', cat: 'Impostos', dono: 'Compartilhado' },
    // Parcelado: notebook 6x
    { desc: 'Notebook Dell', valor: 583.33, data: diaNoMes(mesAtual, 7), tipo: 'despesa', conta: 'Nubank Bruno', cat: 'Educação', dono: 'Bruno', parcela: [2, 6], grupo: true },
    // Próximo mês (previstos)
    { desc: 'Aluguel', valor: 2200, data: diaNoMes(mesProximo, 10), tipo: 'despesa', conta: 'Conta Corrente', cat: 'Moradia', dono: 'Compartilhado', recorrente: true, status: 'previsto' },
    { desc: 'Supermercado (previsto)', valor: 500, data: diaNoMes(mesProximo, 5), tipo: 'despesa', conta: 'Cartão Compartilhado', cat: 'Mercado', dono: 'Compartilhado', status: 'previsto' },
    { desc: 'Salário Ana', valor: 6500, data: diaNoMes(mesProximo, 5), tipo: 'receita', conta: 'Conta Corrente', cat: 'A classificar', dono: 'Ana', status: 'previsto' },
    { desc: 'Salário Bruno', valor: 7200, data: diaNoMes(mesProximo, 5), tipo: 'receita', conta: 'Conta Corrente', cat: 'A classificar', dono: 'Bruno', status: 'previsto' },
  ]

  const grupoParcela = crypto.randomUUID()
  let nLanc = 0
  for (const l of lancamentos) {
    const grupoId = l.grupo ? grupoParcela : l.recorrente ? crypto.randomUUID() : null
    await client.query(
      `insert into lancamentos
       (descricao, valor, data, tipo, conta_id, categoria_id, dono_id, meta_id,
        parcela_atual, parcela_total, valor_total, data_primeira_parcela,
        recorrente, frequencia, status, privado, grupo_id, workspace_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        l.desc,
        l.valor,
        l.data,
        l.tipo,
        contaId[l.conta],
        catId[l.cat],
        pessoaId[l.dono],
        l.meta ? metaId[l.meta] : null,
        l.parcela?.[0] ?? null,
        l.parcela?.[1] ?? null,
        l.parcela ? round2(l.valor * l.parcela[1]) : null,
        l.parcela ? diaNoMes(mesAtual, 7) : null,
        l.recorrente ?? false,
        'mensal',
        l.status ?? 'pago',
        false,
        grupoId,
        WS,
      ]
    )
    nLanc++
  }
  // Parcelas restantes do notebook (3-6)
  for (let p = 3; p <= 6; p++) {
    const mesP = addMonths(mesAtual, p - 2)
    await client.query(
      `insert into lancamentos (descricao, valor, data, tipo, conta_id, categoria_id, dono_id,
        parcela_atual, parcela_total, valor_total, data_primeira_parcela, status, grupo_id, workspace_id)
       values ($1,$2,$3,'despesa',$4,$5,$6,$7,6,3500,$8,$9,$10,$11)`,
      [
        'Notebook Dell',
        583.33,
        diaNoMes(mesP, 7),
        contaId['Nubank Bruno'],
        catId['Educação'],
        pessoaId['Bruno'],
        p,
        diaNoMes(mesAtual, 7),
        p <= 2 ? 'pago' : 'previsto',
        grupoParcela,
        WS,
      ]
    )
    nLanc++
  }

  // Orçamentos mês atual
  const orcamentos = {
    Mercado: 1200,
    Moradia: 2850,
    Saúde: 300,
    Lazer: 600,
    Assinaturas: 150,
    Transporte: 400,
    Educação: 600,
    Roupas: 400,
    Investimento: 2300,
    Impostos: 100,
  }
  for (const [cat, valor] of Object.entries(orcamentos)) {
    await client.query(
      'insert into orcamentos (categoria_id, mes_referencia, valor_estabelecido, recorrente, workspace_id) values ($1,$2,$3,true,$4)',
      [catId[cat], mesAtual, valor, WS]
    )
  }

  // Renda
  await client.query('delete from rendas where workspace_id = $1 and mes_referencia = $2', [WS, mesAtual])
  await client.query(
    'insert into rendas (mes_referencia, valor, recorrente, workspace_id) values ($1,$2,true,$3)',
    [mesAtual, 15500, WS]
  )

  // Desejos
  const desejos = [
    ['Air Fryer Philips', 'desejo', 899, 1, 'Mercado', 'alta'],
    ['iPad para trabalho', 'planejado', 4500, 10, 'Educação', 'media'],
    ['Weekend em Campos', 'avaliando', 2200, 3, 'Lazer', 'baixa'],
    ['Tênis de corrida', 'comprado', 459.9, 1, 'Roupas', 'media'],
  ]
  for (const [nome, status, valor, parcelas, cat, prioridade] of desejos) {
    await client.query(
      `insert into desejos (nome, status, valor_total, parcela_total, mes_inicio, categoria_id, conta_id, dono_id, prioridade, workspace_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [nome, status, valor, parcelas, mesProximo, catId[cat], contaId['Cartão Compartilhado'], pessoaId['Compartilhado'], prioridade, WS]
    )
  }

  // Atualiza progresso das metas
  await client.query('update metas set valor_atual = 9000 where id = $1', [metaId['Reserva de Emergência']])
  await client.query('update metas set valor_atual = 2400 where id = $1', [metaId['Viagem Europa']])
  await client.query('update metas set valor_atual = 1166.66 where id = $1', [metaId['Quitar Cartão']])

  const { rows: totais } = await client.query(
    `select
      (select count(*)::int from lancamentos where workspace_id = $1) as lancamentos,
      (select count(*)::int from desejos where workspace_id = $1) as desejos,
      (select count(*)::int from metas where workspace_id = $1) as metas`,
    [WS]
  )

  await client.end()
  console.log(`\n✅ Seed demo concluído para ${EMAIL}`)
  console.log(`   Workspace: ${WS}`)
  console.log(`   Lançamentos: ${totais[0].lancamentos} | Desejos: ${totais[0].desejos} | Metas: ${totais[0].metas}`)
  console.log(`   Mês de referência: ${mesAtual}`)
  if (!users.length || SENHA) console.log(`   Senha de login: ${SENHA || cred.senha}`)
}

main().catch((e) => {
  console.error('✗ Falhou:', e.message || e)
  process.exit(1)
})
