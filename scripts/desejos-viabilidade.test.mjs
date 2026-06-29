import assert from 'node:assert/strict'
import { build } from 'esbuild'

const testSource = String.raw`
import assert from 'node:assert/strict'
import { resumoDesejos, viabilidadeDesejo } from './src/lib/calc.ts'

const pessoa = {
  id: 'pessoa-1',
  nome: 'Compartilhado',
  cor: null,
  criado_em: '2026-01-01',
}

const lazer = {
  id: 'cat-lazer',
  nome: 'Lazer',
  grupo: 'lazer',
  tipo_reserva: 'gasto',
  dono_id: null,
  cor: '#06b6d4',
  icone: 'party-popper',
  ativo: true,
  criado_em: '2026-01-01',
}

const conta = {
  id: 'conta-card',
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

const baseDesejo = {
  id: 'desejo-1',
  nome: 'PlayStation 5',
  descricao: null,
  status: 'planejado',
  valor_total: 1000,
  parcela_total: 5,
  mes_inicio: '2026-07-01',
  categoria_id: lazer.id,
  conta_id: conta.id,
  dono_id: pessoa.id,
  prioridade: 'media',
  lancamento_grupo_id: null,
  comprado_em: null,
  criado_em: '2026-06-28',
  atualizado_em: '2026-06-28',
}

const lanc = (id, overrides) => ({
  id,
  descricao: id,
  valor: 0,
  data: '2026-07-01',
  tipo: 'despesa',
  conta_id: conta.id,
  categoria_id: lazer.id,
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
  categorias: [lazer],
  contas: [conta],
  metas: [],
  desejos: [],
  orcamentos: [
    {
      id: 'orc-lazer',
      categoria_id: lazer.id,
      mes_referencia: '2026-07-01',
      valor_estabelecido: 600,
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
      valor: 1000,
      recorrente: true,
      observacao: null,
      criado_em: '2026-07-01',
    },
  ],
  lancamentos: [
    lanc('lazer-ja-gasto', { valor: 200 }),
    lanc('outro-gasto', { valor: 500, categoria_id: null }),
  ],
}

const cabe = viabilidadeDesejo(baseDesejo, dados)
assert.equal(cabe.estado, 'verde')
assert.equal(cabe.custoMensal, 200)
assert.equal(cabe.restaEnvelope, 400)
assert.equal(cabe.sobraMes, 300)

const estouraEnvelope = viabilidadeDesejo({ ...baseDesejo, id: 'desejo-2', valor_total: 1500, parcela_total: 3 }, dados)
assert.equal(estouraEnvelope.estado, 'vermelho')
assert.equal(estouraEnvelope.estouroEnvelope, 100)
assert.match(estouraEnvelope.motivo, /Estoura Lazer/)

const incompleto = viabilidadeDesejo({ ...baseDesejo, id: 'desejo-3', categoria_id: null }, dados)
assert.equal(incompleto.estado, 'neutro')
assert.match(incompleto.motivo, /Informe/)

const resumo = resumoDesejos([baseDesejo, { ...baseDesejo, id: 'desejo-4', status: 'comprado' }], dados)
assert.equal(resumo.totalMensalSimulado, 200)
assert.equal(resumo.prontos, 1)
assert.equal(resumo.bloqueados, 0)
`

const output = await build({
  stdin: {
    contents: testSource,
    resolveDir: process.cwd(),
    sourcefile: 'desejos-viabilidade.test.ts',
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
