"""Builds local model and database; python scripts/bootstrap.py"""
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"src"))
from forgepulse.modeling import load_model
from forgepulse.storage import Store
root=Path(__file__).resolve().parents[1]
model,meta=load_model(root)
store=Store(root/"data"/"forgepulse.sqlite3",model)
print("ForgePulse v1.0: modelo listo (F1 sintético",meta["f1"],")")
print("Lecturas locales:",store.stats()["total_readings"])
