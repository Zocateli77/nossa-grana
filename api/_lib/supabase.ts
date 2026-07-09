import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { requiredEnv, serverSupabaseUrl } from './env'

export type ServiceSupabase = SupabaseClient

export interface WorkspaceAuth {
  token: string
  user: User
  workspaceId: string
}

export function createServiceSupabase() {
  const url = serverSupabaseUrl()
  if (!url) throw new Error('Variavel SUPABASE_URL ou VITE_SUPABASE_URL nao configurada.')
  return createClient(url, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function getBearerToken(request: Request) {
  const auth = request.headers.get('authorization') || ''
  const match = auth.match(/^Bearer\s+(.+)$/i)
  if (!match) throw new Error('Sessao ausente.')
  return match[1]
}

export async function authenticateWorkspace(
  request: Request,
  supabase: ServiceSupabase,
  requestedWorkspaceId?: string | null
): Promise<WorkspaceAuth> {
  const token = getBearerToken(request)
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) throw new Error('Sessao invalida.')

  const user = userData.user
  const workspaceId = requestedWorkspaceId || (await resolveActiveWorkspace(supabase, user.id))
  if (!workspaceId) throw new Error('Workspace ativo nao encontrado.')

  const { data: member, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (memberError) throw memberError
  if (!member) throw new Error('Usuario sem acesso a este workspace.')

  return { token, user, workspaceId }
}

async function resolveActiveWorkspace(supabase: ServiceSupabase, userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('active_workspace_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError) throw profileError
  if (profile?.active_workspace_id) return profile.active_workspace_id as string

  const { data: member, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (memberError) throw memberError
  return (member?.workspace_id as string | undefined) ?? null
}
