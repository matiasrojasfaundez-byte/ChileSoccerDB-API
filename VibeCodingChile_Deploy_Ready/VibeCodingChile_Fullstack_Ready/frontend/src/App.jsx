import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ScatterChart, Scatter, PieChart, Pie, Cell } from 'recharts'
import { api, formatNumber } from './lib'

const TABS = [
  { id: 'overview', label: 'Resumen' },
  { id: 'players', label: 'Jugadores' },
  { id: 'xg', label: 'xG Lab' },
  { id: 'deploy', label: 'Deploy' },
]

const COLORS = ['#22c55e', '#38bdf8', '#f59e0b', '#a78bfa', '#ef4444', '#14b8a6']

function MetricCard({ label, value, hint }) {
  return (
    <div className="card metric-card">
      <div className="muted small-uppercase">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="muted">{hint}</div>
    </div>
  )
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        <p className="muted">{subtitle}</p>
      </div>
    </div>
  )
}

function OverviewTab({ overview, shotStats }) {
  const pieData = shotStats?.by_situation?.map((row) => ({ name: row.situation, value: row.shots })) || []
  return (
    <div className="stack">
      <SectionTitle title="Dashboard ejecutivo" subtitle="Listo para demo, venta y validación con clientes." />
      <div className="grid metrics-grid">
        <MetricCard label="Jugadores" value={formatNumber(overview?.summary?.players)} hint="Dataset unificado" />
        <MetricCard label="Tiros" value={formatNumber(overview?.summary?.shots)} hint="Base para xG" />
        <MetricCard label="Goles" value={formatNumber(overview?.summary?.goals)} hint="Eventos marcados" />
        <MetricCard label="xG promedio" value={formatNumber(overview?.summary?.avg_xg, 3)} hint="Modelo listo" />
      </div>
      <div className="grid two-col">
        <div className="card chart-card">
          <h3>Clubes con más goles</h3>
          <div className="chart-wrap">
            <ResponsiveContainer>
              <BarChart data={overview?.top_clubs || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#173128" />
                <XAxis dataKey="club" tick={{ fill: '#89a99a', fontSize: 12 }} angle={-25} textAnchor="end" height={70} />
                <YAxis tick={{ fill: '#89a99a', fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card chart-card">
          <h3>Distribución de tiros por situación</h3>
          <div className="chart-wrap">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {pieData.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="card chart-card">
        <h3>Mapa rápido de tiros</h3>
        <div className="chart-wrap tall">
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid stroke="#173128" />
              <XAxis type="number" dataKey="x" domain={[70, 120]} tick={{ fill: '#89a99a', fontSize: 12 }} />
              <YAxis type="number" dataKey="y" domain={[0, 80]} tick={{ fill: '#89a99a', fontSize: 12 }} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={overview?.shot_map || []} fill="#38bdf8" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function PlayersTab({ players, leaderboard, onRefresh }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    if (!query) return players
    const q = query.toLowerCase()
    return players.filter((row) => [row.name, row.club, row.pos, row.nationality].some((v) => String(v).toLowerCase().includes(q)))
  }, [players, query])
  return (
    <div className="stack">
      <SectionTitle title="Scouting de jugadores" subtitle="Busca por nombre, club, posición o nacionalidad." />
      <div className="toolbar card">
        <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar jugador, club o posición..." />
        <button className="button" onClick={onRefresh}>Recargar</button>
      </div>
      <div className="grid two-col">
        <div className="card table-card">
          <h3>Base de jugadores</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Jugador</th>
                  <th>Club</th>
                  <th>Posición</th>
                  <th>Goles</th>
                  <th>Asistencias</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 30).map((row) => (
                  <tr key={`${row.name}-${row.club}-${row.source_key}`}>
                    <td>{row.name}</td>
                    <td>{row.club}</td>
                    <td>{row.pos}</td>
                    <td>{formatNumber(row.goals)}</td>
                    <td>{formatNumber(row.assists)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card table-card">
          <h3>Leaderboard</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jugador</th>
                  <th>Club</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {(leaderboard?.leaderboard || []).map((row) => (
                  <tr key={`${row.rank}-${row.name}`}>
                    <td>{row.rank}</td>
                    <td>{row.name}</td>
                    <td>{row.club}</td>
                    <td>{formatNumber(row.value, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function XGLabTab() {
  const [x, setX] = useState(105)
  const [y, setY] = useState(40)
  const [isHeader, setIsHeader] = useState(0)
  const [situation, setSituation] = useState('open_play')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  async function predict() {
    setLoading(true)
    try {
      const data = await api(`/api/shots/predict?x=${x}&y=${y}&is_header=${isHeader}&situation=${situation}`)
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { predict() }, [])

  return (
    <div className="stack">
      <SectionTitle title="xG Lab" subtitle="Tu demo comercial lista para mostrar a clubes, analistas y scouts." />
      <div className="grid two-col">
        <div className="card form-card">
          <label>X (0-120)<input type="range" min="0" max="120" value={x} onChange={(e) => setX(Number(e.target.value))} /></label>
          <div className="muted">Valor actual: {x}</div>
          <label>Y (0-80)<input type="range" min="0" max="80" value={y} onChange={(e) => setY(Number(e.target.value))} /></label>
          <div className="muted">Valor actual: {y}</div>
          <label>Tipo de remate
            <select value={isHeader} onChange={(e) => setIsHeader(Number(e.target.value))}>
              <option value={0}>Pie</option>
              <option value={1}>Cabeza</option>
            </select>
          </label>
          <label>Situación
            <select value={situation} onChange={(e) => setSituation(e.target.value)}>
              <option value="open_play">Juego abierto</option>
              <option value="corner">Córner</option>
              <option value="free_kick">Tiro libre</option>
              <option value="penalty">Penal</option>
            </select>
          </label>
          <button className="button" onClick={predict} disabled={loading}>{loading ? 'Calculando...' : 'Calcular xG'}</button>
        </div>
        <div className="card predictor-card">
          <div className="pitch">
            <div className="goal"></div>
            <div className="shot-point" style={{ left: `${(x / 120) * 100}%`, top: `${(y / 80) * 100}%` }} />
          </div>
          <div className="predictor-result">
            <div className="small-uppercase muted">Probabilidad de gol</div>
            <div className="predictor-number">{result ? formatNumber(result.xg, 3) : '—'}</div>
            <div className="muted">{result?.model_source || 'sin modelo'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DeployTab() {
  return (
    <div className="stack">
      <SectionTitle title="Deploy sin pesadilla" subtitle="El paquete está listo para probar local o subir a Render/Railway con Docker." />
      <div className="card deploy-card">
        <ol>
          <li><strong>Local:</strong> `cd backend && pip install -r requirements.txt && python scripts/build_datasets.py && python scripts/train_xg.py && uvicorn app.main:app --reload --port 8000`</li>
          <li><strong>Frontend dev:</strong> `cd frontend && npm install && npm run dev`</li>
          <li><strong>Docker deploy:</strong> desde la raíz ejecuta `docker build -t vibecodingchile-football .` y luego `docker run -p 8000:8000 vibecodingchile-football`</li>
          <li><strong>Render:</strong> sube el repo con `render.yaml` y Dockerfile en la raíz.</li>
        </ol>
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [players, setPlayers] = useState([])
  const [leaderboard, setLeaderboard] = useState(null)
  const [shotStats, setShotStats] = useState(null)
  const [error, setError] = useState('')

  async function loadAll() {
    try {
      setError('')
      const [overviewData, playersData, leaderboardData, shotStatsData] = await Promise.all([
        api('/api/overview'),
        api('/api/players?limit=100'),
        api('/api/leaderboard?metric=goal_involvements&top=10'),
        api('/api/shots/stats'),
      ])
      setOverview(overviewData)
      setPlayers(playersData.data || [])
      setLeaderboard(leaderboardData)
      setShotStats(shotStatsData)
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  useEffect(() => { loadAll() }, [])

  return (
    <div className="app-shell">
      <header className="hero card">
        <div>
          <div className="badge">VibeCodingChile</div>
          <h1>Football Intelligence Platform</h1>
          <p className="muted">Scouting, analytics y xG listos para demo comercial. Autor: <strong>Matias Rojas Faundez</strong>.</p>
        </div>
        <div className="hero-actions">
          <button className="button" onClick={loadAll}>Actualizar datos</button>
          <a className="button secondary" href="/docs" target="_blank" rel="noreferrer">Swagger</a>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((item) => (
          <button key={item.id} className={tab === item.id ? 'tab active' : 'tab'} onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </nav>

      {error && <div className="card error-card">Error: {error}</div>}

      {tab === 'overview' && <OverviewTab overview={overview} shotStats={shotStats} />}
      {tab === 'players' && <PlayersTab players={players} leaderboard={leaderboard} onRefresh={loadAll} />}
      {tab === 'xg' && <XGLabTab />}
      {tab === 'deploy' && <DeployTab />}

      <footer className="footer muted">VibeCodingChile · Matias Rojas Faundez · 2026</footer>
    </div>
  )
}
