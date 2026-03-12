import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { CardioRow, DashboardData } from '@/types/dashboard';

const CARDIO_SESSION_COLUMNS: Array<{
  key: keyof CardioRow;
  label: string;
}> = [
  { key: 'session_date', label: 'Session Date' },
  { key: 'protocol', label: 'Protocol' },
  { key: 'duration_min', label: 'Duration (min)' },
  { key: 'avg_hr', label: 'Avg HR' },
  { key: 'max_hr', label: 'Max HR' },
  { key: 'avg_speed_kmh', label: 'Avg Speed (km/h)' },
  { key: 'z2_cap_respected', label: 'Z2 Cap Respected' },
  { key: 'notes', label: 'Notes' },
];

function getColumns(hideProtocolColumn: boolean) {
  if (!hideProtocolColumn) return CARDIO_SESSION_COLUMNS;
  return CARDIO_SESSION_COLUMNS.filter((column) => column.key !== 'protocol');
}

function formatCellValue(value: CardioRow[keyof CardioRow]) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function formatNotesValue(notes: CardioRow['notes']) {
  const value = String(notes || '').toLowerCase();
  if (value.includes('tcx') || value.includes('garmin') || value.includes('imported')) {
    return 'from TCX';
  }
  return 'from dashboard';
}

function formatColumnValue(row: CardioRow, key: keyof CardioRow) {
  if (key === 'notes') return formatNotesValue(row.notes);
  return formatCellValue(row[key]);
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
  hideProtocolColumn,
}: {
  rows: CardioRow[];
  title: string;
  description: string;
  tableLabel: string;
  hideProtocolColumn?: boolean;
}) {
  const columns = getColumns(hideProtocolColumn ?? false);

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
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 md:hidden">
              {rows.map((row) => (
                <Card
                  key={row.id ?? `${row.session_date}-${row.protocol}`}
                  className="border-border/50 bg-muted/15 shadow-none"
                >
                  <CardHeader className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <CardTitle className="text-base">{row.session_date}</CardTitle>
                        <CardDescription>
                          {hideProtocolColumn ? 'Z2 session' : formatCellValue(row.protocol)}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">{formatCellValue(row.duration_min)} min</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="grid gap-3">
                      {columns.map((column, index) => (
                        <div
                          key={`${row.id ?? row.session_date}-${column.key}`}
                          className="grid gap-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {column.label}
                            </span>
                            <span className="max-w-[58%] break-words text-right text-sm text-foreground">
                              {formatColumnValue(row, column.key)}
                            </span>
                          </div>
                          {index < columns.length - 1 ? (
                            <Separator className="bg-border/50" />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-md border border-border/50 md:block">
              <table aria-label={tableLabel} className="w-auto table-auto text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr className="border-b border-border/50">
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        className="whitespace-nowrap px-3 py-2 font-medium text-foreground"
                      >
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
                      {columns.map((column) => (
                        <td
                          key={`${row.id ?? row.session_date}-${column.key}`}
                          className="align-top whitespace-nowrap px-3 py-2 text-muted-foreground"
                        >
                          {formatColumnValue(row, column.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
        hideProtocolColumn
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
