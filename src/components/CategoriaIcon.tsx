import {
  Circle,
  ShoppingCart,
  Shirt,
  Home,
  HeartPulse,
  GraduationCap,
  Repeat,
  PawPrint,
  PartyPopper,
  Sparkles,
  Wallet,
  TrendingUp,
  PiggyBank,
  Landmark,
  CreditCard,
  CircleHelp,
  Target,
  Shield,
  Car,
  Plane,
  Gift,
  Coffee,
  type LucideProps,
} from 'lucide-react'
import { cn, themeColors, withAlpha } from '@/lib/utils'

// Mapa curado (tree-shakeable) dos ícones usados em categorias/metas.
const MAPA: Record<string, React.ComponentType<LucideProps>> = {
  'shopping-cart': ShoppingCart,
  shirt: Shirt,
  home: Home,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  repeat: Repeat,
  'paw-print': PawPrint,
  'party-popper': PartyPopper,
  sparkles: Sparkles,
  wallet: Wallet,
  'trending-up': TrendingUp,
  'piggy-bank': PiggyBank,
  landmark: Landmark,
  'credit-card': CreditCard,
  'circle-help': CircleHelp,
  target: Target,
  shield: Shield,
  car: Car,
  plane: Plane,
  gift: Gift,
  coffee: Coffee,
}

export function LucideByName({ name, ...props }: { name?: string | null } & LucideProps) {
  const Comp = (name && MAPA[name]) || Circle
  return <Comp {...props} />
}

/** Ícone da categoria dentro de um chip colorido. */
export function CategoriaIcon({
  icone,
  cor,
  className,
  size = 18,
}: {
  icone?: string | null
  cor?: string | null
  className?: string
  size?: number
}) {
  const color = cor ?? themeColors.primary
  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-xl shrink-0', className)}
      style={{ backgroundColor: withAlpha(color, 0.12), color }}
      aria-hidden="true"
    >
      <LucideByName name={icone ?? undefined} size={size} />
    </span>
  )
}
