// @vitest-environment node

import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTempRepo, setServerEnv, type TempRepo } from '../helpers/tempRepo';

describe('server api', () => {
  let app: Parameters<typeof request>[0];
  let repo: TempRepo;
  let restoreEnv: () => void;

  beforeAll(async () => {
    repo = createTempRepo({ stubBuiltScripts: true });
    restoreEnv = setServerEnv(repo);
    vi.resetModules();

    const mod = await import('../../server/src/index');
    app = mod.app;
  });

  afterAll(() => {
    restoreEnv();
    repo.cleanup();
  });

  it('refreshes dashboard data and health artifacts', async () => {
    const response = await request(app).post('/api/refresh?includeHealth=1').expect(200);

    expect(response.body).toEqual({
      ok: true,
      healthPipeline: 'health-ok',
    });
    expect(existsSync(resolve(repo.repoRoot, 'dashboard', 'data.json'))).toBe(true);
    expect(existsSync(resolve(repo.repoRoot, 'imports', 'normalized', 'workouts.ndjson'))).toBe(
      true,
    );
  });

  it('generates data.json on demand when missing', async () => {
    rmSync(resolve(repo.repoRoot, 'dashboard', 'data.json'), { force: true });

    const response = await request(app).get('/data.json').expect(200);

    expect(response.body.generatedAt).toBe('2026-03-10T00:00:00.000Z');
  });

  it('sets the recovery status for a date', async () => {
    await request(app)
      .post('/api/set-status')
      .query({ date: '2030-01-01', status: 'yellow' })
      .expect(200);

    const db = openDb(repo.liveDbPath);
    const row = db
      .prepare('SELECT pain_level FROM recovery_status WHERE session_date = ?')
      .get('2030-01-01') as { pain_level: string } | undefined;
    db.close();

    expect(row?.pain_level).toBe('yellow');
  });

  it('updates a training max', async () => {
    const response = await request(app)
      .post('/api/tm/update')
      .send({ lift: 'Bench', mode: 'delta', value: 2.5, effectiveDate: '2030-01-02' })
      .expect(200);

    expect(response.body.tmKg).toBeGreaterThan(0);

    const db = openDb(repo.liveDbPath);
    const row = db
      .prepare(
        `
          SELECT tm.tm_kg
          FROM training_max_history tm
          JOIN lifts l ON l.id = tm.lift_id
          WHERE l.name = ? AND tm.effective_date = ?
        `,
      )
      .get('Bench', '2030-01-02') as { tm_kg: number } | undefined;
    db.close();

    expect(row?.tm_kg).toBe(response.body.tmKg);
  });

  it('starts a new cycle', async () => {
    await request(app)
      .post('/api/cycle/start')
      .send({ startDate: '2030-02-03', blockType: 'Leader' })
      .expect(200);

    const db = openDb(repo.liveDbPath);
    const row = db
      .prepare('SELECT block_type FROM program_blocks WHERE start_date = ?')
      .get('2030-02-03') as { block_type: string } | undefined;
    db.close();

    expect(row?.block_type).toBe('Leader');
  });

  it('applies a deload block', async () => {
    await request(app)
      .post('/api/cycle/deload')
      .send({ deloadCode: 'WEEK7_LIGHT', startDate: '2030-02-10', durationDays: 4 })
      .expect(200);

    const db = openDb(repo.liveDbPath);
    const row = db
      .prepare('SELECT deload_code, end_date FROM deload_blocks WHERE start_date = ?')
      .get('2030-02-10') as { deload_code: string; end_date: string } | undefined;
    db.close();

    expect(row).toEqual({ deload_code: 'WEEK7_LIGHT', end_date: '2030-02-13' });
  });

  it('logs aerobic tests and computes decoupling', async () => {
    const response = await request(app)
      .post('/api/log-aerobic-test')
      .send({
        testType: 'ZONE2_SESSION',
        date: '2030-03-01',
        hrFirstHalf: 120,
        hrSecondHalf: 126,
      })
      .expect(200);

    expect(response.body.decouplingPercent).toBe(5);

    const db = openDb(repo.liveDbPath);
    const row = db
      .prepare('SELECT decoupling_percent FROM aerobic_tests WHERE date = ?')
      .get('2030-03-01') as { decoupling_percent: number } | undefined;
    db.close();

    expect(row?.decoupling_percent).toBe(5);
  });

  it('logs planned main work into barbell set logs', async () => {
    await request(app)
      .post('/api/log-action')
      .send({
        action: 'main_done',
        date: '2030-03-02',
        plannedBarbellRows: [
          {
            category: 'main',
            lift: 'Bench',
            set_no: 1,
            prescribed_pct: 0.65,
            prescribed_reps: 5,
            planned_weight_kg: 60,
          },
          {
            category: 'main',
            lift: 'Bench',
            set_no: 2,
            prescribed_pct: 0.75,
            prescribed_reps: 5,
            planned_weight_kg: 70,
          },
          {
            category: 'main',
            lift: 'Bench',
            set_no: 3,
            prescribed_pct: 0.85,
            prescribed_reps: 5,
            planned_weight_kg: 80,
          },
        ],
      })
      .expect(200);

    const db = openDb(repo.liveDbPath);
    const row = db
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM barbell_set_logs bsl
          JOIN barbell_sessions bs ON bs.id = bsl.session_id
          WHERE bs.session_date = ? AND bsl.category = 'main'
        `,
      )
      .get('2030-03-02') as { count: number };
    db.close();

    expect(row.count).toBe(3);
  });

  it('logs cardio actions', async () => {
    await request(app)
      .post('/api/log-action')
      .send({
        action: 'cardio_done',
        date: '2030-03-03',
        plannedCardio: {
          session_type: 'Z2_VO2_4x4',
          duration_min: 32,
          speed_high_kmh: 11.2,
          vo2_work_min: 4,
          vo2_easy_min: 3,
        },
        avgHr: 164,
        speedKmh: 11.4,
      })
      .expect(200);

    const db = openDb(repo.liveDbPath);
    const row = db
      .prepare('SELECT protocol, avg_hr FROM cardio_sessions WHERE session_date = ?')
      .get('2030-03-03') as { protocol: string; avg_hr: number } | undefined;
    db.close();

    expect(row).toEqual({ protocol: 'VO2_4x4', avg_hr: 164 });
  });

  it('accepts supported health uploads', async () => {
    const response = await request(app)
      .post('/api/upload-health')
      .field('kind', 'apple')
      .attach('file', Buffer.from('<HealthData />'), 'export.xml')
      .expect(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.path).toContain('imports/raw/apple/latest/export.xml');
    expect(
      existsSync(resolve(repo.repoRoot, 'imports', 'raw', 'apple', 'latest', 'export.xml')),
    ).toBe(true);
  });

  it('returns validation errors for unsupported statuses', async () => {
    const response = await request(app)
      .post('/api/set-status')
      .query({ date: '2030-01-01', status: 'purple' })
      .expect(400);

    expect(response.body.error).toBe('date and valid status required');
  });
});

function openDb(dbPath: string) {
  return new DatabaseSync(dbPath);
}
