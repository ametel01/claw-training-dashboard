import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

export const projectRoot = resolve(currentDir, '..', '..');

export interface TempRepo {
  cleanup: () => void;
  dbStateRoot: string;
  liveDbPath: string;
  repoRoot: string;
}

interface CreateTempRepoOptions {
  copyBuildOutput?: boolean;
  stubBuiltScripts?: boolean;
}

const STUB_DASHBOARD_DATA = JSON.stringify({
  generatedAt: '2026-03-10T00:00:00.000Z',
  weekHeader: null,
  dailyTiles: [],
  weekProgress: [],
  totals: {},
  details: {},
  cycleControl: {},
  est1RM: [],
  currentCyclePlan: [],
  cardioAnalytics: {
    total_z2: 0,
    z2_in_cap: 0,
    z2_compliance_pct: 0,
    z2_points: [],
    z2_scatter_points: [],
    z2_efficiency_points: [],
    z2_decoupling_points: [],
    vo2_points: [],
  },
  auditLog: [],
  aerobicTests: [],
});

export function createTempRepo(options: CreateTempRepoOptions = {}): TempRepo {
  const repoRoot = mkdtempSync(resolve(tmpdir(), 'claw-training-dashboard-'));
  const dbStateRoot = resolve(repoRoot, '.state');
  const liveDbPath = resolve(dbStateRoot, 'training_dashboard.db');

  mkdirSync(resolve(repoRoot, 'dashboard'), { recursive: true });
  mkdirSync(resolve(repoRoot, 'expenses'), { recursive: true });
  mkdirSync(resolve(repoRoot, 'dist'), { recursive: true });
  mkdirSync(dbStateRoot, { recursive: true });

  copyFileSync(
    resolve(projectRoot, 'training_dashboard.db'),
    resolve(repoRoot, 'training_dashboard.db'),
  );
  copyFileSync(resolve(projectRoot, 'training_dashboard.db'), liveDbPath);

  if (options.copyBuildOutput) {
    cpSync(resolve(projectRoot, 'dist'), resolve(repoRoot, 'dist'), { recursive: true });
    cpSync(resolve(projectRoot, 'server', 'dist'), resolve(repoRoot, 'server', 'dist'), {
      recursive: true,
    });
  } else {
    writeFileSync(
      resolve(repoRoot, 'dist', 'index.html'),
      '<!doctype html><html><body><div id="root"></div></body></html>',
      'utf8',
    );
  }

  if (options.stubBuiltScripts) {
    writeStubBuiltScripts(repoRoot);
  }

  return {
    cleanup: () => rmSync(repoRoot, { recursive: true, force: true }),
    dbStateRoot,
    liveDbPath,
    repoRoot,
  };
}

export function setServerEnv(repo: TempRepo, extra: Record<string, string> = {}) {
  const snapshot = {
    CLAW_DISABLE_AUTOSTART: process.env.CLAW_DISABLE_AUTOSTART,
    CLAW_DB_PATH: process.env.CLAW_DB_PATH,
    CLAW_DB_STATE_ROOT: process.env.CLAW_DB_STATE_ROOT,
    CLAW_REPO_ROOT: process.env.CLAW_REPO_ROOT,
    NODE_NO_WARNINGS: process.env.NODE_NO_WARNINGS,
    PORT: process.env.PORT,
  };

  process.env.CLAW_DISABLE_AUTOSTART = '1';
  process.env.CLAW_DB_PATH = repo.liveDbPath;
  process.env.CLAW_DB_STATE_ROOT = repo.dbStateRoot;
  process.env.CLAW_REPO_ROOT = repo.repoRoot;
  process.env.NODE_NO_WARNINGS = '1';
  process.env.PORT = '0';

  for (const [key, value] of Object.entries(extra)) {
    process.env[key] = value;
  }

  return () => {
    restoreEnvValue('CLAW_DISABLE_AUTOSTART', snapshot.CLAW_DISABLE_AUTOSTART);
    restoreEnvValue('CLAW_DB_PATH', snapshot.CLAW_DB_PATH);
    restoreEnvValue('CLAW_DB_STATE_ROOT', snapshot.CLAW_DB_STATE_ROOT);
    restoreEnvValue('CLAW_REPO_ROOT', snapshot.CLAW_REPO_ROOT);
    restoreEnvValue('NODE_NO_WARNINGS', snapshot.NODE_NO_WARNINGS);
    restoreEnvValue('PORT', snapshot.PORT);

    for (const key of Object.keys(extra)) {
      if (!(key in snapshot)) {
        delete process.env[key];
      }
    }
  };
}

