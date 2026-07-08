import { useMemo, useState } from 'react'
import { HandCoins, Loader2, CheckCircle2 } from 'lucide-react'
import { useDados } from '@/hooks/useDados'
import { useQuitarDivida } from '@/hooks/useMutations'
import { byId, dividas as calcularDividas, type DividaInfo } from '@/lib/calc'
import { money, mesCurto } from '@/lib/format'
import { Carregando, Vazio, SecaoTitulo } from '@/components/Estados'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

export function DividasPage() {
  const { dados, isLoading } = useDados()
  const quitar = useQuitarDivida()
  const contasMap = useMemo(() => byId(dados.contas), [dados.contas])
  const [quitando, setQuitando] = useState<string | null>(null)
  const [confirmarQuitar, setConfirmarQuitar] = useState<DividaInfo | null>(null)

  const catsDivida = useMemo(
    () => new Set(dados.categorias.filter((c) => c.grupo === 'divida').map((c) => c.id)),
    [dados.categorias]
  )

  if (isLoading) return <Carregando />

  const ehDivida = (l: (typeof dados.lancamentos)[number]) =>
    l.tipo === 'emprestimo' || (l.categoria_id != null && catsDivida.has(l.categoria_id))
  const ativas = calcularDividas(dados.lancamentos, new Date(), catsDivida).sort((a, b) => b.totalDevido - a.totalDevido)
  const quitados = dados.lancamentos.filter((l) => ehDivida(l) && l.status === 'quitado')
  const total = ativas.reduce((s, d) => s + d.totalDevido, 0)
  const porMes = ativas.reduce((s, d) => s + Number(d.lancamento.valor), 0)

  async function fazerQuitar(d: DividaInfo) {
    setQuitando(d.lancamento.id)
    try {
      await quitar.mutateAsync(d.lancamento)
      setConfirmarQuitar(null)
    } finally {
      setQuitando(null)
    }
  }

  if (ativas.length === 0 && quitados.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-extrabold tracking-tight mb-3">Dívidas</h1>
        <Vazio icon={HandCoins} titulo="Sem dívidas" descricao="Lançamentos do tipo empréstimo aparecem aqui, de qualquer conta." />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-extrabold tracking-tight mb-3">Dívidas</h1>

      <Card className="p-5 mb-4">
        <span className="text-sm text-muted-foreground">Total ainda devido</span>
        <p className="text-3xl font-extrabold text-destructive">{money(total)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {ativas.length} dívida(s) - {money(porMes)}/mês em parcelas
        </p>
      </Card>

      <div className="space-y-2">
        {ativas.map((d) => {
          const l = d.lancamento
          const conta = l.conta_id ? contasMap.get(l.conta_id) : undefined
          return (
            <Card key={l.id} className="p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive shrink-0">
                  <HandCoins className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{l.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {conta?.nome ?? 'Sem conta'} · {l.parcela_atual}/{l.parcela_total} · faltam {d.faltam} · acaba {mesCurto(d.ultimaParcelaMes)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="destructive">{money(d.totalDevido)}</Badge>
                  <p className="text-xs text-muted-foreground mt-1">{money(l.valor)}/mês</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full min-h-11 text-primary"
                disabled={quitando === l.id}
                onClick={() => setConfirmarQuitar(d)}
              >
                {quitando === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Quitar/Adiantar · paga {money(d.totalDevido)}
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
              <div key={l.id} className="flex items-center gap-3 p-3 text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                <span className="flex-1 truncate text-sm line-through">{l.descricao}</span>
                <Badge variant="success">quitada</Badge>
              </div>
            ))}
          </Card>
        </>
      )}

      <Dialog open={!!confirmarQuitar} onOpenChange={(o) => !o && setConfirmarQuitar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quitar dívida?</DialogTitle>
            <DialogDescription>
              {confirmarQuitar && (
                <>
                  Você vai quitar &quot;{confirmarQuitar.lancamento.descricao}&quot; pagando {money(confirmarQuitar.totalDevido)} de uma vez.
                  Esta ação não pode ser desfeita.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setConfirmarQuitar(null)}>
              Cancelar
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={!!quitando}
              onClick={() => confirmarQuitar && fazerQuitar(confirmarQuitar)}
            >
              {quitando && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar quitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="h-4" />
    </div>
  )
}
