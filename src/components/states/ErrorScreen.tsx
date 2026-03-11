interface ErrorScreenProps {
  error: string;
}

export function ErrorScreen({ error }: ErrorScreenProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm text-destructive">{error}</p>
      <p className="text-xs text-muted-foreground">
        Make sure the backend is running and `/data.json` is reachable. `bun run dev` now starts
        both the Vite client and the local server.
      </p>
    </div>
  );
}
