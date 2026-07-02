import { Loader2, AlertCircle, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2"
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      <span className="text-sm">{texto}</span>
    </div>
  )
}

export function Vazio({
  icon: Icon,
  titulo,
  descricao,
  acao,
}: {
  icon: LucideIcon
  titulo: string
  descricao?: string
  acao?: React.ReactNode
}) {
  return (
    <div role="status" className="flex flex-col items-center justify-center py-16 text-center gap-2">
      <span
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary mb-1"
        aria-hidden="true"
      >
        <Icon className="h-7 w-7" />
      </span>
      <h3 className="font-semibold">{titulo}</h3>
      {descricao && <p className="text-sm text-muted-foreground max-w-xs">{descricao}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  )
}

export function Erro({
  titulo = 'Algo deu errado',
  descricao,
  onTentarNovamente,
}: {
  titulo?: string
  descricao?: string
  onTentarNovamente?: () => void
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center py-16 text-center gap-2">
      <span
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-1"
        aria-hidden="true"
      >
        <AlertCircle className="h-7 w-7" />
      </span>
      <h3 className="font-semibold">{titulo}</h3>
      {descricao && <p className="text-sm text-muted-foreground max-w-xs">{descricao}</p>}
      {onTentarNovamente && (
        <Button variant="outline" className="mt-2" onClick={onTentarNovamente}>
          Tentar novamente
        </Button>
      )}
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
