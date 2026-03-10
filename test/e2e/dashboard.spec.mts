import { expect, test } from '@playwright/test';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDir, '..', '..');

type TempRepo = {
  dbStateRoot: string;
  repoRoot: string;
};

let repo: TempRepo;
let server: ChildProcessWithoutNullStreams;
let baseUrl: string;

test.beforeAll(async () => {
  repo = createTempRepo();
  const port = await getAvailablePort();
  baseUrl = `http://127.0.0.1:${port}`;

  server = spawn('node', [`${projectRoot}/server/dist/server/src/index.js`], {
    env: {
      ...process.env,
      CLAW_DB_PATH: resolve(repo.dbStateRoot, 'training_dashboard.db'),
      CLAW_DB_STATE_ROOT: repo.dbStateRoot,
      CLAW_REPO_ROOT: repo.repoRoot,
      NODE_NO_WARNINGS: '1',
      PORT: String(port),
    },
    stdio: 'pipe',
  });

  await waitForHttp(`${baseUrl}/data.json`);
});

test.afterAll(() => {
  server.kill('SIGTERM');
  rmSync(repo.repoRoot, { recursive: true, force: true });
});

test('loads the dashboard and supports tab navigation and refresh', async ({ page }) => {
  await page.goto(baseUrl);

  await expect(page.getByRole('heading', { name: 'CLAW' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();

  await page.getByRole('button', { name: /Refresh from DB/i }).click();
  await expect(page.getByRole('button', { name: /Updated ✓/i })).toBeVisible();

  await page.getByRole('tab', { name: 'Strength' }).click();
  await expect(page.getByRole('heading', { name: 'Cycle', exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Logs & History' }).click();
  await expect(page.getByText(/No audit entries yet|training/i)).toBeVisible();
});

function createTempRepo(): TempRepo {
  const repoRoot = mkdtempSync(resolve(tmpdir(), 'claw-training-dashboard-e2e-'));
  const dbStateRoot = resolve(repoRoot, '.state');

  mkdirSync(resolve(repoRoot, 'dashboard'), { recursive: true });
  mkdirSync(resolve(repoRoot, 'expenses'), { recursive: true });
  mkdirSync(dbStateRoot, { recursive: true });

  copyFileSync(resolve(projectRoot, 'training_dashboard.db'), resolve(repoRoot, 'training_dashboard.db'));
  copyFileSync(
    resolve(projectRoot, 'training_dashboard.db'),
    resolve(dbStateRoot, 'training_dashboard.db'),
  );
  cpSync(resolve(projectRoot, 'dist'), resolve(repoRoot, 'dist'), { recursive: true });
  cpSync(resolve(projectRoot, 'server', 'dist'), resolve(repoRoot, 'server', 'dist'), {
    recursive: true,
  });
  cpSync(resolve(projectRoot, 'expenses'), resolve(repoRoot, 'expenses'), { recursive: true });
  return { dbStateRoot, repoRoot };
}

async function getAvailablePort(): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    const socket = createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address();
      if (!address || typeof address === 'string') {
        reject(new Error('could not allocate port'));
        return;
      }

      socket.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolvePort(address.port);
      });
    });
  });
}

async function waitForHttp(url: string, timeoutMs = 15_000) {
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
