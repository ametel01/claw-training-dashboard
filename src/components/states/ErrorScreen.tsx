interface ErrorScreenProps {
  error: string;
}

export function ErrorScreen({ error }: ErrorScreenProps) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <p className="text-sm text-destructive">{error}</p>
      <p className="text-xs text-muted-foreground">
        Make sure the Flask server is running and `data.json` exists.
      </p>
    </div>
  );
}
