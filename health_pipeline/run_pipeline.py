#!/usr/bin/env python3
import argparse
import csv
import hashlib
import json
import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from statistics import median
import xml.etree.ElementTree as ET
import zipfile
import tempfile


def dt_parse(s: str) -> datetime:
    s = s.strip().replace(" +0000", "Z")
    for fmt in (
        "%Y-%m-%d %H:%M:%S %z",
        "%Y-%m-%d %H:%M:%S %Z",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S%z",
    ):
        try:
            d = datetime.strptime(s, fmt)
            if d.tzinfo is None:
                d = d.replace(tzinfo=timezone.utc)
            return d.astimezone(timezone.utc)
        except ValueError:
            pass
    raise ValueError(f"unsupported datetime: {s}")


def sha(obj) -> str:
    return "sha256:" + hashlib.sha256(json.dumps(obj, sort_keys=True, default=str).encode()).hexdigest()


def load_config(path: Path | None):
    cfg = {
        "timezone": "Asia/Manila",
        "sex": "male",
        "hr_max_default": 190,
        "hr_max_override": None,
        "hr_rest_fallback": 55,
    }
    if path and path.exists():
        cfg.update(json.loads(path.read_text()))
    return cfg


@dataclass
class Context:
    user_id: str
    timezone: str
    sex: str
    hr_max_default: int
    hr_max_override: int | None
    hr_rest_fallback: int


