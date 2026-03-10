// @vitest-environment node

import { execFile } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTempRepo, projectRoot, setServerEnv, type TempRepo } from '../helpers/tempRepo';

const execFileAsync = promisify(execFile);

describe('gym531 cli', () => {
  let repo: TempRepo;
  let restoreEnv: () => void;
  let plannedDate: string;

  beforeAll(() => {
    repo = createTempRepo();
    restoreEnv = setServerEnv(repo);

    const db = new DatabaseSync(resolveTrackedDb(repo));
    const row = db
      .prepare('SELECT session_date FROM v_planned_barbell_sets ORDER BY session_date ASC LIMIT 1')
      .get() as { session_date: string };
    db.close();
    plannedDate = row.session_date;
  });

  afterAll(() => {
    restoreEnv();
    repo.cleanup();
  });

  it('prints the training prescription for a planned day', async () => {
    const scriptPath = `${projectRoot}/server/dist/server/src/cli/gym531.js`;
    const { stderr, stdout } = await execFileAsync(
      'node',
      ['--no-warnings', scriptPath, 'today', '--date', plannedDate],
      {
        env: process.env as Record<string, string>,
      },
    );
    expect(stderr).toBe('');
    expect(stdout).toContain('Main (');
    expect(stdout).toContain('Supplemental (');
  });

  it('logs a session and persists set logs', async () => {
    const scriptPath = `${projectRoot}/server/dist/server/src/cli/gym531.js`;
    const { stderr } = await execFileAsync(
      'node',
      [
        '--no-warnings',
        scriptPath,
        'log',
        '--date',
        plannedDate,
        '--main-reps',
        '5,5,5',
        '--supp-completed',
      ],
      {
        env: process.env as Record<string, string>,
      },
    );

    expect(stderr).toBe('');

    const db = new DatabaseSync(repo.liveDbPath);
    const row = db
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM barbell_set_logs bsl
          JOIN barbell_sessions bs ON bs.id = bsl.session_id
          WHERE bs.session_date = ?
        `,
      )
      .get(plannedDate) as { count: number };
    db.close();

    expect(row.count).toBeGreaterThanOrEqual(3);
  });
});

function resolveTrackedDb(repo: TempRepo) {
  return `${repo.repoRoot}/training_dashboard.db`;
}
