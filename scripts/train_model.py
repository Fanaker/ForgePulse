"""Run from repository root: python scripts/train_model.py"""
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"src"))
from forgepulse.modeling import train_model
root = Path(__file__).resolve().parents[1]
_, data = train_model(root/"model"/"plant_risk_model.joblib", root/"model"/"model_card.json")
print("Modelo entrenado (datos sintéticos):", data["algorithm"], "| F1:", data["f1"], "| AUC:", data["auc"])