export async function getAvailablePort(): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('could not allocate port'));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolvePort(port);
      });
    });
  });
}

export async function waitForHttp(url: string, timeoutMs = 15_000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function writeStubBuiltScripts(repoRoot: string) {
  const exportScriptPath = resolve(repoRoot, 'server', 'dist', 'dashboard', 'src', 'export-data.js');
  const healthScriptPath = resolve(
    repoRoot,
    'server',
    'dist',
    'server',
    'src',
    'cli',
    'health-pipeline.js',
  );

  mkdirSync(dirname(exportScriptPath), { recursive: true });
  mkdirSync(dirname(healthScriptPath), { recursive: true });

  writeFileSync(
    exportScriptPath,
    [
      "import { mkdirSync, writeFileSync } from 'node:fs';",
      "import { resolve } from 'node:path';",
      "const repoRoot = resolve(process.env.CLAW_REPO_ROOT ?? process.cwd());",
      "mkdirSync(resolve(repoRoot, 'dashboard'), { recursive: true });",
      `writeFileSync(resolve(repoRoot, 'dashboard', 'data.json'), ${JSON.stringify(STUB_DASHBOARD_DATA)}, 'utf8');`,
      "console.log('exported');",
    ].join('\n'),
    'utf8',
  );

  writeFileSync(
    healthScriptPath,
    [
      "import { mkdirSync, writeFileSync } from 'node:fs';",
      "import { resolve } from 'node:path';",
      "const repoRoot = resolve(process.env.CLAW_REPO_ROOT ?? process.cwd());",
      "const outputRoot = resolve(repoRoot, process.env.HEALTH_PIPELINE_OUTPUT_ROOT ?? 'imports');",
      "const files = [",
      "  'normalized/workouts.ndjson',",
      "  'normalized/hr_samples.ndjson',",
      "  'normalized/daily_recovery.ndjson',",
      "  'normalized/sleep_sessions.ndjson',",
      "  'normalized/daily_activity.ndjson',",
      "  'normalized/workout_metrics.ndjson',",
      "  'sql/upserts.sql',",
      "  'logs/ingestion-2026-03-10.md',",
      "];",
      'for (const relativePath of files) {',
      "  const fullPath = resolve(outputRoot, relativePath);",
      "  mkdirSync(resolve(fullPath, '..'), { recursive: true });",
      "  writeFileSync(fullPath, 'ok\\n', 'utf8');",
      '}',
      "console.log('health-ok');",
    ].join('\n'),
    'utf8',
  );
}

function restoreEnvValue(key: string, value: string | undefined) {
  if (value == null) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

export function createMinimalAppleHealthExport(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<HealthData>
  <Record type="HKQuantityTypeIdentifierStepCount" startDate="2026-03-01 06:00:00 +0000" value="1234" />
  <Record type="HKQuantityTypeIdentifierRestingHeartRate" startDate="2026-03-01 06:00:00 +0000" value="58" />
  <Workout workoutActivityType="HKWorkoutActivityTypeRunning" startDate="2026-03-01 07:00:00 +0000" endDate="2026-03-01 07:30:00 +0000" totalDistance="5000" totalEnergyBurned="400" />
</HealthData>`;
}

export function hasBuiltServerDist(): boolean {
  return existsSync(resolve(projectRoot, 'server', 'dist', 'server', 'src', 'index.js'));
}
