import { useState, useMemo } from "react";
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ReferenceLine, ReferenceArea,
} from "recharts";

// ─── PALETTE ────────────────────────────────────────────────────────────────
const C = {
  bg:      "#02050a",
  card:    "#060d14",
  border:  "#0c1e2e",
  gold:    "#f59e0b",
  goldDim: "#92400e",
  cyan:    "#06b6d4",
  green:   "#22c55e",
  red:     "#f43f5e",
  violet:  "#a78bfa",
  white:   "#f0f9ff",
  muted:   "#3d5a6e",
  dim:     "#1a2f3f",
};

// ─── PLAYER DATABASE ────────────────────────────────────────────────────────
function seedRng(seed) {
  let s = typeof seed === "string"
    ? seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    : seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

function buildCareer(player) {
  const rng   = seedRng(player.name);
  const start = player.debut;
  const end   = 2025;
  const peak  = player.prime;            // año del prime definido en data
  const career = [];

  for (let yr = start; yr <= end; yr++) {
    const age    = yr - player.born;
    const dist   = Math.abs(yr - peak);
    // Curva de rendimiento: sube hasta el prime, baja después
    const curve  = Math.max(0, 1 - (dist / 7) ** 1.6);
    const noise  = (rng() - 0.5) * 0.18;
    const base   = player.peakXg * curve + noise;
    const xg     = Math.max(0.02, Math.min(1.1, base));

    const goalsBase  = xg * (0.75 + rng() * 0.45);
    const assists    = Math.max(0, +(xg * (0.4 + rng() * 0.6)).toFixed(1));
    const minutes    = Math.round(800 + curve * 1800 + (rng() - 0.5) * 400);
    const apps       = Math.round(minutes / 75);
    const conversion = goalsBase / Math.max(xg, 0.01);

    career.push({
      year:       yr,
      age,
      xg:         +xg.toFixed(3),
      goals:      Math.round(goalsBase),
      assists,
      minutes,
      apps:       Math.min(38, Math.max(1, apps)),
      conversion: +Math.min(1.5, Math.max(0.1, conversion)).toFixed(2),
      team:       teamAt(player, yr),
      isPrime:    yr === peak,
      primeZone:  dist <= 2,
    });
  }
  return career;
}

function teamAt(player, yr) {
  const clubs = player.clubs;
  for (let i = clubs.length - 1; i >= 0; i--) {
    if (yr >= clubs[i].from) return clubs[i].name;
  }
  return clubs[0].name;
}

function detectPrime(career) {
  // Ventana deslizante de 3 años para encontrar el peak real
  let bestScore = -1, bestIdx = 0;
  for (let i = 1; i < career.length - 1; i++) {
    const score = (career[i - 1].xg + career[i].xg * 1.5 + career[i + 1].xg) / 3;
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return career[bestIdx];
}

function phaseLabel(age) {
  if (age < 19) return { label: "Formativo",   color: C.cyan   };
  if (age < 23) return { label: "Emergente",   color: C.green  };
  if (age < 28) return { label: "Prime",       color: C.gold   };
  if (age < 32) return { label: "Maduro",      color: C.violet };
  return              { label: "Crepuscular",  color: C.red    };
}

// ─── PLAYERS ────────────────────────────────────────────────────────────────
const PLAYERS = [
  {
    name: "Carlos González",
    pos: "Delantero Centro",
    born: 1993, debut: 2012, prime: 2019,
    nationality: "🇨🇱",
    peakXg: 0.72,
    clubs: [
      { name: "Palestino",    from: 2012 },
      { name: "Deportes Tolima", from: 2016 },
      { name: "Colo-Colo",   from: 2018 },
      { name: "Necaxa",      from: 2021 },
      { name: "Colo-Colo",   from: 2023 },
    ],
  },
  {
    name: "Óscar Opazo",
    pos: "Lateral Derecho",
    born: 1992, debut: 2011, prime: 2020,
    nationality: "🇨🇱",
    peakXg: 0.28,
    clubs: [
      { name: "Colo-Colo",   from: 2011 },
      { name: "Racing Club", from: 2017 },
      { name: "Colo-Colo",   from: 2019 },
    ],
  },
  {
    name: "Joaquín Larrivey",
    pos: "Delantero Centro",
    born: 1984, debut: 2003, prime: 2021,
    nationality: "🇦🇷",
    peakXg: 0.65,
    clubs: [
      { name: "Lanús",              from: 2003 },
      { name: "Sporting Gijón",     from: 2009 },
      { name: "Universidad de Chile", from: 2020 },
    ],
  },
  {
    name: "Fernando De Paul",
    pos: "Mediocampista",
    born: 1995, debut: 2014, prime: 2022,
    nationality: "🇨🇱",
    peakXg: 0.41,
    clubs: [
      { name: "U. Católica",  from: 2014 },
      { name: "Huachipato",   from: 2018 },
      { name: "U. Católica",  from: 2020 },
    ],
  },
  {
    name: "Leandro Benegas",
    pos: "Delantero",
    born: 1990, debut: 2010, prime: 2018,
    nationality: "🇦🇷",
    peakXg: 0.58,
    clubs: [
      { name: "Independiente", from: 2010 },
      { name: "U. de Chile",   from: 2017 },
      { name: "Colo-Colo",     from: 2020 },
      { name: "Ñublense",      from: 2022 },
    ],
  },
  {
    name: "Maximiliano Falcón",
    pos: "Defensa Central",
    born: 1997, debut: 2016, prime: 2023,
    nationality: "🇺🇾",
    peakXg: 0.18,
    clubs: [
      { name: "Liverpool FC Uruguay", from: 2016 },
      { name: "Colo-Colo",            from: 2021 },
    ],
  },
  {
    name: "Darío Osorio",
    pos: "Extremo",
    born: 2004, debut: 2022, prime: 2024,
    nationality: "🇨🇱",
    peakXg: 0.55,
    clubs: [
      { name: "U. de Chile",  from: 2022 },
      { name: "FC Midtjylland", from: 2023 },
    ],
  },
  {
    name: "Pablo Solari",
    pos: "Extremo Derecho",
    born: 2001, debut: 2019, prime: 2022,
    nationality: "🇦🇷",
    peakXg: 0.61,
    clubs: [
      { name: "Colo-Colo",   from: 2019 },
      { name: "River Plate", from: 2022 },
    ],
  },
];

// ─── CUSTOM TOOLTIP ─────────────────────────────────────────────────────────
function XGTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{
      background: "#060d14ee", border: `1px solid ${C.border}`,
      borderRadius: 8, padding: "0.6rem 0.8rem", minWidth: 140,
    }}>
      <div style={{ color: C.gold, fontWeight: 700, fontSize: "0.75rem", marginBottom: 4 }}>
        {label} · {d?.age} años
      </div>
      <div style={{ color: C.white, fontSize: "0.7rem" }}>xG/partido <span style={{ color: C.cyan }}>{d?.xg}</span></div>
      <div style={{ color: C.white, fontSize: "0.7rem" }}>Goles <span style={{ color: C.green }}>{d?.goals}</span></div>
      <div style={{ color: C.white, fontSize: "0.7rem" }}>Asistencias <span style={{ color: C.violet }}>{d?.assists}</span></div>
      <div style={{ color: C.white, fontSize: "0.7rem" }}>Minutos <span style={{ color: C.muted }}>{d?.minutes?.toLocaleString()}</span></div>
      <div style={{ color: C.muted, fontSize: "0.65rem", marginTop: 4 }}>{d?.team}</div>
      {d?.isPrime && <div style={{ color: C.gold, fontSize: "0.65rem", marginTop: 2 }}>⭐ AÑO PRIME</div>}
    </div>
  );
}

