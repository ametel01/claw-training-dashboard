import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { AuditRow } from '@/types/dashboard';

interface LogsTabProps {
  entries: AuditRow[];
}

function formatTimestamp(value?: string) {
  return (value || '').replace('T', ' ').slice(0, 19);
}

function getEntryKey(entry: AuditRow) {
  return [
    entry.event_time,
    entry.domain,
    entry.action,
    entry.key_name,
    entry.old_value,
    entry.new_value,
    entry.note,
  ]
    .filter(Boolean)
    .join(':');
}

function AuditEntryChange({ entry }: { entry: AuditRow }) {
  if (!entry.old_value && !entry.new_value) return null;

  return (
    <div className="flex items-center gap-2 pl-2 font-mono text-xs">
      {entry.old_value ? <span className="text-[var(--danger)]/80">{entry.old_value}</span> : null}
      {entry.old_value && entry.new_value ? <span className="text-muted-foreground">→</span> : null}
      {entry.new_value ? <span className="text-[var(--ok)]">{entry.new_value}</span> : null}
    </div>
  );
}

function AuditEntryItem({ entry, isLast }: { entry: AuditRow; isLast: boolean }) {
  return (
    <div>
      <div className="space-y-1 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {formatTimestamp(entry.event_time)}
          </span>
          <Badge variant="outline" className="border-primary/20 text-xs text-primary">
            {entry.domain}
          </Badge>
          <span className="text-xs text-foreground">{entry.action}</span>
          {entry.key_name ? (
            <span className="font-mono text-xs text-muted-foreground">· {entry.key_name}</span>
          ) : null}
        </div>
        <AuditEntryChange entry={entry} />
        {entry.note ? <p className="pl-2 text-xs text-muted-foreground">{entry.note}</p> : null}
      </div>
      {isLast ? null : <Separator className="bg-border/30" />}
    </div>
  );
}

export function LogsTab({ entries }: LogsTabProps) {
  if (!entries?.length) {
    return <p className="py-8 text-center text-muted-foreground">No audit entries yet.</p>;
  }

  return (
    <div className="py-4">
      <ScrollArea className="h-[600px] rounded-md border border-border/50">
        <div className="space-y-1 p-4">
          {entries.map((entry, index) => (
            <AuditEntryItem
              key={getEntryKey(entry)}
              entry={entry}
              isLast={index === entries.length - 1}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
