#!/usr/bin/env node
import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// server/src/lib/db.ts
import { DatabaseSync } from "node:sqlite";

// server/src/lib/paths.ts
import { resolve } from "node:path";
var repoRoot = resolve(process.env.CLAW_REPO_ROOT ?? process.cwd());
var dbPath = resolve(repoRoot, "training_dashboard.db");
var distRoot = resolve(repoRoot, "dist");
var dashboardRoot = resolve(repoRoot, "dashboard");
var dashboardDataPath = resolve(dashboardRoot, "data.json");
var serverDistRoot = resolve(repoRoot, "server", "dist");

// server/src/lib/db.ts
function openDatabase() {
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}
function allRows(db, sql, ...params) {
  return db.prepare(sql).all(...params);
}
function getRow(db, sql, ...params) {
  return db.prepare(sql).get(...params);
}
function runStatement(db, sql, ...params) {
  return db.prepare(sql).run(...params);
}
function transact(db, fn) {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {}
    throw error;
  }
}

// server/src/lib/time.ts
function todayIsoLocal() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

// server/src/cli/gym531.ts
var MAIN_PCTS = {
  1: [0.65, 0.75, 0.85],
  2: [0.7, 0.8, 0.9],
  3: [0.75, 0.85, 0.95]
};
var RINGS_TEMPLATES = {
  A: [
    "RTO Support Hold — 5×20–30s (rest 60–90s)",
    "Ring Rows (feet up) — 5×4–6 @31X1 (rest 120s)",
    "Ring Face Pulls — 4×6–8 @3011 (rest 90s)",
    "Ring Plank — 3×30–45s (rest 60s)"
  ],
  B: [
    "RTO Support Shrugs — 4×6–8 @3111 (rest 90s)",
    "Ring Push-Ups (RTO) — 5×4–6 @31X1 (rest 120s)",
    "Assisted Ring Dips — 5×3–5 @40X1 (rest 150s)",
    "Hollow Hold — 3×25–40s (rest 60s)"
  ],
  C: [
    "Feet-Assisted Pull-Ups — 5×3–5 @31X1 (rest 150s)",
    "High Ring Rows — 4×4–6 @31X1 (rest 120s)",
    "False Grip Hold (feet) — 4×20–30s (rest 60s)",
    "Ring Body Saw — 3×8–12 slow (rest 60s)"
  ],
  D: [
    "Single-Ring Support — 4×15–25s/side (rest 60s)",
    "Archer Ring Rows — 5×3–4/side @31X1 (rest 120s)",
    "Dip Iso (bottom) — 4×10–20s (rest 90s)",
    "Knee→Pike Tucks — 3×6–10 (rest 60s)"
  ]
};
function parseFlags(argv) {
  const flags = {};
  for (let index = 0;index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--"))
      continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    index += 1;
  }
  return flags;
}
function requireString(flags, key) {
  const value = flags[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`--${key} is required`);
  }
  return value.trim();
}
function optionalString(flags, key) {
  const value = flags[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function optionalNumber(flags, key) {
  const value = flags[key];
  if (typeof value !== "string" || !value.trim())
    return;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`--${key} must be numeric`);
  }
  return numeric;
}
function hasFlag(flags, key) {
  return flags[key] === true;
}
function parseDate(value) {
  if (!value)
    return todayIsoLocal();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("date must be YYYY-MM-DD");
  }
  return value;
}
function roundToInc(value, increment) {
  return Math.round(value / increment) * increment;
}
function isoDateToUtc(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}
function weekdayName(iso) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC"
  }).format(new Date(`${iso}T00:00:00Z`));
}
function ensureRingsSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rings_sessions (
      id INTEGER PRIMARY KEY,
      session_date TEXT NOT NULL,
      slot TEXT NOT NULL DEFAULT 'PM',
      template TEXT NOT NULL CHECK (template IN ('A','B','C','D')),
      completed_as_prescribed INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_date, slot)
    );
    CREATE TABLE IF NOT EXISTS rings_logs (
      id INTEGER PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES rings_sessions(id) ON DELETE CASCADE,
      item_no INTEGER NOT NULL,
      exercise TEXT NOT NULL,
      result_text TEXT,
      completed INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS cardio_progress_tests (
      id INTEGER PRIMARY KEY,
      test_date TEXT NOT NULL,
      duration_min INTEGER NOT NULL,
      speed_kmh REAL NOT NULL,
      incline_pct REAL NOT NULL,
      final_bpm INTEGER NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
function getDb() {
  const db = openDatabase();
  ensureRingsSchema(db);
  return db;
}
function getConfig(db, key, fallback = "") {
  const row = getRow(db, "SELECT value FROM config WHERE key = ?", key);
  return row?.value ?? fallback;
}
function getBlockForDate(db, iso) {
  return getRow(db, `
      SELECT pb.*, t.name AS template_name, t.main_scheme, t.supplemental_scheme
      FROM program_blocks pb
      JOIN templates t ON t.id = pb.template_id
      WHERE date(pb.start_date) <= date(?)
      ORDER BY date(pb.start_date) DESC, pb.block_no DESC, pb.id DESC
      LIMIT 1
    `, iso);
}
function getTrainingDay(db, iso) {
  const day = new Date(`${iso}T00:00:00Z`);
  const weekday = (day.getUTCDay() + 6) % 7 + 1;
  return getRow(db, `
      SELECT td.*, lm.name AS main_lift, ls.name AS supplemental_lift
      FROM training_days td
      JOIN lifts lm ON lm.id = td.main_lift_id
      JOIN lifts ls ON ls.id = td.supplemental_lift_id
      WHERE td.weekday = ?
    `, weekday);
}
function getTm(db, liftId, iso) {
  const row = getRow(db, `
      SELECT tm_kg
      FROM training_max_history
      WHERE lift_id = ? AND date(effective_date) <= date(?)
      ORDER BY date(effective_date) DESC, id DESC
      LIMIT 1
    `, liftId, iso);
  if (!row) {
    throw new Error("No TM found for lift");
  }
  return Number(row.tm_kg);
}
function getWeekInBlock(blockStart, iso) {
  return Math.floor((isoDateToUtc(iso) - isoDateToUtc(blockStart)) / (86400000 * 7)) + 1;
}
function getPrescription(db, iso) {
  const trainingDay = getTrainingDay(db, iso);
  const block = getBlockForDate(db, iso);
  if (!trainingDay || !block)
    return null;
  const weekInBlock = getWeekInBlock(String(block.start_date), iso);
  const weekWave = (weekInBlock - 1) % 3 + 1;
  const percentages = MAIN_PCTS[weekWave];
  const increment = Number(getConfig(db, "rounding_increment_kg", "2.5"));
  const mainTm = getTm(db, Number(trainingDay.main_lift_id), iso);
  const suppTm = getTm(db, Number(trainingDay.supplemental_lift_id), iso);
  const mainSets = percentages.map((pct) => [
    pct,
    5,
    roundToInc(mainTm * pct, increment)
  ]);
  const fslPct = percentages[0];
  const suppSets = block.block_type === "Leader" ? 5 : 5;
  const suppReps = block.block_type === "Leader" ? 10 : 5;
  const suppWeight = roundToInc(suppTm * fslPct, increment);
  return {
    date: iso,
    weekday: weekdayName(iso),
    block_type: String(block.block_type),
    block_no: Number(block.block_no),
    template: String(block.template_name),
    week_in_block: weekInBlock,
    week_wave: weekWave,
    main_lift: String(trainingDay.main_lift),
    main_lift_id: Number(trainingDay.main_lift_id),
    supp_lift: String(trainingDay.supplemental_lift),
    supp_lift_id: Number(trainingDay.supplemental_lift_id),
    main_sets: mainSets,
    supp_sets: suppSets,
    supp_reps: suppReps,
    supp_weight: suppWeight,
    fsl_pct: fslPct
  };
}
function parseSetTriplets(value) {
  if (!value)
    return [];
  return value.split(",").map((part) => part.trim()).filter(Boolean).map((part) => {
    const match = part.toLowerCase().match(/^(\d+(?:\.\d+)?)x(\d+)$/);
    if (!match)
      throw new Error(`invalid set format: ${part}`);
    return [Number(match[1]), Number(match[2])];
  });
}
function parseRepList(value) {
  if (!value)
    return [];
  return value.split(",").map((part) => part.trim()).filter(Boolean).map((part) => Number(part));
}
function ensureSession(db, iso, notes, bodyweight, readiness) {
  const trainingDay = getTrainingDay(db, iso);
  const block = getBlockForDate(db, iso);
  if (!trainingDay || !block) {
    throw new Error("Date is not configured as a training day");
  }
  const weekInBlock = getWeekInBlock(String(block.start_date), iso);
  runStatement(db, `
      INSERT INTO barbell_sessions(session_date, weekday, block_id, week_in_block, day_id, bodyweight_kg, readiness, notes)
      VALUES(?, ((CAST(strftime('%w', ?) AS INTEGER) + 6) % 7) + 1, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_date) DO UPDATE SET
        bodyweight_kg = excluded.bodyweight_kg,
        readiness = excluded.readiness,
        notes = COALESCE(excluded.notes, barbell_sessions.notes)
    `, iso, iso, Number(block.id), weekInBlock, Number(trainingDay.id), bodyweight ?? null, readiness ?? null, notes ?? null);
  const row = getRow(db, "SELECT id FROM barbell_sessions WHERE session_date = ?", iso);
  if (!row)
    throw new Error("Could not find created session");
  return row.id;
}
function nextRingsTemplate(db) {
  const row = getRow(db, "SELECT template FROM rings_sessions ORDER BY date(session_date) DESC, id DESC LIMIT 1");
  if (!row)
    return "A";
  const order = ["A", "B", "C", "D"];
  const index = Math.max(0, order.indexOf(row.template));
  return order[(index + 1) % order.length];
}
function handleToday(flags) {
  const iso = parseDate(optionalString(flags, "date"));
  const db = getDb();
  const prescription = getPrescription(db, iso);
  if (!prescription) {
    console.log(`${iso} is not a training day in your split.`);
    return;
  }
  console.log(`${prescription.date} (${prescription.weekday})`);
  console.log(`Block: ${prescription.block_type} ${prescription.block_no} | Week in block: ${prescription.week_in_block} (Wave week ${prescription.week_wave})`);
  console.log(`Main (${prescription.main_lift}):`);
  prescription.main_sets.forEach(([pct, reps, weight], index) => {
    console.log(`  Set ${index + 1}: ${Math.round(pct * 100)}% x ${reps} @ ${weight.toFixed(1)} kg`);
  });
  console.log(`Supplemental (${prescription.supp_lift}):`);
  console.log(`  ${prescription.supp_sets} x ${prescription.supp_reps} @ ${prescription.supp_weight.toFixed(1)} kg (${Math.round(prescription.fsl_pct * 100)}% FSL)`);
}
function handleLog(flags) {
  const iso = parseDate(optionalString(flags, "date"));
  const db = getDb();
  const prescription = getPrescription(db, iso);
  if (!prescription)
    throw new Error("Not a configured training day");
  const mainDone = parseSetTriplets(optionalString(flags, "main"));
  const suppDone = parseSetTriplets(optionalString(flags, "supp"));
  const mainRepsOnly = parseRepList(optionalString(flags, "main-reps"));
  if (mainDone.length && mainDone.length !== 3) {
    throw new Error("Main sets require exactly 3 entries, e.g. 72.5x5,82.5x5,92.5x5");
  }
  if (mainRepsOnly.length && mainRepsOnly.length !== 3) {
    throw new Error("--main-reps needs exactly 3 reps, e.g. 5,5,4");
  }
  const effectiveMainReps = mainDone.length ? [] : mainRepsOnly.length ? mainRepsOnly : prescription.main_sets.map((item) => item[1]);
  const sessionId = ensureSession(db, iso, optionalString(flags, "notes"), optionalNumber(flags, "bodyweight"), optionalNumber(flags, "readiness"));
  db.exec("BEGIN");
  try {
    runStatement(db, "DELETE FROM barbell_set_logs WHERE session_id = ? AND category IN ('main','supplemental')", sessionId);
    prescription.main_sets.forEach(([pct, reps, prescribedWeight], index) => {
      const [actualWeight, actualReps] = mainDone.length ? mainDone[index] : [prescribedWeight, effectiveMainReps[index]];
      runStatement(db, `
          INSERT INTO barbell_set_logs(session_id, lift_id, category, set_no, prescribed_pct, prescribed_reps, actual_weight_kg, actual_reps, rpe, note)
          VALUES(?, ?, 'main', ?, ?, ?, ?, ?, ?, NULL)
        `, sessionId, prescription.main_lift_id, index + 1, pct, reps, actualWeight, actualReps, optionalNumber(flags, "rpe") ?? null);
    });
    if (suppDone.length) {
      suppDone.forEach(([actualWeight, actualReps], index) => {
        runStatement(db, `
            INSERT INTO barbell_set_logs(session_id, lift_id, category, set_no, prescribed_pct, prescribed_reps, actual_weight_kg, actual_reps, rpe, note)
            VALUES(?, ?, 'supplemental', ?, ?, ?, ?, ?, NULL, NULL)
          `, sessionId, prescription.supp_lift_id, index + 1, prescription.fsl_pct, prescription.supp_reps, actualWeight, actualReps);
      });
    } else if (hasFlag(flags, "supp-completed")) {
      Array.from({ length: prescription.supp_sets }, (_, index) => index + 1).forEach((setNo) => {
        runStatement(db, `
            INSERT INTO barbell_set_logs(session_id, lift_id, category, set_no, prescribed_pct, prescribed_reps, actual_weight_kg, actual_reps, rpe, note)
            VALUES(?, ?, 'supplemental', ?, ?, ?, ?, ?, NULL, NULL)
          `, sessionId, prescription.supp_lift_id, setNo, prescription.fsl_pct, prescription.supp_reps, prescription.supp_weight, prescription.supp_reps);
      });
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  console.log(`Logged session for ${iso}.`);
}
function handleRingsToday(flags) {
  const iso = parseDate(optionalString(flags, "date"));
  const db = getDb();
  const template = (optionalString(flags, "template") ?? nextRingsTemplate(db)).toUpperCase();
  if (!RINGS_TEMPLATES[template]) {
    throw new Error("Template must be A/B/C/D");
  }
  console.log(`${iso} PM Rings — Template ${template}`);
  console.log("Rules: Strength focus, >=2 RIR; if rings shake, regress; rotate A->B->C->D");
  RINGS_TEMPLATES[template].forEach((exercise, index) => {
    console.log(`  ${index + 1}. ${exercise}`);
  });
}
function handleRingsLog(flags) {
  const iso = parseDate(optionalString(flags, "date"));
  const db = getDb();
  const template = (optionalString(flags, "template") ?? nextRingsTemplate(db)).toUpperCase();
  if (!RINGS_TEMPLATES[template]) {
    throw new Error("Template must be A/B/C/D");
  }
  const completed = hasFlag(flags, "completed");
  runStatement(db, `
      INSERT INTO rings_sessions(session_date, slot, template, completed_as_prescribed, notes)
      VALUES(?, 'PM', ?, ?, ?)
      ON CONFLICT(session_date, slot) DO UPDATE SET
        template = excluded.template,
        completed_as_prescribed = excluded.completed_as_prescribed,
        notes = COALESCE(excluded.notes, rings_sessions.notes)
    `, iso, template, completed ? 1 : 0, optionalString(flags, "notes") ?? null);
  const session = getRow(db, "SELECT id FROM rings_sessions WHERE session_date = ? AND slot = 'PM'", iso);
  if (!session)
    throw new Error("Could not find rings session");
  db.exec("BEGIN");
  try {
    runStatement(db, "DELETE FROM rings_logs WHERE session_id = ?", session.id);
    RINGS_TEMPLATES[template].forEach((exercise, index) => {
      runStatement(db, "INSERT INTO rings_logs(session_id, item_no, exercise, result_text, completed) VALUES(?, ?, ?, ?, ?)", session.id, index + 1, exercise, completed ? "completed as prescribed" : "custom/result not specified", completed ? 1 : 0);
    });
    const missed = optionalString(flags, "missed");
    if (missed) {
      runStatement(db, "INSERT INTO rings_logs(session_id, item_no, exercise, result_text, completed) VALUES(?, 99, ?, ?, 0)", session.id, "Missed/adjustments", missed);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  console.log(`Logged rings session for ${iso} (Template ${template}).`);
}
function handleCardioToday(flags) {
  const iso = parseDate(optionalString(flags, "date"));
  const day = new Date(`${iso}T00:00:00Z`);
  const weekday = (day.getUTCDay() + 6) % 7 + 1;
  console.log(`${iso} Cardio plan:`);
  if ([1, 2, 4, 5].includes(weekday)) {
    console.log("  Protocol: Z2");
    console.log("  Duration: 40-45 min (Fri 40-45, others 45)");
    console.log("  Target HR: 110-125 bpm");
    return;
  }
  if (weekday === 3) {
    console.log("  Protocol: VO2_4x4");
    console.log("  10 min Z2 warm-up");
    console.log("  4 x 4 min hard @ ~10.5-11.5 km/h, 3 min easy between");
    console.log("  5 min cool down");
    console.log("  Interval HR target: 160-170 bpm");
    return;
  }
  if (weekday === 6) {
    console.log("  Protocol: VO2_1min");
    console.log("  10 min Z2 warm-up");
    console.log("  6-8 x 1 min hard / 2 min easy");
    console.log("  5 min cool down");
    console.log("  Hard HR target: 165-175 bpm");
    return;
  }
  console.log("  Off or very easy walk 20-30 min <110 bpm");
}
function handleCardioLog(flags) {
  const iso = parseDate(optionalString(flags, "date"));
  const protocolRaw = requireString(flags, "protocol").toUpperCase();
  if (!["Z2", "VO2_4X4", "VO2_1MIN"].includes(protocolRaw)) {
    throw new Error("protocol must be Z2, VO2_4x4, or VO2_1min");
  }
  const protocol = protocolRaw.replace("VO2_4X4", "VO2_4x4").replace("VO2_1MIN", "VO2_1min");
  const maxHr = optionalNumber(flags, "max-hr");
  const z2CapRespected = protocol === "Z2" && maxHr != null ? maxHr <= 125 ? 1 : 0 : null;
  const db = getDb();
  runStatement(db, `
      INSERT INTO cardio_sessions(session_date, slot, protocol, duration_min, avg_hr, max_hr, z2_cap_respected, notes)
      VALUES(?, 'CARDIO', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_date, slot) DO UPDATE SET
        protocol = excluded.protocol,
        duration_min = excluded.duration_min,
        avg_hr = excluded.avg_hr,
        max_hr = excluded.max_hr,
        z2_cap_respected = excluded.z2_cap_respected,
        notes = COALESCE(excluded.notes, cardio_sessions.notes)
    `, iso, protocol, optionalNumber(flags, "duration") ?? null, optionalNumber(flags, "avg-hr") ?? null, maxHr ?? null, z2CapRespected, optionalString(flags, "notes") ?? null);
  console.log(`Logged cardio session for ${iso} (${protocol}).`);
}
function handleCardioProgressAdd(flags) {
  const iso = parseDate(optionalString(flags, "date"));
  const db = getDb();
  runStatement(db, `
      INSERT INTO cardio_progress_tests(test_date, duration_min, speed_kmh, incline_pct, final_bpm, notes)
      VALUES(?, ?, ?, ?, ?, ?)
    `, iso, Number(requireString(flags, "duration")), Number(requireString(flags, "speed")), Number(requireString(flags, "incline")), Number(requireString(flags, "final-bpm")), optionalString(flags, "notes") ?? null);
  console.log(`Logged cardio progress test for ${iso}.`);
}
function handleCardioProgressShow() {
  const db = getDb();
  const rows = allRows(db, `
      SELECT test_date, duration_min, speed_kmh, incline_pct, final_bpm, notes
      FROM cardio_progress_tests
      ORDER BY date(test_date) ASC, id ASC
    `);
  if (!rows.length) {
    console.log("No cardio progress tests logged yet.");
    return;
  }
  console.log("Cardio progress tests:");
  rows.forEach((row) => {
    const note = row.notes ? ` | ${row.notes}` : "";
    console.log(`  ${row.test_date}: ${row.duration_min}min @ ${Number(row.speed_kmh).toFixed(1)} km/h, ${Number(row.incline_pct).toFixed(1)}% incline, final ${row.final_bpm} bpm${note}`);
  });
}
function printUsage() {
  console.log(`Usage:
  gym531 today [--date YYYY-MM-DD]
  gym531 log [--date YYYY-MM-DD] [--main 72.5x5,82.5x5,92.5x5] [--main-reps 5,5,4] [--supp 55x10,55x10] [--supp-completed]
  gym531 rings-today [--date YYYY-MM-DD] [--template A|B|C|D]
  gym531 rings-log [--date YYYY-MM-DD] [--template A|B|C|D] [--completed] [--missed "..."]
  gym531 cardio-today [--date YYYY-MM-DD]
  gym531 cardio-log --protocol Z2|VO2_4x4|VO2_1min [--date YYYY-MM-DD]
  gym531 cardio-progress-add --duration N --speed N --incline N --final-bpm N [--date YYYY-MM-DD]
  gym531 cardio-progress-show`);
}
function main() {
  const [, , command, ...rest] = process.argv;
  if (!command) {
    printUsage();
    process.exitCode = 1;
    return;
  }
  const flags = parseFlags(rest);
  switch (command) {
    case "today":
      handleToday(flags);
      return;
    case "log":
      handleLog(flags);
      return;
    case "rings-today":
      handleRingsToday(flags);
      return;
    case "rings-log":
      handleRingsLog(flags);
      return;
    case "cardio-today":
      handleCardioToday(flags);
      return;
    case "cardio-log":
      handleCardioLog(flags);
      return;
    case "cardio-progress-add":
      handleCardioProgressAdd(flags);
      return;
    case "cardio-progress-show":
      handleCardioProgressShow();
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}
try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
