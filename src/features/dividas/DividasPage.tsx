import { useMemo, useState } from 'react'
import { HandCoins, Loader2, CheckCircle2 } from 'lucide-react'
import { useDados } from '@/hooks/useDados'
import { useQuitarDivida } from '@/hooks/useMutations'
import { byId, ehParcelado, parcelasFaltam } from '@/lib/calc'
import { mesRefDe, navegarMes } from '@/lib/dates'
import { money, mesCurto } from '@/lib/format'
import type { Lancamento } from '@/types/db'
import { Carregando, Vazio, SecaoTitulo } from '@/components/Estados'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

function totalDevido(l: Lancamento): number {
  if (ehParcelado(l)) return parcelasFaltam(l) * Number(l.valor)
  return Number(l.valor)
}
function ultimaParcelaMes(l: Lancamento): string | null {
  if (!ehParcelado(l)) return null
  const base = mesRefDe(l.data_primeira_parcela ?? l.data)
  return navegarMes(base, (l.parcela_total ?? 1) - 1)
}

export function DividasPage() {
  const { dados, isLoading } = useDados()
  const quitar = useQuitarDivida()
  const contasMap = useMemo(() => byId(dados.contas), [dados.contas])
  const [quitando, setQuitando] = useState<string | null>(null)

  const catsDivida = useMemo(
    () => new Set(dados.categorias.filter((c) => c.grupo === 'divida').map((c) => c.id)),
    [dados.categorias]
  )

  if (isLoading) return <Carregando />

  // inclui o que é tipo 'emprestimo' OU está numa categoria do grupo "dívida"
  const emprestimos = dados.lancamentos.filter(
    (l) => l.tipo === 'emprestimo' || (l.categoria_id != null && catsDivida.has(l.categoria_id))
  )
  const ativas = emprestimos.filter((l) => l.status !== 'quitado').sort((a, b) => totalDevido(b) - totalDevido(a))
  const quitados = emprestimos.filter((l) => l.status === 'quitado')
  const total = ativas.reduce((s, l) => s + totalDevido(l), 0)
  const porMes = ativas.reduce((s, l) => s + Number(l.valor), 0)

  async function fazerQuitar(l: Lancamento) {
    setQuitando(l.id)
    try {
      await quitar.mutateAsync(l)
    } finally {
      setQuitando(null)
    }
  }

  if (emprestimos.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-extrabold tracking-tight mb-3">Dívidas</h1>
        <Vazio icon={HandCoins} titulo="Sem dívidas 🎉" descricao="Lançamentos do tipo 'empréstimo' aparecem aqui, de qualquer conta." />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-extrabold tracking-tight mb-3">Dívidas</h1>

      <Card className="p-5 mb-4">
        <span className="text-sm text-muted-foreground">Total ainda devido</span>
        <p className="text-3xl font-extrabold text-destructive">{money(total)}</p>
        <p className="text-xs text-muted-foreground mt-1">{ativas.length} dívida(s) · {money(porMes)}/mês em parcelas</p>
      </Card>

      <div className="space-y-2">
        {ativas.map((l) => {
          const conta = l.conta_id ? contasMap.get(l.conta_id) : undefined
          const fim = ultimaParcelaMes(l)
          const faltam = ehParcelado(l) ? parcelasFaltam(l) : null
          return (
            <Card key={l.id} className="p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive shrink-0">
                  <HandCoins className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{l.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {conta?.nome ?? 'Sem conta'}
                    {ehParcelado(l) && <> · {l.parcela_atual}/{l.parcela_total} · faltam {faltam}</>}
                    {fim && <> · acaba {mesCurto(fim)}</>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="destructive">{money(totalDevido(l))}</Badge>
                  <p className="text-xs text-muted-foreground mt-1">{money(l.valor)}/mês</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full text-primary"
                disabled={quitando === l.id}
                onClick={() => fazerQuitar(l)}
              >
                {quitando === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Quitar/Adiantar · paga {money(totalDevido(l))}
              </Button>
            </Card>
          )
        })}
      </div>

      {quitados.length > 0 && (
        <>
          <SecaoTitulo>Quitadas</SecaoTitulo>
          <Card className="divide-y overflow-hidden">
            {quitados.map((l) => (
              <div key={l.id} className="flex items-center gap-3 p-3 opacity-70">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                <span className="flex-1 truncate text-sm line-through">{l.descricao}</span>
                <Badge variant="success">quitada</Badge>
              </div>
            ))}
          </Card>
        </>
      )}
      <div className="h-4" />
    </div>
  )
}
