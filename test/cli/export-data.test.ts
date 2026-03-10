// @vitest-environment node

import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTempRepo, projectRoot, setServerEnv, type TempRepo } from '../helpers/tempRepo';

const execFileAsync = promisify(execFile);

describe('export-data cli', () => {
  let repo: TempRepo;
  let restoreEnv: () => void;

  beforeAll(() => {
    repo = createTempRepo();
    restoreEnv = setServerEnv(repo);
  });

  afterAll(() => {
    restoreEnv();
    repo.cleanup();
  });

  it('writes dashboard/data.json from the tracked database', async () => {
    const scriptPath = resolve(projectRoot, 'server', 'dist', 'dashboard', 'src', 'export-data.js');
    const { stderr } = await execFileAsync('node', ['--no-warnings', scriptPath], {
      env: process.env as Record<string, string>,
    });

    expect(stderr).toBe('');

    const outPath = resolve(repo.repoRoot, 'dashboard', 'data.json');
    expect(existsSync(outPath)).toBe(true);

    const payload = JSON.parse(readFileSync(outPath, 'utf8')) as { dailyTiles: unknown[]; generatedAt: string };
    expect(payload.generatedAt).toMatch(/T/);
    expect(Array.isArray(payload.dailyTiles)).toBe(true);
  });
});
