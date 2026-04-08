import { useState, useEffect, useRef } from "react";
import * as tf from "tensorflow";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const C = {
  bg: "#030a04",
  card: "#091509",
  border: "#152d17",
  green: "#15803d",
  gl: "#22c55e",
  amber: "#f59e0b",
  red: "#f43f5e",
  blue: "#38bdf8",
  white: "#f0fdf4",
  muted: "#4b6553",
  pitch: "#0b1f0d",
};

// StatsBomb pitch: 120×80 yards. Goal at x=120, center y=40, posts y=36 & y=44
const PW = 120, PH = 80, GX = 120, GYC = 40, GP1 = 36, GP2 = 44;

// ─── MATH HELPERS ─────────────────────────────────────────────────────────────
const dist = (x, y) => Math.sqrt((GX - x) ** 2 + (GYC - y) ** 2);
const angle = (x, y) => {
  const dx = GX - x;
  const a1 = Math.atan2(GP1 - y, dx), a2 = Math.atan2(GP2 - y, dx);
  return Math.abs(a2 - a1) * (180 / Math.PI);
};
const buildFeatures = (x, y, isHead, sit) => [
  x / PW, y / PH,
  Math.min(dist(x, y) / 60, 1),
  Math.min(angle(x, y) / 45, 1),
  isHead ? 1 : 0,
  sit === "penalty" ? 1 : 0,
  sit === "free_kick" ? 1 : 0,
  sit === "corner" ? 1 : 0,
];

// ─── SYNTHETIC DATASET ────────────────────────────────────────────────────────
function genShots(n = 1000) {
  const sits = ["open_play","open_play","open_play","open_play","free_kick","corner","penalty"];
  return Array.from({ length: n }, () => {
    const sit = sits[Math.floor(Math.random() * sits.length)];
    const isHead = Math.random() < 0.22;
    let x, y;
    if (sit === "penalty") { x = 108; y = 40; }
    else if (sit === "corner") { x = 100 + Math.random() * 15; y = 18 + Math.random() * 44; }
    else { x = 72 + Math.random() * 48; y = 14 + Math.random() * 52; }
    const d = dist(x, y), a = angle(x, y);
    const logit = sit === "penalty" ? 1.09 : (-0.5 - 0.072 * d + 0.042 * a + (isHead ? -0.35 : 0));
    const xg = 1 / (1 + Math.exp(-logit));
    return { x, y, isHead, sit, isGoal: Math.random() < xg, xg_true: xg };
  });
}

// ─── TF.JS MODEL ─────────────────────────────────────────────────────────────
function buildModel() {
  const m = tf.sequential({
    layers: [
      tf.layers.dense({ inputShape: [8], units: 32, activation: "relu",
        kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }) }),
      tf.layers.dropout({ rate: 0.25 }),
      tf.layers.dense({ units: 16, activation: "relu" }),
      tf.layers.dense({ units: 1, activation: "sigmoid" }),
    ],
  });
  m.compile({ optimizer: tf.train.adam(0.005), loss: "binaryCrossentropy", metrics: ["accuracy"] });
  return m;
}

async function trainModel(model, shots, onEpoch) {
  const xs = tf.tensor2d(shots.map(s => buildFeatures(s.x, s.y, s.isHead, s.sit)));
  const ys = tf.tensor2d(shots.map(s => [s.isGoal ? 1 : 0]));
  await model.fit(xs, ys, {
    epochs: 70, batchSize: 32, validationSplit: 0.15, shuffle: true,
    callbacks: { onEpochEnd: async (ep, logs) => { onEpoch(ep, logs); await tf.nextFrame(); } },
  });
  xs.dispose(); ys.dispose();
}

const predictXG = (model, x, y, isHead, sit) =>
  tf.tidy(() => {
    const inp = tf.tensor2d([buildFeatures(x, y, isHead, sit)]);
    return model.predict(inp).dataSync()[0];
  });

