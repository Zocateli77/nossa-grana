import { Link } from 'react-router-dom'
import { Check, Circle, ArrowRight, Sparkles } from 'lucide-react'
import type { Dados } from '@/lib/calc'
import { useProfile, useConcluirOnboarding } from '@/hooks/useWorkspace'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Passo {
  feito: boolean
  titulo: string
  para: string
  cta: string
}

export function OnboardingCard({ dados }: { dados: Dados }) {
  const profile = useProfile()
  const concluir = useConcluirOnboarding()

  // só aparece enquanto o onboarding não foi concluído/dispensado (uma vez por usuário)
  if (!profile.data || profile.data.onboarding_em) return null

  const passos: Passo[] = [
    {
      feito: dados.rendas.some((r) => Number(r.valor) > 0),
      titulo: 'Cadastre sua renda',
      para: '/config',
      cta: 'Definir renda',
    },
    {
      feito: dados.orcamentos.some((o) => Number(o.valor_estabelecido) > 0 || o.percentual != null),
      titulo: 'Crie seus envelopes',
      para: '/orcamentos',
      cta: 'Criar envelope',
    },
    {
      feito: dados.lancamentos.some((l) => l.tipo === 'despesa'),
      titulo: 'Lance seu primeiro gasto',
      para: '/lancamentos/novo',
      cta: 'Lançar gasto',
    },
  ]
  const feitos = passos.filter((p) => p.feito).length
  const tudoPronto = feitos === passos.length

  return (
    <Card className="p-4 border-primary/30 bg-primary/5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-extrabold">
            <Sparkles className="h-4 w-4 text-primary" /> Bem-vindo(a) ao Nossa Grana!
          </h2>
          <p className="text-sm text-muted-foreground">
            {tudoPronto ? 'Tudo pronto! Seu espaço já está configurado.' : `3 passos para se organizar (${feitos}/3).`}
          </p>
        </div>
      </div>

      <ol className="mt-3 space-y-2">
        {passos.map((p) => (
          <li key={p.para} className="flex items-center gap-3">
            {p.feito ? (
              <Check className="h-5 w-5 shrink-0 text-success" />
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-muted-foreground/50" />
            )}
            <span className={cn('flex-1 text-sm', p.feito && 'text-muted-foreground line-through')}>{p.titulo}</span>
            {!p.feito && (
              <Button asChild variant="outline" size="sm" className="gap-1">
                <Link to={p.para}>
                  {p.cta} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-3 flex justify-end">
        <Button
          variant={tudoPronto ? 'default' : 'ghost'}
          size="sm"
          onClick={() => concluir.mutate()}
          disabled={concluir.isPending}
        >
          {tudoPronto ? 'Concluir' : 'Pular por agora'}
        </Button>
      </div>
    </Card>
  )
}
