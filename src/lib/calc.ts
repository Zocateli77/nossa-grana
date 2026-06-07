import { parseISO, isWithinInterval } from 'date-fns'
import type { Categoria, Conta, Lancamento, Meta, Orcamento, Pessoa, Renda, StatusLancamento, TipoLancamento } from '@/types/db'
import { mesRange, semanaRange, restanteDoMes, noMes, mesRefDe, navegarMes, iso, mesAtualRef } from './dates'
import { startOfMonth, differenceInCalendarMonths } from 'date-fns'

export interface Dados {
  pessoas: Pessoa[]
  categorias: Categoria[]
  contas: Conta[]
  metas: Meta[]
  orcamentos: Orcamento[]
  lancamentos: Lancamento[]
  rendas: Renda[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Status padrão de um novo lançamento:
 * - receita (entrada) sempre nasce 'previsto' (só é certa quando cai);
 * - qualquer lançamento datado num mês futuro nasce 'previsto' (planejamento);
 * - caso contrário 'pago'.
 */
export function statusPadrao(dataISO: string, tipo: TipoLancamento): StatusLancamento {
  if (tipo === 'receita') return 'previsto'
  return mesRefDe(dataISO) > mesAtualRef() ? 'previsto' : 'pago'
}

// ------------------------------------------------------------------
//  Renda prevista por mês (com herança recorrente — regra PJ)
// ------------------------------------------------------------------
export function rendaEfetiva(rendas: Renda[], mesRef: string, fallback = 0): number {
  const exato = rendas.find((r) => r.mes_referencia === mesRef)
  if (exato) return Number(exato.valor)
  const anterior = rendas
    .filter((r) => r.recorrente && r.mes_referencia <= mesRef)
    .sort((a, b) => (a.mes_referencia < b.mes_referencia ? 1 : -1))[0]
  return anterior ? Number(anterior.valor) : fallback
}

// ------------------------------------------------------------------
//  helpers de orçamento (com herança de recorrentes — regra 5.6)
// ------------------------------------------------------------------
/** linha de orçamento vigente (exata ou último recorrente anterior) */
export function orcamentoRow(orcamentos: Orcamento[], categoriaId: string, mesRef: string): Orcamento | undefined {
  const exato = orcamentos.find((o) => o.categoria_id === categoriaId && o.mes_referencia === mesRef)
  if (exato) return exato
  return orcamentos
    .filter((o) => o.categoria_id === categoriaId && o.recorrente && o.mes_referencia <= mesRef)
    .sort((a, b) => (a.mes_referencia < b.mes_referencia ? 1 : -1))[0]
}

/** valor do envelope no mês. Se for percentual, calcula sobre a renda do mês. */
export function orcamentoEfetivo(orcamentos: Orcamento[], categoriaId: string, mesRef: string, renda = 0): number {
  const row = orcamentoRow(orcamentos, categoriaId, mesRef)
  if (!row) return 0
  if (row.tipo_valor === 'percentual') return round2(((Number(row.percentual) || 0) / 100) * renda)
  return Number(row.valor_estabelecido)
}

export function lancsDoMes(lancamentos: Lancamento[], mesRef: string): Lancamento[] {
  return lancamentos.filter((l) => noMes(l.data, mesRef))
}

export function gastoCategoriaMes(lancamentos: Lancamento[], categoriaId: string, mesRef: string): number {
  return lancsDoMes(lancamentos, mesRef)
    .filter((l) => l.categoria_id === categoriaId)
    .reduce((s, l) => s + Number(l.valor), 0)
}

function gastoCategoriaSemana(lancamentos: Lancamento[], categoriaId: string, base: Date): number {
  const { inicio, fim } = semanaRange(base)
  return lancamentos
    .filter((l) => l.categoria_id === categoriaId && isWithinInterval(parseISO(l.data), { start: inicio, end: fim }))
    .reduce((s, l) => s + Number(l.valor), 0)
}

// ------------------------------------------------------------------
//  Envelope (regra 5.2)
// ------------------------------------------------------------------
export interface EnvelopeInfo {
  categoria: Categoria
  estabelecido: number
  gasto: number
  resta: number
  pct: number
  estado: 'verde' | 'amarelo' | 'vermelho' | 'sem_orcamento'
  semanasRestantes: number
  ritmoSemanal: number
  gastoSemana: number
  restaSemana: number
  estourou: boolean
  estourouValor: number
}

export function envelope(
  categoria: Categoria,
  dados: Pick<Dados, 'orcamentos' | 'lancamentos' | 'rendas'>,
  mesRef: string,
  hoje: Date = new Date()
): EnvelopeInfo {
  const renda = rendaEfetiva(dados.rendas, mesRef)
  const estabelecido = orcamentoEfetivo(dados.orcamentos, categoria.id, mesRef, renda)
  const gasto = gastoCategoriaMes(dados.lancamentos, categoria.id, mesRef)
  const resta = estabelecido - gasto
  const pct = estabelecido > 0 ? gasto / estabelecido : gasto > 0 ? 1.5 : 0
  const { semanasRestantes, refEhMesCorrente } = restanteDoMes(mesRef, hoje)
  const ritmoSemanal = Math.max(0, resta) / semanasRestantes
  const gastoSemana = refEhMesCorrente ? gastoCategoriaSemana(dados.lancamentos, categoria.id, hoje) : 0
  const restaSemana = ritmoSemanal - gastoSemana

  let estado: EnvelopeInfo['estado'] = 'verde'
  if (estabelecido <= 0) estado = 'sem_orcamento'
  else if (pct >= 1) estado = 'vermelho'
  else if (pct >= 0.7) estado = 'amarelo'

  return {
    categoria,
    estabelecido,
    gasto,
    resta,
    pct,
    estado,
    semanasRestantes,
    ritmoSemanal,
    gastoSemana,
    restaSemana,
    estourou: estabelecido > 0 && gasto > estabelecido,
    estourouValor: Math.max(0, gasto - estabelecido),
  }
}

/** Envelopes de gasto do dia a dia (exclui reservas e mesadas), ordenados pelos mais apertados. */
export function envelopesDoMes(dados: Dados, mesRef: string, hoje: Date = new Date()): EnvelopeInfo[] {
  return dados.categorias
    .filter((c) => c.ativo && c.tipo_reserva === 'gasto')
    .map((c) => envelope(c, dados, mesRef, hoje))
    .filter((e) => e.estabelecido > 0 || e.gasto > 0)
    .sort((a, b) => a.resta - b.resta)
}

// ------------------------------------------------------------------
//  Reservas: investimento / impostos (5.3 / 5.4)
// ------------------------------------------------------------------
export interface ReservaInfo {
  planejado: number
  executado: number
  falta: number
  pct: number
}

function reservaPorTipo(dados: Dados, tipoReserva: 'investimento' | 'imposto', tipoLanc: string, mesRef: string): ReservaInfo {
  const renda = rendaEfetiva(dados.rendas, mesRef)
  const cats = dados.categorias.filter((c) => c.tipo_reserva === tipoReserva)
  const planejado = cats.reduce((s, c) => s + orcamentoEfetivo(dados.orcamentos, c.id, mesRef, renda), 0)
  const executado = lancsDoMes(dados.lancamentos, mesRef)
    .filter((l) => l.tipo === tipoLanc)
    .reduce((s, l) => s + Number(l.valor), 0)
  return { planejado, executado, falta: planejado - executado, pct: planejado > 0 ? executado / planejado : 0 }
}

export const reservaInvestimento = (d: Dados, m: string) => reservaPorTipo(d, 'investimento', 'investimento', m)
export const reservaImpostos = (d: Dados, m: string) => reservaPorTipo(d, 'imposto', 'imposto', m)

// ------------------------------------------------------------------
//  Mesada (5.8)
// ------------------------------------------------------------------
export interface MesadaInfo {
  categoria: Categoria
  pessoa: Pessoa | undefined
  estabelecido: number
  gasto: number
  resta: number
  pct: number
}

export function mesadas(dados: Dados, mesRef: string): MesadaInfo[] {
  const renda = rendaEfetiva(dados.rendas, mesRef)
  return dados.categorias
    .filter((c) => c.tipo_reserva === 'mesada')
    .map((c) => {
      const estabelecido = orcamentoEfetivo(dados.orcamentos, c.id, mesRef, renda)
      const gasto = gastoCategoriaMes(dados.lancamentos, c.id, mesRef)
      return {
        categoria: c,
        pessoa: dados.pessoas.find((p) => p.id === c.dono_id),
        estabelecido,
        gasto,
        resta: estabelecido - gasto,
        pct: estabelecido > 0 ? gasto / estabelecido : 0,
      }
    })
}

// ------------------------------------------------------------------
//  Resumo do mês / disponível livre (5.1)
// ------------------------------------------------------------------
export interface ResumoMes {
  renda: number
  reservadoInvestimento: number
  reservadoImpostos: number
  orcadoGastosMesada: number
  comprometido: number
  disponivelLivre: number
  // realizado
  gastoRealizado: number
  investidoRealizado: number
  impostoRealizado: number
  emprestimoRealizado: number
  receitaRealizada: number
  // waterfall
  cascata: { nome: string; valor: number; tipo: 'entrada' | 'reserva' | 'gasto' | 'sobra' }[]
}

export function resumoMes(dados: Dados, mesRef: string, rendaFallback = 0): ResumoMes {
  const noMesLancs = lancsDoMes(dados.lancamentos, mesRef)
  const receitaRealizada = noMesLancs.filter((l) => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0)
  // Renda do mês = renda PREVISTA (não soma as receitas lançadas, p/ não duplicar)
  const renda = rendaEfetiva(dados.rendas, mesRef, rendaFallback)

  const reservadoInvestimento = dados.categorias
    .filter((c) => c.tipo_reserva === 'investimento')
    .reduce((s, c) => s + orcamentoEfetivo(dados.orcamentos, c.id, mesRef, renda), 0)
  const reservadoImpostos = dados.categorias
    .filter((c) => c.tipo_reserva === 'imposto')
    .reduce((s, c) => s + orcamentoEfetivo(dados.orcamentos, c.id, mesRef, renda), 0)
  const orcadoGastosMesada = dados.categorias
    .filter((c) => c.tipo_reserva === 'gasto' || c.tipo_reserva === 'mesada')
    .reduce((s, c) => s + orcamentoEfetivo(dados.orcamentos, c.id, mesRef, renda), 0)

  const comprometido = reservadoInvestimento + reservadoImpostos + orcadoGastosMesada
  const disponivelLivre = renda - comprometido

  return {
    renda,
    reservadoInvestimento,
    reservadoImpostos,
    orcadoGastosMesada,
    comprometido,
    disponivelLivre,
    gastoRealizado: noMesLancs.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor), 0),
    investidoRealizado: noMesLancs.filter((l) => l.tipo === 'investimento').reduce((s, l) => s + Number(l.valor), 0),
    impostoRealizado: noMesLancs.filter((l) => l.tipo === 'imposto').reduce((s, l) => s + Number(l.valor), 0),
    emprestimoRealizado: noMesLancs.filter((l) => l.tipo === 'emprestimo').reduce((s, l) => s + Number(l.valor), 0),
    receitaRealizada,
    cascata: [
      { nome: 'Renda', valor: renda, tipo: 'entrada' },
      { nome: 'Investir', valor: reservadoInvestimento, tipo: 'reserva' },
      { nome: 'Impostos', valor: reservadoImpostos, tipo: 'reserva' },
      { nome: 'Gastos', valor: orcadoGastosMesada, tipo: 'gasto' },
      { nome: 'Sobra', valor: disponivelLivre, tipo: 'sobra' },
    ],
  }
}