// ─── CAREER TIMELINE ────────────────────────────────────────────────────────
function CareerTimeline({ career, prime }) {
  const primeStart = prime.year - 2;
  const primeEnd   = prime.year + 2;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0.9rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <p style={{ color: C.muted, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Curva xG histórica
        </p>
        <div style={{
          background: `${C.gold}18`, border: `1px solid ${C.gold}40`,
          borderRadius: 20, padding: "0.15rem 0.6rem",
          color: C.gold, fontSize: "0.6rem", fontWeight: 700,
        }}>⭐ Prime {prime.year}</div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={career} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="xgGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.gold} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={C.gold} stopOpacity={0.02}/>
            </linearGradient>
            <linearGradient id="primeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.gold} stopOpacity={0.5}/>
              <stop offset="95%" stopColor={C.gold} stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <ReferenceArea
            x1={primeStart} x2={primeEnd}
            fill={C.gold} fillOpacity={0.08}
            stroke={C.gold} strokeOpacity={0.3} strokeDasharray="4 3"
          />
          <ReferenceLine
            x={prime.year}
            stroke={C.gold} strokeWidth={1.5} strokeDasharray="6 3"
          />
          <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 8 }} axisLine={false} tickLine={false}/>
          <YAxis tick={{ fill: C.muted, fontSize: 8 }} axisLine={false} tickLine={false} domain={[0, "dataMax + 0.1"]}/>
          <Tooltip content={<XGTooltip/>}/>
          <Area
            type="monotone" dataKey="xg" stroke={C.gold} strokeWidth={2}
            fill="url(#xgGrad)" name="xG/partido"
            dot={(props) => {
              const { cx, cy, payload } = props;
              if (!payload.isPrime) return <circle key={props.key} cx={cx} cy={cy} r={0}/>;
              return (
                <g key={props.key}>
                  <circle cx={cx} cy={cy} r={6} fill={C.gold} opacity={0.3}/>
                  <circle cx={cx} cy={cy} r={3} fill={C.gold}/>
                </g>
              );
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── PHASE BANDS ────────────────────────────────────────────────────────────
function PhaseBand({ career }) {
  const phases = [];
  let cur = null;
  career.forEach(s => {
    const p = phaseLabel(s.age);
    if (!cur || cur.label !== p.label) {
      if (cur) phases.push(cur);
      cur = { label: p.label, color: p.color, from: s.year, to: s.year, seasons: 0, xgSum: 0 };
    }
    cur.to = s.year;
    cur.seasons++;
    cur.xgSum += s.xg;
  });
  if (cur) phases.push(cur);

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0.9rem" }}>
      <p style={{ color: C.muted, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>
        Fases de carrera
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
        {phases.map(ph => (
          <div key={ph.label} style={{
            display: "flex", alignItems: "center", gap: "0.6rem",
            background: `${ph.color}0a`, border: `1px solid ${ph.color}25`,
            borderLeft: `3px solid ${ph.color}`,
            borderRadius: 8, padding: "0.5rem 0.7rem",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: ph.color, fontSize: "0.72rem", fontWeight: 700 }}>{ph.label}</div>
              <div style={{ color: C.muted, fontSize: "0.6rem", marginTop: 1 }}>
                {ph.from} – {ph.to} · {ph.seasons} temporadas
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: C.white, fontSize: "0.75rem", fontWeight: 700 }}>
                {(ph.xgSum / ph.seasons).toFixed(2)}
              </div>
              <div style={{ color: C.muted, fontSize: "0.58rem" }}>xG/t prom</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SEASON STATS TABLE ──────────────────────────────────────────────────────
function SeasonTable({ career, prime }) {
  const recent = [...career].reverse().slice(0, 8);
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0.9rem" }}>
      <p style={{ color: C.muted, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.65rem" }}>
        Historial por temporada
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.68rem" }}>
          <thead>
            <tr>
              {["Año","Edad","Club","xG","Goles","Asis","Min"].map(h => (
                <th key={h} style={{ color: C.muted, fontWeight: 600, textAlign: h === "Club" ? "left" : "right",
                  padding: "0.2rem 0.4rem", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent.map(s => {
              const phase = phaseLabel(s.age);
              const isPrime = s.year === prime.year;
              return (
                <tr key={s.year} style={{ background: isPrime ? `${C.gold}08` : "transparent" }}>
                  <td style={{ color: isPrime ? C.gold : C.white, fontWeight: isPrime ? 700 : 400,
                    padding: "0.28rem 0.4rem", borderBottom: `1px solid ${C.border}08`, textAlign: "right" }}>
                    {isPrime ? "⭐ " : ""}{s.year}
                  </td>
                  <td style={{ color: phase.color, padding: "0.28rem 0.4rem",
                    borderBottom: `1px solid ${C.border}08`, textAlign: "right", fontSize: "0.65rem" }}>
                    {s.age}
                  </td>
                  <td style={{ color: C.muted, padding: "0.28rem 0.4rem",
                    borderBottom: `1px solid ${C.border}08`, textAlign: "left",
                    maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.team}
                  </td>
                  <td style={{ color: C.cyan, fontWeight: 600, padding: "0.28rem 0.4rem",
                    borderBottom: `1px solid ${C.border}08`, textAlign: "right" }}>{s.xg}</td>
                  <td style={{ color: C.green, padding: "0.28rem 0.4rem",
                    borderBottom: `1px solid ${C.border}08`, textAlign: "right" }}>{s.goals}</td>
                  <td style={{ color: C.violet, padding: "0.28rem 0.4rem",
                    borderBottom: `1px solid ${C.border}08`, textAlign: "right" }}>{s.assists}</td>
                  <td style={{ color: C.muted, padding: "0.28rem 0.4rem",
                    borderBottom: `1px solid ${C.border}08`, textAlign: "right" }}>
                    {s.minutes >= 1000 ? (s.minutes/1000).toFixed(1)+"k" : s.minutes}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── PRIME CARD ──────────────────────────────────────────────────────────────
function PrimeCard({ prime, player, career }) {
  const primeSeasons = career.filter(s => s.primeZone);
  const avgXgPrime   = primeSeasons.reduce((a, s) => a + s.xg, 0) / primeSeasons.length;
  const avgXgCareer  = career.reduce((a, s) => a + s.xg, 0) / career.length;
  const uplift       = ((avgXgPrime / avgXgCareer - 1) * 100).toFixed(0);

  const currentSeason = career[career.length - 1];
  const currentPhase  = phaseLabel(currentSeason.age);
  const yearsFromPrime = 2025 - prime.year;
  const declining      = yearsFromPrime > 3;

  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.gold}12 0%, #02050a 60%)`,
      border: `1px solid ${C.gold}35`,
      borderRadius: 12, padding: "1rem",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
        <div>
          <div style={{ color: C.gold, fontSize: "0.65rem", fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.12em" }}>⭐ Año Prime</div>
          <div style={{ color: C.white, fontSize: "2rem", fontWeight: 900,
            fontFamily: "'Bebas Neue',sans-serif", lineHeight: 1, marginTop: 2 }}>{prime.year}</div>
          <div style={{ color: C.muted, fontSize: "0.65rem" }}>
            {prime.age} años · {prime.team}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: C.muted, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>xG prime</div>
          <div style={{ color: C.gold, fontSize: "1.5rem", fontWeight: 800, fontFamily: "'Bebas Neue',sans-serif", lineHeight: 1 }}>
            {prime.xg}
          </div>
          <div style={{ color: C.green, fontSize: "0.65rem", marginTop: 2 }}>+{uplift}% vs promedio</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
        {[
          { l: "Goles prime", v: prime.goals, c: C.green   },
          { l: "Asist prime", v: prime.assists, c: C.violet },
          { l: "Minutos",     v: prime.minutes >= 1000 ? (prime.minutes/1000).toFixed(1)+"k" : prime.minutes, c: C.cyan },
        ].map(({ l, v, c }) => (
          <div key={l} style={{
            background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "0.5rem",
            textAlign: "center", border: `1px solid ${C.border}`,
          }}>
            <div style={{ color: c, fontSize: "1rem", fontWeight: 800, fontFamily: "'Bebas Neue',sans-serif", lineHeight: 1 }}>{v}</div>
            <div style={{ color: C.muted, fontSize: "0.55rem", marginTop: 2, lineHeight: 1.2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Estado actual */}
      <div style={{
        marginTop: "0.75rem",
        background: `${currentPhase.color}10`,
        border: `1px solid ${currentPhase.color}30`,
        borderRadius: 8, padding: "0.55rem 0.7rem",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ color: currentPhase.color, fontSize: "0.65rem", fontWeight: 700 }}>
            Estado actual · {currentPhase.label}
          </div>
          <div style={{ color: C.muted, fontSize: "0.6rem", marginTop: 1 }}>
            {2025 - player.born} años · {yearsFromPrime === 0 ? "En su prime ahora mismo" :
              declining ? `${yearsFromPrime} años post-prime` : `${yearsFromPrime} año${yearsFromPrime > 1 ? "s" : ""} post-prime`}
          </div>
        </div>
        <div style={{ color: currentPhase.color, fontSize: "0.8rem", fontWeight: 700 }}>
          {currentSeason.xg} <span style={{ color: C.muted, fontSize: "0.58rem" }}>xG</span>
        </div>
      </div>

      {/* Scout note */}
      <div style={{
        marginTop: "0.65rem",
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${C.border}`,
        borderRadius: 8, padding: "0.55rem 0.7rem",
      }}>
        <span style={{ color: C.gold, fontSize: "0.62rem", fontWeight: 700 }}>📋 Nota scout: </span>
        <span style={{ color: "rgba(240,249,255,0.5)", fontSize: "0.62rem" }}>
          {declining && currentSeason.xg < prime.xg * 0.6
            ? `Rendimiento actual ${((1 - currentSeason.xg / prime.xg) * 100).toFixed(0)}% bajo su prime. Jugador en etapa crepuscular. Costo de oportunidad alto.`
            : declining && currentSeason.xg >= prime.xg * 0.6
            ? `Mantiene ${((currentSeason.xg / prime.xg) * 100).toFixed(0)}% de su nivel prime. Experiencia compensando caída física.`
            : currentSeason.age < 25
            ? `Jugador en desarrollo ascendente. Prime proyectado en ${prime.year <= 2025 ? prime.year : "~" + (player.born + 27)}. Alto potencial.`
            : `En ventana óptima de rendimiento. Momento ideal para fichar antes del peak.`
          }
        </span>
      </div>
    </div>
  );
}

// ─── RADAR PERFORMANCE ──────────────────────────────────────────────────────
function PerformanceRadar({ career, prime }) {
  const current = career[career.length - 1];
  const peak    = prime;
  const max     = { xg: 1.0, conv: 1.5, mins: 2700, goals: 30, assists: 20 };

  const radarData = [
    { stat: "xG/partido",  current: (current.xg   / max.xg   * 100).toFixed(0),  prime: (peak.xg    / max.xg   * 100).toFixed(0)  },
    { stat: "Conversión",  current: (current.conversion / max.conv * 100).toFixed(0), prime: (peak.conversion / max.conv * 100).toFixed(0) },
    { stat: "Minutos",     current: (current.minutes / max.mins * 100).toFixed(0), prime: (peak.minutes / max.mins * 100).toFixed(0) },
    { stat: "Goles",       current: (current.goals / max.goals * 100).toFixed(0),  prime: (peak.goals  / max.goals * 100).toFixed(0) },
    { stat: "Asistencias", current: (current.assists / max.assists * 100).toFixed(0), prime: (peak.assists / max.assists * 100).toFixed(0) },
  ].map(r => ({ ...r, current: Math.min(100, +r.current), prime: Math.min(100, +r.prime) }));

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0.9rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
        <p style={{ color: C.muted, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Actual vs Prime
        </p>
        <div style={{ display: "flex", gap: "0.8rem" }}>
          {[{ l: "Actual", c: C.cyan }, { l: "Prime", c: C.gold }].map(({ l, c }) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: c }}/>
              <span style={{ color: C.muted, fontSize: "0.58rem" }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <RadarChart data={radarData}>
          <PolarGrid stroke={C.border}/>
          <PolarAngleAxis dataKey="stat" tick={{ fill: C.muted, fontSize: 8 }}/>
          <Radar dataKey="prime"   stroke={C.gold} fill={C.gold} fillOpacity={0.1} strokeWidth={1.5}/>
          <Radar dataKey="current" stroke={C.cyan} fill={C.cyan} fillOpacity={0.12} strokeWidth={1.5}/>
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function PlayerProfiler() {
  const [selected, setSelected] = useState(PLAYERS[0].name);
  const [tab, setTab]           = useState("overview");

  const player = PLAYERS.find(p => p.name === selected);
  const career = useMemo(() => buildCareer(player), [player]);
  const prime  = useMemo(() => detectPrime(career), [career]);
  const phase  = phaseLabel(2025 - player.born);

  const TABS = [
    { id: "overview",  label: "📋 Perfil"    },
    { id: "curva",     label: "📈 Curva"     },
    { id: "fases",     label: "🔄 Fases"     },
    { id: "historial", label: "📅 Historial" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.white, fontFamily: "'Source Sans 3',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Source+Sans+3:wght@300;400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        button,select{font-family:inherit;cursor:pointer}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:#0c1e2e;border-radius:2px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes primeGlow{0%,100%{box-shadow:0 0 0 rgba(245,158,11,0)}50%{box-shadow:0 0 20px rgba(245,158,11,.2)}}
      `}</style>

      {/* HEADER */}
      <div style={{
        background: "linear-gradient(160deg,#060d14 0%,#02050a 100%)",
        borderBottom: `1px solid ${C.border}`,
        padding: "1rem 1.1rem 0.85rem",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `radial-gradient(ellipse at 90% 50%, ${C.gold}10 0%, transparent 50%)`,
        }}/>
        <div style={{ position: "relative" }}>
          <div style={{
            fontFamily: "'Bebas Neue',sans-serif",
            fontSize: "clamp(1.2rem,5vw,1.7rem)",
            letterSpacing: "0.08em",
            background: `linear-gradient(90deg, ${C.white} 60%, ${C.gold})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>PLAYER PERFORMANCE PROFILER</div>
          <div style={{ color: C.muted, fontSize: "0.58rem", letterSpacing: "0.13em", textTransform: "uppercase" }}>
            Rendimiento histórico · Prime Detection · VibeCodingChile
          </div>
        </div>
      </div>

      {/* PLAYER SELECTOR */}
      <div style={{ padding: "0.85rem 1.1rem", background: C.card, borderBottom: `1px solid ${C.border}` }}>
        <select value={selected} onChange={e => { setSelected(e.target.value); setTab("overview"); }} style={{
          width: "100%", background: "#060d14",
          border: `1px solid ${C.gold}40`, color: C.white,
          borderRadius: 10, padding: "0.65rem 0.75rem",
          fontSize: "0.8rem", fontWeight: 600,
        }}>
          {PLAYERS.map(p => (
            <option key={p.name} value={p.name}>
              {p.nationality} {p.name} · {p.pos} · {2025 - p.born} años
            </option>
          ))}
        </select>
      </div>

      {/* PLAYER BANNER */}
      <div style={{
        padding: "0.85rem 1.1rem",
        background: `linear-gradient(90deg, ${phase.color}10 0%, transparent 60%)`,
        borderBottom: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{
            fontFamily: "'Bebas Neue',sans-serif",
            fontSize: "1.4rem", letterSpacing: "0.05em", lineHeight: 1,
            color: C.white,
          }}>{player.name}</div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: 4, flexWrap: "wrap" }}>
            <span style={{
              background: `${phase.color}18`, border: `1px solid ${phase.color}40`,
              borderRadius: 20, padding: "0.15rem 0.55rem",
              color: phase.color, fontSize: "0.6rem", fontWeight: 700,
            }}>{phase.label}</span>
            <span style={{ color: C.muted, fontSize: "0.65rem" }}>{player.pos}</span>
            <span style={{ color: C.muted, fontSize: "0.65rem" }}>
              Debut {player.debut} · {career.length} temporadas
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: C.gold, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>Prime</div>
          <div style={{ color: C.gold, fontFamily: "'Bebas Neue',sans-serif", fontSize: "1.6rem", lineHeight: 1 }}>{prime.year}</div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", background: C.card, borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: "1 0 auto", padding: "0.65rem 0.5rem",
            background: "none", border: "none",
            borderBottom: `2px solid ${tab === t.id ? C.gold : "transparent"}`,
            color: tab === t.id ? C.white : C.muted,
            fontSize: "0.68rem", fontWeight: 600,
            transition: "all .15s", whiteSpace: "nowrap",
          }}>{t.label}</button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ padding: "1rem 1.1rem", animation: "fadeUp .2s ease", display: "flex", flexDirection: "column", gap: "0.9rem" }}>

        {tab === "overview" && <>
          <PrimeCard prime={prime} player={player} career={career}/>
          <PerformanceRadar career={career} prime={prime}/>
        </>}

        {tab === "curva" && <>
          <CareerTimeline career={career} prime={prime}/>

          {/* Goals vs xG por año */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0.9rem" }}>
            <p style={{ color: C.muted, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.6rem" }}>
              Goles vs xG esperado
            </p>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={career} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 8 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill: C.muted, fontSize: 8 }} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, fontSize: "0.68rem", color: C.white }}/>
                <ReferenceLine x={prime.year} stroke={C.gold} strokeDasharray="4 3" strokeWidth={1}/>
                <Line type="monotone" dataKey="xg" stroke={C.gold} dot={false} strokeWidth={1.5} name="xG esperado" strokeDasharray="4 2"/>
                <Line type="monotone" dataKey="goals" stroke={C.green} dot={false} strokeWidth={2} name="Goles reales"/>
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: "1rem", marginTop: "0.4rem" }}>
              {[{ c: C.green, l: "Goles reales" }, { c: C.gold, l: "xG esperado" }].map(({ c, l }) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <div style={{ width: 10, height: 2, background: c, borderRadius: 1 }}/>
                  <span style={{ color: C.muted, fontSize: "0.6rem" }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </>}

        {tab === "fases" && <>
          <PhaseBand career={career}/>

          {/* Minutos por temporada */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0.9rem" }}>
            <p style={{ color: C.muted, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.6rem" }}>
              Minutos jugados por temporada
            </p>
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={career} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="minsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.violet} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={C.violet} stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 8 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill: C.muted, fontSize: 8 }} axisLine={false} tickLine={false}/>
                <ReferenceLine x={prime.year} stroke={C.gold} strokeDasharray="4 3" strokeWidth={1}/>
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, fontSize: "0.68rem", color: C.white }}/>
                <Area type="monotone" dataKey="minutes" stroke={C.violet} fill="url(#minsGrad)" strokeWidth={1.5} name="Minutos"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>}

        {tab === "historial" && <SeasonTable career={career} prime={prime}/>}
      </div>

      <div style={{ textAlign: "center", padding: "0.85rem", borderTop: `1px solid ${C.border}`, color: C.muted, fontSize: "0.55rem", letterSpacing: "0.1em" }}>
        PLAYER PROFILER · VIBECODINGCHILE · 2026 · PRIME DETECTION ENGINE
      </div>
    </div>
  );
}
