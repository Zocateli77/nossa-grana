import { optionalEnv } from '../_lib/env'
import { errorResponse, json } from '../_lib/http'
import { getWorkspacesForWeeklyReport, sendWorkspaceWeeklyReport, todaySaoPaulo } from '../_lib/report'
import { createServiceSupabase } from '../_lib/supabase'

export async function GET(request: Request) {
  const cronSecret = optionalEnv('CRON_SECRET')
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return json({ error: 'Nao autorizado.' }, 401)
  }

  try {
    const supabase = createServiceSupabase()
    const date = todaySaoPaulo()
    const workspaces = await getWorkspacesForWeeklyReport(supabase)
    const results = []

    for (const workspace of workspaces) {
      results.push(await sendWorkspaceWeeklyReport(supabase, workspace.id, date))
    }

    return json({
      date,
      workspaces: workspaces.length,
      sent: results.filter((result) => result.status === 'sent').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
      failed: results.filter((result) => result.status === 'failed').length,
      results,
    })
  } catch (error) {
    return errorResponse(error, 500)
  }
}
