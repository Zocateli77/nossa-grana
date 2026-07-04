import { describe, it, expect } from 'vitest'
import { contasDoMes } from './calc'
import type { Lancamento } from '@/types/db'

function lanc(over: Partial<Lancamento>): Lancamento {
  return {
    id: Math.random().toString(36).slice(2),
    workspace_id: 'w1',
    descricao: 'conta',
    valor: 100,
    data: '2026-03-10',
    tipo: 'despesa',
    conta_id: null,
    categoria_id: null,
    dono_id: null,
    meta_id: null,
    parcela_atual: null,
    parcela_total: null,
    valor_total: null,
    data_primeira_parcela: null,
    recorrente: false,
    frequencia: 'mensal',
    status: 'previsto',
    pago: false,
    privado: false,
    grupo_id: null,
    observacao: null,
    criado_em: '2026-03-01',
    atualizado_em: '2026-03-01',
    ...over,
  }
}

describe('contasDoMes', () => {
  const hoje = new Date(2026, 2, 15) // 15/mar

  it('lista apenas previstos a pagar do mês, ordenados por data', () => {
    const lancs = [
      lanc({ data: '2026-03-20', valor: 50, descricao: 'B' }),
      lanc({ data: '2026-03-05', valor: 30, descricao: 'A' }),
      lanc({ data: '2026-03-10', valor: 100, status: 'pago', descricao: 'pago-fora' }),
      lanc({ data: '2026-04-10', valor: 100, descricao: 'outro-mes' }),
      lanc({ data: '2026-03-12', valor: 200, tipo: 'receita', descricao: 'receita-fora' }),
    ]
    const r = contasDoMes(lancs, '2026-03-01', hoje)
    expect(r.itens.map((x) => x.lancamento.descricao)).toEqual(['A', 'B'])
    expect(r.total).toBe(80)
  })

  it('marca vencidas as com data anterior a hoje e soma o vencido', () => {
    const lancs = [
      lanc({ data: '2026-03-05', valor: 30 }), // vencida
      lanc({ data: '2026-03-15', valor: 40 }), // hoje → não vencida
      lanc({ data: '2026-03-25', valor: 50 }), // futura
    ]
    const r = contasDoMes(lancs, '2026-03-01', hoje)
    expect(r.qtdVencida).toBe(1)
    expect(r.totalVencido).toBe(30)
    expect(r.itens.find((x) => x.lancamento.data === '2026-03-15')!.vencida).toBe(false)
  })

  it('inclui imposto e emprestimo, exclui investimento e receita', () => {
    const lancs = [
      lanc({ tipo: 'imposto', valor: 10 }),
      lanc({ tipo: 'emprestimo', valor: 20 }),
      lanc({ tipo: 'investimento', valor: 30 }),
      lanc({ tipo: 'receita', valor: 40 }),
    ]
    const r = contasDoMes(lancs, '2026-03-01', hoje)
    expect(r.total).toBe(30) // 10 + 20
  })
})
