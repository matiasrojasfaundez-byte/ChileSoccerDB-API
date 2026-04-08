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
import math
import pandas as pd
import numpy as np

BASE_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = BASE_DIR / "data" / "raw"
PROCESSED_DIR = BASE_DIR / "data" / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


def safe_div(a: pd.Series, b: pd.Series) -> pd.Series:
    out = np.where(b.fillna(0) > 0, a.fillna(0) / b.replace(0, np.nan), 0)
    return pd.Series(np.nan_to_num(out), index=a.index)


def normalize_epl_players() -> pd.DataFrame:
    src = RAW_DIR / "epl" / "epl_players_2020.csv"
    df = pd.read_csv(src)
    rename_map = {
        "Name": "name",
        "Jersey Number": "jersey_number",
        "Club": "club",
        "Position": "pos",
        "Nationality": "nationality",
        "Age": "age",
        "Appearances": "apps",
        "Wins": "wins",
        "Losses": "losses",
        "Goals": "goals",
        "Goals per match": "goals_per_match",
        "Headed goals": "headed_goals",
        "Penalties scored": "penalties_scored",
        "Freekicks scored": "freekicks_scored",
        "Shots": "shots",
        "Shots on target": "shots_on_target",
        "Shooting accuracy %": "shoot_acc",
        "Big chances missed": "big_chances_missed",
        "Assists": "assists",
        "Passes": "passes",
        "Passes per match": "passes_per_match",
        "Big chances created": "big_chances_created",
        "Tackles": "tackles",
        "Interceptions": "interceptions",
        "Saves": "saves",
        "Yellow cards": "yellow_cards",
        "Red cards": "red_cards",
    }
    df = df.rename(columns=rename_map)
    keep = list(rename_map.values())
    df = df[keep].copy()
    df["source"] = "Premier League 2020"
    df["source_key"] = "epl_2020"
    df["xg_per_app"] = safe_div(df["shots_on_target"] * 0.12 + df["goals"] * 0.18, df["apps"])
    df["goals_per_app"] = safe_div(df["goals"], df["apps"])
    df["assists_per_app"] = safe_div(df["assists"], df["apps"])
    df["conversion"] = safe_div(df["goals"], df["shots"])
    df["goal_involvements"] = df["goals"].fillna(0) + df["assists"].fillna(0)
    df = df.fillna(0)
    return df


def normalize_world_cup_players() -> pd.DataFrame:
    src = RAW_DIR / "worldcup" / "WorldCupPlayers.csv"
    if not src.exists():
        return pd.DataFrame()
    df = pd.read_csv(src)
    rename_map = {
        "Player Name": "name",
        "Coach Name": "coach_name",
        "Team Initials": "team_initials",
        "Position": "pos",
        "Shirt Number": "jersey_number",
    }
    df = df.rename(columns=rename_map)
    out = pd.DataFrame()
    out["name"] = df.get("name", "")
    out["club"] = df.get("team_initials", "")
    out["pos"] = df.get("pos", "")
    out["nationality"] = df.get("team_initials", "")
    out["age"] = 0
    out["apps"] = 1
    out["wins"] = 0
    out["losses"] = 0
    out["goals"] = 0
    out["assists"] = 0
    out["shots"] = 0
    out["shots_on_target"] = 0
    out["shoot_acc"] = 0
    out["tackles"] = 0
    out["interceptions"] = 0
    out["saves"] = 0
    out["yellow_cards"] = 0
    out["red_cards"] = 0
    out["goals_per_match"] = 0
    out["headed_goals"] = 0
    out["penalties_scored"] = 0
    out["freekicks_scored"] = 0
    out["big_chances_missed"] = 0
    out["passes"] = 0
    out["passes_per_match"] = 0
    out["big_chances_created"] = 0
    out["source"] = "FIFA World Cup archive"
    out["source_key"] = "world_cup_archive"
    out["xg_per_app"] = 0
    out["goals_per_app"] = 0
    out["assists_per_app"] = 0
    out["conversion"] = 0
    out["goal_involvements"] = 0
    out["jersey_number"] = df.get("jersey_number", 0)
    out["coach_name"] = df.get("coach_name", "")
    return out.fillna(0)