def parse_apple_xml(xml_path: Path, ctx: Context, out, anomalies):
    tree = ET.parse(xml_path)
    root = tree.getroot()

    daily_activity = defaultdict(lambda: {"steps": 0, "distance_m": 0.0, "active_energy_kcal": 0.0, "basal_energy_kcal": 0.0, "exercise_time_min": 0.0, "stand_time_min": 0.0, "flights_climbed": 0})
    daily_recovery = defaultdict(dict)

    rec_map = {
        "HKQuantityTypeIdentifierRestingHeartRate": ("resting_hr_bpm", float),
        "HKQuantityTypeIdentifierHeartRateVariabilitySDNN": ("hrv_sdnn_ms", float),
        "HKQuantityTypeIdentifierRespiratoryRate": ("respiratory_rate_brpm", float),
        "HKQuantityTypeIdentifierOxygenSaturation": ("spo2_pct", lambda v: float(v) * 100.0 if float(v) <= 1 else float(v)),
        "HKQuantityTypeIdentifierAppleSleepingWristTemperature": ("wrist_temp_delta_c", float),
        "HKQuantityTypeIdentifierVO2Max": ("vo2max_ml_kg_min", float),
        "HKQuantityTypeIdentifierBodyMass": ("body_mass_kg", float),
    }

    for rec in root.iter("Record"):
        rtype = rec.attrib.get("type", "")
        sd = rec.attrib.get("startDate")
        ed = rec.attrib.get("endDate")
        val = rec.attrib.get("value")
        if not sd:
            continue
        try:
            d = dt_parse(sd).date().isoformat()
        except Exception:
            continue

        if rtype == "HKQuantityTypeIdentifierStepCount":
            daily_activity[d]["steps"] += int(float(val or 0))
        elif rtype == "HKQuantityTypeIdentifierDistanceWalkingRunning":
            daily_activity[d]["distance_m"] += float(val or 0)
        elif rtype == "HKQuantityTypeIdentifierActiveEnergyBurned":
            daily_activity[d]["active_energy_kcal"] += float(val or 0)
        elif rtype == "HKQuantityTypeIdentifierBasalEnergyBurned":
            daily_activity[d]["basal_energy_kcal"] += float(val or 0)
        elif rtype == "HKQuantityTypeIdentifierAppleExerciseTime":
            daily_activity[d]["exercise_time_min"] += float(val or 0)
        elif rtype == "HKQuantityTypeIdentifierAppleStandTime":
            daily_activity[d]["stand_time_min"] += float(val or 0)
        elif rtype == "HKQuantityTypeIdentifierFlightsClimbed":
            daily_activity[d]["flights_climbed"] += int(float(val or 0))
        elif rtype == "HKCategoryTypeIdentifierSleepAnalysis" and sd and ed:
            try:
                sdt, edt = dt_parse(sd), dt_parse(ed)
                duration = int((edt - sdt).total_seconds())
                sid = f"apple_sleep:{sdt.isoformat()}"
                out["sleep_sessions"].append({
                    "user_id": ctx.user_id,
                    "source": "apple_health_xml",
                    "source_sleep_id": sid,
                    "started_at": sdt.isoformat().replace("+00:00", "Z"),
                    "ended_at": edt.isoformat().replace("+00:00", "Z"),
                    "duration_s": duration,
                    "in_bed_s": duration,
                    "asleep_s": duration,
                    "awake_s": 0,
                    "rem_s": None,
                    "core_s": None,
                    "deep_s": None,
                    "raw_hash": sha(rec.attrib),
                })
            except Exception:
                anomalies.append("sleep_parse_error")
        elif rtype in rec_map:
            key, conv = rec_map[rtype]
            try:
                daily_recovery[d][key] = conv(val)
            except Exception:
                anomalies.append(f"invalid_{key}")

    for d, row in daily_activity.items():
        payload = {
            "user_id": ctx.user_id,
            "activity_date": d,
            "source": "apple_health_xml",
            **row,
        }
        payload["raw_hash"] = sha(payload)
        out["daily_activity"].append(payload)

    for d, row in daily_recovery.items():
        payload = {
            "user_id": ctx.user_id,
            "recovery_date": d,
            "source": "apple_health_xml",
            **row,
        }
        payload["raw_hash"] = sha(payload)
        out["daily_recovery"].append(payload)

    for w in root.iter("Workout"):
        try:
            sdt = dt_parse(w.attrib["startDate"])
            edt = dt_parse(w.attrib["endDate"])
        except Exception:
            continue
        duration = int((edt - sdt).total_seconds())
        sport = (w.attrib.get("workoutActivityType", "other").replace("HKWorkoutActivityType", "") or "other").lower()
        dist = w.attrib.get("totalDistance")
        kcal = w.attrib.get("totalEnergyBurned")
        sid = f"apple:{sdt.isoformat()}:{sport}"
        payload = {
            "user_id": ctx.user_id,
            "source": "apple_watch_workout",
            "source_workout_id": sid,
            "sport": sport,
            "started_at": sdt.isoformat().replace("+00:00", "Z"),
            "ended_at": edt.isoformat().replace("+00:00", "Z"),
            "timezone": ctx.timezone,
            "duration_s": duration,
            "distance_m": float(dist) if dist else None,
            "calories_kcal": float(kcal) if kcal else None,
            "avg_hr_bpm": None,
            "max_hr_bpm": None,
            "avg_speed_mps": (float(dist) / duration) if dist and duration > 0 else None,
            "avg_pace_s_per_km": (duration / (float(dist) / 1000.0)) if dist and float(dist) > 0 else None,
            "indoor": None,
            "has_route": False,
            "route_geojson": None,
            "vendor_vo2max_ml_kg_min": None,
            "raw_hash": sha(w.attrib),
        }
        out["workouts"].append(payload)


