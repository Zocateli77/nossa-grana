import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** R$ 1.234,56 */
export function money(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value ?? 0
  return brl.format(Number.isFinite(n) ? (n as number) : 0)
}

/** R$ 1,2 mil — para espaços apertados */
export function moneyCompact(value: number | null | undefined): string {
  return brlCompact.format(value ?? 0)
}

/** 1.234,56 (sem símbolo) */
export function num(value: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0)
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}

/** 06/06/2025 */
export function dataBR(iso: string): string {
  return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR })
}

/** 6 jun */
export function dataCurta(iso: string): string {
  return format(parseISO(iso), "d MMM", { locale: ptBR })
}

/** Julho 2025 */
export function mesExtenso(iso: string): string {
  const s = format(parseISO(iso), 'MMMM yyyy', { locale: ptBR })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** jul/25 */
export function mesCurto(iso: string): string {
  return format(parseISO(iso), 'MMM/yy', { locale: ptBR })
}
