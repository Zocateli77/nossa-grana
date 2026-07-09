import { createContext, useContext, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile, useWorkspaces, useTrocarWorkspace } from '@/hooks/useWorkspace'
import type { Workspace } from '@/types/db'

interface WorkspaceCtx {
  workspaceAtivo: Workspace | null
  workspaces: Workspace[]
  carregando: boolean
  trocarWorkspace: (id: string) => Promise<void>
}

const Ctx = createContext<WorkspaceCtx | undefined>(undefined)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const profile = useProfile(!!session)
  const workspaces = useWorkspaces(!!session)
  const trocar = useTrocarWorkspace()

  const carregando = !!session && (profile.isLoading || workspaces.isLoading)
  const lista = workspaces.data ?? []
  const ativoId = profile.data?.active_workspace_id
  const workspaceAtivo = lista.find((w) => w.id === ativoId) ?? lista[0] ?? null

  async function trocarWorkspace(id: string) {
    await trocar.mutateAsync(id)
  }

  return (
    <Ctx.Provider value={{ workspaceAtivo, workspaces: lista, carregando, trocarWorkspace }}>
      {children}
    </Ctx.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useWorkspace fora do WorkspaceProvider')
  return ctx
}