// ------------------------------------------------------------------
//  Parcelas (5.5)
// ------------------------------------------------------------------
export function ehParcelado(l: Lancamento): boolean {
  return l.parcela_total != null && l.parcela_total > 1
}
export function parcelasFaltam(l: Lancamento): number {
  if (!ehParcelado(l) || l.status === 'quitado') return 0
  return Math.max(0, (l.parcela_total ?? 0) - (l.parcela_atual ?? 1) + 1)
}

/** meses futuros (mesRef) em que ainda cairão parcelas, com valor. */
export function cronogramaParcelas(l: Lancamento, aPartirDe?: string): { mesRef: string; numero: number; valor: number }[] {
  if (!ehParcelado(l) || l.status === 'quitado') return []
  const baseMes = mesRefDe(l.data_primeira_parcela ?? l.data)
  const atual = l.parcela_atual ?? 1
  const total = l.parcela_total ?? 1
  const limiteMes = aPartirDe ?? mesRefDe(l.data)
  const out: { mesRef: string; numero: number; valor: number }[] = []
  for (let k = 1; k <= total; k++) {
    const mesRef = navegarMes(baseMes, k - 1)
    if (k <= atual) continue // já passou (a parcela atual é a do mês do lançamento)
    if (mesRef <= limiteMes) continue
    out.push({ mesRef, numero: k, valor: Number(l.valor) })
  }
  return out
}

