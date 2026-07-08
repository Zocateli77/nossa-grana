import assert from 'node:assert/strict'
import { build } from 'esbuild'

const testSource = String.raw`
import assert from 'node:assert/strict'
import { dividas, lancamentosAPagarNoMes } from './src/lib/calc.ts'

const catDividaId = 'cat-divida'

const lanc = (id, overrides = {}) => ({
  id,
  descricao: id,
  valor: 100,
  data: '2026-07-10',
  tipo: 'despesa',
  conta_id: 'conta-1',
  categoria_id: 'cat-gasto',
  dono_id: null,
  meta_id: null,
  parcela_atual: null,
  parcela_total: null,
  valor_total: null,
  data_primeira_parcela: null,
  recorrente: false,
  frequencia: 'mensal',
  status: 'previsto',
  pago: true,
  privado: false,
  grupo_id: null,
  observacao: null,
  criado_em: '2026-07-01',
  atualizado_em: '2026-07-01',
  ...overrides,
})

const pagar = lancamentosAPagarNoMes(
  [
    lanc('despesa-prevista', { tipo: 'despesa' }),
    lanc('emprestimo-previsto', { tipo: 'emprestimo' }),
    lanc('imposto-previsto', { tipo: 'imposto' }),
    lanc('investimento-previsto', { tipo: 'investimento' }),
    lanc('receita-prevista', { tipo: 'receita' }),
    lanc('despesa-paga', { status: 'pago' }),
    lanc('despesa-quitada', { status: 'quitado' }),
    lanc('despesa-outro-mes', { data: '2026-08-01' }),
  ],
  '2026-07-01'
)

assert.deepEqual(
  pagar.map((l) => l.id),
  ['despesa-prevista', 'emprestimo-previsto', 'imposto-previsto', 'investimento-previsto']
)

const hoje = new Date('2026-07-08T12:00:00')
const activeDebtRows = [
  lanc('parcela-1', {
    descricao: 'Emprestimo Lucas',
    tipo: 'emprestimo',
    valor: 250,
    status: 'pago',
    parcela_atual: 1,
    parcela_total: 3,
    data_primeira_parcela: '2026-07-01',
    grupo_id: 'grupo-emprestimo',
  }),
  lanc('parcela-2', {
    descricao: 'Emprestimo Lucas',
    tipo: 'emprestimo',
    valor: 250,
    data: '2026-08-10',
    status: 'previsto',
    parcela_atual: 2,
    parcela_total: 3,
    data_primeira_parcela: '2026-07-01',
    grupo_id: 'grupo-emprestimo',
  }),
  lanc('parcela-3', {
    descricao: 'Emprestimo Lucas',
    tipo: 'emprestimo',
    valor: 250,
    data: '2026-09-10',
    status: 'previsto',
    parcela_atual: 3,
    parcela_total: 3,
    data_primeira_parcela: '2026-07-01',
    grupo_id: 'grupo-emprestimo',
  }),
]

const quitacaoAvulsa = lanc('quitacao-avulsa', {
  descricao: 'Quitacao - Emprestimo Lucas',
  tipo: 'emprestimo',
  valor: 750,
  status: 'pago',
  parcela_atual: null,
  parcela_total: null,
  grupo_id: null,
})

const categoriaDividaParcelada = lanc('categoria-divida-1', {
  descricao: 'Divida por categoria',
  tipo: 'despesa',
  categoria_id: catDividaId,
  valor: 80,
  status: 'previsto',
  parcela_atual: 1,
  parcela_total: 2,
  data_primeira_parcela: '2026-07-01',
  grupo_id: 'grupo-categoria-divida',
})

const categoriaDividaQuitada = lanc('categoria-divida-quitada', {
  descricao: 'Divida ja quitada',
  tipo: 'despesa',
  categoria_id: catDividaId,
  valor: 100,
  status: 'quitado',
  parcela_atual: 1,
  parcela_total: 2,
  data_primeira_parcela: '2026-07-01',
  grupo_id: 'grupo-quitado',
})

const dvs = dividas(
  [...activeDebtRows, quitacaoAvulsa, categoriaDividaParcelada, categoriaDividaQuitada],
  hoje,
  new Set([catDividaId])
)

assert.equal(dvs.length, 2)
assert.deepEqual(
  dvs.map((d) => d.lancamento.id).sort(),
  ['categoria-divida-1', 'parcela-1']
)
assert.equal(dvs.find((d) => d.lancamento.id === 'parcela-1')?.totalDevido, 750)
assert.equal(dvs.some((d) => d.lancamento.id === 'quitacao-avulsa'), false)
assert.equal(dvs.some((d) => d.lancamento.id === 'categoria-divida-quitada'), false)
`

const output = await build({
  stdin: {
    contents: testSource,
    resolveDir: process.cwd(),
    sourcefile: 'lancamentos-pagamento.test.ts',
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  absWorkingDir: process.cwd(),
  tsconfig: 'tsconfig.json',
  logLevel: 'silent',
})

assert.equal(output.outputFiles.length, 1)
const code = Buffer.from(output.outputFiles[0].text).toString('base64')
await import(`data:text/javascript;base64,${code}`)
