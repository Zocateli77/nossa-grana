import { errorResponse, json, text } from '../_lib/http'
import { buildWeeklyReport, todaySaoPaulo } from '../_lib/report'
import { authenticateWorkspace, createServiceSupabase } from '../_lib/supabase'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const supabase = createServiceSupabase()
    const auth = await authenticateWorkspace(request, supabase, url.searchParams.get('workspaceId'))
    const date = url.searchParams.get('date') || todaySaoPaulo()
    const report = await buildWeeklyReport(supabase, auth.workspaceId, date)

    if (url.searchParams.get('format') === 'html') {
      return text(report.html, 200, 'text/html; charset=utf-8')
    }

    return json({
      snapshot: report.snapshot,
      notes: report.notes,
      html: report.html,
      usage: report.usage,
    })
  } catch (error) {
    const status = error instanceof Error && /sessao|workspace|acesso/i.test(error.message) ? 401 : 500
    return errorResponse(error, status)
  }
}
