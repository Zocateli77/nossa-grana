import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastItem {
  id: number
  mensagem: string
  acaoLabel?: string
  onAcao?: () => void
}

interface ToastCtx {
  mostrar: (t: { mensagem: string; acaoLabel?: string; onAcao?: () => void; duracaoMs?: number }) => void
}

const Ctx = createContext<ToastCtx | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const remover = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const mostrar = useCallback<ToastCtx['mostrar']>(
    ({ duracaoMs = 6000, ...t }) => {
      const id = ++idRef.current
      setToasts((cur) => [...cur, { id, ...t }])
      window.setTimeout(() => remover(id), duracaoMs)
    },
    [remover]
  )

  return (
    <Ctx.Provider value={{ mostrar }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl bg-foreground px-4 py-3 text-background shadow-lg"
          >
            <span className="flex-1 text-sm">{t.mensagem}</span>
            {t.acaoLabel && (
              <button
                className="shrink-0 rounded-md bg-background/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide hover:bg-background/25"
                onClick={() => {
                  t.onAcao?.()
                  remover(t.id)
                }}
              >
                {t.acaoLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useToast fora do ToastProvider')
  return c
}
