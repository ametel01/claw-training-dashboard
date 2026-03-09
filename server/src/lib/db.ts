import { DatabaseSync } from 'node:sqlite'
import { dbPath } from './paths'

export type SqlPrimitive = string | number | bigint | null | Uint8Array

export function openDatabase(): DatabaseSync {
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA foreign_keys = ON')
  return db
}

export function allRows<T>(db: DatabaseSync, sql: string, ...params: SqlPrimitive[]): T[] {
  return db.prepare(sql).all(...params) as T[]
}

export function getRow<T>(db: DatabaseSync, sql: string, ...params: SqlPrimitive[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined
}

export function runStatement(db: DatabaseSync, sql: string, ...params: SqlPrimitive[]) {
  return db.prepare(sql).run(...params)
}

export function transact<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    try {
      db.exec('ROLLBACK')
    } catch {}
    throw error
  }
}
