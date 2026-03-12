import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CardioRow, DashboardData } from '@/types/dashboard';

const CARDIO_SESSION_COLUMNS: Array<{
  key: keyof CardioRow;
  label: string;
}> = [
  { key: 'id', label: 'id' },
  { key: 'session_date', label: 'session_date' },
  { key: 'slot', label: 'slot' },
  { key: 'protocol', label: 'protocol' },
  { key: 'duration_min', label: 'duration_min' },
  { key: 'avg_hr', label: 'avg_hr' },
  { key: 'max_hr', label: 'max_hr' },
  { key: 'avg_speed_kmh', label: 'avg_speed_kmh' },
  { key: 'z2_cap_respected', label: 'z2_cap_respected' },
  { key: 'notes', label: 'notes' },
  { key: 'created_at', label: 'created_at' },
];

function formatCellValue(value: CardioRow[keyof CardioRow]) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function getRawCardioSessions(data: DashboardData): CardioRow[] {
  const rows = Object.values(data.details?.cardioByDate || {}).flat();
  const seen = new Set<string>();

  return rows
    .filter((row) => {
      const key =
        row.id != null ? `id:${row.id}` : `${row.session_date}|${row.slot}|${row.protocol}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => {
      const dateCompare = right.session_date.localeCompare(left.session_date);
      if (dateCompare !== 0) return dateCompare;
      return Number(right.id ?? 0) - Number(left.id ?? 0);
    });
}

function RawCardioTable({
  rows,
  title,
  description,
  tableLabel,
}: {
  rows: CardioRow[];
  title: string;
  description: string;
  tableLabel: string;
}) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant="secondary">{rows.length} sessions</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <div className="overflow-x-auto rounded-md border border-border/50">
            <table aria-label={tableLabel} className="w-full min-w-[1100px] text-sm">
              <thead className="bg-muted/40 text-left">
                <tr className="border-b border-border/50">
                  {CARDIO_SESSION_COLUMNS.map((column) => (
                    <th key={column.key} className="px-3 py-2 font-medium text-foreground">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id ?? `${row.session_date}-${row.protocol}`}
                    className="border-b border-border/40"
                  >
                    {CARDIO_SESSION_COLUMNS.map((column) => (
                      <td
                        key={`${row.id ?? row.session_date}-${column.key}`}
                        className="align-top px-3 py-2 text-muted-foreground"
                      >
                        {formatCellValue(row[column.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No matching cardio sessions in the exported data.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function CardioAnalyticsTab({ data }: { data: DashboardData }) {
  const cardioSessions = getRawCardioSessions(data);
  const z2Rows = cardioSessions.filter((row) => row.protocol === 'Z2');
  const vo2Rows = cardioSessions.filter((row) => String(row.protocol || '').startsWith('VO2'));

  return (
    <div className="flex flex-col gap-6 py-4">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-xl">Cardio Analytics</CardTitle>
          <CardDescription>
            Raw `cardio_sessions` rows grouped by protocol. Each row is one stored cardio session.
          </CardDescription>
        </CardHeader>
      </Card>

      <RawCardioTable
        rows={z2Rows}
        title="Z2 Sessions"
        description="Raw rows from cardio_sessions where protocol = Z2."
        tableLabel="Z2 raw cardio session data"
      />

      <RawCardioTable
        rows={vo2Rows}
        title="VO2 Max Sessions"
        description="Raw rows from cardio_sessions where protocol starts with VO2."
        tableLabel="VO2 max raw cardio session data"
      />
    </div>
  );
}
