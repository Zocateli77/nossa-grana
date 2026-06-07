import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Tema = 'claro' | 'escuro'

interface AppCtx {
  mesRef: string
  setMesRef: (m: string) => void
  salarioBase: number
  setSalarioBase: (v: number) => void
  tema: Tema
  alternarTema: () => void
}

const Ctx = createContext<AppCtx | undefined>(undefined)

const ls = {
  get: (k: string, fb: string) => (typeof localStorage !== 'undefined' ? localStorage.getItem(k) ?? fb : fb),
  set: (k: string, v: string) => localStorage.setItem(k, v),
}

export function AppProvider({ children, mesInicial }: { children: ReactNode; mesInicial: string }) {
  const [mesRef, setMesRef] = useState(mesInicial)
  const [salarioBase, setSalarioBaseState] = useState<number>(() => Number(ls.get('salarioBase', '21000')))
  const [tema, setTema] = useState<Tema>(() => (ls.get('tema', 'claro') as Tema))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'escuro')
    ls.set('tema', tema)
  }, [tema])

  function setSalarioBase(v: number) {
    setSalarioBaseState(v)
    ls.set('salarioBase', String(v))
  }

  return (
    <Ctx.Provider
      value={{ mesRef, setMesRef, salarioBase, setSalarioBase, tema, alternarTema: () => setTema((t) => (t === 'claro' ? 'escuro' : 'claro')) }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp fora do AppProvider')
  return ctx
}
