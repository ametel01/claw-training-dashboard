export const getById = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T | null

export const getValue = (id: string): string => getById<HTMLInputElement>(id)?.value ?? ''

export const isChecked = (id: string): boolean => Boolean(getById<HTMLInputElement>(id)?.checked)

export const closestFromEvent = <T extends HTMLElement = HTMLElement>(
  event: Event,
  selector: string
) => (event.target instanceof Element ? (event.target.closest(selector) as T | null) : null)
