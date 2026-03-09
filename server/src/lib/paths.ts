import { resolve } from 'node:path'

export const repoRoot = resolve(process.env.CLAW_REPO_ROOT ?? process.cwd())
export const dbPath = resolve(repoRoot, 'training_dashboard.db')
export const distRoot = resolve(repoRoot, 'dist')
export const dashboardRoot = resolve(repoRoot, 'dashboard')
export const dashboardDataPath = resolve(dashboardRoot, 'data.json')
export const serverDistRoot = resolve(repoRoot, 'server', 'dist')
