import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthCtx {
  session: Session | null
  carregando: boolean
  entrar: (email: string, senha: string) => Promise<{ error: string | null }>
  cadastrar: (email: string, senha: string) => Promise<{ error: string | null; precisaConfirmar: boolean }>
  sair: () => Promise<void>
}

const Ctx = createContext<AuthCtx | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCarregando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  async function entrar(email: string, senha: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    return { error: error ? traduzErro(error.message) : null }
  }

  async function cadastrar(email: string, senha: string) {
    const { data, error } = await supabase.auth.signUp({ email, password: senha })
    if (error) return { error: traduzErro(error.message), precisaConfirmar: false }
    const precisaConfirmar = !data.session
    return { error: null, precisaConfirmar }
  }

  async function sair() {
    await supabase.auth.signOut()
  }

  return <Ctx.Provider value={{ session, carregando, entrar, cadastrar, sair }}>{children}</Ctx.Provider>
}

function traduzErro(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(msg)) return 'E-mail ainda não confirmado.'
  if (/user already registered/i.test(msg)) return 'Este e-mail já está cadastrado.'
  if (/password.*at least/i.test(msg)) return 'A senha deve ter pelo menos 6 caracteres.'
  if (/database error saving new user/i.test(msg)) return 'Erro ao criar sua conta. Tente novamente em instantes.'
  if (/database error creating new user/i.test(msg)) return 'Erro ao criar sua conta. Tente novamente em instantes.'
  return msg
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
