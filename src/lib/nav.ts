import {
  Home,
  ReceiptText,
  Wallet,
  Target,
  CreditCard,
  TrendingUp,
  Settings,
  LayoutGrid,
  HandCoins,
  Gift,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export const navPrincipal: NavItem[] = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/lancamentos', label: 'Extrato', icon: ReceiptText },
  { to: '/orcamentos', label: 'Envelopes', icon: Wallet },
  { to: '/metas', label: 'Metas', icon: Target },
]

export const navSecundario: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/desejos', label: 'Desejos', icon: Gift },
  { to: '/contas', label: 'Contas & Cartões', icon: CreditCard },
  { to: '/dividas', label: 'Dívidas', icon: HandCoins },
  { to: '/futuro', label: 'Futuro', icon: TrendingUp },
  { to: '/massa', label: 'Entrada em massa', icon: LayoutGrid },
  { to: '/config', label: 'Configurações', icon: Settings },
]
