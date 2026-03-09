import { useState } from 'react';

export function useDetailDialogState() {
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  function openForDate(date: string) {
    setDetailDate(date);
    setDetailOpen(true);
  }

  function closeDetail() {
    setDetailOpen(false);
  }

  return {
    closeDetail,
    detailDate,
    detailOpen,
    openForDate,
  };
}
