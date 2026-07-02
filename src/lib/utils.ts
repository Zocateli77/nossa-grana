import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Estilo compartilhado para tooltips do Recharts — legível em light e dark mode. */
export const rechartsTooltipProps = {
  contentStyle: {
    borderRadius: 12,
    border: '1px solid hsl(var(--border))',
    background: 'hsl(var(--card))',
    color: 'hsl(var(--foreground))',
  },
  labelStyle: { color: 'hsl(var(--foreground))' },
  itemStyle: { color: 'hsl(var(--foreground))' },
} as const

/** Adiciona alpha a cores hex (#RGB/#RRGGBB) ou hsl/hsla. */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha))
  const trimmed = color.trim()

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1)
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => c + c)
            .join('')
        : hex.slice(0, 6)
    const r = parseInt(full.slice(0, 2), 16)
    const g = parseInt(full.slice(2, 4), 16)
    const b = parseInt(full.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }

  if (trimmed.startsWith('hsl')) {
    const inner = trimmed.replace(/^hsla?\(/, '').replace(/\)$/, '')
    return `hsla(${inner}, ${a})`
  }

  if (trimmed.startsWith('rgb')) {
    const inner = trimmed.replace(/^rgba?\(/, '').replace(/\)$/, '')
    return `rgba(${inner}, ${a})`
  }

  return trimmed
}

/** Tokens CSS do tema para uso em gráficos e fallbacks de cor. */
export const themeColors = {
  primary: 'hsl(var(--primary))',
  muted: 'hsl(var(--muted))',
  mutedForeground: 'hsl(var(--muted-foreground))',
  success: 'hsl(var(--success))',
  destructive: 'hsl(var(--destructive))',
} as const
