import { afterEach, describe, expect, it, vi } from 'vitest'

describe('Resend API helper', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
  })

  it('sends weekly report email through Resend with server-only credentials', async () => {
    process.env.RESEND_API_KEY = 're_test'
    process.env.EMAIL_FROM = 'Nossa Grana <relatorios@example.com>'
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.headers).toMatchObject({
        authorization: 'Bearer re_test',
        'content-type': 'application/json',
      })
      const body = JSON.parse(String(init.body))
      expect(body).toMatchObject({
        from: 'Nossa Grana <relatorios@example.com>',
        to: ['a@example.com', 'b@example.com'],
        subject: 'Relatorio',
        html: '<strong>ok</strong>',
      })
      return new Response(JSON.stringify({ id: 'email_123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { sendReportEmailViaResend } = await import('./report')
    const id = await sendReportEmailViaResend({
      to: ['a@example.com', 'b@example.com'],
      subject: 'Relatorio',
      html: '<strong>ok</strong>',
    })

    expect(id).toBe('email_123')
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.any(Object))
  })
})
