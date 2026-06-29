import { parseISO, isWithinInterval, startOfMonth, differenceInCalendarMonths, getDaysInMonth } from 'date-fns'
import type { Categoria, Conta, Desejo, Frequencia, Lancamento, Meta, NovoLancamento, Orcamento, Pessoa, Renda, StatusLancamento, TipoLancamento } from '@/types/db'
import { mesRange, semanaRange, restanteDoMes, noMes, mesRefDe, navegarMes, iso, mesAtualRef, addMonths } from './dates'

/** Horizonte rolante das recorrências: quantos meses à frente manter materializados. */
export const MESES_RECORRENCIA_ADIANTE = 12

export interface Dados {
  pessoas: Pessoa[]
  categorias: Categoria[]
  contas: Conta[]
  metas: Meta[]
  desejos: Desejo[]
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
//  Dashboard "real" — o que de fato aconteceu no mês
// ------------------------------------------------------------------
export interface ResumoReal {
  entradas: number          // renda prevista do mês
  totalGasto: number        // despesas do mês (pago + previsto)
  jaPago: number            // despesas já pagas
  previstoRestante: number  // despesas previstas que ainda vão cair
  investido: number
  imposto: number
  emprestimo: number
  saidasTotais: number      // tudo que não é receita
  saldoReal: number         // entradas − saídas totais
  pctRenda: number          // totalGasto / entradas
  diasRestantes: number
  mediaDia: number          // já pago ÷ dias decorridos
}

export function resumoReal(dados: Dados, mesRef: string, rendaFallback = 0, hoje: Date = new Date()): ResumoReal {
  const lancs = lancsDoMes(dados.lancamentos, mesRef).filter((l) => l.status !== 'quitado')
  const despesas = lancs.filter((l) => l.tipo === 'despesa')
  const soma = (arr: Lancamento[]) => arr.reduce((s, l) => s + Number(l.valor), 0)
  const totalGasto = soma(despesas)
  const jaPago = soma(despesas.filter((l) => l.status === 'pago'))
  const previstoRestante = soma(despesas.filter((l) => l.status === 'previsto'))
  const investido = soma(lancs.filter((l) => l.tipo === 'investimento'))
  const imposto = soma(lancs.filter((l) => l.tipo === 'imposto'))
  const emprestimo = soma(lancs.filter((l) => l.tipo === 'emprestimo'))
  const entradas = rendaEfetiva(dados.rendas, mesRef, rendaFallback)
  const saidasTotais = totalGasto + investido + imposto + emprestimo
  const { diasRestantes, refEhMesCorrente } = restanteDoMes(mesRef, hoje)
  const totalDias = getDaysInMonth(parseISO(mesRef))
  const diasDecorridos = refEhMesCorrente ? Math.max(1, hoje.getDate()) : totalDias
  return {
    entradas,
    totalGasto,
    jaPago,
    previstoRestante,
    investido,
    imposto,
    emprestimo,
    saidasTotais,
    saldoReal: entradas - saidasTotais,
    pctRenda: entradas > 0 ? totalGasto / entradas : 0,
    diasRestantes,
    mediaDia: round2(jaPago / diasDecorridos),
  }
}

export interface ViabilidadeDesejo {
  estado: 'verde' | 'vermelho' | 'neutro'
  motivo: string
  custoMensal: number
  sobraMes: number
  restaEnvelope: number
  estouroMes: number
  estouroEnvelope: number
}

export interface ResumoDesejos {
  totalMensalSimulado: number
  prontos: number
  bloqueados: number
}

function custoMensalDesejo(desejo: Pick<Desejo, 'valor_total' | 'parcela_total'>): number {
  const parcelas = Math.max(1, Number(desejo.parcela_total) || 1)
  return round2(Number(desejo.valor_total) / parcelas)
}

function gastoDespesaCategoriaMes(lancamentos: Lancamento[], categoriaId: string, mesRef: string): number {
  return round2(
    lancsDoMes(lancamentos, mesRef)
      .filter((l) => l.tipo === 'despesa' && l.status !== 'quitado' && l.categoria_id === categoriaId)
      .reduce((s, l) => s + Number(l.valor), 0)
  )
}

export function viabilidadeDesejo(desejo: Desejo, dados: Dados, rendaFallback = 0): ViabilidadeDesejo {
  const custoMensal = custoMensalDesejo(desejo)
  const incompleto = custoMensal <= 0 || !desejo.mes_inicio || !desejo.categoria_id
  if (incompleto) {
    return {
      estado: 'neutro',
      motivo: 'Informe valor, categoria e mes para simular.',
      custoMensal,
      sobraMes: 0,
      restaEnvelope: 0,
      estouroMes: 0,
      estouroEnvelope: 0,
    }
  }

  const mesRef = desejo.mes_inicio as string
  const categoriaId = desejo.categoria_id as string
  const categoria = dados.categorias.find((c) => c.id === categoriaId)
  if (!categoria) {
    return {
      estado: 'neutro',
      motivo: 'Categoria nao encontrada.',
      custoMensal,
      sobraMes: 0,
      restaEnvelope: 0,
      estouroMes: 0,
      estouroEnvelope: 0,
    }
  }

  const real = resumoReal(dados, mesRef, rendaFallback)
  const renda = rendaEfetiva(dados.rendas, mesRef, rendaFallback)
  const estabelecido = orcamentoEfetivo(dados.orcamentos, categoria.id, mesRef, renda)
  const gastoCategoria = gastoDespesaCategoriaMes(dados.lancamentos, categoria.id, mesRef)
  const sobraMes = round2(real.saldoReal)
  const restaEnvelope = round2(estabelecido - gastoCategoria)

  if (estabelecido <= 0) {
    return {
      estado: 'vermelho',
      motivo: `${categoria.nome} nao tem envelope para este mes.`,
      custoMensal,
      sobraMes,
      restaEnvelope,
      estouroMes: Math.max(0, round2(custoMensal - sobraMes)),
      estouroEnvelope: custoMensal,
    }
  }

  const estouroEnvelope = Math.max(0, round2(custoMensal - restaEnvelope))
  const estouroMes = Math.max(0, round2(custoMensal - sobraMes))

  if (estouroEnvelope > 0) {
    return {
      estado: 'vermelho',
      motivo: `Estoura ${categoria.nome} em ${moneyLike(estouroEnvelope)}.`,
      custoMensal,
      sobraMes,
      restaEnvelope,
      estouroMes,
      estouroEnvelope,
    }
  }

  if (estouroMes > 0) {
    return {
      estado: 'vermelho',
      motivo: `Estoura a sobra do mes em ${moneyLike(estouroMes)}.`,
      custoMensal,
      sobraMes,
      restaEnvelope,
      estouroMes,
      estouroEnvelope,
    }
  }

  return {
    estado: 'verde',
    motivo: 'Cabe na sobra do mes e no envelope.',
    custoMensal,
    sobraMes,
    restaEnvelope,
    estouroMes: 0,
    estouroEnvelope: 0,
  }
}

export function resumoDesejos(desejos: Desejo[], dados: Dados, rendaFallback = 0): ResumoDesejos {
  const ativos = desejos.filter((d) => d.status !== 'comprado' && d.status !== 'arquivado')
  const vis = ativos.map((d) => viabilidadeDesejo(d, dados, rendaFallback))
  return {
    totalMensalSimulado: round2(vis.filter((v) => v.estado !== 'neutro').reduce((s, v) => s + v.custoMensal, 0)),
    prontos: vis.filter((v) => v.estado === 'verde').length,
    bloqueados: vis.filter((v) => v.estado === 'vermelho').length,
  }
}

function moneyLike(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export interface GastoCategoria {
  categoria: Categoria
  total: number
  pct: number
}

/** Gasto (despesas) por categoria no mês, ordenado do maior p/ o menor. */
export function gastosPorCategoria(dados: Dados, mesRef: string): GastoCategoria[] {
  const desp = lancsDoMes(dados.lancamentos, mesRef).filter((l) => l.tipo === 'despesa' && l.status !== 'quitado')
  const porCat = new Map<string, number>()
  for (const l of desp) {
    if (!l.categoria_id) continue
    porCat.set(l.categoria_id, (porCat.get(l.categoria_id) ?? 0) + Number(l.valor))
  }
  const total = [...porCat.values()].reduce((s, v) => s + v, 0)
  const out: GastoCategoria[] = []
  for (const [catId, val] of porCat) {
    const categoria = dados.categorias.find((c) => c.id === catId)
    if (!categoria) continue
    out.push({ categoria, total: val, pct: total > 0 ? val / total : 0 })
  }
  return out.sort((a, b) => b.total - a.total)
}

/** As N maiores despesas individuais do mês. */
export function maioresGastos(lancamentos: Lancamento[], mesRef: string, n = 5): Lancamento[] {
  return lancsDoMes(lancamentos, mesRef)
    .filter((l) => l.tipo === 'despesa' && l.status !== 'quitado')
    .sort((a, b) => Number(b.valor) - Number(a.valor))
    .slice(0, n)
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
//  Séries: materialização de parcelas e recorrências em linhas reais
// ------------------------------------------------------------------
/** Dados de um lançamento que servem de molde para gerar a série. */
export interface BaseSerie {
  descricao: string
  valor: number
  data: string
  tipo: TipoLancamento
  conta_id: string | null
  categoria_id: string | null
  dono_id: string | null
  meta_id: string | null
  parcela_atual: number | null
  parcela_total: number | null
  valor_total: number | null
  data_primeira_parcela: string | null
  recorrente: boolean
  frequencia: Frequencia
  privado: boolean
  observacao: string | null
}

function moldeComum(base: BaseSerie) {
  return {
    descricao: base.descricao,
    valor: base.valor,
    tipo: base.tipo,
    conta_id: base.conta_id,
    categoria_id: base.categoria_id,
    dono_id: base.dono_id,
    meta_id: base.meta_id,
    valor_total: base.valor_total,
    frequencia: base.frequencia,
    privado: base.privado,
    pago: true,
    observacao: base.observacao,
  }
}

/**
 * Expande um lançamento-base no array de linhas a inserir:
 * - parcelado → uma linha por parcela (da atual até a total), meses consecutivos;
 * - recorrente (não parcelado) → uma linha por mês, até o mês atual + 12 (janela rolante);
 * - simples → uma única linha (grupo_id nulo).
 * O status de cada linha segue `statusPadrao` (meses futuros nascem 'previsto').
 */
export function expandirSerie(base: BaseSerie, grupoId: string): NovoLancamento[] {
  const comum = moldeComum(base)
  const parcelado = base.parcela_total != null && base.parcela_total > 1

  if (parcelado) {
    const atual = base.parcela_atual ?? 1
    const total = base.parcela_total as number
    const primeira = base.data_primeira_parcela ?? iso(addMonths(parseISO(base.data), -(atual - 1)))
    const rows: NovoLancamento[] = []
    for (let k = atual; k <= total; k++) {
      const data = iso(addMonths(parseISO(base.data), k - atual))
      rows.push({
        ...comum,
        // só a 1ª ocorrência mantém o vínculo com a meta (as futuras não pré-creditam)
        meta_id: k === atual ? base.meta_id : null,
        data,
        parcela_atual: k,
        parcela_total: total,
        data_primeira_parcela: primeira,
        recorrente: false,
        status: statusPadrao(data, base.tipo),
        grupo_id: grupoId,
      })
    }
    return rows
  }

  if (base.recorrente) {
    const fimMes = navegarMes(mesAtualRef(), MESES_RECORRENCIA_ADIANTE)
    const rows: NovoLancamento[] = []
    for (let i = 0; i <= 240; i++) {
      const data = iso(addMonths(parseISO(base.data), i))
      if (i > 0 && mesRefDe(data) > fimMes) break
      rows.push({
        ...comum,
        meta_id: i === 0 ? base.meta_id : null,
        data,
        parcela_atual: null,
        parcela_total: null,
        data_primeira_parcela: null,
        recorrente: true,
        status: statusPadrao(data, base.tipo),
        grupo_id: grupoId,
      })
    }
    return rows
  }

  return [
    {
      ...comum,
      data: base.data,
      parcela_atual: null,
      parcela_total: null,
      data_primeira_parcela: null,
      recorrente: false,
      status: statusPadrao(base.data, base.tipo),
      grupo_id: null,
    },
  ]
}

/**
 * Janela rolante: para cada série recorrente ativa, gera as linhas que faltam
 * APÓS a última ocorrência, até o mês atual + 12. Só acrescenta no fim (nunca
 * preenche buracos internos), respeitando exclusões pontuais. Idempotente.
 */
export function seriesParaReabastecer(dados: Pick<Dados, 'lancamentos'>): NovoLancamento[] {
  const fimMes = navegarMes(mesAtualRef(), MESES_RECORRENCIA_ADIANTE)
  const grupos = new Map<string, Lancamento[]>()
  for (const l of dados.lancamentos) {
    if (!l.grupo_id || ehParcelado(l) || !l.recorrente || l.status === 'quitado') continue
    const arr = grupos.get(l.grupo_id) ?? []
    arr.push(l)
    grupos.set(l.grupo_id, arr)
  }

  const novas: NovoLancamento[] = []
  for (const [grupoId, rows] of grupos) {
    const ultima = rows.reduce((a, b) => (a.data >= b.data ? a : b))
    if (mesRefDe(ultima.data) >= fimMes) continue
    const comum = moldeComum({
      descricao: ultima.descricao,
      valor: Number(ultima.valor),
      data: ultima.data,
      tipo: ultima.tipo,
      conta_id: ultima.conta_id,
      categoria_id: ultima.categoria_id,
      dono_id: ultima.dono_id,
      meta_id: ultima.meta_id,
      parcela_atual: null,
      parcela_total: null,
      valor_total: null,
      data_primeira_parcela: null,
      recorrente: true,
      frequencia: ultima.frequencia,
      privado: ultima.privado,
      observacao: ultima.observacao,
    })
    for (let k = 1; k <= 240; k++) {
      const data = iso(addMonths(parseISO(ultima.data), k))
      if (mesRefDe(data) > fimMes) break
      novas.push({
        ...comum,
        meta_id: null, // meses futuros reabastecidos não pré-creditam metas
        data,
        parcela_atual: null,
        parcela_total: null,
        data_primeira_parcela: null,
        recorrente: true,
        status: statusPadrao(data, ultima.tipo),
        grupo_id: grupoId,
      })
    }
  }
  return novas
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

export function dividas(lancamentos: Lancamento[], hoje: Date = new Date()): DividaInfo[] {
  const mesCorrente = mesRefDe(iso(hoje))
  const emprestimos = lancamentos.filter((l) => l.tipo === 'emprestimo' && ehParcelado(l) && l.status !== 'quitado')
  // agrupa as parcelas-irmãs por grupo_id (linhas legadas sem grupo ficam isoladas pelo id)
  const grupos = new Map<string, Lancamento[]>()
  for (const l of emprestimos) {
    const key = l.grupo_id ?? l.id
    const arr = grupos.get(key) ?? []
    arr.push(l)
    grupos.set(key, arr)
  }

  const out: DividaInfo[] = []
  for (const [, rows] of grupos) {
    // legado: linha única ainda não materializada → usa o cronograma calculado
    if (rows.length === 1 && parcelasFaltam(rows[0]) > 1) {
      const l = rows[0]
      const faltam = parcelasFaltam(l)
      const baseMes = mesRefDe(l.data_primeira_parcela ?? l.data)
      out.push({
        lancamento: l,
        faltam,
        totalDevido: faltam * Number(l.valor),
        ultimaParcelaMes: navegarMes(baseMes, (l.parcela_total ?? 1) - 1),
      })
      continue
    }
    const futuras = rows.filter((l) => mesRefDe(l.data) >= mesCorrente).sort((a, b) => (a.data < b.data ? -1 : 1))
    if (futuras.length === 0) continue
    const ultima = rows.reduce((a, b) => (a.data >= b.data ? a : b))
    out.push({
      lancamento: futuras[0],
      faltam: futuras.length,
      totalDevido: futuras.reduce((s, l) => s + Number(l.valor), 0),
      ultimaParcelaMes: mesRefDe(ultima.data),
    })
  }
  return out
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
  const out: MesProjetado[] = []
  let acumulado = 0

  // Com as séries materializadas, o futuro é a soma dos lançamentos REAIS de cada mês.
  for (let i = 1; i <= mesesAdiante; i++) {
    const mesRef = navegarMes(baseMes, i)
    const lancs = lancsDoMes(dados.lancamentos, mesRef).filter((l) => l.status !== 'quitado')
    const parcelas: MesProjetado['parcelas'] = lancs
      .filter((l) => ehParcelado(l))
      .map((l) => ({ descricao: l.descricao, valor: Number(l.valor), numero: l.parcela_atual ?? 0, total: l.parcela_total ?? 0 }))
    // entradas = renda prevista do mês (as receitas lançadas são a realização da renda, não somam)
    const entradas = rendaEfetiva(dados.rendas, mesRef, rendaFallback)
    const saidas = lancs.filter((l) => l.tipo !== 'receita').reduce((s, l) => s + Number(l.valor), 0)
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
