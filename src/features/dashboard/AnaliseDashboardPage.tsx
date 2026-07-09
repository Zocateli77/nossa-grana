import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  ReferenceLine,
} from 'recharts'
import { AlertTriangle, TrendingDown, TrendingUp, ShieldAlert } from 'lucide-react'
import { useApp } from '@/contexts/AppContext'
import { useDados } from '@/hooks/useDados'
import {
  analiseGastoInvestimento,
  envelopesDoMes,
  gastosPorCategoria,
  serieMensal,
} from '@/lib/calc'
import { money, moneyCompact, pct, mesCurto } from '@/lib/format'
import { MonthSelector } from '@/components/layout/MonthSelector'
import { CategoriaIcon } from '@/components/CategoriaIcon'
import { AIQuickLink } from '@/components/AIQuickLink'
import { Carregando, SecaoTitulo } from '@/components/Estados'
import { Progress } from '@/components/ui/progress'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn, rechartsTooltipProps } from '@/lib/utils'

const CORES_RENDA = {
  investimento: 'hsl(var(--success))',
  impostos: 'hsl(var(--muted-foreground))',
  gastos: 'hsl(var(--primary))',
  sobra: 'hsl(var(--accent))',
}

export function AnaliseDashboardPage() {
  const { mesRef, salarioBase } = useApp()
  const { dados, isLoading } = useDados()

  if (isLoading) return <Carregando />

  const analise = analiseGastoInvestimento(dados, mesRef, salarioBase)
  const envs = envelopesDoMes(dados, mesRef).slice(0, 8)
  const categorias = gastosPorCategoria(dados, mesRef).slice(0, 8)
  const tendencia = serieMensal(dados, mesRef, 6, salarioBase)

  const pctTeto =
    analise.tetoGastoSemAfetarInvest > 0
      ? Math.min(100, (analise.gastoRealTotal / analise.tetoGastoSemAfetarInvest) * 100)
      : 0

  const heroCor =
    analise.estado === 'risco'
      ? 'text-destructive'
      : analise.estado === 'alerta'
        ? 'text-warning-foreground'
        : 'text-success'

  const barraCor =
    analise.estado === 'risco'
      ? 'bg-destructive'
      : analise.estado === 'alerta'
        ? 'bg-warning'
        : 'bg-success'

  const sobraLivre = Math.max(
    0,
    analise.renda - analise.impostosReservados - analise.aportePlanejado - analise.gastoRealTotal
  )

  const distribuicaoRenda = [
    { nome: 'Investimento', valor: analise.aportePlanejado, cor: CORES_RENDA.investimento },
    { nome: 'Impostos', valor: analise.impostosReservados, cor: CORES_RENDA.impostos },
    { nome: 'Gastos', valor: analise.gastoRealTotal, cor: CORES_RENDA.gastos },
    { nome: 'Sobra livre', valor: sobraLivre, cor: CORES_RENDA.sobra },
  ].filter((d) => d.valor > 0)

  const dadosEnvelopes = envs.map((e) => ({
    nome: e.categoria.nome.length > 14 ? `${e.categoria.nome.slice(0, 12)}…` : e.categoria.nome,
    gasto: e.gasto,
    orcado: e.estabelecido,
    estourou: e.estourou,
    cor: e.categoria.cor ?? 'hsl(var(--primary))',
  }))

  const dadosCategorias = categorias.map((g) => ({
    nome: g.categoria.nome,
    valor: g.total,
    cor: g.categoria.cor ?? 'hsl(var(--primary))',
  }))

  const chartTendencia = tendencia.map((t) => ({
    mes: mesCurto(t.mesRef),
    renda: Math.round(t.renda),
    gasto: Math.round(t.gasto),
    investido: Math.round(t.investido),
  }))

  const pctAporte =
    analise.aportePlanejado > 0
      ? Math.min(100, (analise.aportePossivel / analise.aportePlanejado) * 100)
      : 0

  return (
    <div className="space-y-1">
      <header className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm text-muted-foreground">Análise consolidada</p>
          <h1 className="text-xl font-extrabold tracking-tight">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <AIQuickLink prompt="Analise meu dashboard consolidado e diga os principais riscos." label="IA" />
          <MonthSelector />
        </div>
      </header>

      {/* Hero — quanto ainda posso gastar */}
      <Card className="overflow-hidden">
        <div className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Quanto ainda posso gastar</span>
            <Badge
              variant={
                analise.estado === 'risco'
                  ? 'destructive'
                  : analise.estado === 'alerta'
                    ? 'warning'
                    : 'success'
              }
            >
              {analise.estado === 'risco'
                ? 'Investimento em risco'
                : analise.estado === 'alerta'
                  ? 'Atenção'
                  : 'No caminho'}
            </Badge>
          </div>
          <p className={cn('text-4xl font-extrabold tracking-tight mt-1', heroCor)}>
            {money(Math.max(0, analise.podeGastarAinda))}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            sem comprometer seu aporte de {money(analise.aportePlanejado)}
          </p>

          <div className="mt-4">
            <Progress value={pctTeto} indicatorClassName={barraCor} />
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                Teto de gasto <b className="text-foreground">{money(analise.tetoGastoSemAfetarInvest)}</b>
              </span>
              <span>
                Já gastou <b className="text-foreground">{money(analise.gastoRealTotal)}</b>
              </span>
            </div>
          </div>

          {analise.aporteEmRisco > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Você já invadiu {money(analise.aporteEmRisco)} do que seria seu aporte.
            </p>
          )}
        </div>
      </Card>

      {/* Mini-stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat titulo="Renda" valor={analise.renda} />
        <MiniStat titulo="Gasto real" valor={analise.gastoRealTotal} />
        <MiniStat titulo="Investido" valor={analise.investidoReal} cor="text-success" />
        <MiniStat
          titulo="Aporte possível"
          valor={analise.aportePossivel}
          cor={analise.aporteEmRisco > 0 ? 'text-destructive' : 'text-success'}
        />
      </div>

      {/* Efeito dominó no investimento */}
      <SecaoTitulo>Efeito no investimento</SecaoTitulo>
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              analise.aporteEmRisco > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
            )}
          >
            {analise.aporteEmRisco > 0 ? (
              <TrendingDown className="h-5 w-5" />
            ) : (
              <TrendingUp className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Aporte planejado vs possível</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold tabular-nums">{money(analise.aportePossivel)}</span>
              <span className="text-sm text-muted-foreground">de {money(analise.aportePlanejado)}</span>
            </div>
            <Progress
              value={pctAporte}
              className="mt-3"
              indicatorClassName={analise.aporteEmRisco > 0 ? 'bg-destructive' : 'bg-success'}
            />
            {analise.aporteEmRisco > 0 ? (
              <p className="mt-3 text-sm text-destructive">
                Estourar envelopes de gasto reduz seu aporte em até {money(analise.aporteEmRisco)}.
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Mantendo os gastos dentro do teto, seu aporte de investimento fica preservado.
              </p>
            )}
          </div>
        </div>

        {analise.estouroEnvelopes.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" />
              Envelopes que estouraram
            </p>
            <div className="space-y-2">
              {analise.estouroEnvelopes.map((e) => (
                <div key={e.categoria.id} className="flex items-center gap-3">
                  <CategoriaIcon
                    icone={e.categoria.icone}
                    cor={e.categoria.cor}
                    className="h-8 w-8 shrink-0"
                    size={15}
                  />
                  <span className="flex-1 truncate text-sm font-medium">{e.categoria.nome}</span>
                  <span className="text-sm font-semibold tabular-nums text-destructive">
                    +{money(e.estourouValor)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Total estourado: <b className="text-destructive">{money(analise.estouroTotal)}</b> — esse excesso
              compete diretamente com o envelope de investimento.
            </p>
          </div>
        )}
      </Card>

      {/* Distribuição da renda */}
      {distribuicaoRenda.length > 0 && (
        <>
          <SecaoTitulo>Distribuição da renda</SecaoTitulo>
          <Card className="p-4">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribuicaoRenda}
                    dataKey="valor"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                  >
                    {distribuicaoRenda.map((d) => (
                      <Cell key={d.nome} fill={d.cor} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => money(v)}
                    {...rechartsTooltipProps}
                  />
                  <Legend
                    formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                    iconType="circle"
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Renda total: <b className="text-foreground">{money(analise.renda)}</b>
            </p>
          </Card>
        </>
      )}

      {/* Envelopes: orçado vs gasto */}
      {dadosEnvelopes.length > 0 && (
        <>
          <SecaoTitulo>Envelopes: orçado vs gasto</SecaoTitulo>
          <Card className="p-4">
            <div className="h-56 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dadosEnvelopes}
                  layout="vertical"
                  margin={{ top: 0, right: 8, bottom: 0, left: 4 }}
                >
                  <XAxis
                    type="number"
                    tickFormatter={(v) => moneyCompact(v)}
                    tick={{ fontSize: 10 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={72}
                    tick={{ fontSize: 10 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      money(v),
                      name === 'gasto' ? 'Gasto' : 'Orçado',
                    ]}
                    labelFormatter={(label) => String(label)}
                    {...rechartsTooltipProps}
                  />
                  <Bar dataKey="orcado" fill="hsl(var(--muted))" radius={[0, 4, 4, 0]} barSize={10} />
                  <Bar dataKey="gasto" radius={[0, 4, 4, 0]} barSize={10}>
                    {dadosEnvelopes.map((e, i) => (
                      <Cell
                        key={i}
                        fill={e.estourou ? 'hsl(var(--destructive))' : e.cor}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-4 rounded bg-muted" /> Orçado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-4 rounded bg-primary" /> Gasto
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-4 rounded bg-destructive" /> Estourou
              </span>
            </div>
          </Card>
        </>
      )}

      {/* Gastos por categoria */}
      {dadosCategorias.length > 0 && (
        <>
          <SecaoTitulo>Gastos por categoria</SecaoTitulo>
          <Card className="p-4">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dadosCategorias}
                    dataKey="valor"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={72}
                    paddingAngle={1}
                  >
                    {dadosCategorias.map((d, i) => (
                      <Cell key={i} fill={d.cor} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => money(v)}
                    {...rechartsTooltipProps}
                  />
                  <Legend
                    formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                    iconType="circle"
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1">
              {categorias.slice(0, 4).map((g) => (
                <div key={g.categoria.id} className="flex items-center justify-between text-xs">
                  <span className="truncate text-muted-foreground">{g.categoria.nome}</span>
                  <span className="font-medium tabular-nums">
                    {money(g.total)} · {pct(g.pct)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* Tendência 6 meses */}
      <SecaoTitulo>Tendência (6 meses)</SecaoTitulo>
      <Card className="p-4">
        <p className="text-sm text-muted-foreground mb-2">Renda, gasto e investimento mês a mês</p>
        <div className="h-48 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartTendencia} margin={{ top: 5, right: 8, bottom: 0, left: 8 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                tickFormatter={(v) => moneyCompact(v)}
                tick={{ fontSize: 11 }}
                width={52}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip
                formatter={(v: number, name: string) => [
                  money(v),
                  name === 'renda' ? 'Renda' : name === 'gasto' ? 'Gasto' : 'Investido',
                ]}
                {...rechartsTooltipProps}
              />
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-foreground">
                    {value === 'renda' ? 'Renda' : value === 'gasto' ? 'Gasto' : 'Investido'}
                  </span>
                )}
                iconType="line"
                iconSize={12}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="renda"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                dot={{ r: 2 }}
                strokeDasharray="4 2"
              />
              <Line
                type="monotone"
                dataKey="gasto"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="investido"
                stroke="hsl(var(--success))"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="h-4" />
    </div>
  )
}

function MiniStat({ titulo, valor, cor }: { titulo: string; valor: number; cor?: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={cn('mt-0.5 text-base font-bold tabular-nums', cor)}>{money(valor)}</p>
    </Card>
  )
}
