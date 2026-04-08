#!/usr/bin/env python3
"""
ChileSoccerDB API
─────────────────
FastAPI REST API para datos de fútbol chileno y europeo.
VibeCodingChile · 2026

Deploy: Railway / Render / Fly.io (gratis)
Docs:   /docs  (Swagger UI automático)

Instalar:
    pip install fastapi uvicorn pandas python-multipart

Correr local:
    uvicorn api:app --reload --port 8000

Correr en Termux:
    uvicorn api:app --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional, List
from datetime import datetime
import pandas as pd
import json
import os

# ─── APP ────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="ChileSoccerDB API",
    description="""
## ⚽ ChileSoccerDB — Football Analytics API

El primer dataset público de rendimiento de jugadores del **Campeonato Nacional de Chile**,
combinado con datos de la **Premier League**, **Big 5 europeas** y **FIFA World Cup**.

### Endpoints disponibles
- `/players` — Jugadores con filtros por posición, club, liga
- `/players/{name}` — Perfil completo de un jugador
- `/players/{name}/prime` — Detección de prime histórico
- `/teams` — Estadísticas por equipo
- `/matches` — Partidos con resultados
- `/shots` — Tiros con xG
- `/leaderboard` — Rankings por métrica
- `/search` — Búsqueda de jugadores

### Fuentes de datos
- Campeonato Nacional Chile (scraper propio)
- Premier League 2020 (571 jugadores)
- FIFA World Cup 1930–2018 (7.663 jugadores)
- Big 5 europeas via FBref (próximamente)

### Planes
| Tier | Requests/día | Precio |
|------|-------------|--------|
| Free | 100 | Gratis |
| Club | Ilimitado + histórico | $150 USD/mes |
| API  | Ilimitado + webhooks | $50 USD/mes |