def parse_polar_tcx(path: Path, ctx: Context, out):
    root = ET.parse(path).getroot()
    ns = "{http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2}"
    activities = root.findall(f".//{ns}Activity")
    for a in activities:
        sport = (a.attrib.get("Sport") or "other").lower()
        for lap in a.findall(f"{ns}Lap"):
            start = lap.attrib.get("StartTime")
            if not start:
                continue
            sdt = dt_parse(start)
            dist = float((lap.findtext(f"{ns}DistanceMeters") or 0) or 0)
            dur = float((lap.findtext(f"{ns}TotalTimeSeconds") or 0) or 0)
            kcal = float((lap.findtext(f"{ns}Calories") or 0) or 0)
            sid = f"polar:{sdt.isoformat()}:{sport}"
            workout_id = sid
            hrs = []
            for tp in lap.findall(f".//{ns}Trackpoint"):
                t = tp.findtext(f"{ns}Time")
                h = tp.findtext(f".//{ns}HeartRateBpm/{ns}Value")
                if not t or not h:
                    continue
                ts = dt_parse(t)
                hr = float(h)
                hrs.append(hr)
                out["hr_samples"].append({
                    "source": "polar_h10",
                    "source_workout_id": workout_id,
                    "ts": ts.isoformat().replace("+00:00", "Z"),
                    "hr_bpm": hr,
                    "rr_ms": None,
                    "quality": 100,
                    "is_interpolated": False,
                })
            payload = {
                "user_id": ctx.user_id,
                "source": "polar_h10",
                "source_workout_id": workout_id,
                "sport": sport,
                "started_at": sdt.isoformat().replace("+00:00", "Z"),
                "ended_at": (sdt.timestamp() + dur),
                "timezone": ctx.timezone,
                "duration_s": int(dur),
                "distance_m": dist,
                "calories_kcal": kcal,
                "avg_hr_bpm": (sum(hrs) / len(hrs)) if hrs else None,
                "max_hr_bpm": max(hrs) if hrs else None,
                "avg_speed_mps": (dist / dur) if dur > 0 else None,
                "avg_pace_s_per_km": (dur / (dist / 1000.0)) if dist > 0 else None,
                "indoor": None,
                "has_route": False,
                "route_geojson": None,
                "vendor_vo2max_ml_kg_min": None,
            }
            edt = sdt.fromtimestamp(payload["ended_at"], tz=timezone.utc)
            payload["ended_at"] = edt.isoformat().replace("+00:00", "Z")
            payload["raw_hash"] = sha(payload)
            out["workouts"].append(payload)


def parse_polar_csv(path: Path, out):
    with path.open() as f:
        reader = csv.DictReader(f)
        for row in reader:
            cols = {k.lower().strip(): v for k, v in row.items() if k}
            ts = cols.get("timestamp") or cols.get("time")
            hr = cols.get("hr") or cols.get("heart_rate") or cols.get("heart rate")
            sid = cols.get("source_workout_id") or cols.get("workout_id")
            if ts and hr and sid:
                try:
                    out["hr_samples"].append({
                        "source": "polar_h10",
                        "source_workout_id": sid,
                        "ts": dt_parse(ts).isoformat().replace("+00:00", "Z"),
                        "hr_bpm": float(hr),
                        "rr_ms": int(float(cols.get("rr_ms") or 0)) if cols.get("rr_ms") else None,
                        "quality": 100,
                        "is_interpolated": False,
                    })
                except Exception:
                    pass