// ------------------------------------------------------------------
//  Recorrentes (5.6)
// ------------------------------------------------------------------
export function recorrentesBase(lancamentos: Lancamento[]): Lancamento[] {
  return lancamentos.filter((l) => l.recorrente && !ehParcelado(l) && l.status !== 'quitado')
}

// ------------------------------------------------------------------
//  Metas (5.7)
// ------------------------------------------------------------------
export interface ProgressoMeta {
  meta: Meta
  pct: number
  falta: number
  mesesRestantes: number | null
  ritmoNecessario: number | null
  aportes: Lancamento[]
}

export function progressoMeta(meta: Meta, lancamentos: Lancamento[], hoje: Date = new Date()): ProgressoMeta {
  const atual = Number(meta.valor_atual)
  const alvo = Number(meta.valor_alvo)
  const falta = Math.max(0, alvo - atual)
  let mesesRestantes: number | null = null
  let ritmoNecessario: number | null = null
  if (meta.data_alvo) {
    mesesRestantes = Math.max(1, differenceInCalendarMonths(parseISO(meta.data_alvo), startOfMonth(hoje)))
    ritmoNecessario = falta / mesesRestantes
  }
  return {
    meta,
    pct: alvo > 0 ? atual / alvo : 0,
    falta,
    mesesRestantes,
    ritmoNecessario,
    aportes: lancamentos
      .filter((l) => l.meta_id === meta.id && l.tipo === 'investimento')
      .sort((a, b) => (a.data < b.data ? 1 : -1)),
  }
}