**VibeCodingChile** · contacto@vibecodingchile.cl
    """,
    version="1.0.0",
    contact={
        "name": "VibeCodingChile",
        "email": "contacto@vibecodingchile.cl",
        "url": "https://vibecodingchile.cl",
    },
    license_info={"name": "MIT"},
)

# ─── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── DATA LOADER ─────────────────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

def load_csv(filename: str) -> pd.DataFrame:
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return pd.DataFrame()
    return pd.read_csv(path)

def load_json(filename: str) -> list:
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return json.load(f)

# ─── CACHE simple en memoria ──────────────────────────────────────────────────
_cache = {}

def get_players_df() -> pd.DataFrame:
    if "players" not in _cache:
        df = load_csv("campeonato_nacional_2024_shots.csv")
        epl_path = os.path.join(DATA_DIR, "epl_players.json")
        if os.path.exists(epl_path):
            with open(epl_path) as f:
                epl = json.load(f)
            _cache["epl"] = pd.DataFrame(epl)
        _cache["players"] = df
    return _cache.get("epl", pd.DataFrame())

def get_matches_df() -> pd.DataFrame:
    if "matches" not in _cache:
        _cache["matches"] = load_csv("campeonato_nacional_2024_matches.csv")
    return _cache["matches"]

def get_shots_df() -> pd.DataFrame:
    if "shots" not in _cache:
        _cache["shots"] = load_csv("campeonato_nacional_2024_shots.csv")
    return _cache["shots"]

# ─── HELPERS ─────────────────────────────────────────────────────────────────
def df_to_records(df: pd.DataFrame, limit: int = 100, offset: int = 0) -> list:
    if df.empty:
        return []
    return df.iloc[offset:offset+limit].fillna(0).to_dict("records")

def paginate(data: list, limit: int, offset: int) -> dict:
    total = len(data)
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "data": data[offset:offset+limit],
    }

# ─── ROUTES ──────────────────────────────────────────────────────────────────

@app.get("/", tags=["Info"])
def root():
    return {
        "name": "ChileSoccerDB API",
        "version": "1.0.0",
        "status": "online",
        "docs": "/docs",
        "by": "VibeCodingChile",
        "datasets": {
            "campeonato_nacional": "2024",
            "premier_league": "2020 (571 players)",
            "world_cup": "1930-2018 (7663 players)",
            "big5_european": "coming soon",
        },
        "timestamp": datetime.utcnow().isoformat(),
    }

@app.get("/health", tags=["Info"])
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# ── PLAYERS ──────────────────────────────────────────────────────────────────

@app.get("/players", tags=["Players"], summary="Lista de jugadores con filtros")
def get_players(
    pos:         Optional[str] = Query(None, description="Posición: Forward, Midfielder, Defender, Goalkeeper"),
    club:        Optional[str] = Query(None, description="Club del jugador"),
    nationality: Optional[str] = Query(None, description="Nacionalidad"),
    min_apps:    int           = Query(0,    description="Mínimo de apariciones"),
    min_goals:   int           = Query(0,    description="Mínimo de goles"),
    sort_by:     str           = Query("xG_per_app", description="Campo para ordenar"),
    order:       str           = Query("desc", description="asc | desc"),
    limit:       int           = Query(20,   le=100, description="Resultados por página"),
    offset:      int           = Query(0,    description="Offset para paginación"),
):
    df = get_players_df()
    if df.empty:
        return paginate([], limit, offset)

    if pos:
        df = df[df["pos"].str.lower() == pos.lower()]
    if club:
        df = df[df["club"].str.lower().str.contains(club.lower())]
    if nationality:
        df = df[df["nationality"].str.lower().str.contains(nationality.lower())]
    if min_apps:
        df = df[df["apps"] >= min_apps]
    if min_goals:
        df = df[df["goals"] >= min_goals]

    if sort_by in df.columns:
        df = df.sort_values(sort_by, ascending=(order == "asc"))

    records = df_to_records(df, limit=1000, offset=0)
    return paginate(records, limit, offset)


@app.get("/players/{name}", tags=["Players"], summary="Perfil completo de un jugador")
def get_player(name: str):
    df = get_players_df()
    if df.empty:
        raise HTTPException(404, "Dataset no cargado")

    match = df[df["name"].str.lower().str.contains(name.lower())]
    if match.empty:
        raise HTTPException(404, f"Jugador '{name}' no encontrado")

    player = match.iloc[0].fillna(0).to_dict()

    # Enrich with computed fields
    apps = max(player.get("apps", 1), 1)
    player["computed"] = {
        "win_rate_pct":      round(player.get("wins", 0) / apps * 100, 1),
        "goals_per_90":      round(player.get("goals", 0) / apps * 90, 2),
        "assists_per_90":    round(player.get("assists", 0) / apps * 90, 2),
        "xG_per_90":         round(player.get("xG_per_app", 0) * 90, 3),
        "conversion_pct":    round(player.get("conversion", 0) * 100, 1),
        "shoot_accuracy_pct":player.get("shoot_acc", 0),
        "has_wc_data":       player.get("wc_editions", 0) > 0,
    }
    return player


@app.get("/players/{name}/prime", tags=["Players"], summary="Detección de prime histórico")
def get_player_prime(name: str):
    df = get_players_df()
    if df.empty:
        raise HTTPException(404, "Dataset no cargado")

    match = df[df["name"].str.lower().str.contains(name.lower())]
    if match.empty:
        raise HTTPException(404, f"Jugador '{name}' no encontrado")

    p = match.iloc[0].fillna(0).to_dict()
    age = int(p.get("age", 27))
    apps = int(p.get("apps", 1))
    debut_year = 2020 - round(apps / 30)
    peak_year = debut_year + round((2020 - debut_year) * 0.65)

    return {
        "player": p["name"],
        "club": p.get("club"),
        "pos": p.get("pos"),
        "age_2020": age,
        "debut_estimated": debut_year,
        "prime_year_estimated": peak_year,
        "prime_age": peak_year - (2020 - age),
        "peak_xG_per_app": p.get("xG_per_app"),
        "peak_goals": p.get("goals"),
        "years_from_prime": 2025 - peak_year,
        "phase": (
            "Formativo" if age < 20 else
            "Emergente" if age < 23 else
            "Prime"     if age < 28 else
            "Maduro"    if age < 32 else
            "Crepuscular"
        ),
        "scout_note": (
            f"Jugador en prime actual. xG/app: {p.get('xG_per_app')}." if abs(2025 - peak_year) <= 1
            else f"Peak estimado en {peak_year}. {2025 - peak_year} años post-prime."
        ),
    }


@app.get("/players/{name}/compare/{name2}", tags=["Players"], summary="Comparar dos jugadores")
def compare_players(name: str, name2: str):
    df = get_players_df()
    if df.empty:
        raise HTTPException(404, "Dataset no cargado")

    m1 = df[df["name"].str.lower().str.contains(name.lower())]
    m2 = df[df["name"].str.lower().str.contains(name2.lower())]

    if m1.empty: raise HTTPException(404, f"Jugador '{name}' no encontrado")
    if m2.empty: raise HTTPException(404, f"Jugador '{name2}' no encontrado")

    p1 = m1.iloc[0].fillna(0).to_dict()
    p2 = m2.iloc[0].fillna(0).to_dict()

    metrics = ["apps","goals","assists","xG_per_app","goals_per_app",
               "shoot_acc","conversion","tackles","interceptions","saves"]

    comparison = {}
    for m in metrics:
        v1, v2 = float(p1.get(m, 0)), float(p2.get(m, 0))
        comparison[m] = {
            p1["name"]: v1,
            p2["name"]: v2,
            "winner": p1["name"] if v1 >= v2 else p2["name"],
            "diff": round(abs(v1 - v2), 3),
        }

    return {
        "player_a": p1["name"],
        "player_b": p2["name"],
        "comparison": comparison,
        "overall_winner": max(
            [p1["name"], p2["name"]],
            key=lambda n: sum(
                1 for m in metrics
                if float(p1.get(m, 0) if n == p1["name"] else p2.get(m, 0)) >=
                   float(p2.get(m, 0) if n == p1["name"] else p1.get(m, 0))
            )
        ),
    }


# ── LEADERBOARD ───────────────────────────────────────────────────────────────

@app.get("/leaderboard", tags=["Leaderboard"], summary="Rankings por métrica")
def leaderboard(
    metric:   str = Query("xG_per_app", description="xG_per_app | goals | assists | conversion | saves | tackles"),
    pos:      Optional[str] = Query(None, description="Filtrar por posición"),
    min_apps: int = Query(5, description="Mínimo partidos jugados"),
    top:      int = Query(10, le=50, description="Top N jugadores"),
):
    df = get_players_df()
    if df.empty:
        return {"leaderboard": [], "metric": metric}

    if metric not in df.columns:
        raise HTTPException(400, f"Métrica '{metric}' no válida. Usa: {list(df.select_dtypes('number').columns[:10])}")

    if pos:
        df = df[df["pos"].str.lower() == pos.lower()]
    df = df[df["apps"] >= min_apps]
    df = df.sort_values(metric, ascending=False).head(top)

    return {
        "metric": metric,
        "pos_filter": pos,
        "min_apps": min_apps,
        "leaderboard": [
            {
                "rank": i + 1,
                "name": row["name"],
                "club": row.get("club", ""),
                "pos": row.get("pos", ""),
                "nationality": row.get("nationality", ""),
                "apps": int(row.get("apps", 0)),
                "value": round(float(row.get(metric, 0)), 3),
            }
            for i, (_, row) in enumerate(df.iterrows())
        ],
    }


# ── MATCHES ──────────────────────────────────────────────────────────────────

@app.get("/matches", tags=["Matches"], summary="Partidos del Campeonato Nacional")
def get_matches(
    team:   Optional[str] = Query(None, description="Filtrar por equipo"),
    season: Optional[int] = Query(None, description="Temporada (ej: 2024)"),
    limit:  int = Query(20, le=100),
    offset: int = Query(0),
):
    df = get_matches_df()
    if df.empty:
        return paginate([], limit, offset)

    if team:
        mask = (df["home_team"].str.lower().str.contains(team.lower()) |
                df["away_team"].str.lower().str.contains(team.lower()))
        df = df[mask]
    if season:
        df = df[df["season"] == season]

    df = df.sort_values("date", ascending=False) if "date" in df.columns else df
    return paginate(df_to_records(df, limit=1000, offset=0), limit, offset)


# ── SHOTS / xG ───────────────────────────────────────────────────────────────

@app.get("/shots", tags=["xG & Shots"], summary="Tiros con datos xG")
def get_shots(
    team:      Optional[str] = Query(None),
    situation: Optional[str] = Query(None, description="open_play | corner | free_kick | penalty"),
    outcome:   Optional[str] = Query(None, description="goal | saved | blocked | off_target"),
    min_xg:    float = Query(0.0, description="xG mínimo del tiro"),
    limit:     int   = Query(20, le=100),
    offset:    int   = Query(0),
):
    df = get_shots_df()
    if df.empty:
        return paginate([], limit, offset)

    if team:
        df = df[df["team"].str.lower().str.contains(team.lower())]
    if situation:
        df = df[df["situation"] == situation]
    if outcome:
        df = df[df["outcome"] == outcome]
    if min_xg and "xg_model" in df.columns:
        df = df[df["xg_model"] >= min_xg]

    return paginate(df_to_records(df, limit=1000, offset=0), limit, offset)


@app.get("/shots/stats", tags=["xG & Shots"], summary="Estadísticas agregadas de tiros")
def shots_stats():
    df = get_shots_df()
    if df.empty:
        return {}

    return {
        "total_shots": len(df),
        "total_goals": int(df["is_goal"].sum()) if "is_goal" in df.columns else 0,
        "conversion_rate_pct": round(df["is_goal"].mean() * 100, 2) if "is_goal" in df.columns else 0,
        "by_situation": df.groupby("situation").agg(
            shots=("shot_id", "count"),
            goals=("is_goal", "sum"),
        ).assign(conv_pct=lambda x: (x["goals"] / x["shots"] * 100).round(1)).to_dict("index")
        if "situation" in df.columns else {},
        "by_body_part": df.groupby("body_part").agg(
            shots=("shot_id", "count"),
            goals=("is_goal", "sum"),
        ).to_dict("index") if "body_part" in df.columns else {},
        "avg_xg": round(float(df["xg_model"].mean()), 4) if "xg_model" in df.columns else 0,
    }


# ── SEARCH ───────────────────────────────────────────────────────────────────

@app.get("/search", tags=["Search"], summary="Búsqueda global de jugadores")
def search(
    q:     str = Query(..., min_length=2, description="Nombre o club a buscar"),
    limit: int = Query(10, le=30),
):
    df = get_players_df()
    if df.empty:
        return {"results": [], "query": q}

    mask = (
        df["name"].str.lower().str.contains(q.lower(), na=False) |
        df["club"].str.lower().str.contains(q.lower(), na=False) |
        df["nationality"].str.lower().str.contains(q.lower(), na=False)
    )
    results = df[mask].head(limit).fillna(0).to_dict("records")
    return {"query": q, "total": len(results), "results": results}


# ── DATASETS INFO ─────────────────────────────────────────────────────────────

@app.get("/datasets", tags=["Info"], summary="Info de los datasets cargados")
def datasets_info():
    epl_df    = get_players_df()
    matches_df = get_matches_df()
    shots_df   = get_shots_df()

    return {
        "epl_players": {
            "rows": len(epl_df),
            "columns": list(epl_df.columns) if not epl_df.empty else [],
            "source": "Premier League 2020",
        },
        "matches": {
            "rows": len(matches_df),
            "source": "Campeonato Nacional Chile 2024",
            "teams": matches_df["home_team"].nunique() if "home_team" in matches_df.columns else 0,
        },
        "shots": {
            "rows": len(shots_df),
            "source": "Campeonato Nacional Chile 2024",
            "goals": int(shots_df["is_goal"].sum()) if "is_goal" in shots_df.columns else 0,
        },
        "pending": [
            "Big 5 European Leagues 2024-25 (FBref)",
            "FIFA World Cup extended (Kaggle)",
            "Transfermarkt Chile players",
            "LaLiga / Bundesliga / Serie A",
        ],
    }


# ─── RUN ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
