import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { AuditRow } from '@/types/dashboard'

interface LogsTabProps {
  entries: AuditRow[]
}

export function LogsTab({ entries }: LogsTabProps) {
  if (!entries?.length) {
    return <p className="text-muted-foreground py-8 text-center">No audit entries yet.</p>
  }

  return (
    <div className="py-4">
      <ScrollArea className="h-[600px] rounded-md border border-border/50">
        <div className="p-4 space-y-1">
          {entries.map((entry) => {
            const timestamp = (entry.event_time || '').replace('T', ' ').slice(0, 19)
            const change =
              entry.old_value || entry.new_value
                ? `${entry.old_value ?? '∅'} → ${entry.new_value ?? '∅'}`
                : ''
            const entryKey = [
              entry.event_time,
              entry.domain,
              entry.action,
              entry.key_name,
              entry.old_value,
              entry.new_value,
              entry.note
            ]
              .filter(Boolean)
              .join(':')
            return (
              <div key={entryKey}>
                <div className="py-3 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{timestamp}</span>
                    <Badge variant="outline" className="text-xs border-primary/20 text-primary">
                      {entry.domain}
                    </Badge>
                    <span className="text-xs text-foreground">{entry.action}</span>
                    {entry.key_name && (
                      <span className="text-xs text-muted-foreground font-mono">
                        · {entry.key_name}
                      </span>
                    )}
                  </div>
                  {change && (
                    <div className="flex items-center gap-2 text-xs font-mono pl-2">
                      {entry.old_value && (
                        <span className="text-[var(--danger)]/80">{entry.old_value}</span>
                      )}
                      {entry.old_value && entry.new_value && (
                        <span className="text-muted-foreground">→</span>
                      )}
                      {entry.new_value && (
                        <span className="text-[var(--ok)]">{entry.new_value}</span>
                      )}
                    </div>
                  )}
                  {entry.note && <p className="text-xs text-muted-foreground pl-2">{entry.note}</p>}
                </div>
                {entry !== entries[entries.length - 1] && <Separator className="bg-border/30" />}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
