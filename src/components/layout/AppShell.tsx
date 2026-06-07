import { useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Plus, Menu, Moon, Sun, LogOut, PiggyBank } from 'lucide-react'
import { navPrincipal, navSecundario, type NavItem } from '@/lib/nav'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'

function NavItemLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
          isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )
      }
    >
      <Icon className="h-5 w-5" />
      {item.label}
    </NavLink>
  )
}

function Sidebar() {
  const { sair } = useAuth()
  const { tema, alternarTema } = useApp()
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card/50 p-4 gap-1 h-screen sticky top-0">
      <div className="flex items-center gap-2 px-2 py-3 mb-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <PiggyBank className="h-5 w-5" />
        </span>
        <span className="text-lg font-extrabold tracking-tight">Nossa Grana</span>
      </div>
      {navPrincipal.map((i) => (
        <NavItemLink key={i.to} item={i} />
      ))}
      <div className="my-2 h-px bg-border" />
      {navSecundario.map((i) => (
        <NavItemLink key={i.to} item={i} />
      ))}
      <div className="mt-auto flex flex-col gap-1">
        <Button variant="ghost" className="justify-start gap-3 px-3 text-muted-foreground" onClick={alternarTema}>
          {tema === 'claro' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          {tema === 'claro' ? 'Tema escuro' : 'Tema claro'}
        </Button>
        <Button variant="ghost" className="justify-start gap-3 px-3 text-muted-foreground" onClick={sair}>
          <LogOut className="h-5 w-5" /> Sair
        </Button>
      </div>
    </aside>
  )
}

function MaisSheet() {
  const [open, setOpen] = useState(false)
  const { sair } = useAuth()
  const { tema, alternarTema } = useApp()
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="flex flex-1 flex-col items-center gap-0.5 py-2 text-muted-foreground">
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium">Mais</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>Mais</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-1 pb-4">
          {navSecundario.map((i) => (
            <SheetClose asChild key={i.to}>
              <NavItemLink item={i} />
            </SheetClose>
          ))}
          <div className="my-2 h-px bg-border" />
          <Button variant="ghost" className="justify-start gap-3 px-3 text-muted-foreground" onClick={alternarTema}>
            {tema === 'claro' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            {tema === 'claro' ? 'Tema escuro' : 'Tema claro'}
          </Button>
          <Button variant="ghost" className="justify-start gap-3 px-3 text-muted-foreground" onClick={sair}>
            <LogOut className="h-5 w-5" /> Sair
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function BottomNav() {
  const navigate = useNavigate()
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur safe-bottom">
      <div className="relative flex items-stretch">
        {navPrincipal.slice(0, 2).map((i) => (
          <BottomItem key={i.to} item={i} />
        ))}
        <div className="flex flex-1 items-start justify-center">
          <button
            onClick={() => navigate('/lancamentos/novo')}
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform"
            aria-label="Lançar"
          >
            <Plus className="h-7 w-7" />
          </button>
        </div>
        {navPrincipal.slice(2, 4).map((i) => (
          <BottomItem key={i.to} item={i} />
        ))}
        <MaisSheet />
      </div>
    </nav>
  )
}

function BottomItem({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn('flex flex-1 flex-col items-center gap-0.5 py-2', isActive ? 'text-primary' : 'text-muted-foreground')
      }
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px] font-medium">{item.label}</span>
    </NavLink>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen md:flex bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-24 md:pb-0">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 md:py-6">{children}</div>
      </main>
      <BottomNav />
    </div>
  )
}
