import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  format,
  parseISO,
  differenceInCalendarDays,
  isWithinInterval,
} from 'date-fns'

export const WEEK_STARTS_ON = 1 // segunda-feira

export const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/** 1º dia do mês de uma data (string ISO) */
export function mesRefDe(dataISO: string): string {
  return iso(startOfMonth(parseISO(dataISO)))
}

/** intervalo [início, fim] do mês de referência (1º dia) */
export function mesRange(mesRefISO: string) {
  const d = parseISO(mesRefISO)
  return { inicio: startOfMonth(d), fim: endOfMonth(d), inicioISO: iso(startOfMonth(d)), fimISO: iso(endOfMonth(d)) }
}

export function semanaRange(base: Date = new Date()) {
  const inicio = startOfWeek(base, { weekStartsOn: WEEK_STARTS_ON })
  const fim = endOfWeek(base, { weekStartsOn: WEEK_STARTS_ON })
  return { inicio, fim, inicioISO: iso(inicio), fimISO: iso(fim) }
}

export function navegarMes(mesRefISO: string, delta: number): string {
  return iso(startOfMonth(addMonths(parseISO(mesRefISO), delta)))
}

export const mesAtualRef = () => iso(startOfMonth(new Date()))

/** está dentro do mês de referência? */
export function noMes(dataISO: string, mesRefISO: string): boolean {
  const { inicio, fim } = mesRange(mesRefISO)
  return isWithinInterval(parseISO(dataISO), { start: inicio, end: fim })
}

/**
 * Dias e semanas restantes do mês a partir de "hoje".
 * Se o mês de referência não é o mês corrente, usa o mês inteiro.
 */
export function restanteDoMes(mesRefISO: string, hoje: Date = new Date()) {
  const { inicio, fim } = mesRange(mesRefISO)
  const refEhMesCorrente = startOfMonth(hoje).getTime() === inicio.getTime()
  const ponto = refEhMesCorrente ? hoje : inicio
  const diasRestantes = Math.max(1, differenceInCalendarDays(fim, ponto) + 1)
  const semanasRestantes = Math.max(1, Math.ceil(diasRestantes / 7))
  return { diasRestantes, semanasRestantes, refEhMesCorrente }
}

export { parseISO, addMonths, format }