// ─── STATSBOMB FETCHER ────────────────────────────────────────────────────────
const SB = "https://raw.githubusercontent.com/statsbomb/open-data/master/data";
async function fetchSB(onLog) {
  onLog("Conectando a StatsBomb Open Data...");
  const comps = await (await fetch(`${SB}/competitions.json`)).json();
  // Prefer FIFA World Cup 2018 (competition_id=43, season_id=3) — biggest sample
  const target = comps.find(c => c.competition_id === 43 && c.season_id === 3)
    || comps.find(c => c.competition_id === 16)
    || comps[0];
  onLog(`📂 ${target.competition_name} ${target.season_name}`);
  const matches = await (await fetch(`${SB}/matches/${target.competition_id}/${target.season_id}.json`)).json();
  const sample = matches.slice(0, 6);
  const shots = [];
  for (let i = 0; i < sample.length; i++) {
    const m = sample[i];
    onLog(`⚽ Partido ${i+1}/${sample.length}: ${m.home_team.home_team_name} vs ${m.away_team.away_team_name}`);
    const events = await (await fetch(`${SB}/events/${m.match_id}.json`)).json();
    events.filter(e => e.type?.name === "Shot").forEach(e => {
      shots.push({
        x: e.location[0], y: e.location[1],
        isHead: e.shot?.body_part?.name === "Head",
        sit: (e.shot?.type?.name || "Open Play").toLowerCase().replace(" ", "_"),
        isGoal: e.shot?.outcome?.name === "Goal",
        minute: e.minute, player: e.player?.name,
        match: `${m.home_team.home_team_name} vs ${m.away_team.away_team_name}`,
      });
    });
  }
  onLog(`✓ ${shots.length} tiros cargados desde StatsBomb`);
  return { shots, label: `${target.competition_name} ${target.season_name}`, source: "StatsBomb" };
}

// ─── PATTERN ANALYSIS ─────────────────────────────────────────────────────────
function analyzePatterns(shots) {
  const map = {};
  shots.forEach(s => {
    const k = `${s.sit.replace("_"," ")} · ${s.isHead ? "cabeza" : "pie"}`;
    if (!map[k]) map[k] = { shots: 0, goals: 0 };
    map[k].shots++; if (s.isGoal) map[k].goals++;
  });
  return Object.entries(map)
    .map(([name, v]) => ({ name, ...v, conv: +((v.goals / v.shots) * 100).toFixed(1) }))
    .sort((a, b) => b.shots - a.shots).slice(0, 8);
}

