import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, Cell, PieChart, Pie } from "recharts";

// ── DATASET MOCK (estructura real, valores sintéticos basados en patrones reales) ──
const DATASET = {
  totalMatches: 3840,
  totalGoals: 10291,
  seasons: ["2018-19","2019-20","2020-21","2021-22","2022-23","2023-24"],

  goalPatterns: [
    { pattern: "Centro + Remate cabeza", count: 1842, pct: 17.9, zone: "área chica", type: "juego_abierto" },
    { pattern: "Triangulación + Disparo ángulo", count: 1589, pct: 15.4, zone: "borde área", type: "juego_abierto" },
    { pattern: "Contraataque 3v2", count: 1203, pct: 11.7, zone: "centro área", type: "transición" },
    { pattern: "Córner directo / 2do palo", count: 1098, pct: 10.7, zone: "2do palo", type: "pelota_parada" },
    { pattern: "Tiro libre directo", count: 876, pct: 8.5, zone: "frontal área", type: "pelota_parada" },
    { pattern: "1v1 con portero", count: 823, pct: 8.0, zone: "punto penal", type: "juego_abierto" },
    { pattern: "Pase filtrado + definición", count: 712, pct: 6.9, zone: "centro área", type: "juego_abierto" },
    { pattern: "Disparo largo distancia", count: 534, pct: 5.2, zone: "fuera área", type: "juego_abierto" },
    { pattern: "Penalti", count: 498, pct: 4.8, zone: "punto penal", type: "pelota_parada" },
    { pattern: "Rebote / 2do remate", count: 411, pct: 4.0, zone: "área chica", type: "juego_abierto" },
    { pattern: "Autogoal", count: 214, pct: 2.1, zone: "varios", type: "error" },
    { pattern: "Otro", count: 491, pct: 4.8, zone: "varios", type: "varios" },
  ],

  minuteGoals: [
    {min:"0-9",goals:412},{min:"10-19",goals:678},{min:"20-29",goals:831},
    {min:"30-39",goals:874},{min:"40-45+",goals:1143},{min:"46-54",goals:892},
    {min:"55-64",goals:1021},{min:"65-74",goals:1198},{min:"75-84",goals:1342},
    {min:"85-90+",goals:1900},
  ],

  zoneHeatmap: [
    // [col, row, xG_avg, goals]
    {zone:"Área chica centro",x:2,y:1,xg:0.78,goals:2841},
    {zone:"Área chica izq",x:1,y:1,xg:0.61,goals:1203},
    {zone:"Área chica der",x:3,y:1,xg:0.60,goals:1187},
    {zone:"Borde área centro",x:2,y:2,xg:0.34,goals:1876},
    {zone:"Borde área izq",x:1,y:2,xg:0.18,goals:743},
    {zone:"Borde área der",x:3,y:2,xg:0.19,goals:761},
    {zone:"Frontal lejano",x:2,y:3,xg:0.08,goals:534},
    {zone:"Banda izq",x:1,y:3,xg:0.03,goals:198},
    {zone:"Banda der",x:3,y:3,xg:0.03,goals:211},
  ],

  sequenceNgrams: [
    {seq:"Pase→Pase→Remate",freq:2341,goles:743},
    {seq:"Dribling→Pase→Remate",freq:1892,goles:612},
    {seq:"Centro→Cabezazo",freq:1654,goles:567},
    {seq:"Pase→Remate directo",freq:1432,goles:489},
    {seq:"Recuperación→Contra→Remate",freq:1203,goles:421},
    {seq:"Córner→Remate→Rebote",freq:876,goles:318},
    {seq:"Pase filtrado→1v1",freq:743,goles:287},
  ],

  refereeStats: {
    yellowAvg: 3.8,
    redAvg: 0.4,
    penaltiesMatch: 0.28,
    flagsMatch: 2.1,
  },

  radarProfile: [
    {stat:"Goles juego abierto",value:78},
    {stat:"Goles pelota parada",value:62},
    {stat:"Contraataques",value:54},
    {stat:"xG realizado",value:71},
    {stat:"Variedad patrones",value:65},
    {stat:"Eficiencia remate",value:58},
  ],
};

const COLORS = {
  bg: "#050e06",
  pitch: "#0a1f0b",
  line: "#1a4d1e",
  green: "#16a34a",
  greenLight: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  white: "#f8fafc",
  muted: "#64748b",
  card: "#0d1f10",
  border: "#1f3a23",
};

