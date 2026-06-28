import assert from 'node:assert/strict'
import { build } from 'esbuild'

const testSource = String.raw`
import assert from 'node:assert/strict'
import { analiseMensal } from './src/lib/calc.ts'

const pessoa = {
  id: 'pessoa-1',
  nome: 'Compartilhado',
  cor: null,
  criado_em: '2026-01-01',
}

const mercado = {
  id: 'cat-mercado',
  nome: 'Mercado',
  grupo: null,
  tipo_reserva: 'gasto',
  dono_id: null,
  cor: '#0f766e',
  icone: 'shopping-cart',
  ativo: true,
  criado_em: '2026-01-01',
}

const classificar = {
  id: 'cat-classificar',
  nome: 'A classificar',
  grupo: null,
  tipo_reserva: 'gasto',
  dono_id: null,
  cor: '#f59e0b',
  icone: 'circle-help',
  ativo: true,
  criado_em: '2026-01-01',
}

const cartao = {
  id: 'conta-cartao',
  nome: 'Cartao',
  tipo: 'cartao_credito',
  dono_id: null,
  dia_fechamento: 5,
  dia_vencimento: 12,
  limite: null,
  cor: '#0f766e',
  ativo: true,
  criado_em: '2026-01-01',
}

const banco = {
  id: 'conta-banco',
  nome: 'Banco',
  tipo: 'conta',
  dono_id: null,
  dia_fechamento: null,
  dia_vencimento: null,
  limite: null,
  cor: '#2563eb',
  ativo: true,
  criado_em: '2026-01-01',
}

const lanc = (id, overrides) => ({
  id,
  descricao: id,
  valor: 0,
  data: '2026-07-01',
  tipo: 'despesa',
  conta_id: null,
  categoria_id: null,
  dono_id: pessoa.id,
  meta_id: null,
  parcela_atual: null,
  parcela_total: null,
  valor_total: null,
  data_primeira_parcela: null,
  recorrente: false,
  frequencia: 'mensal',
  status: 'pago',
  pago: true,
  privado: false,
  grupo_id: null,
  observacao: null,
  criado_em: '2026-07-01',
  atualizado_em: '2026-07-01',
  ...overrides,
})

const dados = {
  pessoas: [pessoa],
  categorias: [mercado, classificar],
  contas: [cartao, banco],
  metas: [],
  orcamentos: [
    {
      id: 'orc-mercado',
      categoria_id: mercado.id,
      mes_referencia: '2026-07-01',
      valor_estabelecido: 700,
      tipo_valor: 'fixo',
      percentual: null,
      recorrente: true,
      observacao: null,
    },
  ],
  rendas: [
    {
      id: 'renda-julho',
      mes_referencia: '2026-07-01',
      valor: 5000,
      recorrente: true,
      observacao: null,
      criado_em: '2026-07-01',
    },
  ],
  lancamentos: [
    lanc('mercado-pago', { valor: 600, data: '2026-07-05', categoria_id: mercado.id, conta_id: cartao.id }),
    lanc('mercado-previsto', { valor: 200, data: '2026-07-20', categoria_id: mercado.id, conta_id: cartao.id, status: 'previsto', pago: false }),
    lanc('sem-categoria', { valor: 50, data: '2026-07-10', conta_id: banco.id }),
    lanc('classificar', { valor: 75, data: '2026-07-08', categoria_id: classificar.id, conta_id: banco.id }),
    lanc('quitado-fora', { valor: 999, data: '2026-07-09', categoria_id: classificar.id, conta_id: banco.id, status: 'quitado' }),
    lanc('investimento', { valor: 300, data: '2026-07-11', tipo: 'investimento', categoria_id: null, conta_id: banco.id }),
    lanc('imposto', { valor: 100, data: '2026-07-12', tipo: 'imposto', categoria_id: null, conta_id: banco.id }),
    lanc('emprestimo', { valor: 40, data: '2026-07-13', tipo: 'emprestimo', categoria_id: null, conta_id: banco.id }),
    lanc('receita-lancada', { valor: 700, data: '2026-07-14', tipo: 'receita', categoria_id: null, conta_id: banco.id }),
  ],
}

const analise = analiseMensal(dados, '2026-07-01', 0, new Date('2026-07-15T12:00:00'))

assert.equal(analise.gastoTotal, 925)
assert.equal(analise.gastoPago, 725)
assert.equal(analise.gastoPrevisto, 200)
assert.equal(analise.saidasTotais, 1365)
assert.equal(analise.saldo, 3635)
assert.equal(analise.semCategoriaTotal, 50)
assert.equal(analise.aClassificarTotal, 75)

assert.equal(analise.porCategoria[0].categoria.id, mercado.id)
assert.equal(analise.porCategoria[0].total, 800)
assert.equal(Math.round(analise.porCategoria[0].pct * 100), 86)

assert.equal(analise.porConta[0].conta.id, cartao.id)
assert.equal(analise.porConta[0].total, 800)
assert.equal(analise.porConta[1].conta.id, banco.id)
assert.equal(analise.porConta[1].total, 125)

assert.equal(analise.serieDiaria.length, 31)
assert.equal(analise.serieDiaria.find((d) => d.data === '2026-07-05').acumulado, 600)
assert.equal(analise.serieDiaria.find((d) => d.data === '2026-07-20').acumulado, 925)

assert.ok(analise.insights.some((i) => i.id === 'categoria-estourada-cat-mercado'))
assert.ok(analise.insights.some((i) => i.id === 'revisar-classificacao'))
assert.ok(analise.insights.some((i) => i.id === 'previstos-restantes'))
`

const output = await build({
  stdin: {
    contents: testSource,
    resolveDir: process.cwd(),
    sourcefile: 'analise-mensal.test.ts',
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
