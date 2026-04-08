#!/usr/bin/env python3
"""
VibeCodingChile Football Intelligence System
Author: Matias Rojas Faundez
Year: 2026

All rights reserved.
Unauthorized use, replication, or distribution is prohibited.
"""
from __future__ import annotations

from pathlib import Path
import joblib
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, brier_score_loss

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = BASE_DIR / "data" / "processed" / "shots_unified.csv"
MODEL_DIR = BASE_DIR / "models"
MODEL_DIR.mkdir(exist_ok=True)
MODEL_PATH = MODEL_DIR / "xg_model.joblib"
METRICS_PATH = MODEL_DIR / "xg_model_metrics.json"

FEATURES = ["x_norm", "y_norm", "distance", "angle", "is_header", "is_penalty", "is_freekick", "is_corner"]


def main() -> None:
    df = pd.read_csv(DATA_PATH)
    df["x_norm"] = df["x"] / 120.0
    df["y_norm"] = df["y"] / 80.0
    X = df[FEATURES]
    y = df["is_goal"]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    model = GradientBoostingClassifier(random_state=42)
    model.fit(X_train, y_train)
    preds = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, preds)
    brier = brier_score_loss(y_test, preds)
    joblib.dump(model, MODEL_PATH)
    METRICS_PATH.write_text(
        '{\n'
        f'  "roc_auc": {auc:.4f},\n'
        f'  "brier_score": {brier:.4f},\n'
        f'  "n_train": {len(X_train)},\n'
        f'  "n_test": {len(X_test)}\n'
        '}\n',
        encoding="utf-8",
    )
    print(f"[OK] model saved -> {MODEL_PATH}")
    print(f"[OK] roc_auc -> {auc:.4f}")
    print(f"[OK] brier_score -> {brier:.4f}")


if __name__ == "__main__":
    main()