const typeColor = {
  juego_abierto: "#22c55e",
  transición: "#f59e0b",
  pelota_parada: "#60a5fa",
  error: "#ef4444",
  varios: "#94a3b8",
};

// ── COMPONENTES ──

function PitchZoneMap({ selected, onSelect }) {
  const zones = DATASET.zoneHeatmap;
  const maxGoals = Math.max(...zones.map(z => z.goals));

  const cols = [1,2,3];
  const rows = [1,2,3];

  const zoneAt = (x,y) => zones.find(z => z.x===x && z.y===y);

  return (
    <div style={{fontFamily:"inherit"}}>
      <p style={{color:COLORS.muted,fontSize:"0.75rem",marginBottom:"0.75rem",letterSpacing:"0.1em",textTransform:"uppercase"}}>
        Mapa de Zonas · Goles por Sector
      </p>
      <div style={{
        background: `linear-gradient(180deg, ${COLORS.pitch} 0%, #0f2e12 100%)`,
        border: `1px solid ${COLORS.border}`,
        borderRadius: "12px",
        padding: "1rem",
        position:"relative",
        overflow:"hidden",
      }}>
        {/* Pitch lines decoration */}
        <div style={{
          position:"absolute",inset:0,
          backgroundImage:`
            radial-gradient(circle at 50% 15%, rgba(22,163,74,0.08) 0%, transparent 50%),
            linear-gradient(90deg, transparent 33%, rgba(255,255,255,0.03) 33%, rgba(255,255,255,0.03) 34%, transparent 34%),
            linear-gradient(90deg, transparent 66%, rgba(255,255,255,0.03) 66%, rgba(255,255,255,0.03) 67%, transparent 67%)
          `,
        }}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0.5rem",position:"relative"}}>
          {rows.map(row => cols.map(col => {
            const z = zoneAt(col,row);
            if(!z) return null;
            const intensity = z.goals / maxGoals;
            const isSelected = selected?.zone === z.zone;
            return (
              <button key={`${col}-${row}`}
                onClick={()=>onSelect(isSelected ? null : z)}
                style={{
                  background: isSelected
                    ? `rgba(34,197,94,${0.3 + intensity*0.5})`
                    : `rgba(34,197,94,${0.05 + intensity*0.35})`,
                  border: `1px solid ${isSelected ? COLORS.greenLight : `rgba(34,197,94,${0.2 + intensity*0.3})`}`,
                  borderRadius:"8px",
                  padding:"0.75rem 0.25rem",
                  cursor:"pointer",
                  transition:"all 0.2s",
                  textAlign:"center",
                  boxShadow: isSelected ? `0 0 16px rgba(34,197,94,0.4)` : "none",
                }}
              >
                <div style={{color:COLORS.white,fontSize:"1.1rem",fontWeight:"700"}}>{z.goals.toLocaleString()}</div>
                <div style={{color:"rgba(255,255,255,0.5)",fontSize:"0.6rem",marginTop:"2px"}}>xG {z.xg}</div>
                <div style={{color:"rgba(255,255,255,0.35)",fontSize:"0.55rem",marginTop:"1px",lineHeight:1.2}}>{z.zone.replace("Área chica","").replace("Borde área","").replace("Frontal","").trim() || z.zone}</div>
              </button>
            );
          }))}
        </div>
        {/* Goal label */}
        <div style={{
          textAlign:"center",marginTop:"0.75rem",
          borderTop:`1px solid ${COLORS.border}`,paddingTop:"0.5rem",
          color:COLORS.greenLight,fontSize:"0.65rem",letterSpacing:"0.15em",textTransform:"uppercase",
        }}>⚽ PORTERÍA</div>
      </div>
      {selected && (
        <div style={{
          marginTop:"0.75rem",
          background:"rgba(34,197,94,0.08)",
          border:`1px solid rgba(34,197,94,0.25)`,
          borderRadius:"8px",padding:"0.75rem",
          animation:"fadeIn 0.2s ease",
        }}>
          <div style={{color:COLORS.greenLight,fontWeight:"600",fontSize:"0.85rem"}}>{selected.zone}</div>
          <div style={{display:"flex",gap:"1rem",marginTop:"0.4rem",flexWrap:"wrap"}}>
            <span style={{color:COLORS.muted,fontSize:"0.75rem"}}>Goles: <span style={{color:COLORS.white}}>{selected.goals.toLocaleString()}</span></span>
            <span style={{color:COLORS.muted,fontSize:"0.75rem"}}>xG prom: <span style={{color:COLORS.amber}}>{selected.xg}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}

function RefereeWidget() {
  const { yellowAvg, redAvg, penaltiesMatch, flagsMatch } = DATASET.refereeStats;
  const stats = [
    {label:"🟨 Amarillas/partido",val:yellowAvg,color:"#f59e0b"},
    {label:"🟥 Rojas/partido",val:redAvg,color:"#ef4444"},
    {label:"🔴 Penaltis/partido",val:penaltiesMatch,color:"#a78bfa"},
    {label:"🚩 Fueras de juego",val:flagsMatch,color:"#60a5fa"},
  ];
  return (
    <div>
      <p style={{color:COLORS.muted,fontSize:"0.75rem",marginBottom:"0.75rem",letterSpacing:"0.1em",textTransform:"uppercase"}}>
        Stats Árbitro · Promedio por Partido
      </p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}}>
        {stats.map(s=>(
          <div key={s.label} style={{
            background:COLORS.card,
            border:`1px solid ${COLORS.border}`,
            borderLeft:`3px solid ${s.color}`,
            borderRadius:"8px",padding:"0.75rem",
          }}>
            <div style={{color:s.color,fontSize:"1.4rem",fontWeight:"800",lineHeight:1}}>{s.val}</div>
            <div style={{color:"rgba(255,255,255,0.45)",fontSize:"0.65rem",marginTop:"4px",lineHeight:1.3}}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PatternExplorer({ filter, setFilter }) {
  const types = ["todos","juego_abierto","transición","pelota_parada","pelota_parada"];
  const uniqueTypes = ["todos","juego_abierto","transición","pelota_parada","error"];
  const filtered = filter==="todos"
    ? DATASET.goalPatterns
    : DATASET.goalPatterns.filter(p=>p.type===filter);
  const maxCount = Math.max(...DATASET.goalPatterns.map(p=>p.count));

  return (
    <div>
      <div style={{display:"flex",gap:"0.4rem",marginBottom:"0.75rem",flexWrap:"wrap"}}>
        {uniqueTypes.map(t=>(
          <button key={t} onClick={()=>setFilter(t)} style={{
            background: filter===t ? (t==="todos" ? COLORS.green : typeColor[t]) : "rgba(255,255,255,0.04)",
            border:`1px solid ${filter===t ? "transparent" : COLORS.border}`,
            color: filter===t ? "#fff" : COLORS.muted,
            borderRadius:"20px",padding:"0.25rem 0.65rem",
            fontSize:"0.65rem",cursor:"pointer",fontWeight:"600",letterSpacing:"0.05em",textTransform:"capitalize",
            transition:"all 0.15s",
          }}>{t.replace("_"," ")}</button>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:"0.4rem",maxHeight:"320px",overflowY:"auto",paddingRight:"4px"}}>
        {filtered.map((p,i)=>(
          <div key={p.pattern} style={{
            background:COLORS.card,
            border:`1px solid ${COLORS.border}`,
            borderRadius:"8px",padding:"0.6rem 0.75rem",
            position:"relative",overflow:"hidden",
          }}>
            <div style={{
              position:"absolute",left:0,top:0,bottom:0,
              width:`${(p.count/maxCount)*100}%`,
              background:`linear-gradient(90deg, ${typeColor[p.type]}18, transparent)`,
              transition:"width 0.5s ease",
            }}/>
            <div style={{position:"relative",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <span style={{color:COLORS.white,fontSize:"0.8rem",fontWeight:"600"}}>{p.pattern}</span>
                <div style={{marginTop:"2px",display:"flex",gap:"0.5rem"}}>
                  <span style={{color:COLORS.muted,fontSize:"0.65rem"}}>zona: {p.zone}</span>
                  <span style={{
                    color:typeColor[p.type],fontSize:"0.6rem",
                    background:`${typeColor[p.type]}18`,
                    padding:"1px 6px",borderRadius:"10px",
                  }}>{p.type.replace("_"," ")}</span>
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:"0.5rem"}}>
                <div style={{color:COLORS.greenLight,fontWeight:"700",fontSize:"0.9rem"}}>{p.count.toLocaleString()}</div>
                <div style={{color:COLORS.muted,fontSize:"0.6rem"}}>{p.pct}%</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NgramTable() {
  return (
    <div>
      <p style={{color:COLORS.muted,fontSize:"0.75rem",marginBottom:"0.75rem",letterSpacing:"0.1em",textTransform:"uppercase"}}>
        N-Grams de Jugadas → Conversión
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
        {DATASET.sequenceNgrams.map((s,i)=>{
          const conv = ((s.goles/s.freq)*100).toFixed(1);
          return (
            <div key={s.seq} style={{
              display:"flex",alignItems:"center",gap:"0.5rem",
              background:COLORS.card,border:`1px solid ${COLORS.border}`,
              borderRadius:"8px",padding:"0.5rem 0.65rem",
            }}>
              <span style={{color:COLORS.muted,fontSize:"0.7rem",minWidth:"16px",fontVariantNumeric:"tabular-nums"}}>#{i+1}</span>
              <span style={{color:COLORS.white,fontSize:"0.72rem",flex:1,fontFamily:"'Courier New',monospace"}}>{s.seq}</span>
              <div style={{textAlign:"right",flexShrink:0}}>
                <span style={{
                  color: parseFloat(conv)>35 ? COLORS.greenLight : parseFloat(conv)>28 ? COLORS.amber : COLORS.muted,
                  fontSize:"0.78rem",fontWeight:"700",
                }}>{conv}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── MAIN APP ──
export default function FootballPatterns() {
  const [filter, setFilter] = useState("todos");
  const [selectedZone, setSelectedZone] = useState(null);
  const [activeTab, setActiveTab] = useState("patrones");

  const tabs = [
    {id:"patrones",label:"🎯 Patrones"},
    {id:"tiempo",label:"⏱ Minutos"},
    {id:"mapa",label:"🗺 Zonas"},
    {id:"ngrams",label:"🔗 Secuencias"},
  ];

  return (
    <div style={{
      minHeight:"100vh",
      background: COLORS.bg,
      fontFamily:"'Georgia', 'Times New Roman', serif",
      color: COLORS.white,
      padding:"0",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Source+Sans+3:wght@300;400;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } 
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1f3a23; border-radius: 2px; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
      `}</style>

      {/* HEADER */}
      <div style={{
        background:`linear-gradient(180deg, #0a1f0b 0%, ${COLORS.bg} 100%)`,
        borderBottom:`1px solid ${COLORS.border}`,
        padding:"1.5rem 1.25rem 1rem",
        position:"relative",overflow:"hidden",
      }}>
        {/* Pitch lines BG */}
        <div style={{
          position:"absolute",inset:0,opacity:0.04,
          backgroundImage:`
            repeating-linear-gradient(90deg, #fff 0, #fff 1px, transparent 1px, transparent 80px),
            repeating-linear-gradient(0deg, #fff 0, #fff 1px, transparent 1px, transparent 80px)
          `,
        }}/>
        <div style={{
          position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
          width:"120px",height:"120px",
          border:"1px solid rgba(255,255,255,0.04)",borderRadius:"50%",
        }}/>

        <div style={{position:"relative"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.75rem",marginBottom:"0.5rem"}}>
            <div style={{
              background:COLORS.green,borderRadius:"8px",
              padding:"0.3rem 0.5rem",fontSize:"1.2rem",
            }}>⚽</div>
            <div>
              <div style={{
                fontFamily:"'Oswald',sans-serif",
                fontSize:"clamp(1.1rem,4vw,1.5rem)",
                fontWeight:"700",letterSpacing:"0.05em",
                textTransform:"uppercase",
                background:`linear-gradient(90deg, ${COLORS.white}, ${COLORS.greenLight})`,
                WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
              }}>
                FootballPattern DB
              </div>
              <div style={{color:COLORS.muted,fontSize:"0.65rem",letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"'Source Sans 3',sans-serif"}}>
                Análisis de Patrones Históricos · Sistema Finito
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div style={{display:"flex",gap:"1rem",flexWrap:"wrap",marginTop:"0.75rem"}}>
            {[
              {label:"Partidos",val:"3,840"},
              {label:"Goles analizados",val:"10,291"},
              {label:"Patrones únicos",val:"12"},
              {label:"Temporadas",val:"6"},
            ].map(k=>(
              <div key={k.label}>
                <div style={{color:COLORS.greenLight,fontFamily:"'Oswald',sans-serif",fontSize:"1rem",fontWeight:"600"}}>{k.val}</div>
                <div style={{color:COLORS.muted,fontSize:"0.6rem",textTransform:"uppercase",letterSpacing:"0.08em"}}>{k.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{
        display:"flex",gap:"0",
        borderBottom:`1px solid ${COLORS.border}`,
        background:COLORS.card,
        overflowX:"auto",
      }}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
            flex:"1 0 auto",
            padding:"0.75rem 1rem",
            background:"none",border:"none",
            borderBottom: activeTab===t.id ? `2px solid ${COLORS.greenLight}` : "2px solid transparent",
            color: activeTab===t.id ? COLORS.white : COLORS.muted,
            fontSize:"0.72rem",fontWeight:"600",cursor:"pointer",
            letterSpacing:"0.05em",fontFamily:"'Source Sans 3',sans-serif",
            transition:"all 0.15s",whiteSpace:"nowrap",
          }}>{t.label}</button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{padding:"1.25rem",animation:"slideDown 0.25s ease"}}>

        {activeTab==="patrones" && (
          <div style={{display:"flex",flexDirection:"column",gap:"1.25rem"}}>
            <PatternExplorer filter={filter} setFilter={setFilter}/>
            <RefereeWidget/>
          </div>
        )}

        {activeTab==="tiempo" && (
          <div>
            <p style={{color:COLORS.muted,fontSize:"0.75rem",marginBottom:"0.75rem",letterSpacing:"0.1em",textTransform:"uppercase"}}>
              Distribución Temporal de Goles
            </p>
            <div style={{
              background:COLORS.card,border:`1px solid ${COLORS.border}`,
              borderRadius:"12px",padding:"1rem",
            }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={DATASET.minuteGoals} margin={{top:4,right:4,left:-20,bottom:0}}>
                  <XAxis dataKey="min" tick={{fill:COLORS.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:COLORS.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip
                    contentStyle={{background:"#0d1f10",border:`1px solid ${COLORS.border}`,borderRadius:"8px",color:COLORS.white,fontSize:"0.75rem"}}
                    labelStyle={{color:COLORS.greenLight,fontWeight:"700"}}
                  />
                  <Bar dataKey="goals" radius={[4,4,0,0]} name="Goles">
                    {DATASET.minuteGoals.map((entry,index)=>(
                      <Cell key={index}
                        fill={entry.min.includes("+") ? COLORS.amber : COLORS.green}
                        opacity={0.7+index*0.02}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{
                marginTop:"0.75rem",padding:"0.6rem 0.75rem",
                background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",
                borderRadius:"8px",
              }}>
                <span style={{color:COLORS.amber,fontSize:"0.72rem",fontWeight:"600"}}>⚡ Insight: </span>
                <span style={{color:"rgba(255,255,255,0.6)",fontSize:"0.7rem"}}>
                  El 27.6% de los goles caen en los minutos 85-90+. Los equipos que van perdiendo meten riesgo → más espacios.
                </span>
              </div>
            </div>

            <div style={{marginTop:"1rem"}}>
              <p style={{color:COLORS.muted,fontSize:"0.75rem",marginBottom:"0.75rem",letterSpacing:"0.1em",textTransform:"uppercase"}}>
                Perfil de Ataque Radar
              </p>
              <div style={{background:COLORS.card,border:`1px solid ${COLORS.border}`,borderRadius:"12px",padding:"0.75rem"}}>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={DATASET.radarProfile}>
                    <PolarGrid stroke={COLORS.border}/>
                    <PolarAngleAxis dataKey="stat" tick={{fill:COLORS.muted,fontSize:9}}/>
                    <Radar dataKey="value" stroke={COLORS.greenLight} fill={COLORS.greenLight} fillOpacity={0.15} strokeWidth={2}/>
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab==="mapa" && (
          <div style={{display:"flex",flexDirection:"column",gap:"1.25rem"}}>
            <PitchZoneMap selected={selectedZone} onSelect={setSelectedZone}/>
            <div style={{
              background:COLORS.card,border:`1px solid ${COLORS.border}`,
              borderRadius:"12px",padding:"1rem",
            }}>
              <p style={{color:COLORS.muted,fontSize:"0.75rem",marginBottom:"0.75rem",letterSpacing:"0.1em",textTransform:"uppercase"}}>
                xG por Zona
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={DATASET.zoneHeatmap.sort((a,b)=>b.xg-a.xg)}
                  layout="vertical"
                  margin={{top:0,right:8,left:4,bottom:0}}
                >
                  <XAxis type="number" tick={{fill:COLORS.muted,fontSize:9}} axisLine={false} tickLine={false} domain={[0,1]}/>
                  <YAxis type="category" dataKey="zone" tick={{fill:COLORS.muted,fontSize:8}} width={90} axisLine={false} tickLine={false}/>
                  <Tooltip
                    contentStyle={{background:"#0d1f10",border:`1px solid ${COLORS.border}`,borderRadius:"8px",color:COLORS.white,fontSize:"0.75rem"}}
                  />
                  <Bar dataKey="xg" name="xG" radius={[0,4,4,0]}>
                    {DATASET.zoneHeatmap.sort((a,b)=>b.xg-a.xg).map((entry,index)=>(
                      <Cell key={index}
                        fill={entry.xg>0.5 ? COLORS.greenLight : entry.xg>0.2 ? COLORS.amber : COLORS.muted}
                        opacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab==="ngrams" && (
          <div style={{display:"flex",flexDirection:"column",gap:"1.25rem"}}>
            <NgramTable/>
            <div style={{
              background:"rgba(34,197,94,0.05)",
              border:`1px solid rgba(34,197,94,0.2)`,
              borderRadius:"12px",padding:"1rem",
            }}>
              <div style={{color:COLORS.greenLight,fontWeight:"700",fontSize:"0.8rem",marginBottom:"0.5rem",fontFamily:"'Oswald',sans-serif",textTransform:"uppercase",letterSpacing:"0.05em"}}>
                📐 Schema del Dataset
              </div>
              <pre style={{
                color:"rgba(255,255,255,0.55)",fontSize:"0.62rem",lineHeight:1.7,
                fontFamily:"'Courier New',monospace",overflowX:"auto",
              }}>{`match_id        → UUID
date            → YYYY-MM-DD
minute          → INT (0-120)
team_attack     → STRING
formation       → "4-3-3" | "4-4-2" | ...
action_sequence → ["pase","pase","remate"]
zone_code       → "A1".."C3" (grilla 3x3)
shot_type       → "pie_derecho"|"cabeza"|...
outcome         → "gol" | "no_gol"
xg              → FLOAT (0.0-1.0)
referee_events  → {yellows, reds, penalties}
match_state     → {score_diff, time_segment}`}</pre>
            </div>
            <div style={{
              background:COLORS.card,border:`1px solid ${COLORS.border}`,
              borderRadius:"12px",padding:"1rem",
            }}>
              <div style={{color:COLORS.amber,fontWeight:"700",fontSize:"0.75rem",marginBottom:"0.5rem",textTransform:"uppercase",letterSpacing:"0.08em"}}>
                🔗 Fuentes de Datos Recomendadas
              </div>
              {[
                {name:"StatsBomb Open Data",url:"github.com/statsbomb",note:"360° event data gratuito"},
                {name:"FBref / Understat",url:"fbref.com",note:"Scraping + xG aggregados"},
                {name:"Wyscout API",url:"wyscout.com",note:"Eventos por partido (licencia)"},
              ].map(s=>(
                <div key={s.name} style={{
                  display:"flex",justifyContent:"space-between",
                  padding:"0.4rem 0",borderBottom:`1px solid ${COLORS.border}`,
                }}>
                  <div>
                    <span style={{color:COLORS.white,fontSize:"0.75rem",fontWeight:"600"}}>{s.name}</span>
                    <span style={{color:COLORS.muted,fontSize:"0.65rem",marginLeft:"0.5rem"}}>{s.note}</span>
                  </div>
                  <span style={{color:COLORS.green,fontSize:"0.65rem"}}>{s.url}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{
        textAlign:"center",padding:"1rem",
        borderTop:`1px solid ${COLORS.border}`,
        color:COLORS.muted,fontSize:"0.6rem",letterSpacing:"0.1em",
        fontFamily:"'Source Sans 3',sans-serif",
      }}>
        FOOTBALLPATTERN DB · VIBECODINGCHILE · 2026 · SISTEMA FINITO DE REGLAS
      </div>
    </div>
  );
}
