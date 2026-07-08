// Coleta o snapshot financeiro do casal para o relatório por e-mail.
// Lê o Supabase direto (pg) e reproduz em JS a lógica de renda/envelopes/insights.

const round2 = (n) => Math.round(n * 100) / 100

// --- datas (sem dependências) ---
/** Data de "hoje" no fuso de São Paulo, como 'YYYY-MM-DD'. */
export function hojeSaoPaulo(base = new Date()) {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(base)
}
/** 1º dia do mês de uma data 'YYYY-MM-DD'. */
export const mesRefDe = (d) => `${d.slice(0, 7)}-01`
/** desloca um mesRef ('YYYY-MM-01') em n meses. */
export function navegarMes(mesRef, n) {
  const [y, m] = mesRef.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}
const noMes = (dataISO, mesRef) => dataISO.slice(0, 7) === mesRef.slice(0, 7)

const DIAS_PT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** Quais seções extras entram em cada dia da semana (0=Dom … 6=Sáb). Resumo do mês vem sempre. */
export function secoesDoDia(diaSemana) {
  switch (diaSemana) {
    case 1: return { envelopes: true } // Segunda
    case 3: return { insights: true } // Quarta
    case 5: return { maiores: true } // Sexta
    case 0: return { envelopes: true, insights: true, maiores: true } // Domingo — recapão
    default: return {}
  }
}

// --- lógica de negócio (espelha src/lib/calc.ts) ---
function rendaEfetiva(rendas, mesRef, fallback = 0) {
  const exato = rendas.find((r) => r.mes_referencia === mesRef)
  if (exato) return Number(exato.valor)
  const anterior = rendas
    .filter((r) => r.recorrente && r.mes_referencia <= mesRef)
    .sort((a, b) => (a.mes_referencia < b.mes_referencia ? 1 : -1))[0]
  return anterior ? Number(anterior.valor) : fallback
}

function orcamentoRow(orcamentos, categId, mesRef) {
  const doCat = orcamentos.filter((o) => o.categoria_id === categId)
  const exato = doCat.find((o) => o.mes_referencia === mesRef)
  if (exato) return exato
  return doCat
    .filter((o) => o.recorrente && o.mes_referencia <= mesRef)
    .sort((a, b) => (a.mes_referencia < b.mes_referencia ? 1 : -1))[0]
}

function orcamentoEfetivo(orcamentos, categId, mesRef, renda) {
  const row = orcamentoRow(orcamentos, categId, mesRef)
  if (!row) return 0
  if (row.tipo_valor === 'percentual' && row.percentual != null) {
    return round2((Number(row.percentual) / 100) * renda)
  }
  return Number(row.valor_estabelecido)
}

const gastoCategoriaMes = (lancs, categId, mesRef) =>
  lancs.filter((l) => l.categoria_id === categId && noMes(l.data, mesRef)).reduce((s, l) => s + Number(l.valor), 0)

