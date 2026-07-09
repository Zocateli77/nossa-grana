import { describe, expect, it } from 'vitest'
import { buildAiFooterNotes, emailRunKey, injectAiFooterIntoEmail } from './aiEmail'

describe('buildAiFooterNotes', () => {
  it('returns exactly three practical notes for the weekly report', () => {
    const notes = buildAiFooterNotes({
      resumo: { renda: 21000, gasto: 11600, sobra: 1200, pctRenda: 0.55 },
      envelopes: [
        { nome: 'Saude', gasto: 2310, estabelecido: 2000, pct: 1.15, estourou: true },
        { nome: 'Mercado', gasto: 1700, estabelecido: 1800, pct: 0.94, estourou: false },
      ],
      insights: [{ tipo: 'alerta', texto: 'Saude acima da media.' }],
      maiores: [{ descricao: 'Mounjaro', valor: 1200, categoria: 'Saude', data: '2026-08-01' }],
    })

    expect(notes).toHaveLength(3)
    expect(notes[0]).toContain('Saude')
    expect(notes[1]).toContain('Mercado')
    expect(notes[2]).toMatch(/\?$/)
  })
})

describe('injectAiFooterIntoEmail', () => {
  it('adds the AI footer before the final app footer', () => {
    const html = '<html><body><main>Relatorio</main><footer>Paz com o dinheiro</footer></body></html>'
    const out = injectAiFooterIntoEmail(html, ['Ponto 1', 'Ponto 2', 'Pergunta?'])

    expect(out).toContain('Notas da IA')
    expect(out.indexOf('Notas da IA')).toBeLessThan(out.indexOf('Paz com o dinheiro'))
    expect(out).toContain('Pergunta?')
  })
})

describe('emailRunKey', () => {
  it('builds a stable idempotency key per workspace and date', () => {
    expect(emailRunKey('ws-1', '2026-07-12')).toBe('ws-1:2026-07-12:weekly-report')
  })
})
