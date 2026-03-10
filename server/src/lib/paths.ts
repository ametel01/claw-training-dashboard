import { homedir } from 'node:os'
import { resolve } from 'node:path'

export const repoRoot = resolve(process.env.CLAW_REPO_ROOT ?? process.cwd())

// Keep the live DB outside the git repo so pulls/resets cannot clobber workout data.
export const trackedDbPath = resolve(repoRoot, 'training_dashboard.db')
export const dbStateRoot = resolve(process.env.CLAW_DB_STATE_ROOT ?? resolve(homedir(), '.openclaw', 'state', 'claw-training-dashboard'))
export const dbPath = resolve(process.env.CLAW_DB_PATH ?? resolve(dbStateRoot, 'training_dashboard.db'))

export const distRoot = resolve(repoRoot, 'dist')
export const dashboardRoot = resolve(repoRoot, 'dashboard')
export const dashboardDataPath = resolve(dashboardRoot, 'data.json')
export const serverDistRoot = resolve(repoRoot, 'server', 'dist')