def infer_position_label(pos: str) -> str:
    value = str(pos).lower()
    if "goal" in value or value in {"gk", "goalkeeper"}:
        return "Goalkeeper"
    if any(t in value for t in ["back", "def", "cb", "lb", "rb"]):
        return "Defender"
    if any(t in value for t in ["mid", "wing", "dm", "am"]):
        return "Midfielder"
    if any(t in value for t in ["for", "striker", "fw", "att"]):
        return "Forward"
    return pos or "Unknown"


def build_demo_shots(players_df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    rng = np.random.default_rng(42)
    shot_id = 1
    situations = ["open_play", "open_play", "open_play", "corner", "free_kick", "penalty"]
    sample = players_df[players_df["shots"].fillna(0) > 0].copy()
    if sample.empty:
        sample = players_df.head(180).copy()
    for _, row in sample.head(180).iterrows():
        count = int(max(3, min(24, row.get("shots", 0) if pd.notna(row.get("shots", 0)) else 3)))
        for _ in range(count):
            situation = str(rng.choice(situations))
            is_header = int(rng.random() < 0.18)
            if situation == "penalty":
                x, y = 108.0, 40.0
            elif situation == "corner":
                x, y = float(rng.uniform(98, 118)), float(rng.uniform(18, 62))
            elif situation == "free_kick":
                x, y = float(rng.uniform(86, 108)), float(rng.uniform(24, 56))
            else:
                x, y = float(rng.uniform(76, 118)), float(rng.uniform(10, 70))
            goal_x, goal_y = 120.0, 40.0
            distance = float(math.sqrt((goal_x - x) ** 2 + (goal_y - y) ** 2))
            dx = max(goal_x - x, 0.1)
            a1 = math.atan2(36.0 - y, dx)
            a2 = math.atan2(44.0 - y, dx)
            angle = abs(a2 - a1)
            is_penalty = 1 if situation == "penalty" else 0
            is_corner = 1 if situation == "corner" else 0
            is_freekick = 1 if situation == "free_kick" else 0
            logit = -1.25 - 0.055 * distance + 2.8 * angle - 0.28 * is_header + 2.15 * is_penalty - 0.15 * is_corner - 0.08 * is_freekick
            xg = float(1 / (1 + math.exp(-logit)))
            is_goal = int(rng.random() < xg)
            body_part = "head" if is_header else "foot"
            rows.append({
                "shot_id": shot_id,
                "player": row.get("name", "Unknown"),
                "team": row.get("club", "Unknown"),
                "position": infer_position_label(row.get("pos", "Unknown")),
                "situation": situation,
                "body_part": body_part,
                "x": round(x, 2),
                "y": round(y, 2),
                "distance": round(distance, 3),
                "angle": round(angle, 6),
                "is_header": is_header,
                "is_penalty": is_penalty,
                "is_corner": is_corner,
                "is_freekick": is_freekick,
                "is_goal": is_goal,
                "outcome": "goal" if is_goal else str(rng.choice(["saved", "blocked", "off_target"])),
                "xg_model": round(xg, 4),
                "source": row.get("source", "unknown"),
            })
            shot_id += 1
    return pd.DataFrame(rows)


def main() -> None:
    epl = normalize_epl_players()
    wc = normalize_world_cup_players()
    unified = pd.concat([epl, wc], ignore_index=True, sort=False).fillna(0)
    shots = build_demo_shots(epl)
    unified.to_csv(PROCESSED_DIR / "players_unified.csv", index=False)
    shots.to_csv(PROCESSED_DIR / "shots_unified.csv", index=False)
    summary = pd.DataFrame([
        {"dataset": "players_unified", "rows": len(unified)},
        {"dataset": "shots_unified", "rows": len(shots)},
    ])
    summary.to_csv(PROCESSED_DIR / "build_summary.csv", index=False)
    print(f"[OK] players_unified.csv -> {len(unified)} rows")
    print(f"[OK] shots_unified.csv -> {len(shots)} rows")


if __name__ == "__main__":
    main()