def compute_metrics(ctx: Context, out):
    by_workout_hr = defaultdict(list)
    for s in out["hr_samples"]:
        by_workout_hr[s["source_workout_id"]].append(s)

    resting_vals = sorted([d.get("resting_hr_bpm") for d in out["daily_recovery"] if d.get("resting_hr_bpm") is not None])
    hr_rest = int(median(resting_vals[-14:])) if resting_vals else ctx.hr_rest_fallback
    observed_max = max([w.get("max_hr_bpm") or 0 for w in out["workouts"]] + [0])
    hr_max = ctx.hr_max_override or int(observed_max) or ctx.hr_max_default
    hrr = max(1, hr_max - hr_rest)

    for w in out["workouts"]:
        samples = sorted(by_workout_hr.get(w["source_workout_id"], []), key=lambda x: x["ts"])
        if not samples:
            continue
        z = [0, 0, 0, 0, 0]
        hrs = [s["hr_bpm"] for s in samples]
        for i in range(len(samples) - 1):
            t0 = dt_parse(samples[i]["ts"])
            t1 = dt_parse(samples[i + 1]["ts"])
            dt = max(1, int((t1 - t0).total_seconds()))
            pct = (samples[i]["hr_bpm"] - hr_rest) / hrr
            if pct < 0.6:
                idx = 0
            elif pct < 0.7:
                idx = 1
            elif pct < 0.8:
                idx = 2
            elif pct < 0.9:
                idx = 3
            else:
                idx = 4
            z[idx] += dt

        avg_hr = sum(hrs) / len(hrs)
        dhr = (avg_hr - hr_rest) / hrr
        dur_min = w["duration_s"] / 60.0
        if ctx.sex.lower() == "female":
            trimp = dur_min * dhr * 0.86 * math.exp(1.67 * dhr)
        else:
            trimp = dur_min * dhr * 0.64 * math.exp(1.92 * dhr)

        edwards = (z[0]/60)*1 + (z[1]/60)*2 + (z[2]/60)*3 + (z[3]/60)*4 + (z[4]/60)*5
        aer_eff = (w.get("avg_speed_mps") or 0) / max(1e-6, (avg_hr - hr_rest)) if w.get("avg_speed_mps") else None

        out["workout_metrics"].append({
            "source_workout_id": w["source_workout_id"],
            "user_id": w["user_id"],
            "trimp_bannister": round(trimp, 2),
            "trimp_edwards": round(edwards, 2),
            "time_in_z1_s": z[0],
            "time_in_z2_s": z[1],
            "time_in_z3_s": z[2],
            "time_in_z4_s": z[3],
            "time_in_z5_s": z[4],
            "aerobic_efficiency": round(aer_eff, 4) if aer_eff is not None else None,
            "decoupling_pct": None,
            "recovery_hr_60s": None,
            "avg_rr_ms": None,
            "rmssd_ms": None,
            "artifact_pct": 0,
        })


def write_ndjson(out_root: Path, out):
    nroot = out_root / "normalized"
    nroot.mkdir(parents=True, exist_ok=True)
    for key in ("workouts", "hr_samples", "daily_recovery", "sleep_sessions", "daily_activity", "workout_metrics"):
        p = nroot / f"{key}.ndjson"
        with p.open("w") as f:
            for row in out[key]:
                f.write(json.dumps(row, default=str) + "\n")


def write_sql(out_root: Path, out):
    sroot = out_root / "sql"
    sroot.mkdir(parents=True, exist_ok=True)
    lines = ["-- generated upserts"]
    for w in out["workouts"]:
        lines.append(
            """
insert into workouts (
  user_id, source_id, source_workout_id, sport, started_at, ended_at, timezone,
  duration_s, distance_m, calories_kcal, avg_hr_bpm, max_hr_bpm,
  avg_speed_mps, avg_pace_s_per_km, indoor, has_route, route_geojson,
  vendor_vo2max_ml_kg_min, raw_hash
) values (
  '{user_id}',
  (select id from data_sources where source_code='{source}'),
  '{source_workout_id}',
  '{sport}',
  '{started_at}',
  '{ended_at}',
  '{timezone}',
  {duration_s}, {distance_m}, {calories_kcal}, {avg_hr_bpm}, {max_hr_bpm},
  {avg_speed_mps}, {avg_pace_s_per_km}, {indoor}, {has_route}, {route_geojson},
  {vendor_vo2max_ml_kg_min}, '{raw_hash}'
)
on conflict (user_id, source_id, source_workout_id)
do update set
  duration_s=excluded.duration_s,
  distance_m=excluded.distance_m,
  calories_kcal=excluded.calories_kcal,
  avg_hr_bpm=excluded.avg_hr_bpm,
  max_hr_bpm=excluded.max_hr_bpm,
  updated_at=now();
            """.format(
                **{k: ("null" if w.get(k) is None else json.dumps(w.get(k))) for k in w},
                user_id=w["user_id"],
                source=w["source"],
                source_workout_id=w["source_workout_id"].replace("'", "''"),
                sport=w["sport"].replace("'", "''"),
                started_at=w["started_at"],
                ended_at=w["ended_at"],
                timezone=w["timezone"],
                raw_hash=w["raw_hash"],
            )
        )
    (sroot / "upserts.sql").write_text("\n".join(lines))


