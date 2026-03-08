#!/usr/bin/env python3
import argparse
import sqlite3
from datetime import date, datetime
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "training_dashboard.db"

MAIN_PCTS = {
    1: [0.65, 0.75, 0.85],
    2: [0.70, 0.80, 0.90],
    3: [0.75, 0.85, 0.95],
}

RINGS_TEMPLATES = {
    "A": [
        "RTO Support Hold — 5×20–30s (rest 60–90s)",
        "Ring Rows (feet up) — 5×4–6 @31X1 (rest 120s)",
        "Ring Face Pulls — 4×6–8 @3011 (rest 90s)",
        "Ring Plank — 3×30–45s (rest 60s)",
    ],
    "B": [
        "RTO Support Shrugs — 4×6–8 @3111 (rest 90s)",
        "Ring Push-Ups (RTO) — 5×4–6 @31X1 (rest 120s)",
        "Assisted Ring Dips — 5×3–5 @40X1 (rest 150s)",
        "Hollow Hold — 3×25–40s (rest 60s)",
    ],
    "C": [
        "Feet-Assisted Pull-Ups — 5×3–5 @31X1 (rest 150s)",
        "High Ring Rows — 4×4–6 @31X1 (rest 120s)",
        "False Grip Hold (feet) — 4×20–30s (rest 60s)",
        "Ring Body Saw — 3×8–12 slow (rest 60s)",
    ],
    "D": [
        "Single-Ring Support — 4×15–25s/side (rest 60s)",
        "Archer Ring Rows — 5×3–4/side @31X1 (rest 120s)",
        "Dip Iso (bottom) — 4×10–20s (rest 90s)",
        "Knee→Pike Tucks — 3×6–10 (rest 60s)",
    ],
}


def round_to_inc(value: float, inc: float) -> float:
    return round(value / inc) * inc


def parse_date(s: str | None) -> date:
    if not s:
        return date.today()
    return datetime.strptime(s, "%Y-%m-%d").date()


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    ensure_rings_schema(conn)
    return conn


