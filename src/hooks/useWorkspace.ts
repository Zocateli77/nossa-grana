import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Convite, Profile, Workspace, WorkspaceMember } from '@/types/db'

export function useProfile(enabled = true) {
  return useQuery({
    queryKey: ['profile'],
    enabled,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (error) throw error
      return data as Profile
    },
  })
}

export function useWorkspaces(enabled = true) {
  return useQuery({
    queryKey: ['workspaces'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('workspaces').select('*').order('nome')
      if (error) throw error
      return (data ?? []) as Workspace[]
    },
  })
}

export function useMembros(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: ['workspace_members', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceId!)
      if (error) throw error
      return (data ?? []) as WorkspaceMember[]
    },
  })
}

export function useConvites(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: ['workspace_invites', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspace_invites')
        .select('*')
        .eq('workspace_id', workspaceId!)
        .neq('status', 'revogado')
        .order('criado_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as Convite[]
    },
  })
}

export function useConvitesPendentes() {
  return useQuery({
    queryKey: ['convites_pendentes'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) return []
      const { data, error } = await supabase
        .from('workspace_invites')
        .select('*, workspaces(nome)')
        .eq('status', 'pendente')
        .ilike('email', user.email)
      if (error) throw error
      return data ?? []
    },
  })
}

/** Marca o onboarding como concluído/dispensado para o usuário atual (uma vez). */
export function useConcluirOnboarding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_em: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('onboarding_em', null)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })
}

export function useCriarWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (nome?: string) => {
      const { data, error } = await supabase.rpc('create_my_workspace', {
        p_nome: nome?.trim() || 'Meu espaço',
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries()
    },
  })
}

export function useTrocarWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (workspaceId: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')
      const { error } = await supabase
        .from('profiles')
        .update({ active_workspace_id: workspaceId })
        .eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries()
    },
  })
}

export function useCriarConvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ workspaceId, email }: { workspaceId: string; email: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('workspace_invites')
        .insert({
          workspace_id: workspaceId,
          email: email.trim().toLowerCase(),
          convidado_por: user?.id ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data as Convite
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['workspace_invites', vars.workspaceId] })
    },
  })
}

export function useRevogarConvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, workspaceId }: { id: string; workspaceId: string }) => {
      const { error } = await supabase.from('workspace_invites').update({ status: 'revogado' }).eq('id', id)
      if (error) throw error
      return workspaceId
    },
    onSuccess: (workspaceId) => {
      qc.invalidateQueries({ queryKey: ['workspace_invites', workspaceId] })
    },
  })
}

export function useAceitarConvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (convite: Convite & { workspaces?: { nome: string } }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      // Defesa em profundidade: revalida o convite no servidor em vez de confiar
      // no objeto recebido. A RLS já bloqueia inserções sem convite pendente,
      // mas isto garante erro claro e impede aceitar convite de outra pessoa.
      const { data: conviteValido, error: valErr } = await supabase
        .from('workspace_invites')
        .select('id, workspace_id, email, papel, status')
        .eq('id', convite.id)
        .eq('status', 'pendente')
        .ilike('email', user.email ?? '')
        .single()
      if (valErr || !conviteValido) throw new Error('Convite inválido ou não é destinado a você.')

      const { error: memErr } = await supabase.from('workspace_members').insert({
        workspace_id: conviteValido.workspace_id,
        user_id: user.id,
        papel: conviteValido.papel,
      })
      if (memErr && !/duplicate|unique/i.test(memErr.message)) throw memErr

      const { error: invErr } = await supabase
        .from('workspace_invites')
        .update({ status: 'aceito' })
        .eq('id', conviteValido.id)
      if (invErr) throw invErr

      const { error: profErr } = await supabase
        .from('profiles')
        .update({ active_workspace_id: conviteValido.workspace_id })
        .eq('user_id', user.id)
      if (profErr) throw profErr
    },
    onSuccess: () => {
      qc.invalidateQueries()
    },
  })
}
