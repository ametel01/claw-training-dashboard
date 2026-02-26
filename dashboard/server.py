#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import subprocess
import os
import re
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parents[1]
PORT = 8080
NODE_BIN = "/Users/brunoclaw/.nvm/versions/node/v24.13.1/bin/node"

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", "0") or 0)
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            return json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            return {}

    def _run_sql(self, sql):
        db = ROOT / "gym531.db"
        subprocess.run(["sqlite3", str(db), sql], check=True, cwd=str(ROOT), capture_output=True, text=True)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/refresh":
            try:
                subprocess.run([
                    NODE_BIN, str(ROOT / "dashboard" / "export-data.mjs")
                ], check=True, cwd=str(ROOT), capture_output=True, text=True)
                self._send_json(200, {"ok": True})
            except subprocess.CalledProcessError as e:
                self._send_json(500, {
                    "ok": False,
                    "error": (e.stderr or e.stdout or str(e)).strip()
                })
            return

        if parsed.path == "/api/set-status":
            q = parse_qs(parsed.query)
            date = (q.get("date") or [None])[0]
            status = (q.get("status") or [None])[0]

            if not date or not status or status not in {"green", "yellow", "red"}:
                self._send_json(400, {"ok": False, "error": "date and valid status required"})
                return

            sql = (
                "INSERT INTO recovery_status(session_date,pain_level,note) "
                f"VALUES('{date}','{status}','Set from dashboard') "
                "ON CONFLICT(session_date) DO UPDATE SET pain_level=excluded.pain_level;"
            )

            try:
                self._run_sql(sql)
                subprocess.run([
                    NODE_BIN, str(ROOT / "dashboard" / "export-data.mjs")
                ], check=True, cwd=str(ROOT), capture_output=True, text=True)
                self._send_json(200, {"ok": True})
            except subprocess.CalledProcessError as e:
                self._send_json(500, {"ok": False, "error": (e.stderr or e.stdout or str(e)).strip()})
            return

        if parsed.path == "/api/log-action":
            body = self._read_json_body()
            action = body.get("action")
            date = body.get("date")

            if not action or not date:
                self._send_json(400, {"ok": False, "error": "action and date required"})
                return

            try:
                if action == "main_done":
                    rows = body.get("plannedBarbellRows") or []
                    main_rows = [r for r in rows if r.get("category") == "main"]
                    if not main_rows:
                        self._send_json(400, {"ok": False, "error": "no planned main rows"})
                        return

                    sql = ["BEGIN;"]
                    sql.append(
                        f"INSERT INTO barbell_sessions(session_date,weekday,week_in_block,day_id,notes) "
                        f"VALUES('{date}', ((CAST(strftime('%w','{date}') AS INTEGER)+6)%7)+1, 1, NULL, 'Logged from dashboard main_done') "
                        f"ON CONFLICT(session_date) DO NOTHING;"
                    )
                    sql.append(
                        f"DELETE FROM barbell_set_logs WHERE session_id=(SELECT id FROM barbell_sessions WHERE session_date='{date}') AND category='main';"
                    )
                    for r in main_rows:
                        lift = str(r.get("lift", "")).replace("'", "''")
                        set_no = int(r.get("set_no") or 0)
                        reps = int(r.get("prescribed_reps") or 0)
                        wt = float(r.get("planned_weight_kg") or 0)
                        pct = float(r.get("prescribed_pct") or 0)
                        sql.append(
                            "INSERT INTO barbell_set_logs(session_id,lift_id,category,set_no,prescribed_pct,prescribed_reps,actual_weight_kg,actual_reps,note) "
                            f"SELECT bs.id,l.id,'main',{set_no},{pct},{reps},{wt},{reps},'Main done from dashboard' "
                            f"FROM barbell_sessions bs JOIN lifts l ON l.name='{lift}' WHERE bs.session_date='{date}';"
                        )
                    sql.append("COMMIT;")
                    self._run_sql("\n".join(sql))

                elif action == "supp_done":
                    rows = body.get("plannedBarbellRows") or []
                    supp_rows = [r for r in rows if r.get("category") == "supplemental"]
                    if not supp_rows:
                        self._send_json(400, {"ok": False, "error": "no planned supplemental rows"})
                        return

                    sql = ["BEGIN;"]
                    sql.append(
                        f"INSERT INTO barbell_sessions(session_date,weekday,week_in_block,day_id,notes) "
                        f"VALUES('{date}', ((CAST(strftime('%w','{date}') AS INTEGER)+6)%7)+1, 1, NULL, 'Logged from dashboard supp_done') "
                        f"ON CONFLICT(session_date) DO NOTHING;"
                    )
                    sql.append(
                        f"DELETE FROM barbell_set_logs WHERE session_id=(SELECT id FROM barbell_sessions WHERE session_date='{date}') AND category='supplemental';"
                    )
                    for r in supp_rows:
                        lift = str(r.get("lift", "")).replace("'", "''")
                        set_no = int(r.get("set_no") or 0)
                        reps = int(r.get("prescribed_reps") or 0)
                        wt = float(r.get("planned_weight_kg") or 0)
                        pct = float(r.get("prescribed_pct") or 0)
                        sql.append(
                            "INSERT INTO barbell_set_logs(session_id,lift_id,category,set_no,prescribed_pct,prescribed_reps,actual_weight_kg,actual_reps,note) "
                            f"SELECT bs.id,l.id,'supplemental',{set_no},{pct},{reps},{wt},{reps},'Supplemental done from dashboard' "
                            f"FROM barbell_sessions bs JOIN lifts l ON l.name='{lift}' WHERE bs.session_date='{date}';"
                        )
                    sql.append("COMMIT;")
                    self._run_sql("\n".join(sql))

                elif action == "supp_modified":
                    text = (body.get("suppModifiedText") or "").strip()
                    rows = body.get("plannedBarbellRows") or []
                    supp_rows = [r for r in rows if r.get("category") == "supplemental"]
                    if not supp_rows:
                        self._send_json(400, {"ok": False, "error": "no planned supplemental rows"})
                        return
                    m = re.search(r"(\d+)\s*x\s*(\d+)\s*@\s*(\d+(?:\.\d+)?)", text.replace("X", "x"))
                    if not m:
                        self._send_json(400, {"ok": False, "error": "format must be like 5x10@60"})
                        return
                    sets = int(m.group(1)); reps = int(m.group(2)); wt = float(m.group(3))
                    lift = str(supp_rows[0].get("lift", "")).replace("'", "''")

                    sql = ["BEGIN;"]
                    sql.append(
                        f"INSERT INTO barbell_sessions(session_date,weekday,week_in_block,day_id,notes) "
                        f"VALUES('{date}', ((CAST(strftime('%w','{date}') AS INTEGER)+6)%7)+1, 1, NULL, 'Logged from dashboard supp_modified') "
                        f"ON CONFLICT(session_date) DO NOTHING;"
                    )
                    sql.append(
                        f"DELETE FROM barbell_set_logs WHERE session_id=(SELECT id FROM barbell_sessions WHERE session_date='{date}') AND category='supplemental';"
                    )
                    for i in range(1, sets + 1):
                        sql.append(
                            "INSERT INTO barbell_set_logs(session_id,lift_id,category,set_no,prescribed_reps,actual_weight_kg,actual_reps,note) "
                            f"SELECT bs.id,l.id,'supplemental',{i},{reps},{wt},{reps},'Supplemental modified from dashboard' "
                            f"FROM barbell_sessions bs JOIN lifts l ON l.name='{lift}' WHERE bs.session_date='{date}';"
                        )
                    sql.append("COMMIT;")
                    self._run_sql("\n".join(sql))

                elif action == "cardio_done":
                    p = body.get("plannedCardio") or {}
                    session_type = p.get("session_type") or "Z2"
                    if session_type == "Z2_VO2_4x4":
                        protocol = "VO2_4x4"
                    elif session_type == "Z2_VO2_1min":
                        protocol = "VO2_1min"
                    elif session_type in {"Z2", "VO2_4x4", "VO2_1min"}:
                        protocol = session_type
                    else:
                        protocol = "Z2"
                    duration = int(p.get("duration_min") or 30)

                    avg_hr_raw = body.get("avgHr")
                    try:
                        avg_hr = int(avg_hr_raw) if avg_hr_raw is not None else int(p.get("target_hr_min") or 0)
                    except Exception:
                        avg_hr = 0
                    if avg_hr <= 0:
                        avg_hr = 120

                    try:
                        speed_low = float(p.get("speed_low_kmh")) if p.get("speed_low_kmh") is not None else None
                    except Exception:
                        speed_low = None
                    try:
                        speed_high = float(p.get("speed_high_kmh")) if p.get("speed_high_kmh") is not None else None
                    except Exception:
                        speed_high = None
                    speed_for_trend = speed_high if speed_high is not None else speed_low

                    z2_cap = 1 if protocol == "Z2" else "NULL"
                    sql = (
                        "INSERT INTO cardio_sessions(session_date,slot,protocol,duration_min,avg_hr,z2_cap_respected,notes) "
                        f"VALUES('{date}','CARDIO','{protocol}',{duration},{avg_hr},{z2_cap},'Cardio done from dashboard (avg HR logged)') "
                        "ON CONFLICT(session_date,slot) DO UPDATE SET "
                        "protocol=excluded.protocol,duration_min=excluded.duration_min,avg_hr=excluded.avg_hr,z2_cap_respected=excluded.z2_cap_respected,notes=excluded.notes;"
                    )
                    self._run_sql(sql)

                    if protocol in {"VO2_4x4", "VO2_1min"} and speed_for_trend is not None:
                        sid_sql = f"SELECT id FROM cardio_sessions WHERE session_date='{date}' AND slot='CARDIO' LIMIT 1;"
                        sid = self._run_sql(sid_sql).strip()
                        if sid:
                            self._run_sql(f"DELETE FROM cardio_intervals WHERE session_id={sid};")
                            self._run_sql(
                                "INSERT INTO cardio_intervals(session_id,interval_no,work_min,easy_min,target_speed_kmh,achieved_hr,note) "
                                f"VALUES({sid},1,NULL,NULL,{speed_for_trend},{avg_hr},'Auto summary interval from dashboard cardio_done');"
                            )

                elif action == "rings_done":
                    sql = (
                        "INSERT INTO rings_sessions(session_date,slot,template,completed_as_prescribed,notes) "
                        "SELECT '" + date + "','PM',"
                        "COALESCE((SELECT template_code FROM rings_plan_days WHERE weekday=((CAST(strftime('%w','" + date + "') AS INTEGER)+6)%7)+1),'A'),"
                        "1,'Rings done from dashboard' "
                        "ON CONFLICT(session_date,slot) DO UPDATE SET template=excluded.template,completed_as_prescribed=excluded.completed_as_prescribed,notes=excluded.notes;"
                    )
                    self._run_sql(sql)
                    self._run_sql(
                        "DELETE FROM rings_logs WHERE session_id=(SELECT id FROM rings_sessions WHERE session_date='" + date + "' AND slot='PM');"
                    )
                    self._run_sql(
                        "INSERT INTO rings_logs(session_id,item_no,exercise,result_text,completed) "
                        "SELECT rs.id,rti.item_no,rti.exercise,'completed as prescribed',1 "
                        "FROM rings_sessions rs "
                        "JOIN rings_templates rt ON rt.code=rs.template "
                        "JOIN rings_template_items rti ON rti.template_id=rt.id "
                        "WHERE rs.session_date='" + date + "' AND rs.slot='PM' "
                        "ORDER BY rti.item_no;"
                    )
                else:
                    self._send_json(400, {"ok": False, "error": "unknown action"})
                    return

                subprocess.run([
                    NODE_BIN, str(ROOT / "dashboard" / "export-data.mjs")
                ], check=True, cwd=str(ROOT), capture_output=True, text=True)
                self._send_json(200, {"ok": True})
            except subprocess.CalledProcessError as e:
                self._send_json(500, {"ok": False, "error": (e.stderr or e.stdout or str(e)).strip()})
            return

        self._send_json(404, {"ok": False, "error": "Not found"})

if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Serving dashboard with refresh API on http://127.0.0.1:{PORT}")
    server.serve_forever()