def write_log(out_root: Path, anomalies, out):
    lroot = out_root / "logs"
    lroot.mkdir(parents=True, exist_ok=True)
    today = datetime.now().date().isoformat()
    p = lroot / f"ingestion-{today}.md"
    txt = [
        f"# Ingestion {today}",
        f"- workouts: {len(out['workouts'])}",
        f"- hr_samples: {len(out['hr_samples'])}",
        f"- daily_recovery: {len(out['daily_recovery'])}",
        f"- daily_activity: {len(out['daily_activity'])}",
        f"- sleep_sessions: {len(out['sleep_sessions'])}",
        f"- workout_metrics: {len(out['workout_metrics'])}",
        "",
        "## anomalies",
    ]
    if anomalies:
        txt += [f"- {a}" for a in sorted(set(anomalies))]
    else:
        txt += ["- none"]
    p.write_text("\n".join(txt) + "\n")


def iter_apple_xml_inputs(in_root: Path):
    # Direct XML drops (supports imports/raw/apple/latest/export.xml)
    for xml in in_root.glob("apple/**/export.xml"):
        yield xml


def parse_apple_zip(zip_path: Path, ctx: Context, out, anomalies):
    # Supports imports/raw/apple/**/export.zip (including latest)
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            xml_candidates = [n for n in zf.namelist() if n.lower().endswith("export.xml")]
            if not xml_candidates:
                anomalies.append(f"apple_zip_missing_export_xml:{zip_path.name}")
                return
            chosen = sorted(xml_candidates, key=len)[0]
            with tempfile.TemporaryDirectory() as td:
                out_xml = Path(td) / "export.xml"
                out_xml.write_bytes(zf.read(chosen))
                parse_apple_xml(out_xml, ctx, out, anomalies)
    except Exception:
        anomalies.append(f"apple_zip_parse_error:{zip_path.name}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--user-id", required=True)
    ap.add_argument("--input-root", default="imports/raw")
    ap.add_argument("--output-root", default="imports")
    ap.add_argument("--config")
    args = ap.parse_args()

    cfg = load_config(Path(args.config) if args.config else None)
    ctx = Context(
        user_id=args.user_id,
        timezone=cfg["timezone"],
        sex=cfg["sex"],
        hr_max_default=int(cfg["hr_max_default"]),
        hr_max_override=cfg.get("hr_max_override"),
        hr_rest_fallback=int(cfg["hr_rest_fallback"]),
    )

    out = {k: [] for k in ["workouts", "hr_samples", "daily_recovery", "sleep_sessions", "daily_activity", "workout_metrics"]}
    anomalies = []

    in_root = Path(args.input_root)

    # Apple inputs: direct export.xml + export.zip
    for xml in iter_apple_xml_inputs(in_root):
        parse_apple_xml(xml, ctx, out, anomalies)
    for z in in_root.glob("apple/**/*.zip"):
        parse_apple_zip(z, ctx, out, anomalies)

    # Polar inputs (supports imports/raw/polar/latest/*)
    for tcx in in_root.glob("polar/**/*.tcx"):
        parse_polar_tcx(tcx, ctx, out)
    for csvf in in_root.glob("polar/**/*.csv"):
        parse_polar_csv(csvf, out)
    for fit in in_root.glob("polar/**/*.fit"):
        anomalies.append(f"fit_not_parsed:{fit.name}")

    # de-dup workouts by (user_id, source, source_workout_id)
    uniq = {}
    for w in out["workouts"]:
        uniq[(w["user_id"], w["source"], w["source_workout_id"])] = w
    out["workouts"] = list(uniq.values())

    compute_metrics(ctx, out)

    out_root = Path(args.output_root)
    write_ndjson(out_root, out)
    write_sql(out_root, out)
    write_log(out_root, anomalies, out)
    print("ok")


if __name__ == "__main__":
    main()
