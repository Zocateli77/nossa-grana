import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AIQuickLink({ prompt, label = 'Perguntar a IA' }: { prompt: string; label?: string }) {
  return (
    <Button asChild variant="outline" size="sm">
      <Link to={`/ia?prompt=${encodeURIComponent(prompt)}`}>
        <Sparkles className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  )
}
