import { Loader2, type LucideIcon } from 'lucide-react'

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <span className="text-sm">{texto}</span>
    </div>
  )
}

export function Vazio({ icon: Icon, titulo, descricao, acao }: { icon: LucideIcon; titulo: string; descricao?: string; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary mb-1">
        <Icon className="h-7 w-7" />
      </span>
      <p className="font-semibold">{titulo}</p>
      {descricao && <p className="text-sm text-muted-foreground max-w-xs">{descricao}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  )
}

export function SecaoTitulo({ children, acao }: { children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2 mt-6 first:mt-0">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{children}</h2>
      {acao}
    </div>
  )
}
