# ⚽ VibeCodingChile Football Intelligence System

**Author:** Matias Rojas Faundez  
**Brand:** VibeCodingChile  
**API Version:** 3.0.0

---

## 🚀 Deploy en 3 pasos

### 1. GitHub
```bash
git init
git add .
git commit -m "🚀 VibeCodingChile Football Intelligence v3.0"
git remote add origin https://github.com/vibecodingchile/chilesoccerdb.git
git push -u origin main
```

### 2. Render.com (gratis)
1. render.com → New Web Service
2. Conectar repo GitHub
3. Seleccionar `render.yaml` → Deploy automático
4. URL: `https://chilesoccerdb-api.onrender.com`

### 3. Docker (cualquier VPS)
```bash
docker build -t chilesoccerdb .
docker run -p 8000:8000 chilesoccerdb
```

---

## 📡 Endpoints

| Endpoint | Descripción |
|----------|-------------|
| `GET /api` | Info de la API |
| `GET /api/health` | Health check |
| `GET /api/datasets` | Info datasets |
| `GET /api/players` | Lista jugadores (filtros: club, position, nationality, min_apps) |
| `GET /api/players/{name}` | Perfil jugador |
| `GET /api/leaderboard` | Rankings por métrica |
| `GET /api/shots` | Tiros con xG |
| `GET /api/shots/stats` | Estadísticas agregadas |
| `GET /api/shots/predict?x=&y=&situation=` | Predictor xG en tiempo real |
| `GET /docs` | Swagger UI |

---

## 📦 Dataset

- **38.355 jugadores** — Premier League 2020 + FIFA World Cup 1930-2018
- **3.557 tiros** con xG calculado
- **GradientBoostingClassifier** — ROC-AUC: 0.8471

---

## 💻 Local (Termux / Linux)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# → http://localhost:8000/docs
```
