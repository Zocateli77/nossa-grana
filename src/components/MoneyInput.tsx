import * as React from 'react'
import { Input } from '@/components/ui/input'
import { money } from '@/lib/format'

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number
  onChange: (v: number) => void
}

/** Input de moeda baseado em centavos: digitar "75642" vira R$ 756,42. */
export const MoneyInput = React.forwardRef<HTMLInputElement, Props>(({ value, onChange, ...props }, ref) => {
  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    onChange(digits ? parseInt(digits, 10) / 100 : 0)
  }
  return (
    <Input
      ref={ref}
      inputMode="numeric"
      value={value ? money(value) : ''}
      onChange={handle}
      placeholder="R$ 0,00"
      className="text-lg font-semibold tabular-nums"
      {...props}
    />
  )
})
MoneyInput.displayName = 'MoneyInput'
