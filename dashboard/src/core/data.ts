import type { AnyRecord } from './types'

export async function loadData(): Promise<AnyRecord> {
  const response = await fetch('./data.json', { cache: 'no-store' })
  if (!response.ok) throw new Error('Could not load data.json')
  return response.json()
}
