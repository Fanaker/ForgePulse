"""Deterministic synthetic condition classifier. Not validated on actual equipment."""
from __future__ import annotations
import json
from pathlib import Path
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split

FEATURES = ["temperature", "vibration", "current", "pressure", "rpm", "hours"]
LABELS = {"temperature": "Temperatura", "vibration": "Vibración", "current": "Corriente", "pressure": "Presión", "rpm": "RPM", "hours": "Horas de uso"}


def training_set(count: int = 9000, seed: int = 2026):
    rng = np.random.default_rng(seed)
    temp = rng.uniform(42, 108, count)
    vib = rng.uniform(0.7, 9.2, count)
    curr = rng.uniform(9, 48, count)
    pres = rng.uniform(1.0, 7.0, count)
    rpm = rng.uniform(980, 2200, count)
    hours = rng.uniform(300, 15000, count)
    # Synthetic engineering-inspired risk signal; no real-world calibration.
    risk = (0.24 * np.clip((temp - 71) / 35, 0, 1.5) +
            0.36 * np.clip((vib - 3.3) / 5.4, 0, 1.5) +
            0.14 * np.clip((curr - 29) / 20, 0, 1.5) +
            0.13 * np.clip((3.4 - pres) / 2.5, 0, 1.5) +
            0.05 * np.clip(abs(rpm - 1575) / 700, 0, 1.2) +
            0.08 * np.clip((hours - 8000) / 6500, 0, 1.2))
    # Non-deterministic effects from manufacturing noise, deterministic thanks to seed.
    labels = (risk + rng.normal(0, 0.045, count) > 0.37).astype(int)
    X = np.column_stack([temp, vib, curr, pres, rpm, hours]).astype(np.float32)
    return X, labels


def train_model(path: Path, meta_path: Path):
    X, y = training_set()
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)
    model = RandomForestClassifier(n_estimators=90, max_depth=13, min_samples_leaf=4, random_state=42, n_jobs=-1, class_weight="balanced")
    model.fit(X_train, y_train)
    prediction = model.predict(X_test)
    probability = model.predict_proba(X_test)[:, 1]
    cm = confusion_matrix(y_test, prediction).tolist()
    meta = {
        "algorithm": "RandomForestClassifier",
        "dataset": "Simulación sintética determinista",
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "accuracy": round(float(accuracy_score(y_test, prediction)), 4),
        "precision": round(float(precision_score(y_test, prediction, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, prediction, zero_division=0)), 4),
        "f1": round(float(f1_score(y_test, prediction, zero_division=0)), 4),
        "auc": round(float(roc_auc_score(y_test, probability)), 4),
        "confusion_matrix": cm,
        "features": [{"name": name, "label": LABELS[name], "importance": round(float(value), 4)} for name, value in sorted(zip(FEATURES, model.feature_importances_), key=lambda x: -x[1])],
        "caveat": "Entrenado y evaluado únicamente con datos sintéticos; no apto para decisiones de seguridad industrial.",
        "version": "synthetic-rf-v1",
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, path)
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    return model, meta


def load_model(repo_root: Path):
    path = repo_root / "model" / "plant_risk_model.joblib"
    metadata = repo_root / "model" / "model_card.json"
    if not path.exists() or not metadata.exists():
        return train_model(path, metadata)
    return joblib.load(path), json.loads(metadata.read_text(encoding="utf-8"))


def risk_score(model, row: dict) -> float:
    matrix = np.array([[row[name] for name in FEATURES]], dtype=np.float32)
    return round(float(model.predict_proba(matrix)[0, 1]), 4)
