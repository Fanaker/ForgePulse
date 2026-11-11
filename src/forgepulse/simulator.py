"""Synthetic IoT historian with deterministic equipment condition profiles."""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
import numpy as np

ASSETS = [
    {"id":"P-101","name":"Bomba de alimentación 01","type":"Bomba centrífuga","zone":"Procesamiento","manufacturer":"Flowtech PX-400","hours":4320,"profile":"healthy"},
    {"id":"P-102","name":"Bomba de alimentación 02","type":"Bomba centrífuga","zone":"Procesamiento","manufacturer":"Flowtech PX-400","hours":8930,"profile":"warning"},
    {"id":"C-201","name":"Compresor principal","type":"Compresor","zone":"Compresión","manufacturer":"Atlas R-800","hours":11780,"profile":"critical"},
    {"id":"C-202","name":"Compresor auxiliar","type":"Compresor","zone":"Compresión","manufacturer":"Atlas R-600","hours":6800,"profile":"healthy"},
    {"id":"M-301","name":"Motor de línea A","type":"Motor trifásico","zone":"Envasado","manufacturer":"Siemax M-180","hours":4940,"profile":"healthy"},
    {"id":"M-302","name":"Motor de línea B","type":"Motor trifásico","zone":"Envasado","manufacturer":"Siemax M-180","hours":12420,"profile":"critical"},
    {"id":"M-303","name":"Motor de línea C","type":"Motor trifásico","zone":"Envasado","manufacturer":"Siemax M-160","hours":3310,"profile":"healthy"},
    {"id":"F-401","name":"Ventilador de extracción","type":"Ventilación","zone":"Servicios","manufacturer":"Ventec AX-70","hours":10220,"profile":"warning"},
    {"id":"P-103","name":"Bomba de retorno","type":"Bomba centrífuga","zone":"Procesamiento","manufacturer":"Flowtech PX-250","hours":6780,"profile":"healthy"},
    {"id":"F-402","name":"Ventilador de respaldo","type":"Ventilación","zone":"Servicios","manufacturer":"Ventec AX-60","hours":2610,"profile":"healthy"},
]


def telemetry_samples(now=None):
    """10 assets * 96 quarter-hour samples; dates are generated at initialization."""
    now = (now or datetime.now(timezone.utc)).replace(second=0, microsecond=0)
    rng = np.random.default_rng(5521)
    result = []
    for asset in ASSETS:
        for index in range(96):
            minute = 95 - index
            t = now - timedelta(minutes=15 * minute)
            cyclic = np.sin(index / 11 + ASSETS.index(asset) * 0.6)
            warming = max(0, (index - 59) / 36)
            unhealthy = asset["profile"]
            temp = 61.5 + 3.2 * cyclic + rng.normal(0, 1.3)
            vib = 1.95 + 0.35 * cyclic + rng.normal(0, 0.24)
            curr = 21.8 + 1.1 * cyclic + rng.normal(0, 0.75)
            pres = 4.8 + 0.15 * cyclic + rng.normal(0, 0.10)
            rpm = 1540 + 25 * cyclic + rng.normal(0, 10)
            if unhealthy == "warning":
                temp += 13 * warming + 8
                vib += 2.8 * warming + 0.85
                curr += 6 * warming
                pres -= 0.7 * warming
            if unhealthy == "critical":
                temp += 25 * warming + 13
                vib += 4.9 * warming + 1.8
                curr += 13 * warming + 3
                pres -= 1.7 * warming + 0.3
            # Every asset uses a virtual line-pressure channel for comparability.
            result.append({"asset_id": asset["id"], "timestamp": t.isoformat(), "temperature": round(max(20,temp),2),
               "vibration": round(max(0.1,vib),2), "current": round(max(0.1,curr),2), "pressure": round(max(0.2,pres),2),
               "rpm": round(max(100,rpm),1), "hours": round(asset["hours"] + index / 4,1), "source": "simulator"})
    return result


def scenario_reading(asset, scenario, latest):
    import random
    randomizer = random.Random(f"{asset['id']}:{scenario}:{latest['timestamp']}")
    row = {k: float(latest[k]) for k in ["temperature","vibration","current","pressure","rpm","hours"]}
    if scenario == "normal":
        row.update(temperature=63.5, vibration=1.75, current=21.5, pressure=4.8, rpm=1540)
    elif scenario == "bearing":
        row.update(temperature=92.4, vibration=8.3, current=39.8, pressure=3.2, rpm=1450)
    elif scenario == "overheat":
        row.update(temperature=106.2, vibration=5.4, current=43.6, pressure=3.6, rpm=1480)
    elif scenario == "pressure":
        row.update(temperature=85.7, vibration=5.8, current=37.4, pressure=1.25, rpm=1410)
    else:
        raise ValueError("Escenario no reconocido")
    row["temperature"] += randomizer.uniform(-0.6,0.6)
    row["vibration"] += randomizer.uniform(-0.12,0.12)
    row["hours"] += 0.25
    return {"asset_id": asset["id"], "timestamp": datetime.now(timezone.utc).isoformat(), **{k:round(v, 2) for k,v in row.items()}, "source":"interactive-simulator"}