// ─── PITCH SVG ────────────────────────────────────────────────────────────────
function Pitch({ pos, onPos }) {
  const svgRef = useRef(null);
  const VW = 300, VH = 200;
  const px = x => (x / PW) * VW, py = y => (y / PH) * VH;

  const handleClick = e => {
    const r = svgRef.current.getBoundingClientRect();
    const rx = ((e.clientX - r.left) / r.width) * VW;
    const ry = ((e.clientY - r.top) / r.height) * VH;
    const pitchX = (rx / VW) * PW, pitchY = (ry / VH) * PH;
    if (pitchX > 50 && pitchX <= 120 && pitchY >= 0 && pitchY <= 80)
      onPos({ x: pitchX, y: pitchY });
  };

  return (
    <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`}
      style={{ width: "100%", cursor: "crosshair", borderRadius: "8px", display: "block" }}
      onClick={handleClick}>
      {/* Base */}
      <defs>
        <radialGradient id="pitchGrad" cx="80%" cy="50%">
          <stop offset="0%" stopColor="#0f2e12"/>
          <stop offset="100%" stopColor="#0a1a0b"/>
        </radialGradient>
      </defs>
      <rect width={VW} height={VH} fill="url(#pitchGrad)" rx={6}/>
      {/* Stripes */}
      {[0,1,2,3,4,5].map(i => (
        <rect key={i} x={px(60+i*10)} y={0} width={px(10)} height={VH}
          fill={i%2===0?"rgba(255,255,255,0.012)":"transparent"}/>
      ))}
      {/* Lines */}
      <line x1={px(60)} y1={0} x2={px(60)} y2={VH} stroke="rgba(255,255,255,0.12)" strokeWidth={1}/>
      <rect x={px(60)} y={0} width={px(60)} height={VH} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1}/>
      {/* Penalty area */}
      <rect x={px(102)} y={py(18)} width={px(18)} height={py(44)} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1}/>
      {/* 6-yard box */}
      <rect x={px(114)} y={py(30)} width={px(6)} height={py(20)} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={0.8}/>
      {/* Penalty spot */}
      <circle cx={px(108)} cy={py(40)} r={2} fill="rgba(255,255,255,0.25)"/>
      {/* Penalty arc */}
      <path d={`M ${px(102)} ${py(28)} A ${px(9)} ${py(9)} 0 0 0 ${px(102)} ${py(52)}`}
        fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={0.8}/>
      {/* Goal */}
      <rect x={px(120)-2} y={py(36)} width={5} height={py(8)} fill="rgba(255,255,255,0.35)" rx={1}/>
      <text x={px(33)} y={py(50)+4} textAnchor="middle"
        fill="rgba(255,255,255,0.06)" fontSize={9} fontFamily="'Oswald',sans-serif">
        TAP CAMPO PARA DISPARAR
      </text>
      {/* Shot position */}
      {pos && <>
        <line x1={px(pos.x)} y1={py(pos.y)} x2={px(120)} y2={py(40)}
          stroke="rgba(34,197,94,0.3)" strokeWidth={1} strokeDasharray="4 3"/>
        <circle cx={px(pos.x)} cy={py(pos.y)} r={8} fill="rgba(34,197,94,0.12)" stroke="none"/>
        <circle cx={px(pos.x)} cy={py(pos.y)} r={5} fill="rgba(34,197,94,0.2)" stroke="#22c55e" strokeWidth={1.5}/>
        <circle cx={px(pos.x)} cy={py(pos.y)} r={2} fill="#22c55e"/>
      </>}
    </svg>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("data");
  const [shots, setShots] = useState([]);
  const [dataLabel, setDataLabel] = useState(null);
  const [logMsg, setLogMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const modelRef = useRef(null);
  const [trained, setTrained] = useState(false);
  const [training, setTraining] = useState(false);
  const [trainMsg, setTrainMsg] = useState("");
  const [lossHist, setLossHist] = useState([]);
  const [patterns, setPatterns] = useState([]);

  // Predictor
  const [pos, setPos] = useState({ x: 108, y: 40 });
  const [isHead, setIsHead] = useState(false);
  const [sit, setSit] = useState("open_play");
  const [xgVal, setXgVal] = useState(null);

  useEffect(() => { modelRef.current = buildModel(); }, []);

  useEffect(() => {
    if (trained && modelRef.current && pos)
      setXgVal(predictXG(modelRef.current, pos.x, pos.y, isHead, sit));
  }, [trained, pos, isHead, sit]);

  const loadSB = async () => {
    setLoading(true); setLogMsg("");
    try {
      const res = await fetchSB(msg => setLogMsg(msg));
      setShots(res.shots); setDataLabel(res.label);
      setPatterns(analyzePatterns(res.shots));
    } catch (err) {
      setLogMsg("⚠️ CORS / red → usando datos sintéticos...");
      const syn = genShots(1200);
      setShots(syn); setDataLabel("Dataset sintético (1200 tiros)");
      setPatterns(analyzePatterns(syn));
      setTimeout(() => setLogMsg("✓ 1,200 tiros sintéticos cargados"), 800);
    }
    setLoading(false);
  };

  const loadSyn = () => {
    const syn = genShots(1200);
    setShots(syn); setDataLabel("Dataset sintético (1200 tiros)");
    setPatterns(analyzePatterns(syn));
    setLogMsg("✓ 1,200 tiros sintéticos listos");
  };

  const train = async () => {
    if (!shots.length || !modelRef.current) return;
    setTraining(true); setLossHist([]); setTrained(false);
    try {
      await trainModel(modelRef.current, shots, (ep, logs) => {
        setTrainMsg(`Epoch ${ep + 1}/70 · loss ${logs.loss.toFixed(4)}`);
        setLossHist(prev => [...prev, { ep: ep + 1, loss: +logs.loss.toFixed(4), val: logs.val_loss ? +logs.val_loss.toFixed(4) : null }]);
      });
      setTrained(true);
      setTrainMsg(`✓ Entrenado con ${shots.length} tiros`);
      setXgVal(predictXG(modelRef.current, pos.x, pos.y, isHead, sit));
    } catch (e) { setTrainMsg(`Error: ${e.message}`); }
    setTraining(false);
  };

  const xgColor = xgVal == null ? C.muted : xgVal > 0.5 ? C.red : xgVal > 0.2 ? C.amber : C.gl;
  const xgLabel = xgVal == null ? "—"
    : xgVal > 0.7 ? "🔥 Premium — definir o morir"
    : xgVal > 0.4 ? "⚡ Alta probabilidad"
    : xgVal > 0.15 ? "🎯 Probabilidad media"
    : xgVal > 0.05 ? "📐 Difícil"
    : "❄️ Casi imposible";

  const TABS = [
    { id: "data", label: "📦 Datos & Train" },
    { id: "pred", label: "🎯 Predictor xG" },
    { id: "pat", label: "📊 Patrones" },
    { id: "arch", label: "🧠 Arquitectura" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.white, fontFamily: "'Source Sans 3',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Source+Sans+3:wght@300;400;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        button{font-family:inherit;cursor:pointer}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:#152d17;border-radius:2px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes glowPulse{0%,100%{box-shadow:0 0 0 rgba(34,197,94,0)}50%{box-shadow:0 0 18px rgba(34,197,94,.25)}}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{
        background: "linear-gradient(160deg,#0b200d 0%,#030a04 100%)",
        borderBottom: `1px solid ${C.border}`,
        padding: "1.25rem 1.25rem 1rem",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0, opacity: 0.04,
          backgroundImage: `radial-gradient(ellipse at 85% 50%, #22c55e 0%, transparent 55%),
            repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 36px),
            repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 36px)`,
        }}/>
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.85rem" }}>
            <div style={{ background: C.green, borderRadius: "8px", padding: "0.3rem 0.5rem", fontSize: "1.2rem", lineHeight: 1 }}>⚽</div>
            <div>
              <div style={{
                fontFamily: "'Oswald',sans-serif", fontWeight: 700,
                fontSize: "clamp(1rem,4.5vw,1.45rem)", letterSpacing: "0.06em", textTransform: "uppercase",
                background: `linear-gradient(90deg,${C.white},${C.gl})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>xG Neural Engine</div>
              <div style={{ color: C.muted, fontSize: "0.6rem", letterSpacing: "0.13em", textTransform: "uppercase" }}>
                TensorFlow.js · StatsBomb Open Data · VibeCodingChile
              </div>
            </div>
            {trained && (
              <div style={{
                marginLeft: "auto",
                background: "rgba(34,197,94,.12)", border: "1px solid rgba(34,197,94,.4)",
                borderRadius: 20, padding: "0.2rem 0.7rem",
                color: C.gl, fontSize: "0.62rem", fontWeight: 600,
                animation: "glowPulse 2s infinite",
              }}>🟢 MODELO ACTIVO</div>
            )}
          </div>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {[
              { l: "Tiros", v: shots.length ? shots.length.toLocaleString() : "—" },
              { l: "Fuente", v: dataLabel ? (dataLabel.length > 22 ? dataLabel.slice(0, 22) + "…" : dataLabel) : "—" },
              { l: "Goles", v: shots.length ? shots.filter(s => s.isGoal).length.toLocaleString() : "—" },
              { l: "Modelo", v: trained ? "Entrenado ✓" : training ? "Training…" : "Pendiente" },
            ].map(({ l, v }) => (
              <div key={l}>
                <div style={{ color: C.gl, fontFamily: "'Oswald',sans-serif", fontWeight: 600, fontSize: "0.9rem", lineHeight: 1 }}>{v}</div>
                <div style={{ color: C.muted, fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: "flex", background: C.card, borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: "1 0 auto", padding: "0.7rem 0.6rem",
            background: "none", border: "none",
            borderBottom: `2px solid ${tab === t.id ? C.gl : "transparent"}`,
            color: tab === t.id ? C.white : C.muted,
            fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.04em",
            transition: "all .15s", whiteSpace: "nowrap",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: "1.1rem", animation: "fadeUp .22s ease" }}>

        {/* ─── DATA & TRAIN ─── */}
        {tab === "data" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem" }}>
              {[
                { label: "🌐 StatsBomb\nOpen Data", onClick: loadSB, disabled: loading, accent: C.green, note: "Champions League / World Cup" },
                { label: "🧪 Dataset\nSintético", onClick: loadSyn, disabled: loading, accent: "#1d4ed8", note: "1,200 tiros generados" },
              ].map(b => (
                <button key={b.label} onClick={b.onClick} disabled={b.disabled} style={{
                  background: `rgba(${b.accent === C.green ? "21,128,61" : "29,78,216"},.12)`,
                  border: `1px solid ${b.accent}60`, borderRadius: 10,
                  color: C.white, padding: "0.9rem 0.6rem",
                  fontSize: "0.75rem", fontWeight: 600, lineHeight: 1.5,
                  opacity: b.disabled ? 0.6 : 1, whiteSpace: "pre-line",
                  transition: "all .15s",
                }}>
                  <div>{b.label}</div>
                  <div style={{ color: C.muted, fontSize: "0.6rem", fontWeight: 400, marginTop: 4 }}>{b.note}</div>
                </button>
              ))}
            </div>

            {logMsg && (
              <div style={{
                background: "rgba(34,197,94,.05)", border: `1px solid rgba(34,197,94,.2)`,
                borderRadius: 8, padding: "0.6rem 0.75rem",
                color: "rgba(240,253,244,.55)", fontSize: "0.7rem", lineHeight: 1.6,
                animation: "blink 2s infinite",
              }}>{logMsg}</div>
            )}

            {shots.length > 0 && (
              <>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0.85rem" }}>
                  <div style={{ color: C.gl, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.6rem" }}>
                    Dataset cargado
                  </div>
                  {[
                    ["Total tiros", shots.length.toLocaleString()],
                    ["Goles", shots.filter(s => s.isGoal).length.toLocaleString()],
                    ["Conversión", `${((shots.filter(s => s.isGoal).length / shots.length) * 100).toFixed(1)}%`],
                    ["Headers", `${((shots.filter(s => s.isHead).length / shots.length) * 100).toFixed(0)}%`],
                    ["Penaltis", shots.filter(s => s.sit === "penalty").length],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "0.3rem 0", borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ color: C.muted, fontSize: "0.7rem" }}>{l}</span>
                      <span style={{ color: C.white, fontSize: "0.7rem", fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>

                <button onClick={train} disabled={training} style={{
                  background: training ? "rgba(21,128,61,.1)" : C.green,
                  border: "none", borderRadius: 10, color: "#fff",
                  padding: "0.95rem", fontSize: "0.8rem", fontWeight: 700,
                  letterSpacing: "0.05em", textTransform: "uppercase",
                  opacity: training ? 0.7 : 1, transition: "all .15s",
                }}>
                  {training ? `🧠 ${trainMsg}` : trained ? "🔄 Reentrenar" : "🧠 Entrenar Modelo xG"}
                </button>

                {trainMsg && !training && (
                  <div style={{
                    background: "rgba(34,197,94,.07)", border: `1px solid rgba(34,197,94,.2)`,
                    borderRadius: 8, padding: "0.55rem 0.7rem", color: C.gl, fontSize: "0.7rem",
                  }}>{trainMsg}</div>
                )}

                {lossHist.length > 1 && (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0.85rem" }}>
                    <div style={{ color: C.muted, fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
                      Curva de pérdida
                    </div>
                    <ResponsiveContainer width="100%" height={110}>
                      <LineChart data={lossHist} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                        <XAxis dataKey="ep" tick={{ fill: C.muted, fontSize: 8 }} axisLine={false} tickLine={false}/>
                        <YAxis tick={{ fill: C.muted, fontSize: 8 }} axisLine={false} tickLine={false}/>
                        <Tooltip contentStyle={{ background: "#091509", border: `1px solid ${C.border}`, fontSize: "0.68rem", color: C.white }} labelFormatter={v => `Epoch ${v}`}/>
                        <Line type="monotone" dataKey="loss" stroke={C.gl} dot={false} strokeWidth={1.5} name="Train"/>
                        <Line type="monotone" dataKey="val" stroke={C.amber} dot={false} strokeWidth={1.5} name="Val" strokeDasharray="4 2"/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ─── PREDICTOR ─── */}
        {tab === "pred" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            {!trained && (
              <div style={{
                background: "rgba(245,158,11,.07)", border: `1px solid rgba(245,158,11,.3)`,
                borderRadius: 10, padding: "0.8rem", textAlign: "center",
              }}>
                <div style={{ color: C.amber, fontSize: "0.75rem", fontWeight: 600 }}>⚠️ Modelo no entrenado</div>
                <div style={{ color: C.muted, fontSize: "0.67rem", marginTop: 4 }}>Ir a 📦 Datos → cargar dataset → Entrenar Modelo</div>
              </div>
            )}

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0.85rem" }}>
              <p style={{ color: C.muted, fontSize: "0.64rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.6rem" }}>
                Toca el campo atacante para colocar el tiro
              </p>
              <Pitch pos={pos} onPos={setPos}/>
              {pos && (
                <div style={{ display: "flex", gap: "1rem", marginTop: "0.45rem", flexWrap: "wrap" }}>
                  {[
                    ["x", pos.x.toFixed(1)],
                    ["y", pos.y.toFixed(1)],
                    ["dist", `${dist(pos.x, pos.y).toFixed(1)} yds`],
                    ["ángulo", `${angle(pos.x, pos.y).toFixed(1)}°`],
                  ].map(([l, v]) => (
                    <span key={l} style={{ color: C.muted, fontSize: "0.63rem" }}>
                      {l}: <span style={{ color: C.white }}>{v}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem" }}>
              {/* Tipo remate */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0.75rem" }}>
                <p style={{ color: C.muted, fontSize: "0.63rem", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>Tipo remate</p>
                {[["🦵 Pie", false], ["🏃 Cabeza", true]].map(([l, v]) => (
                  <button key={String(v)} onClick={() => setIsHead(v)} style={{
                    display: "block", width: "100%", marginBottom: "0.3rem",
                    background: isHead === v ? "rgba(34,197,94,.18)" : "rgba(255,255,255,.03)",
                    border: `1px solid ${isHead === v ? C.gl : C.border}`,
                    borderRadius: 6, padding: "0.4rem", color: C.white, fontSize: "0.7rem", transition: "all .1s",
                  }}>{l}</button>
                ))}
              </div>
              {/* Situación */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0.75rem" }}>
                <p style={{ color: C.muted, fontSize: "0.63rem", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>Situación</p>
                {[
                  ["⚽ Juego abierto", "open_play"],
                  ["🚩 Córner", "corner"],
                  ["🎯 Tiro libre", "free_kick"],
                  ["🔴 Penalti", "penalty"],
                ].map(([l, v]) => (
                  <button key={v} onClick={() => setSit(v)} style={{
                    display: "block", width: "100%", marginBottom: "0.28rem",
                    background: sit === v ? "rgba(34,197,94,.18)" : "rgba(255,255,255,.03)",
                    border: `1px solid ${sit === v ? C.gl : C.border}`,
                    borderRadius: 6, padding: "0.3rem 0.4rem", color: C.white,
                    fontSize: "0.63rem", transition: "all .1s", textAlign: "left",
                  }}>{l}</button>
                ))}
              </div>
            </div>

            {/* xG RESULT */}
            {trained && xgVal !== null && (
              <div style={{
                background: `rgba(${xgVal > 0.5 ? "244,63,94" : xgVal > 0.2 ? "245,158,11" : "34,197,94"},.08)`,
                border: `1px solid ${xgColor}35`,
                borderRadius: 12, padding: "1.2rem",
                textAlign: "center", animation: "fadeUp .22s ease",
              }}>
                <div style={{ color: C.muted, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.13em", marginBottom: "0.3rem" }}>
                  Expected Goals (xG)
                </div>
                <div style={{
                  color: xgColor, fontFamily: "'Oswald',sans-serif",
                  fontSize: "3.2rem", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em",
                }}>{xgVal.toFixed(3)}</div>
                <div style={{ color: "rgba(240,253,244,.5)", fontSize: "0.68rem", marginTop: "0.45rem" }}>{xgLabel}</div>
                <div style={{ marginTop: "0.75rem", background: "rgba(255,255,255,.06)", borderRadius: 4, height: 5 }}>
                  <div style={{
                    height: "100%", borderRadius: 4, background: xgColor,
                    width: `${Math.min(xgVal * 100, 100)}%`, transition: "width .4s ease",
                  }}/>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ color: C.muted, fontSize: "0.58rem" }}>0%</span>
                  <span style={{ color: C.muted, fontSize: "0.58rem" }}>100%</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── PATTERNS ─── */}
        {tab === "pat" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            {!patterns.length ? (
              <div style={{ color: C.muted, textAlign: "center", padding: "2.5rem", fontSize: "0.78rem" }}>
                Carga datos primero → 📦 Datos
              </div>
            ) : (
              <>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0.85rem" }}>
                  <p style={{ color: C.muted, fontSize: "0.64rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.65rem" }}>
                    Tiros & Goles por tipo de jugada
                  </p>
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={patterns} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }}>
                      <XAxis type="number" tick={{ fill: C.muted, fontSize: 8 }} axisLine={false} tickLine={false}/>
                      <YAxis type="category" dataKey="name" tick={{ fill: C.muted, fontSize: 7.5 }} width={110} axisLine={false} tickLine={false}/>
                      <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, fontSize: "0.68rem", color: C.white }}/>
                      <Bar dataKey="shots" name="Tiros" fill="rgba(34,197,94,.22)" radius={[0, 3, 3, 0]}/>
                      <Bar dataKey="goals" name="Goles" fill={C.gl} radius={[0, 3, 3, 0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {patterns.map((p, i) => (
                    <div key={p.name} style={{
                      background: C.card, border: `1px solid ${C.border}`,
                      borderLeft: `3px solid ${p.conv > 25 ? C.gl : p.conv > 12 ? C.amber : C.muted}`,
                      borderRadius: 8, padding: "0.55rem 0.7rem",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <div>
                        <span style={{ color: C.muted, fontSize: "0.6rem", marginRight: "0.4rem" }}>#{i + 1}</span>
                        <span style={{ color: C.white, fontSize: "0.73rem", fontWeight: 600, textTransform: "capitalize" }}>{p.name}</span>
                        <div style={{ color: C.muted, fontSize: "0.62rem", marginTop: 2 }}>{p.shots} tiros · {p.goals} goles</div>
                      </div>
                      <div style={{
                        color: p.conv > 25 ? C.gl : p.conv > 12 ? C.amber : C.muted,
                        fontFamily: "'Oswald',sans-serif", fontSize: "1.1rem", fontWeight: 700,
                      }}>{p.conv}%</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ─── ARQUITECTURA ─── */}
        {tab === "arch" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            {[
              {
                title: "📐 Schema del Dataset", color: C.gl,
                content: `shot_id         → UUID
match_id        → UUID
minute          → INT (0–120+)
x               → FLOAT (0–120 yards)
y               → FLOAT (0–80 yards)
distance_goal   → FLOAT (yards)
angle_goal      → FLOAT (degrees, 0–45+)
is_header       → BOOL
situation       → ENUM[open_play, corner,
                       free_kick, penalty]
under_pressure  → BOOL
outcome         → BOOL (gol / no gol)
xg_true         → FLOAT (0.0–1.0)
xg_model        → FLOAT (output modelo)`,
              },
              {
                title: "🧠 Red Neuronal", color: C.amber,
                content: `Input  → [8 features]
  x_norm, y_norm, dist_norm, angle_norm
  is_header, is_penalty, is_freekick, is_corner

Dense(32, relu) + L2 regularización
Dropout(0.25)
Dense(16, relu)
Dense(1, sigmoid) → xG ∈ [0, 1]

Loss:   BinaryCrossentropy
Optim:  Adam(lr=0.005)
Epochs: 70 | Batch: 32 | Val: 15%`,
              },
              {
                title: "🚀 Roadmap Escalado", color: C.blue,
                content: `1. ETL Python → StatsBomb + FBref scraper
2. Scraper Campeonato Nacional Chile (único)
3. Modelo GBM / XGBoost con tracking posicional
4. API REST pública → clubes chilenos
5. ChileSoccerBench → paper CENIA / Zenodo
6. Dashboard cuerpo técnico → SaaS`,
              },
            ].map(({ title, color, content }) => (
              <div key={title} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0.85rem" }}>
                <div style={{ color, fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.6rem", fontFamily: "'Oswald',sans-serif" }}>{title}</div>
                <pre style={{ color: "rgba(240,253,244,.45)", fontSize: "0.6rem", lineHeight: 1.75, fontFamily: "'Courier New',monospace", overflowX: "auto", whiteSpace: "pre-wrap" }}>{content}</pre>
              </div>
            ))}
          </div>
        )}

      </div>

      <div style={{
        textAlign: "center", padding: "0.9rem",
        borderTop: `1px solid ${C.border}`,
        color: C.muted, fontSize: "0.56rem", letterSpacing: "0.1em",
      }}>
        xG NEURAL ENGINE · VIBECODINGCHILE · TENSORFLOW.JS · 2026
      </div>
    </div>
  );
}
