#!/usr/bin/env python3
"""
VibeCodingChile Football Intelligence System
Author: Matias Rojas Faundez
Year: 2026

All rights reserved.
Unauthorized use, replication, or distribution is prohibited.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data" / "processed"
MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "xg_model.joblib"
FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"

app = FastAPI(
    title="VibeCodingChile Football Intelligence API",
    version="3.0.0",
    description="API y frontend listos para deploy. Construido por VibeCodingChile · Matias Rojas Faundez.",
    contact={"name": "VibeCodingChile", "email": "contacto@vibecodingchile.cl"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def brand_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Powered-By"] = "VibeCodingChile"
    response.headers["X-Author"] = "Matias Rojas Faundez"
    response.headers["X-Project"] = "Football Intelligence System"
    return response


def _read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path) if path.exists() else pd.DataFrame()


def get_players_df() -> pd.DataFrame:
    return _read_csv(DATA_DIR / "players_unified.csv")


def get_shots_df() -> pd.DataFrame:
    return _read_csv(DATA_DIR / "shots_unified.csv")


def get_model():
    if MODEL_PATH.exists():
        try:
            return joblib.load(MODEL_PATH)
        except Exception:
            return None
    return None


def heuristic_xg(x: float, y: float, is_header: int, situation: str) -> float:
    goal_x, goal_y = 120.0, 40.0
    distance = float(np.sqrt((goal_x - x) ** 2 + (goal_y - y) ** 2))
    dx = max(goal_x - x, 0.1)
    left_post_y, right_post_y = 36.0, 44.0
    a1 = np.arctan2(left_post_y - y, dx)
    a2 = np.arctan2(right_post_y - y, dx)
    angle = abs(a2 - a1)
    logit = -1.2 - 0.06 * distance + 2.6 * angle
    if is_header:
        logit -= 0.25
    if situation == "penalty":
        logit += 2.2
    elif situation == "corner":
        logit -= 0.2
    elif situation == "free_kick":
        logit -= 0.15
    return float(1 / (1 + np.exp(-logit)))


@app.get("/api")
def api_root():
    return {
        "name": "VibeCodingChile Football Intelligence API",
        "author": "Matias Rojas Faundez",
        "status": "online",
        "docs": "/docs",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "brand": "VibeCodingChile",
        "author": "Matias Rojas Faundez",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/datasets")
def datasets():
    players = get_players_df()
    shots = get_shots_df()
    metrics_path = MODEL_DIR / "xg_model_metrics.json"
    metrics = metrics_path.read_text(encoding="utf-8") if metrics_path.exists() else None
    return {
        "brand": "VibeCodingChile",
        "author": "Matias Rojas Faundez",
        "players_rows": int(len(players)),
        "shots_rows": int(len(shots)),
        "players_columns": list(players.columns),
        "shots_columns": list(shots.columns),
        "model_metrics": metrics,
    }


@app.get("/api/overview")
def overview():
    players = get_players_df()
    shots = get_shots_df()
    top_clubs = []
    leaderboard = []
    if not players.empty:
        top_clubs = (
            players.groupby("club")["goals"].sum().sort_values(ascending=False).head(10).reset_index().rename(columns={"goals": "value"}).to_dict("records")
        )
        leaderboard = (
            players.sort_values("goal_involvements", ascending=False).head(10)[["name", "club", "pos", "goal_involvements"]].rename(columns={"goal_involvements": "value"}).to_dict("records")
        )
    shot_map = []
    if not shots.empty:
        shot_map = shots[["x", "y", "is_goal", "xg_model", "team", "player"]].head(250).to_dict("records")
    return {
        "summary": {
            "players": int(len(players)),
            "shots": int(len(shots)),
            "goals": int(shots["is_goal"].sum()) if not shots.empty else 0,
            "avg_xg": round(float(shots["xg_model"].mean()), 4) if not shots.empty else 0,
        },
        "top_clubs": top_clubs,
        "leaderboard": leaderboard,
        "shot_map": shot_map,
    }


@app.get("/api/players")
def players(
    club: Optional[str] = Query(None),
    position: Optional[str] = Query(None),
    nationality: Optional[str] = Query(None),
    min_apps: int = Query(0, ge=0),
    sort_by: str = Query("goal_involvements"),
    order: str = Query("desc"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    df = get_players_df()
    if df.empty:
        return {"total": 0, "data": []}
    if club:
        df = df[df["club"].fillna("").str.contains(club, case=False, na=False)]
    if position:
        df = df[df["pos"].fillna("").str.contains(position, case=False, na=False)]
    if nationality:
        df = df[df["nationality"].fillna("").str.contains(nationality, case=False, na=False)]
    df = df[df["apps"].fillna(0) >= min_apps]
    if sort_by in df.columns:
        df = df.sort_values(sort_by, ascending=(order == "asc"))
    total = int(len(df))
    data = df.iloc[offset:offset + limit].fillna(0).to_dict("records")
    return {"total": total, "limit": limit, "offset": offset, "data": data}


@app.get("/api/players/{name}")
def player_detail(name: str):
    df = get_players_df()
    if df.empty:
        raise HTTPException(status_code=404, detail="No hay dataset procesado")
    hit = df[df["name"].fillna("").str.contains(name, case=False, na=False)]
    if hit.empty:
        raise HTTPException(status_code=404, detail=f"Jugador '{name}' no encontrado")
    row = hit.iloc[0].fillna(0).to_dict()
    apps = max(float(row.get("apps", 0)), 1.0)
    row["computed"] = {
        "goals_per_app": round(float(row.get("goals", 0)) / apps, 3),
        "assists_per_app": round(float(row.get("assists", 0)) / apps, 3),
        "xg_per_app": round(float(row.get("xg_per_app", 0)), 3),
        "goal_involvements": round(float(row.get("goal_involvements", 0)), 1),
    }
    return row


@app.get("/api/leaderboard")
def leaderboard(
    metric: str = Query("goal_involvements"),
    top: int = Query(10, ge=1, le=50),
    position: Optional[str] = Query(None),
):
    df = get_players_df()
    if df.empty:
        return {"metric": metric, "leaderboard": []}
    if position:
        df = df[df["pos"].fillna("").str.contains(position, case=False, na=False)]
    if metric not in df.columns:
        raise HTTPException(status_code=400, detail=f"Métrica inválida: {metric}")
    df = df.sort_values(metric, ascending=False).head(top)
    data = []
    for i, (_, row) in enumerate(df.iterrows(), start=1):
        data.append({
            "rank": i,
            "name": row.get("name", ""),
            "club": row.get("club", ""),
            "pos": row.get("pos", ""),
            "value": float(row.get(metric, 0) or 0),
        })
    return {"metric": metric, "leaderboard": data}


@app.get("/api/shots")
def shots(
    team: Optional[str] = Query(None),
    situation: Optional[str] = Query(None),
    min_xg: float = Query(0.0, ge=0.0, le=1.0),
    limit: int = Query(100, ge=1, le=500),
):
    df = get_shots_df()
    if df.empty:
        return {"total": 0, "data": []}
    if team:
        df = df[df["team"].fillna("").str.contains(team, case=False, na=False)]
    if situation:
        df = df[df["situation"] == situation]
    df = df[df["xg_model"] >= min_xg]
    return {"total": int(len(df)), "data": df.head(limit).to_dict("records")}


@app.get("/api/shots/stats")
def shots_stats():
    df = get_shots_df()
    if df.empty:
        return {"total_shots": 0, "total_goals": 0, "conversion_rate_pct": 0, "by_situation": []}
    by_situation = (
        df.groupby("situation").agg(shots=("shot_id", "count"), goals=("is_goal", "sum"), avg_xg=("xg_model", "mean")).reset_index()
    )
    by_situation["conv_pct"] = (by_situation["goals"] / by_situation["shots"] * 100).round(1)
    return {
        "total_shots": int(len(df)),
        "total_goals": int(df["is_goal"].sum()),
        "conversion_rate_pct": round(float(df["is_goal"].mean() * 100), 2),
        "avg_xg": round(float(df["xg_model"].mean()), 4),
        "by_situation": by_situation.to_dict("records"),
    }


@app.get("/api/shots/predict")
def predict_xg(
    x: float = Query(..., ge=0, le=120),
    y: float = Query(..., ge=0, le=80),
    is_header: int = Query(0, ge=0, le=1),
    situation: str = Query("open_play"),
):
    situation = situation.lower()
    is_penalty = 1 if situation == "penalty" else 0
    is_corner = 1 if situation == "corner" else 0
    is_freekick = 1 if situation == "free_kick" else 0
    distance = float(np.sqrt((120 - x) ** 2 + (40 - y) ** 2))
    dx = max(120 - x, 0.1)
    angle = float(abs(np.arctan2(36 - y, dx) - np.arctan2(44 - y, dx)))
    model = get_model()
    if model is not None:
        arr = np.array([[x / 120.0, y / 80.0, distance, angle, is_header, is_penalty, is_freekick, is_corner]])
        pred = float(model.predict_proba(arr)[0][1])
        source = "trained_model"
    else:
        pred = heuristic_xg(x, y, is_header, situation)
        source = "heuristic_fallback"
    return {
        "xg": round(pred, 4),
        "model_source": source,
        "powered_by": "VibeCodingChile",
        "author": "Matias Rojas Faundez",
    }


if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str):
        requested = FRONTEND_DIST / full_path
        if full_path and requested.exists() and requested.is_file():
            return FileResponse(requested)
        return FileResponse(FRONTEND_DIST / "index.html")