def ensure_rings_schema(conn: sqlite3.Connection):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS rings_sessions (
          id INTEGER PRIMARY KEY,
          session_date TEXT NOT NULL,
          slot TEXT NOT NULL DEFAULT 'PM',
          template TEXT NOT NULL CHECK (template IN ('A','B','C','D')),
          completed_as_prescribed INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(session_date, slot)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS rings_logs (
          id INTEGER PRIMARY KEY,
          session_id INTEGER NOT NULL REFERENCES rings_sessions(id) ON DELETE CASCADE,
          item_no INTEGER NOT NULL,
          exercise TEXT NOT NULL,
          result_text TEXT,
          completed INTEGER NOT NULL DEFAULT 1
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS cardio_progress_tests (
          id INTEGER PRIMARY KEY,
          test_date TEXT NOT NULL,
          duration_min INTEGER NOT NULL,
          speed_kmh REAL NOT NULL,
          incline_pct REAL NOT NULL,
          final_bpm INTEGER NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()


def get_config(conn: sqlite3.Connection, key: str, default: str = "") -> str:
    row = conn.execute("SELECT value FROM config WHERE key=?", (key,)).fetchone()
    return row[0] if row else default


def get_block_for_date(conn: sqlite3.Connection, d: date):
    row = conn.execute(
        """
        SELECT pb.*, t.name AS template_name, t.main_scheme, t.supplemental_scheme
        FROM program_blocks pb
        JOIN templates t ON t.id = pb.template_id
        WHERE date(pb.start_date) <= date(?)
        ORDER BY date(pb.start_date) DESC, pb.block_no DESC, pb.id DESC
        LIMIT 1
        """,
        (d.isoformat(),),
    ).fetchone()
    return row


def get_training_day(conn: sqlite3.Connection, d: date):
    weekday = d.isoweekday()  # 1=Mon
    row = conn.execute(
        """
        SELECT td.*, lm.name AS main_lift, ls.name AS supplemental_lift
        FROM training_days td
        JOIN lifts lm ON lm.id = td.main_lift_id
        JOIN lifts ls ON ls.id = td.supplemental_lift_id
        WHERE td.weekday=?
        """,
        (weekday,),
    ).fetchone()
    return row


def get_tm(conn: sqlite3.Connection, lift_id: int, d: date) -> float:
    row = conn.execute(
        """
        SELECT tm_kg
        FROM training_max_history
        WHERE lift_id=? AND date(effective_date) <= date(?)
        ORDER BY date(effective_date) DESC, id DESC
        LIMIT 1
        """,
        (lift_id, d.isoformat()),
    ).fetchone()
    if not row:
        raise RuntimeError("No TM found for lift")
    return float(row[0])


def get_week_in_block(block_start: str, d: date) -> int:
    bs = datetime.strptime(block_start, "%Y-%m-%d").date()
    return ((d - bs).days // 7) + 1


def prescription(conn: sqlite3.Connection, d: date):
    td = get_training_day(conn, d)
    if not td:
        return None
    block = get_block_for_date(conn, d)
    if not block:
        return None

    week_in_block = get_week_in_block(block["start_date"], d)
    week_wave = ((week_in_block - 1) % 3) + 1
    pcts = MAIN_PCTS[week_wave]
    inc = float(get_config(conn, "rounding_increment_kg", "2.5"))

    main_tm = get_tm(conn, td["main_lift_id"], d)
    supp_tm = get_tm(conn, td["supplemental_lift_id"], d)

    main_sets = []
    for p in pcts:
        main_sets.append((p, 5, round_to_inc(main_tm * p, inc)))

    fsl_pct = pcts[0]
    if block["block_type"] == "Leader":
        supp_sets, supp_reps = 5, 10
    else:
        supp_sets, supp_reps = 5, 5
    supp_weight = round_to_inc(supp_tm * fsl_pct, inc)

    return {
        "date": d.isoformat(),
        "weekday": d.strftime("%A"),
        "block_type": block["block_type"],
        "block_no": block["block_no"],
        "template": block["template_name"],
        "week_in_block": week_in_block,
        "week_wave": week_wave,
        "main_lift": td["main_lift"],
        "main_lift_id": td["main_lift_id"],
        "supp_lift": td["supplemental_lift"],
        "supp_lift_id": td["supplemental_lift_id"],
        "main_sets": main_sets,
        "supp_sets": supp_sets,
        "supp_reps": supp_reps,
        "supp_weight": supp_weight,
        "fsl_pct": fsl_pct,
    }


def cmd_today(args):
    d = parse_date(args.date)
    conn = get_conn()
    p = prescription(conn, d)
    if not p:
        print(f"{d.isoformat()} is not a training day in your split.")
        return

    print(f"{p['date']} ({p['weekday']})")
    print(f"Block: {p['block_type']} {p['block_no']} | Week in block: {p['week_in_block']} (Wave week {p['week_wave']})")
    print(f"Main ({p['main_lift']}):")
    for i, (pct, reps, w) in enumerate(p["main_sets"], start=1):
        print(f"  Set {i}: {int(pct*100)}% x {reps} @ {w:.1f} kg")
    print(f"Supplemental ({p['supp_lift']}):")
    print(f"  {p['supp_sets']} x {p['supp_reps']} @ {p['supp_weight']:.1f} kg ({int(p['fsl_pct']*100)}% FSL)")


def parse_set_triplets(s: str):
    out = []
    if not s:
        return out
    parts = [p.strip() for p in s.split(",") if p.strip()]
    for part in parts:
        w, r = part.lower().split("x")
        out.append((float(w), int(r)))
    return out


def parse_rep_list(s: str):
    if not s:
        return []
    return [int(x.strip()) for x in s.split(",") if x.strip()]


def ensure_session(conn: sqlite3.Connection, d: date, notes: str | None, bw: float | None, readiness: int | None):
    td = get_training_day(conn, d)
    block = get_block_for_date(conn, d)
    if not td or not block:
        raise RuntimeError("Date is not configured as a training day")
    week_in_block = get_week_in_block(block["start_date"], d)

    conn.execute(
        """
        INSERT INTO barbell_sessions(session_date, weekday, block_id, week_in_block, day_id, bodyweight_kg, readiness, notes)
        VALUES(?,?,?,?,?,?,?,?)
        ON CONFLICT(session_date) DO UPDATE SET
          bodyweight_kg=excluded.bodyweight_kg,
          readiness=excluded.readiness,
          notes=COALESCE(excluded.notes, barbell_sessions.notes)
        """,
        (d.isoformat(), d.isoweekday(), block["id"], week_in_block, td["id"], bw, readiness, notes),
    )
    row = conn.execute("SELECT id FROM barbell_sessions WHERE session_date=?", (d.isoformat(),)).fetchone()
    return int(row[0]), td, block, week_in_block


def cmd_log(args):
    d = parse_date(args.date)
    conn = get_conn()
    p = prescription(conn, d)
    if not p:
        raise RuntimeError("Not a configured training day")

    main_done = parse_set_triplets(args.main)
    supp_done = parse_set_triplets(args.supp)
    main_reps_only = parse_rep_list(args.main_reps)

    if main_done and len(main_done) != 3:
        raise RuntimeError("Main sets require exactly 3 entries, e.g. 72.5x5,82.5x5,92.5x5")
    if main_reps_only and len(main_reps_only) != 3:
        raise RuntimeError("--main-reps needs exactly 3 reps, e.g. 5,5,4")
    if not main_done and not main_reps_only:
        main_reps_only = [int(ms[1]) for ms in p["main_sets"]]

    session_id, _, _, _ = ensure_session(conn, d, args.notes, args.bodyweight, args.readiness)
    conn.execute("DELETE FROM barbell_set_logs WHERE session_id=? AND category IN ('main','supplemental')", (session_id,))

    for i, (pct, reps, prescribed_weight) in enumerate(p["main_sets"], start=1):
        if main_done:
            aw, ar = main_done[i - 1]
        else:
            aw, ar = prescribed_weight, main_reps_only[i - 1]
        conn.execute(
            """
            INSERT INTO barbell_set_logs(session_id,lift_id,category,set_no,prescribed_pct,prescribed_reps,actual_weight_kg,actual_reps,rpe,note)
            VALUES(?,?,?,?,?,?,?,?,?,?)
            """,
            (session_id, p["main_lift_id"], "main", i, pct, reps, aw, ar, args.rpe, None),
        )

    if supp_done:
        for i, (aw, ar) in enumerate(supp_done, start=1):
            conn.execute(
                """
                INSERT INTO barbell_set_logs(session_id,lift_id,category,set_no,prescribed_pct,prescribed_reps,actual_weight_kg,actual_reps,rpe,note)
                VALUES(?,?,?,?,?,?,?,?,?,?)
                """,
                (session_id, p["supp_lift_id"], "supplemental", i, p["fsl_pct"], p["supp_reps"], aw, ar, None, None),
            )
    elif args.supp_completed:
        for i in range(1, p["supp_sets"] + 1):
            conn.execute(
                """
                INSERT INTO barbell_set_logs(session_id,lift_id,category,set_no,prescribed_pct,prescribed_reps,actual_weight_kg,actual_reps,rpe,note)
                VALUES(?,?,?,?,?,?,?,?,?,?)
                """,
                (session_id, p["supp_lift_id"], "supplemental", i, p["fsl_pct"], p["supp_reps"], p["supp_weight"], p["supp_reps"], None, None),
            )

    conn.commit()
    print(f"Logged session for {d.isoformat()}.")


def next_rings_template(conn: sqlite3.Connection) -> str:
    row = conn.execute(
        "SELECT template FROM rings_sessions ORDER BY date(session_date) DESC, id DESC LIMIT 1"
    ).fetchone()
    if not row:
        return "A"
    order = ["A", "B", "C", "D"]
    idx = order.index(row[0])
    return order[(idx + 1) % 4]


def cmd_rings_today(args):
    d = parse_date(args.date)
    conn = get_conn()
    template = (args.template or next_rings_template(conn)).upper()
    if template not in RINGS_TEMPLATES:
        raise RuntimeError("Template must be A/B/C/D")

    print(f"{d.isoformat()} PM Rings — Template {template}")
    print("Rules: Strength focus, >=2 RIR; if rings shake, regress; rotate A->B->C->D")
    for i, ex in enumerate(RINGS_TEMPLATES[template], start=1):
        print(f"  {i}. {ex}")


def cmd_rings_log(args):
    d = parse_date(args.date)
    conn = get_conn()
    template = (args.template or next_rings_template(conn)).upper()
    if template not in RINGS_TEMPLATES:
        raise RuntimeError("Template must be A/B/C/D")

    conn.execute(
        """
        INSERT INTO rings_sessions(session_date,slot,template,completed_as_prescribed,notes)
        VALUES(?,?,?,?,?)
        ON CONFLICT(session_date,slot) DO UPDATE SET
          template=excluded.template,
          completed_as_prescribed=excluded.completed_as_prescribed,
          notes=COALESCE(excluded.notes, rings_sessions.notes)
        """,
        (d.isoformat(), "PM", template, 1 if args.completed else 0, args.notes),
    )
    session_id = conn.execute(
        "SELECT id FROM rings_sessions WHERE session_date=? AND slot='PM'", (d.isoformat(),)
    ).fetchone()[0]

    conn.execute("DELETE FROM rings_logs WHERE session_id=?", (session_id,))
    for i, ex in enumerate(RINGS_TEMPLATES[template], start=1):
        result = "completed as prescribed" if args.completed else "custom/result not specified"
        conn.execute(
            "INSERT INTO rings_logs(session_id,item_no,exercise,result_text,completed) VALUES(?,?,?,?,?)",
            (session_id, i, ex, result, 1 if args.completed else 0),
        )

    if args.missed:
        conn.execute(
            "INSERT INTO rings_logs(session_id,item_no,exercise,result_text,completed) VALUES(?,?,?,?,?)",
            (session_id, 99, "Missed/adjustments", args.missed, 0),
        )

    conn.commit()
    print(f"Logged rings session for {d.isoformat()} (Template {template}).")


def cmd_cardio_today(args):
    d = parse_date(args.date)
    wd = d.isoweekday()
    print(f"{d.isoformat()} Cardio plan:")
    if wd in (1, 2, 4, 5):
        print("  Protocol: Z2")
        print("  Duration: 40-45 min (Fri 40-45, others 45)")
        print("  Target HR: 110-125 bpm")
    elif wd == 3:
        print("  Protocol: VO2_4x4")
        print("  10 min Z2 warm-up")
        print("  4 x 4 min hard @ ~10.5-11.5 km/h, 3 min easy between")
        print("  5 min cool down")
        print("  Interval HR target: 160-170 bpm")
    elif wd == 6:
        print("  Protocol: VO2_1min")
        print("  10 min Z2 warm-up")
        print("  6-8 x 1 min hard / 2 min easy")
        print("  5 min cool down")
        print("  Hard HR target: 165-175 bpm")
    else:
        print("  Off or very easy walk 20-30 min <110 bpm")


def cmd_cardio_log(args):
    d = parse_date(args.date)
    conn = get_conn()
    protocol = args.protocol.upper()
    if protocol not in ("Z2", "VO2_4X4", "VO2_1MIN"):
        raise RuntimeError("protocol must be Z2, VO2_4x4, or VO2_1min")
    protocol = protocol.replace("VO2_4X4", "VO2_4x4").replace("VO2_1MIN", "VO2_1min")

    z2_cap_respected = None
    if protocol == "Z2" and args.max_hr is not None:
        z2_cap_respected = 1 if args.max_hr <= 125 else 0

    conn.execute(
        """
        INSERT INTO cardio_sessions(session_date,slot,protocol,duration_min,avg_hr,max_hr,z2_cap_respected,notes)
        VALUES(?,?,?,?,?,?,?,?)
        ON CONFLICT(session_date,slot) DO UPDATE SET
          protocol=excluded.protocol,
          duration_min=excluded.duration_min,
          avg_hr=excluded.avg_hr,
          max_hr=excluded.max_hr,
          z2_cap_respected=excluded.z2_cap_respected,
          notes=COALESCE(excluded.notes, cardio_sessions.notes)
        """,
        (d.isoformat(), "CARDIO", protocol, args.duration, args.avg_hr, args.max_hr, z2_cap_respected, args.notes),
    )
    conn.commit()
    print(f"Logged cardio session for {d.isoformat()} ({protocol}).")


def cmd_cardio_progress_add(args):
    d = parse_date(args.date)
    conn = get_conn()
    conn.execute(
        """
        INSERT INTO cardio_progress_tests(test_date,duration_min,speed_kmh,incline_pct,final_bpm,notes)
        VALUES(?,?,?,?,?,?)
        """,
        (d.isoformat(), args.duration, args.speed, args.incline, args.final_bpm, args.notes),
    )
    conn.commit()
    print(f"Logged cardio progress test for {d.isoformat()}.")


def cmd_cardio_progress_show(args):
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT test_date, duration_min, speed_kmh, incline_pct, final_bpm, notes
        FROM cardio_progress_tests
        ORDER BY date(test_date) ASC, id ASC
        """
    ).fetchall()
    if not rows:
        print("No cardio progress tests logged yet.")
        return
    print("Cardio progress tests:")
    for r in rows:
        note = f" | {r['notes']}" if r['notes'] else ""
        print(
            f"  {r['test_date']}: {r['duration_min']}min @ {r['speed_kmh']:.1f} km/h, {r['incline_pct']:.1f}% incline, final {r['final_bpm']} bpm{note}"
        )


def main():
    parser = argparse.ArgumentParser(description="5/3/1 + Rings tracker helper")
    sub = parser.add_subparsers(required=True)

    p_today = sub.add_parser("today", help="Show prescribed barbell workout for date (default: today)")
    p_today.add_argument("--date", help="YYYY-MM-DD")
    p_today.set_defaults(func=cmd_today)

    p_log = sub.add_parser("log", help="Log completed barbell workout sets")
    p_log.add_argument("--date", help="YYYY-MM-DD")
    p_log.add_argument("--main", default="", help="3 main sets as w x reps CSV, e.g. 72.5x5,82.5x5,92.5x5")
    p_log.add_argument("--main-reps", default="", help="Main set reps only, e.g. 5,5,4 (weights auto from prescription)")
    p_log.add_argument("--supp", default="", help="Supplemental sets CSV, e.g. 55x10,55x10,55x10,55x10,55x10")
    p_log.add_argument("--supp-completed", action="store_true", help="Mark supplemental work completed as prescribed")
    p_log.add_argument("--bodyweight", type=float)
    p_log.add_argument("--readiness", type=int)
    p_log.add_argument("--rpe", type=float)
    p_log.add_argument("--notes")
    p_log.set_defaults(func=cmd_log)

    p_rt = sub.add_parser("rings-today", help="Show PM rings template for date")
    p_rt.add_argument("--date", help="YYYY-MM-DD")
    p_rt.add_argument("--template", help="A|B|C|D (optional; auto-rotates if omitted)")
    p_rt.set_defaults(func=cmd_rings_today)

    p_rl = sub.add_parser("rings-log", help="Log PM rings session")
    p_rl.add_argument("--date", help="YYYY-MM-DD")
    p_rl.add_argument("--template", help="A|B|C|D (optional; auto-rotates if omitted)")
    p_rl.add_argument("--completed", action="store_true", help="Completed as prescribed")
    p_rl.add_argument("--missed", default="", help="What changed/missed, free text")
    p_rl.add_argument("--notes")
    p_rl.set_defaults(func=cmd_rings_log)

    p_ct = sub.add_parser("cardio-today", help="Show cardio plan for date")
    p_ct.add_argument("--date", help="YYYY-MM-DD")
    p_ct.set_defaults(func=cmd_cardio_today)

    p_cl = sub.add_parser("cardio-log", help="Log cardio session")
    p_cl.add_argument("--date", help="YYYY-MM-DD")
    p_cl.add_argument("--protocol", required=True, help="Z2 | VO2_4x4 | VO2_1min")
    p_cl.add_argument("--duration", type=int)
    p_cl.add_argument("--avg-hr", type=int)
    p_cl.add_argument("--max-hr", type=int)
    p_cl.add_argument("--notes")
    p_cl.set_defaults(func=cmd_cardio_log)

    p_cpa = sub.add_parser("cardio-progress-add", help="Log cardio progress benchmark")
    p_cpa.add_argument("--date", help="YYYY-MM-DD")
    p_cpa.add_argument("--duration", required=True, type=int)
    p_cpa.add_argument("--speed", required=True, type=float)
    p_cpa.add_argument("--incline", required=True, type=float)
    p_cpa.add_argument("--final-bpm", required=True, type=int)
    p_cpa.add_argument("--notes")
    p_cpa.set_defaults(func=cmd_cardio_progress_add)

    p_cps = sub.add_parser("cardio-progress-show", help="Show cardio progress benchmarks")
    p_cps.set_defaults(func=cmd_cardio_progress_show)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