// ------------------------------------------------------------------
//  Dívidas / empréstimos (5.9)
// ------------------------------------------------------------------
export interface DividaInfo {
  lancamento: Lancamento
  faltam: number
  totalDevido: number
  ultimaParcelaMes: string
}

export function dividas(lancamentos: Lancamento[]): DividaInfo[] {
  return lancamentos
    .filter((l) => l.tipo === 'emprestimo' && ehParcelado(l) && l.status !== 'quitado')
    .map((l) => {
      const faltam = parcelasFaltam(l)
      const baseMes = mesRefDe(l.data_primeira_parcela ?? l.data)
      return {
        lancamento: l,
        faltam,
        totalDevido: faltam * Number(l.valor),
        ultimaParcelaMes: navegarMes(baseMes, (l.parcela_total ?? 1) - 1),
      }
    })
}

// ------------------------------------------------------------------
//  Projeção de futuro (6.8)
// ------------------------------------------------------------------
export interface MesProjetado {
  mesRef: string
  entradas: number
  saidas: number
  saldoMes: number
  saldoAcumulado: number
  parcelas: { descricao: string; valor: number; numero: number; total: number }[]
}

export function projecao(dados: Dados, mesesAdiante = 6, hoje: Date = new Date(), rendaFallback = 0): MesProjetado[] {
  const baseMes = iso(startOfMonth(hoje))
  const recorr = recorrentesBase(dados.lancamentos)
  const out: MesProjetado[] = []
  let acumulado = 0

  for (let i = 1; i <= mesesAdiante; i++) {
    const mesRef = navegarMes(baseMes, i)
    const parcelas: MesProjetado['parcelas'] = []
    for (const l of dados.lancamentos) {
      for (const p of cronogramaParcelas(l, baseMes)) {
        if (p.mesRef === mesRef) parcelas.push({ descricao: l.descricao, valor: p.valor, numero: p.numero, total: l.parcela_total ?? 1 })
      }
    }
    const saidaRecorrente = recorr.reduce((s, l) => s + Number(l.valor), 0)
    const saidaParcelas = parcelas.reduce((s, p) => s + p.valor, 0)
    const entradas = rendaEfetiva(dados.rendas, mesRef, rendaFallback) // renda variável por mês
    const saidas = saidaRecorrente + saidaParcelas
    const saldoMes = entradas - saidas
    acumulado += saldoMes
    out.push({ mesRef, entradas, saidas, saldoMes, saldoAcumulado: acumulado, parcelas })
  }
  return out
}

// ------------------------------------------------------------------
//  helpers de lookup
// ------------------------------------------------------------------
export const byId = <T extends { id: string }>(arr: T[]) => {
  const m = new Map<string, T>()
  for (const x of arr) m.set(x.id, x)
  return m
}

/** total de uma conta no mês (soma das parcelas que caem no mês). */
export function totalContaMes(lancamentos: Lancamento[], contaId: string, mesRef: string): number {
  return lancsDoMes(lancamentos, mesRef)
    .filter((l) => l.conta_id === contaId)
    .reduce((s, l) => s + Number(l.valor), 0)
}

/** meses que possuem algum lançamento, mais recente primeiro. */
export function mesesComDados(lancamentos: Lancamento[]): string[] {
  const set = new Set(lancamentos.map((l) => mesRefDe(l.data)))
  return [...set].sort((a, b) => (a < b ? 1 : -1))
}
