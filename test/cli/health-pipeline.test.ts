// @vitest-environment node

import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createMinimalAppleHealthExport,
  createTempRepo,
  projectRoot,
  type TempRepo,
} from '../helpers/tempRepo';

const execFileAsync = promisify(execFile);

describe('health-pipeline cli', () => {
  let repo: TempRepo;

  beforeAll(() => {
    repo = createTempRepo();
    mkdirSync(resolve(repo.repoRoot, 'imports', 'raw', 'apple', 'latest'), { recursive: true });
    writeFileSync(
      resolve(repo.repoRoot, 'imports', 'raw', 'apple', 'latest', 'export.xml'),
      createMinimalAppleHealthExport(),
      'utf8',
    );
    writeFileSync(
      resolve(repo.repoRoot, 'health-config.json'),
      JSON.stringify({
        timezone: 'Asia/Manila',
        sex: 'male',
        hr_max_default: 190,
        hr_rest_fallback: 55,
      }),
      'utf8',
    );
  });

  afterAll(() => {
    repo.cleanup();
  });

  it('produces normalized outputs from a minimal apple export', async () => {
    const scriptPath = resolve(
      projectRoot,
      'server',
      'dist',
      'server',
      'src',
      'cli',
      'health-pipeline.js',
    );
    const { stderr, stdout } = await execFileAsync(
      'node',
      [
        '--no-warnings',
        scriptPath,
        '--user-id',
        'test-user',
        '--input-root',
        resolve(repo.repoRoot, 'imports', 'raw'),
        '--output-root',
        resolve(repo.repoRoot, 'imports'),
        '--config',
        resolve(repo.repoRoot, 'health-config.json'),
      ],
      {
        env: process.env as Record<string, string>,
      },
    );
    expect(stdout.trim()).toBe('ok');
    expect(stderr).toBe('');
    expect(readFileSync(resolve(repo.repoRoot, 'imports', 'normalized', 'workouts.ndjson'), 'utf8'))
      .toContain('apple_watch_workout');
    const logRoot = resolve(repo.repoRoot, 'imports', 'logs');
    const ingestionLog = readdirSync(logRoot).find((file) => /^ingestion-\d{4}-\d{2}-\d{2}\.md$/.test(file));
    expect(ingestionLog).toBeDefined();
    expect(readFileSync(resolve(logRoot, ingestionLog!), 'utf8')).toContain('# Ingestion');
  });
});
