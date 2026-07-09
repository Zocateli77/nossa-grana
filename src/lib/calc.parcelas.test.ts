import { describe, it, expect } from 'vitest'
import { expandirSerie, type BaseSerie } from './calc'

function base(over: Partial<BaseSerie> = {}): BaseSerie {
  return {
    descricao: 'Notebook',
    valor: 0,
    data: '2026-03-10',
    tipo: 'despesa',
    conta_id: 'c1',
    categoria_id: null,
    dono_id: null,
    meta_id: null,
    parcela_atual: 1,
    parcela_total: 3,
    valor_total: 1000,
    data_primeira_parcela: null,
    recorrente: false,
    frequencia: 'mensal',
    privado: false,
    observacao: null,
    ...over,
  }
}

describe('expandirSerie — ajuste de centavos', () => {
  it('1000/3: última parcela absorve a diferença e a soma fecha o total', () => {
    const rows = expandirSerie(base({ valor: 333.33, valor_total: 1000, parcela_total: 3 }), 'g1')
    const valores = rows.map((r) => r.valor)
    expect(valores).toEqual([333.33, 333.33, 333.34])
    expect(valores.reduce((s, v) => s + v, 0)).toBeCloseTo(1000, 10)
  })

  it('100/3: 33,33 + 33,33 + 33,34 = 100', () => {
    const rows = expandirSerie(base({ valor: 33.33, valor_total: 100, parcela_total: 3 }), 'g1')
    expect(rows.map((r) => r.valor)).toEqual([33.33, 33.33, 33.34])
  })

  it('recalcula a divisão mesmo se o valor da parcela vier errado do form', () => {
    const rows = expandirSerie(base({ valor: 999, valor_total: 1000, parcela_total: 4 }), 'g1')
    // ignora o base.valor e usa round2(1000/4)=250 + última = 250
    expect(rows.map((r) => r.valor)).toEqual([250, 250, 250, 250])
  })

  it('sem valor_total (modo "sei o valor da parcela") mantém o valor informado', () => {
    const rows = expandirSerie(base({ valor: 200, valor_total: null, parcela_total: 3 }), 'g1')
    expect(rows.map((r) => r.valor)).toEqual([200, 200, 200])
  })

  it('parcela retroativa (atual > 1) não aplica ajuste de centavos', () => {
    const rows = expandirSerie(
      base({ valor: 333.33, valor_total: 1000, parcela_atual: 3, parcela_total: 3 }),
      'g1'
    )
    // gera só a parcela 3, com o valor informado (não recalcula a série toda)
    expect(rows).toHaveLength(1)
    expect(rows[0].valor).toBe(333.33)
  })
})
