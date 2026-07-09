import { describe, expect, it } from 'vitest'
import {
  buildActionOperations,
  estimateAiUsage,
  normalizeAiActionDraft,
  summarizeAiUsage,
} from './aiActions'

describe('normalizeAiActionDraft', () => {
  it('accepts an envelope adjustment draft and preserves the confirmation copy', () => {
    const draft = normalizeAiActionDraft({
      type: 'orcamento.upsert',
      title: 'Ajustar Mercado',
      summary: 'Aumentar Mercado para acomodar a compra do mes.',
      payload: {
        categoria_id: 'cat-mercado',
        mes_referencia: '2026-08-01',
        valor_estabelecido: 1800,
        tipo_valor: 'fixo',
        percentual: null,
        recorrente: true,
      },
      impact: {
        before: { envelope: 1500 },
        after: { envelope: 1800 },
        explanation: 'Sobra R$ 300,00 a menos no mes.',
      },
    })

    expect(draft.type).toBe('orcamento.upsert')
    if (draft.type !== 'orcamento.upsert') throw new Error('draft type mismatch')
    expect(draft.title).toBe('Ajustar Mercado')
    expect(draft.summary).toContain('Mercado')
    expect(draft.payload.valor_estabelecido).toBe(1800)
  })

  it('rejects unknown actions and invalid financial values', () => {
    expect(() =>
      normalizeAiActionDraft({
        type: 'lancamento.insert',
        title: 'Compra invalida',
        summary: 'Valor negativo nao pode virar lancamento.',
        payload: {
          descricao: 'Mercado',
          valor: -10,
          data: '2026-08-10',
          tipo: 'despesa',
          conta_id: null,
          categoria_id: 'cat',
          dono_id: null,
          meta_id: null,
          status: 'pago',
          pago: true,
          privado: false,
          observacao: null,
        },
      })
    ).toThrow(/valor/i)

    expect(() =>
      normalizeAiActionDraft({
        type: 'sql.freeform',
        title: 'SQL',
        summary: 'Nao deve aceitar SQL livre.',
        payload: { sql: 'delete from lancamentos' },
      })
    ).toThrow(/acao/i)
  })
})

describe('buildActionOperations', () => {
  it('maps a confirmed draft to bounded Supabase operations', () => {
    const draft = normalizeAiActionDraft({
      type: 'meta.update',
      title: 'Atualizar meta',
      summary: 'Ajustar valor alvo da reserva.',
      payload: {
        id: 'meta-1',
        nome: 'Reserva',
        valor_alvo: 30000,
        valor_atual: 12000,
        data_alvo: '2026-12-01',
        descricao: 'Nova meta aprovada pela IA.',
      },
    })

    expect(buildActionOperations(draft)).toEqual([
      {
        table: 'metas',
        method: 'update',
        match: { id: 'meta-1' },
        values: {
          nome: 'Reserva',
          valor_alvo: 30000,
          valor_atual: 12000,
          data_alvo: '2026-12-01',
          descricao: 'Nova meta aprovada pela IA.',
        },
      },
    ])
  })
})

describe('AI usage helpers', () => {
  it('estimates cost and warns softly near the configured budget', () => {
    const cost = estimateAiUsage({ inputTokens: 100_000, outputTokens: 20_000, model: 'gpt-5.4-mini' })
    expect(cost.usd).toBeCloseTo(0.165, 3)

    const summary = summarizeAiUsage([
      { model: 'gpt-5.4-mini', inputTokens: 1_000_000, outputTokens: 700_000 },
    ])
    expect(summary.budgetUsd).toBe(5)
    expect(summary.spentUsd).toBeCloseTo(3.9, 1)
    expect(summary.warning).toBe(true)
    expect(summary.blocked).toBe(false)
  })
})
