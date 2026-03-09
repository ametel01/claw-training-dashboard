export function scrollToSessionDate(date: string) {
  document
    .querySelector<HTMLElement>(`[data-date="${date}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
