"""HTTP API and local UI; all telemetry and predictions use synthetic data."""
from __future__ import annotations
import csv
import io
import os
from contextlib import asynccontextmanager
from pathlib import Path
from statistics import mean
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from forgepulse.modeling import load_model
from forgepulse.storage import Store
from forgepulse.simulator import scenario_reading

ROOT = Path(__file__).resolve().parents[2]
STATUS_THRESHOLD = {"critical": .72, "warning": .08}

def classify(risk):
    return "critical" if risk >= .72 else "warning" if risk >= .08 else "healthy"

class SimulationRequest(BaseModel):
    asset_id: str
    scenario: str


def create_app(data_dir: str | Path | None = None):
    data_dir = Path(data_dir or os.environ.get("FORGEPULSE_DATA_DIR",ROOT/"data"))

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        model, metadata = load_model(ROOT)
        app.state.model = model
        app.state.metadata = metadata
        app.state.store = Store(data_dir/"forgepulse.sqlite3",model)
        yield

    app = FastAPI(title="ForgePulse Industrial Intelligence", version="1.0.0", lifespan=lifespan,
                  description="Offline industrial IoT / predictive maintenance educational demo. All data are simulated.")

    def db():
        return app.state.store

    @app.get("/api/health")
    def health():
        return {"status":"ok","version":"1.0.0","mode":"synthetic-demo"}

    @app.get("/api/overview")
    def overview():
        assets = db().assets()
        for a in assets:
            a["status"] = classify(a["risk"])
        alert_list = db().alerts()
        unack = [a for a in alert_list if not a["acknowledged"]]
        summary = {
            "assets_total":len(assets),
            "healthy":sum(a["status"]=="healthy" for a in assets),
            "warning":sum(a["status"]=="warning" for a in assets),
            "critical":sum(a["status"]=="critical" for a in assets),
            "open_alerts":len(unack),
            "avg_health":round(100-mean(a["risk"]*100 for a in assets),1),
            "readings":db().stats()["total_readings"],
        }
        # Twenty-four hourly mean probabilities across all assets.
        history = db().query("""
            SELECT SUBSTR(timestamp,1,13) AS bucket, ROUND(AVG(risk)*100,2) AS risk,
             ROUND(AVG(temperature),2) AS temperature, COUNT(*) AS readings
            FROM readings WHERE source='simulator' GROUP BY bucket ORDER BY bucket
        """)
        return {"summary":summary,"assets":assets,"alerts":unack[:6],"history":history,"zones":zone_summary(assets)}

    def zone_summary(assets):
        return [{"name":z,"count":len(items),"max_risk":round(max(x["risk"] for x in items),4),
                 "health":round(100-mean(x["risk"]*100 for x in items),1)}
                for z in sorted(set(a["zone"] for a in assets))
                for items in [[a for a in assets if a["zone"]==z]]]

    @app.get("/api/assets")
    def assets():
        return [{**a,"status":classify(a["risk"])} for a in db().assets()]

    @app.get("/api/assets/{asset_id}")
    def asset_detail(asset_id: str):
        asset=db().asset(asset_id)
        if not asset:
            raise HTTPException(404, "Activo inexistente")
        return {"asset":{**asset,"status":classify(asset["risk"])},"readings":db().timeline(asset_id),
                "alerts":[a for a in db().alerts() if a["asset_id"]==asset_id][:12]}

    @app.get("/api/alerts")
    def alerts():
        return db().alerts()

    @app.post("/api/alerts/{alert_id}/acknowledge")
    def acknowledge(alert_id: int):
        if not db().acknowledge(alert_id):
            raise HTTPException(404,"Alerta inexistente")
        return {"ok":True,"alert_id":alert_id}

    @app.post("/api/simulate")
    def simulate(request: SimulationRequest):
        if request.scenario not in ("normal","bearing","overheat","pressure"):
            raise HTTPException(422,"Escenario inválido")
        asset=db().asset(request.asset_id)
        if not asset:
            raise HTTPException(404,"Activo inexistente")
        sample=scenario_reading(asset,request.scenario,asset)
        return {"reading":db().append(sample),"message":"Nueva lectura almacenada. Las estimaciones son sintéticas."}

    @app.get("/api/model")
    def model_info():
        return app.state.metadata

    @app.get("/api/pipeline")
    def pipeline():
        readings=db().last_readings(10000)
        total=len(readings)
        return {"stats":db().stats(),"quality":{
             "null_values":sum(any(r[key] is None for key in ("temperature","vibration","current","pressure","rpm")) for r in readings),
             "invalid_units":sum(r["vibration"]<0 or r["rpm"]<0 for r in readings),
             "simulator_rows":sum(r["source"]=="simulator" for r in readings),
             "interactive_rows":sum(r["source"]=="interactive-simulator" for r in readings),
             "data_completeness":100.0 if total else 0.0,
             "validated":total,
          },"schema":[
            {"field":"timestamp","type":"ISO 8601 UTC","description":"Instante de lectura"},
            {"field":"asset_id","type":"TEXT","description":"Identificador del activo"},
            {"field":"temperature","type":"FLOAT · °C","description":"Temperatura"},
            {"field":"vibration","type":"FLOAT · mm/s","description":"Vibración RMS simulada"},
            {"field":"current","type":"FLOAT · A","description":"Corriente eléctrica"},
            {"field":"pressure","type":"FLOAT · bar","description":"Presión de línea virtual"},
            {"field":"rpm","type":"FLOAT","description":"Velocidad de giro"},
            {"field":"risk","type":"FLOAT · 0–1","description":"Probabilidad estimada por el modelo"},
          ]}

    @app.get("/api/export.csv")
    def export_csv():
        out=io.StringIO(newline="")
        rows=db().last_readings()
        fields=["timestamp","asset_id","temperature","vibration","current","pressure","rpm","hours","source","risk"]
        writer=csv.DictWriter(out,fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
        return Response(out.getvalue(),media_type="text/csv",headers={"Content-Disposition":"attachment; filename=forgepulse_telemetry.csv"})

    @app.post("/api/demo/reset")
    def reset_demo():
        db().reset()
        return {"ok":True,"message":"Datos sintéticos restaurados"}

    static = ROOT/"web"
    @app.get("/")
    def index():
        return FileResponse(static/"index.html")
    app.mount("/static",StaticFiles(directory=str(static)),name="static")
    return app

app=create_app()
