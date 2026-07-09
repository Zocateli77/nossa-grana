import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EmailReportForAi } from '../../src/lib/aiEmail'

const report: EmailReportForAi = {
  resumo: { renda: 10000, gasto: 8200, sobra: 1800, pctRenda: 0.82 },
  envelopes: [{ nome: 'Mercado', gasto: 1300, estabelecido: 1200, pct: 1.08, estourou: true }],
  insights: [{ tipo: 'alerta', texto: 'Mercado passou do combinado.' }],
  maiores: [{ descricao: 'Compra grande', valor: 900, categoria: 'Casa', data: '2026-07-05' }],
}

describe('OpenAI API helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
    delete process.env.OPENAI_API_KEY
  })

  it('uses Responses API structured outputs for report footer notes', async () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      expect(body.model).toBe('gpt-5.4-nano')
      expect(body.text.format.type).toBe('json_schema')
      expect(body.text.format.strict).toBe(true)
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({ notes: ['Alerta principal.', 'Sugestao pratica.', 'Pergunta do casal?'] }),
          usage: { input_tokens: 10, output_tokens: 6 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const { writeReportFooterWithAi } = await import('./openai')
    const result = await writeReportFooterWithAi(report)

    expect(result.result.notes).toEqual(['Alerta principal.', 'Sugestao pratica.', 'Pergunta do casal?'])
    expect(result.skipped).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