export async function coletarDados(supabase, { hoje, workspaceId }) {
  const diaSemana = new Date(`${hoje}T12:00:00-03:00`).getDay()
  // Relatório é sempre PLANEJANDO o próximo mês (em julho, fala de agosto).
  const mesRef = navegarMes(mesRefDe(hoje), 1)

  const sel = async (q) => {
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return data ?? []
  }

  // workspace do casal: id informado, ou o "Nossa Grana", ou o 1º com dados.
  let ws = workspaceId
  if (!ws) {
    const wss = await sel(supabase.from('workspaces').select('id,nome').ilike('nome', 'Nossa Grana'))
    ws = wss[0]?.id
  }
  if (!ws) {
    const l = await sel(supabase.from('lancamentos').select('workspace_id').limit(1))
    ws = l[0]?.workspace_id
  }
  if (!ws) throw new Error('Nenhum workspace encontrado')

  const desde = navegarMes(mesRef, -3)
  const categorias = await sel(supabase.from('categorias').select('id,nome,tipo_reserva,cor,icone').eq('workspace_id', ws).eq('ativo', true))
  const rendasR = await sel(supabase.from('rendas').select('mes_referencia,valor,recorrente').eq('workspace_id', ws))
  const orcamentos = await sel(
    supabase.from('orcamentos').select('categoria_id,mes_referencia,valor_estabelecido,tipo_valor,percentual,recorrente').eq('workspace_id', ws)
  )
  const lancamentos = await sel(
    supabase.from('lancamentos').select('id,descricao,valor,data,tipo,categoria_id,status,privado').eq('workspace_id', ws).gte('data', desde)
  )
  const catMap = new Map(categorias.map((c) => [c.id, c]))

  const doMes = lancamentos.filter((l) => noMes(l.data, mesRef))
  const soma = (arr) => round2(arr.reduce((s, l) => s + Number(l.valor), 0))
  const despesas = doMes.filter((l) => l.tipo === 'despesa' && l.status !== 'quitado')

  const renda = rendaEfetiva(rendasR, mesRef)
  const gasto = soma(despesas)
  const jaPago = soma(despesas.filter((l) => l.status === 'pago'))
  const previsto = soma(despesas.filter((l) => l.status === 'previsto'))
  const investido = soma(doMes.filter((l) => l.tipo === 'investimento' && l.status !== 'quitado'))
  const impostos = soma(doMes.filter((l) => l.tipo === 'imposto' && l.status !== 'quitado'))
  const sobra = round2(renda - gasto - investido - impostos)
  const pctRenda = renda > 0 ? gasto / renda : 0

  // envelopes no limite (>=70%)
  const envelopes = categorias
    .filter((c) => c.tipo_reserva === 'gasto')
    .map((c) => {
      const estabelecido = orcamentoEfetivo(orcamentos, c.id, mesRef, renda)
      const g = round2(gastoCategoriaMes(despesas, c.id, mesRef))
      const pct = estabelecido > 0 ? g / estabelecido : g > 0 ? 1.5 : 0
      return { nome: c.nome, cor: c.cor, estabelecido, gasto: g, pct, estourou: estabelecido > 0 && g > estabelecido }
    })
    .filter((e) => e.estabelecido > 0 && e.pct >= 0.7)
    .sort((a, b) => b.pct - a.pct)

  // insights: categoria vs média 3 meses
  const mesNome = MESES_PT[Number(mesRef.slice(5, 7)) - 1]
  const mesNomeCap = mesNome.charAt(0).toUpperCase() + mesNome.slice(1)
  const PISO = 50
  const alertas = []
  for (const c of categorias) {
    if (c.tipo_reserva !== 'gasto') continue
    const atual = gastoCategoriaMes(lancamentos, c.id, mesRef)
    let mediaSoma = 0
    for (let i = 1; i <= 3; i++) mediaSoma += gastoCategoriaMes(lancamentos, c.id, navegarMes(mesRef, -i))
    const media = round2(mediaSoma / 3)
    if (media < PISO) continue
    const diff = round2(atual - media)
    const pctVar = media > 0 ? diff / media : 0
    // Planejamento: só alertamos quando o mês JÁ tem mais comprometido que a média.
    if (diff >= PISO && pctVar >= 0.25) {
      alertas.push({ tipo: 'alerta', texto: `${mesNomeCap} já tem ${Math.round(pctVar * 100)}% a mais comprometido em ${c.nome} que sua média (${brl(diff)} a mais).`, peso: diff })
    }
  }
  alertas.sort((a, b) => b.peso - a.peso)
  const insights = alertas.slice(0, 3)

  // maiores gastos do mês
  const maiores = despesas
    .slice()
    .sort((a, b) => Number(b.valor) - Number(a.valor))
    .slice(0, 5)
    .map((l) => ({
      descricao: l.privado ? 'Gasto livre' : l.descricao,
      valor: Number(l.valor),
      categoria: l.categoria_id ? catMap.get(l.categoria_id)?.nome ?? null : null,
      data: l.data,
    }))

  return {
    dia: DIAS_PT[diaSemana],
    dataExtenso: `${Number(hoje.slice(8, 10))} de ${MESES_PT[Number(hoje.slice(5, 7)) - 1]} de ${hoje.slice(0, 4)}`,
    mesNome,
    mesNomeCap,
    secoes: secoesDoDia(diaSemana),
    resumo: { renda, gasto, jaPago, previsto, investido, impostos, sobra, pctRenda },
    envelopes,
    insights,
    maiores,
  }
}

export function brl(n) {
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
