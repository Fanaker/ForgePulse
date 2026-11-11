"""Local SQLite historian and equipment/alert repository."""
from __future__ import annotations
import sqlite3
from pathlib import Path
from forgepulse.modeling import risk_score, FEATURES
import numpy as np
from forgepulse.simulator import ASSETS, telemetry_samples

FIELDS = ("timestamp","asset_id","temperature","vibration","current","pressure","rpm","hours","source","risk")

class Store:
    def __init__(self, db_path: Path, model):
        self.db_path = Path(db_path)
        self.model = model
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.initialize()

    def connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def initialize(self):
        with self.connect() as c:
            c.executescript("""
            CREATE TABLE IF NOT EXISTS assets (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, zone TEXT NOT NULL,
                manufacturer TEXT NOT NULL, hours REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL,
                asset_id TEXT NOT NULL REFERENCES assets(id), temperature REAL NOT NULL,
                vibration REAL NOT NULL, current REAL NOT NULL, pressure REAL NOT NULL,
                rpm REAL NOT NULL, hours REAL NOT NULL, source TEXT NOT NULL, risk REAL NOT NULL);
            CREATE INDEX IF NOT EXISTS idx_readings_asset_ts ON readings(asset_id, timestamp DESC);
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT, asset_id TEXT NOT NULL REFERENCES assets(id),
                created_at TEXT NOT NULL, severity TEXT NOT NULL, title TEXT NOT NULL,
                description TEXT NOT NULL, risk REAL NOT NULL, acknowledged INTEGER NOT NULL DEFAULT 0);
            CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(acknowledged,created_at DESC);
            """)
            n = c.execute("SELECT COUNT(*) FROM assets").fetchone()[0]
            if n == 0:
                self.seed(c)

    def seed(self, c):
        c.executemany("INSERT INTO assets VALUES (:id,:name,:type,:zone,:manufacturer,:hours)",
                      [{k:v for k,v in a.items() if k!="profile"} for a in ASSETS])
        samples = telemetry_samples()
        matrix = np.asarray([[r[k] for k in FEATURES] for r in samples], dtype=np.float32)
        risks = self.model.predict_proba(matrix)[:, 1]
        records = [(*[r[x] for x in FIELDS[:-1]],round(float(risk),4)) for r,risk in zip(samples,risks)]
        c.executemany("INSERT INTO readings(timestamp,asset_id,temperature,vibration,current,pressure,rpm,hours,source,risk) VALUES (?,?,?,?,?,?,?,?,?,?)", records)
        for a in ASSETS:
            if a["profile"] == "healthy":
                continue
            r = c.execute("SELECT * FROM readings WHERE asset_id=? ORDER BY id DESC LIMIT 1", (a["id"],)).fetchone()
            severity = "critical" if a["profile"] == "critical" else "warning"
            title = ("Vibración fuera de rango" if severity=="critical" else "Degradación de condición detectada")
            desc = (f"{a['name']}: vibración {r['vibration']:.2f} mm/s, temperatura {r['temperature']:.1f} °C. Revisión recomendada.")
            c.execute("INSERT INTO alerts(asset_id,created_at,severity,title,description,risk) VALUES(?,?,?,?,?,?)",
                      (a["id"],r["timestamp"],severity,title,desc,r["risk"]))

    def query(self, sql, params=()):
        with self.connect() as c:
            return [dict(r) for r in c.execute(sql,params).fetchall()]

    def assets(self):
        return self.query("""
            SELECT a.*, r.timestamp, r.temperature, r.vibration, r.current, r.pressure,
                   r.rpm, r.risk, r.source, ROUND(a.hours/24.0,0) AS days_in_service
            FROM assets a JOIN readings r ON r.id=(SELECT rr.id FROM readings rr WHERE rr.asset_id=a.id ORDER BY rr.id DESC LIMIT 1)
            ORDER BY CASE WHEN r.risk >= .72 THEN 0 WHEN r.risk >= .08 THEN 1 ELSE 2 END, r.risk DESC
        """)

    def asset(self, asset_id):
        return next((a for a in self.assets() if a["id"]==asset_id), None)

    def timeline(self, asset_id, limit=96):
        return list(reversed(self.query("SELECT * FROM readings WHERE asset_id=? ORDER BY id DESC LIMIT ?",(asset_id,limit))))

    def alerts(self):
        return self.query("SELECT al.*, a.name AS asset_name, a.zone FROM alerts al JOIN assets a ON a.id=al.asset_id ORDER BY al.acknowledged ASC, al.created_at DESC, al.id DESC")

    def acknowledge(self, alert_id):
        with self.connect() as c:
            changed=c.execute("UPDATE alerts SET acknowledged=1 WHERE id=?",(alert_id,)).rowcount
            return bool(changed)

    def append(self, sample):
        risk = risk_score(self.model, sample)
        with self.connect() as c:
            c.execute("INSERT INTO readings(timestamp,asset_id,temperature,vibration,current,pressure,rpm,hours,source,risk) VALUES (?,?,?,?,?,?,?,?,?,?)",
                      (*[sample[k] for k in FIELDS[:-1]],risk))
            severity = "critical" if risk >= .72 else "warning" if risk >= .08 else "healthy"
            if severity != "healthy":
                sensor = max((("Vibración",sample["vibration"]/4), ("Temperatura",sample["temperature"]/80), ("Corriente",sample["current"]/30)), key=lambda x:x[1])[0]
                c.execute("INSERT INTO alerts(asset_id,created_at,severity,title,description,risk) VALUES (?,?,?,?,?,?)",
                          (sample["asset_id"],sample["timestamp"],severity, f"{sensor}: nueva lectura anómala",
                           f"Registro del simulador; riesgo estimado {risk*100:.1f}%. Verificar condición del equipo.",risk))
        return {**sample,"risk":risk,"status":severity}

    def reset(self):
        with self.connect() as c:
            c.execute("DELETE FROM alerts")
            c.execute("DELETE FROM readings")
            c.execute("DELETE FROM assets")
            self.seed(c)

    def stats(self):
        count = self.query("SELECT COUNT(*) AS total FROM readings")[0]["total"]
        return {"total_readings":count,"assets":len(ASSETS),"sources":2,"sampling":"15 min","retention":"24 h demo"}

    def last_readings(self,limit=10000):
        return self.query("SELECT timestamp,asset_id,temperature,vibration,current,pressure,rpm,hours,source,risk FROM readings ORDER BY id DESC LIMIT ?",(limit,))
