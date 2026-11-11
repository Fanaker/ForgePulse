/* ForgePulse lab UI. All KPI values originate in FastAPI/SQLite and the trained synthetic ML model. */
'use strict';
const S = {view:'overview', overview:null, assets:[], alerts:[], model:null, pipeline:null, selectedAsset:'C-201', selectedMetric:'temperature', assetFilter:'all', assetSearch:'', alertFilter:'all'};
const root=document.getElementById('view-content');
const NAV={overview:'Centro de control',telemetry:'Telemetría IoT',assets:'Activos industriales',model:'Predictive AI',alerts:'Centro de alertas',pipeline:'Data pipeline'};
const METRICS={temperature:{label:'Temperatura',unit:'°C',normal:'45–75 °C',color:'#5ce0ba'},vibration:{label:'Vibración RMS',unit:'mm/s',normal:'0–4.5 mm/s',color:'#f5b96e'},current:{label:'Corriente',unit:'A',normal:'10–31 A',color:'#8ebdff'},pressure:{label:'Presión de línea',unit:'bar',normal:'3.5–6.0 bar',color:'#aab0ff'}};
const ico=(n,extra='')=>`<svg class="${extra}"><use href="#i-${n}"/></svg>`;
const fmt=(n,d=1)=>Number(n).toLocaleString('es-PE',{minimumFractionDigits:d,maximumFractionDigits:d});
const pct=(n,d=1)=>`${fmt(Math.max(0,Number(n)*100),d)}%`;
const status=(risk)=>risk>=.72?'critical':risk>=.08?'warning':'healthy';
const textStatus=(s)=>({healthy:'Operativo',warning:'Atención',critical:'Crítico'})[s]||'Desconocido';
const pill=(s)=>`<span class="status-pill ${s}"><span class="mini-dot ${s}"></span>${textStatus(s)}</span>`;
const timeLabel=(iso,full=false)=>{const date=new Date(iso);return Number.isNaN(+date)?'—':date.toLocaleString('es-PE',full?{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'}:{hour:'2-digit',minute:'2-digit'});};
const esc=(s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const badge=(label)=>`<span class="chip live"><span class="dot teal"></span>${label}</span>`;
const simButton=()=>`<button class="btn primary" data-action="open-simulator">${ico('play')} Simular evento</button>`;
const exportButton=()=>`<a class="btn secondary" href="/api/export.csv" download>${ico('download')} Exportar CSV</a>`;
const header=(sup,title,description,buttons='')=>`<div class="page-head"><div><div class="eyebrow">${sup}</div><h1>${title}</h1><p>${description}</p></div><div class="page-actions">${buttons}</div></div>`;
const panelTop=(title,desc,extra='')=>`<div class="panel-header"><div><h2>${title}</h2><p>${desc}</p></div>${extra}</div>`;
const footer=()=>`<div class="thin-footer"><strong>FORGEPULSE LAB</strong> · Plataforma demostrativa con señales, activos y fallos sintéticos. No apta para control industrial.</div>`;

async function api(url,opts){const res=await fetch(url,opts);if(!res.ok){let message='Error de comunicación';try{const data=await res.json();message=data.detail||message;}catch(_){}throw new Error(message);}return res.json();}
async function sync(){
  const [overview,assets,alerts,model,pipeline]=await Promise.all([
    api('/api/overview'),api('/api/assets'),api('/api/alerts'),api('/api/model'),api('/api/pipeline')]);
  Object.assign(S,{overview,assets,alerts,model,pipeline});
  document.getElementById('nav-alerts').textContent=alerts.filter(a=>!a.acknowledged).length;
  document.getElementById('bell-count').textContent=alerts.filter(a=>!a.acknowledged).length;
}
const viewNav=(view)=>{
  S.view=view;document.getElementById('sidebar').classList.remove('open');
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  document.getElementById('breadcrumb').textContent=NAV[view];
  render();window.scrollTo({top:0,behavior:'instant'});
};
function showToast(message,error=false){const div=document.createElement('div');div.className=`toast ${error?'error':''}`;div.textContent=message;document.getElementById('toast-region').appendChild(div);setTimeout(()=>div.remove(),4500);}
function svgLine(data, key, options={}){
  const mobile=window.innerWidth<640;const width=mobile?390:870,height=mobile?230:245,left=mobile?33:39,right=12,top=15,bottom=34,plotW=width-left-right,plotH=height-top-bottom;
  const values=data.map(x=>Number(x[key])||0), vMin=Math.min(...values,0),vMax=Math.max(...values,1);
  let max=options.max??Math.ceil(vMax*1.22/5)*5,min=options.min??Math.max(0,Math.floor(vMin*.8/5)*5);
  if(max-min<1)max=min+1;
  const X=i=>left+i*plotW/Math.max(1,data.length-1), Y=v=>top+plotH*(1-(v-min)/(max-min));
  const points=values.map((v,i)=>`${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const area=`M${X(0).toFixed(1)} ${Y(values[0]).toFixed(1)} `+values.slice(1).map((v,i)=>`L${X(i+1).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ')+` L${X(data.length-1)} ${height-bottom} L${X(0)} ${height-bottom} Z`;
  const keyName='g'+(options.id||key).replace(/[^A-Za-z0-9]/g,'');const color=options.color||'#57dcad';
  const lines=[0,.25,.5,.75,1].map((f)=>{const y=top+f*plotH;const n=max-f*(max-min);return `<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}" stroke="#29414d" stroke-width=".8" stroke-dasharray="3 6"/><text x="${left-9}" y="${y+4}" text-anchor="end">${Math.round(n)}${options.axisSuffix||''}</text>`;}).join('');
  const ticks=[0,.25,.5,.75,1].map(f=>{let i=Math.round(f*(data.length-1));return `<text x="${X(i)}" y="${height-7}" text-anchor="middle">${timeLabel(data[i].timestamp || `${data[i].bucket}:00:00+00:00`)}</text>`;}).join('');
  const dots=data.length>0?`<circle cx="${X(data.length-1)}" cy="${Y(values[values.length-1])}" r="5.5" fill="${color}" stroke="#0e1c26" stroke-width="4"/>`:'';
  return `<svg class="chart-svg" role="img" aria-label="${esc(options.label||key)}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="${keyName}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".22"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${lines}<path d="${area}" fill="url(#${keyName})"/><polyline points="${points}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}${ticks}</svg>`;
}
const lastAlert=(a)=>`${esc(a.asset_id)} · ${timeLabel(a.created_at,true)}`;
function overviewPage(){
  const o=S.overview, s=o.summary;
  const kpis=[
    ['Salud estimada de flota',fmt(s.avg_health)+'<span class="kpi-unit">%</span>','activity','',`<strong>${s.healthy} equipos</strong> en operación normal`],
    ['Activos en riesgo crítico',`${s.critical.toString().padStart(2,'0')}`,'alert','danger','Requieren revisión prioritaria'],
    ['Alertas sin revisar',String(s.open_alerts).padStart(2,'0'),'bell','warn','Incidencias sintéticas activas'],
    ['Lecturas registradas',s.readings.toLocaleString('es-PE'),'database','blue','Historiador local · 15 min']
  ].map(([name,value,icon,color,detail])=>`<div class="card kpi-card"><div class="kpi-top"><span>${name}</span><span class="kpi-symbol ${color}">${ico(icon)}</span></div><div class="kpi-value">${value}</div><div class="kpi-foot"><span class="metric-bullet"></span>${detail}</div></div>`).join('');
  const zoneRows=o.zones.map(z=>{const level=status(z.max_risk);return `<div><div class="zone-line"><strong><i class="mini-dot ${level}"></i>${esc(z.name)}</strong><span>${fmt(z.health)}% <span style="color:#597887">·</span> ${z.count} equipos</span></div><div class="progress-bar ${level==='critical'?'danger':level==='warning'?'warn':''}"><span style="width:${Math.max(2,z.health)}%"></span></div></div>`}).join('');
  const flow=['Procesamiento','Compresión','Envasado','Servicios'].map((z,i)=>{
    const a=o.zones.find(r=>r.name===z);const stat=status(a.max_risk);
    return `<div class="process-block ${stat==='critical'?'danger':stat==='warning'?'warn':''}"><span class="stage">ETAPA ${String(i+1).padStart(2,'0')}</span><strong>${z}</strong><span class="status-small"><span class="mini-dot ${stat}"></span><b>${a.count} activos</b> · ${textStatus(stat)}</span></div>`;
  }).join('');
  const assetRows=o.assets.slice(0,5).map(a=>`<tr data-asset="${a.id}"><td><div class="asset-name"><span class="asset-icon">${ico('settings')}</span><span><strong>${esc(a.name)}</strong><small>${a.id} · ${a.zone}</small></span></div></td><td>${fmt(a.temperature)} °C</td><td>${fmt(a.vibration,2)} mm/s</td><td><strong class="risk-number ${a.status}">${pct(a.risk,1)}</strong></td><td>${pill(a.status)}</td></tr>`).join('');
  const alerts=o.alerts.slice(0,3).map(a=>`<div class="alert-item"><div class="alert-icon ${a.severity}">${ico('alert')}</div><div class="alert-body"><strong>${esc(a.title)}</strong><p>${esc(a.description)}</p><span class="alert-meta">${lastAlert(a)}</span></div></div>`).join('');
  return header('OPERATIONS / LIVE OVERVIEW','Planta Norte <span style="color:#6f9394;font-weight:500">/</span> Centro de control','Monitorización inteligente de activos industriales con telemetría y predicciones de riesgo generadas localmente.',`${exportButton()} ${simButton()}`)+
    `<div class="kpi-grid">${kpis}</div><div class="col-grid"><section class="card chart-panel">${panelTop('Evolución del riesgo operacional','Riesgo promedio estimado de la flota · últimas 24 horas',badge('VENTANA 24 H'))}<div class="chart-frame">${svgLine(o.history,'risk',{id:'overall',color:'#55dcb1',label:'Evolución del riesgo en porcentaje',axisSuffix:'%'})}</div><div class="chart-note"><span><i class="legend-dot"></i>Riesgo promedio</span><span><i class="legend-dot amber"></i>Valores sintéticos · modelo RF</span></div></section><section class="card zone-panel">${panelTop('Estado por áreas de planta','Salud estimada por zona de producción',`<span class="chip">${o.zones.length} ZONAS</span>`)}<div class="zone-list">${zoneRows}</div><div class="zone-foot"><span><i class="mini-dot"></i>Sincronizado con SQLite</span><strong>10 activos conectados</strong></div></section></div>`+
    `<section class="card process-card"><div class="process-heading"><strong>Mapa del proceso industrial</strong><span>PLANTA NORTE / TOPOLOGÍA DEMOSTRATIVA · 4 ÁREAS</span></div><div class="process-flow">${flow}</div></section>`+
    `<div class="bottom-grid" style="margin-top:17px"><section class="card table-panel">${panelTop('Activos que requieren seguimiento','Clasificados por probabilidad de fallo',`<button class="text-btn" data-go="assets">Ver todos ${ico('arrow')}</button>`)}<div class="table-wrap" style="margin-top:16px"><table class="table"><thead><tr><th>Equipo</th><th>Temp.</th><th>Vibración</th><th>Riesgo ML</th><th>Condición</th></tr></thead><tbody>${assetRows}</tbody></table></div></section><section class="card">${panelTop('Alertas recientes','Eventos generados a partir de la telemetría',`<button class="text-btn" data-go="alerts">Ver alertas ${ico('arrow')}</button>`)}<div style="margin-top:12px">${alerts}</div></section></div>${footer()}`;
}
function telemetryPage(){
  const a=S.assets.find(r=>r.id===S.selectedAsset)||S.assets[0];const detail=S.assetDetail;
  if(!detail||detail.asset.id!==a.id) return `<div class="skeleton"><div class="loading-ring"></div>Cargando señales del activo...</div>`;
  const latest=detail.readings[detail.readings.length-1], metric=S.selectedMetric, metricInfo=METRICS[metric];
  const options=S.assets.map(x=>`<option value="${x.id}" ${x.id===a.id?'selected':''}>${x.id} — ${esc(x.name)}</option>`).join('');
  const sensors=Object.entries(METRICS).map(([key,m])=>`<section class="card sensor"><div class="sensor-label">${m.label} ${ico(key==='temperature'?'thermo':key==='current'?'zap':'activity')}</div><div class="sensor-value">${fmt(latest[key],key==='vibration'?2:1)} <small>${m.unit}</small></div><div class="sensor-range">Rango de referencia sintético · ${m.normal}</div><div class="risk-track progress-bar ${key==='vibration'&&latest[key]>4.5?'danger':''}"><span style="width:${Math.min(100,Number(latest[key])/(key==='temperature'?120:key==='vibration'?10:key==='current'?55:8)*100)}%"></span></div></section>`).join('');
  const tabs=Object.keys(METRICS).map(key=>`<button class="tab ${key===metric?'active':''}" data-metric="${key}">${METRICS[key].label}</button>`).join('');
  const rows=detail.readings.slice(-12).reverse().map(r=>`<tr><td>${timeLabel(r.timestamp,true)}</td><td>${fmt(r.temperature)} °C</td><td>${fmt(r.vibration,2)} mm/s</td><td>${fmt(r.current)} A</td><td>${fmt(r.pressure,2)} bar</td><td><span class="risk-number ${status(r.risk)}">${pct(r.risk)}</span></td></tr>`).join('');
  return header('IOT MONITORING / SIGNALS','Telemetría de sensores','Lecturas temporales por activo. Selecciona una máquina para examinar su comportamiento y evolución.',`<select class="select" id="asset-select" aria-label="Seleccionar activo">${options}</select> ${simButton()}`)+
   `<div class="data-note">${ico('info')} Señales simuladas en intervalos de 15 minutos. No existe conexión con hardware industrial real ni broker MQTT.</div><div class="sensor-grid">${sensors}</div>`+
   `<section class="card telemetry-graph">${panelTop(`${metricInfo.label} · serie temporal`,`Últimas ${detail.readings.length} muestras · ${esc(a.id)} · ${metricInfo.unit}`,`<div class="panel-actions">${badge('HISTORIADOR LOCAL')}</div>`)}<div style="padding:19px 21px 0"><div class="tab-strip">${tabs}</div></div><div class="chart-frame" style="padding-top:15px">${svgLine(detail.readings,metric,{color:metricInfo.color,id:'detail'+metric,label:metricInfo.label})}</div><div class="chart-note"><span><i class="legend-dot" style="background:${metricInfo.color}"></i>${metricInfo.label} registrada</span><span>Fuente: SQLite · Muestreo simulado</span></div></section>`+
   `<div class="col-grid" style="margin-top:17px"><section class="card table-panel">${panelTop('Histórico de lecturas','Últimas 12 muestras almacenadas',`<span class="chip">${a.id}</span>`)}<div class="table-wrap" style="margin-top:17px"><table class="table"><thead><tr><th>Fecha y hora</th><th>Temperatura</th><th>Vibración</th><th>Corriente</th><th>Presión</th><th>Riesgo</th></tr></thead><tbody>${rows}</tbody></table></div></section><section class="card">${panelTop('Diagnóstico del activo','Estado calculado con RandomForest')}
    <div style="padding:25px 22px"><div style="display:flex;justify-content:space-between;align-items:center"><strong style="font-size:16px">${esc(a.name)}</strong>${pill(a.status)}</div><p style="font-size:11px;color:#8aa5ae;margin-top:12px;line-height:1.7">${a.manufacturer} · ${a.zone}<br>Tiempo de operación: ${Math.round(a.hours).toLocaleString('es-PE')} h</p><div style="border-top:1px solid #284550;margin-top:22px;padding-top:20px;display:flex;align-items:center;gap:17px"><strong style="font-size:45px;letter-spacing:-2px;color:${a.risk>=.72?'#ff8d95':a.risk>=.08?'#f1bd7d':'#7ce9bb'}">${pct(a.risk,1)}</strong><span style="font-size:10px;color:#9ab3bd;line-height:1.6">Probabilidad de fallo<br>estimada por IA</span></div><p style="font-size:10px;color:#7e9dab;line-height:1.6;margin-top:20px">Esta probabilidad se calcula con un modelo entrenado en datos sintéticos y no indica una probabilidad real calibrada para la maquinaria.</p></div></section></div>${footer()}`;
}
function assetsPage(){
 const matches=S.assets.filter(a=>(S.assetFilter==='all'||a.status===S.assetFilter)&&(`${a.name} ${a.id} ${a.zone}`.toLowerCase().includes(S.assetSearch.toLowerCase())));
 const counts={all:S.assets.length,critical:S.assets.filter(a=>a.status==='critical').length,warning:S.assets.filter(a=>a.status==='warning').length,healthy:S.assets.filter(a=>a.status==='healthy').length};
 const filters=Object.entries({all:'Todos',critical:'Críticos',warning:'Atención',healthy:'Operativos'}).map(([key,label])=>`<button class="tab ${S.assetFilter===key?'active':''}" data-asset-filter="${key}">${label} · ${counts[key]}</button>`).join('');
 const cards=matches.map(a=>`<section class="card asset-tile" data-asset="${a.id}"><div class="tile-upper"><div class="tile-icon">${ico('settings')}</div>${pill(a.status)}</div><div class="tile-title">${esc(a.name)}</div><div class="tile-id">${a.id} <span style="margin:0 6px;color:#3e5f6b">/</span> ${a.zone}</div><div class="tile-metrics"><div><small>Temperatura</small><strong>${fmt(a.temperature)} °C</strong></div><div><small>Vibración</small><strong>${fmt(a.vibration,2)}</strong></div><div><small>Riesgo ML</small><strong style="color:${a.status==='critical'?'#ff9098':a.status==='warning'?'#ffd082':'#6ce3b5'}">${pct(a.risk)}</strong></div></div><div class="tile-bottom"><span>${esc(a.type)}</span><span>Ver señales ${ico('arrow')}</span></div></section>`).join('');
 return header('ASSET MANAGEMENT / EQUIPMENT','Inventario industrial','Gestión visual de maquinaria simulada, organizada por condición estimada, zona y señales.',`${simButton()}`)+
 `<div class="card" style="padding:14px 17px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><div class="tab-strip">${filters}</div><input class="search" id="asset-search" style="min-width:245px" placeholder="Buscar equipo, código o zona" value="${esc(S.assetSearch)}" aria-label="Buscar activos"></div><div class="asset-mosaic">${cards||'<div class="empty-state">Sin activos con estos filtros.</div>'}</div>${footer()}`;
}
function modelPage(){
 const m=S.model;const evals=[['Exactitud / accuracy','accuracy','Clasificación sobre datos de prueba'],['Precisión','precision','Proporción de positivos correctos'],['Sensibilidad / recall','recall','Detección de ejemplos positivos'],['F1-score','f1','Balance de precisión y sensibilidad']].map(([l,k,d])=>`<section class="card eval-stat"><small>${l}</small><strong>${pct(m[k])}</strong><p>${d}</p></section>`).join('');
 const features=m.features.map(f=>`<div class="feature-item"><span>${esc(f.label)}</span><div class="progress-bar"><span style="width:${f.importance*100/Math.max(.01,m.features[0].importance)}%"></span></div><b>${fmt(f.importance*100,1)}%</b></div>`).join('');
 const c=m.confusion_matrix;
 return header('PREDICTIVE MAINTENANCE / MACHINE LEARNING','Motor predictivo','Evaluación reproducible de un clasificador entrenado con señales industriales sintéticas.',`${simButton()}`)+
 `<section class="model-hero"><div><div class="eyebrow">MODELO ACTIVO / ENTRENAMIENTO LOCAL</div><h2>Condition Risk Classifier</h2><p>Random Forest entrenado con 6 variables de sensores; genera una probabilidad estimada de fallo para cada lectura. Evaluación con conjunto de prueba separado.</p></div><span class="model-version">${esc(m.version)} · ACTIVE</span></section><div class="eval-grid">${evals}</div>`+
 `<div class="col-grid"><section class="card">${panelTop('Importancia de variables','Contribución relativa de cada señal al clasificador',`<span class="chip">6 FEATURES</span>`)}<div style="padding:7px 22px 12px">${features}</div></section><section class="card">${panelTop('Matriz de confusión','Predicción del modelo vs etiqueta real sintética',`<span class="chip">TEST SET · ${m.test_samples.toLocaleString('es-PE')}</span>`)}<div class="confusion"><div></div><div class="head">Pred. normal</div><div class="head">Pred. fallo</div><div class="head">Real normal</div><div class="matrix-cell"><strong>${c[0][0]}</strong><span>Verdaderos negativos</span></div><div class="matrix-cell bad"><strong>${c[0][1]}</strong><span>Falsos positivos</span></div><div class="head">Real fallo</div><div class="matrix-cell bad"><strong>${c[1][0]}</strong><span>Falsos negativos</span></div><div class="matrix-cell"><strong>${c[1][1]}</strong><span>Verdaderos positivos</span></div></div></section></div>`+
 `<div class="explain-note">${ico('info')} <div><strong>Alcance metodológico:</strong> se generaron ${m.train_samples.toLocaleString('es-PE')} observaciones de entrenamiento y ${m.test_samples.toLocaleString('es-PE')} de prueba con un generador determinista. La etiqueta de riesgo también proviene de reglas sintéticas. Los resultados NO prueban capacidad predictiva sobre fallas reales ni reemplazan un sistema industrial certificado.</div></div>`+
 `<section class="section-head"><h2>Riesgo estimado por activo</h2><span>INFERENCIA CON MODELO ENTRENADO</span></section><section class="card table-panel"><div class="table-wrap"><table class="table"><thead><tr><th>Activo</th><th>Área</th><th>Riesgo estimado</th><th>Estado</th></tr></thead><tbody>${S.assets.map(a=>`<tr data-asset="${a.id}"><td><strong>${a.id}</strong> · ${esc(a.name)}</td><td>${a.zone}</td><td><div style="display:flex;align-items:center;gap:10px;min-width:180px"><div class="progress-bar" style="flex:1"><span style="width:${Math.max(2,a.risk*100)}%"></span></div><strong class="risk-number ${a.status}">${pct(a.risk)}</strong></div></td><td>${pill(a.status)}</td></tr>`).join('')}</tbody></table></div></section>${footer()}`;
}
function alertsPage(){
 const all=S.alerts,counts={all:all.length,critical:all.filter(a=>a.severity==='critical').length,warning:all.filter(a=>a.severity==='warning').length,open:all.filter(a=>!a.acknowledged).length};
 const filtered=all.filter(a=>S.alertFilter==='all'||(S.alertFilter==='open'?!a.acknowledged:a.severity===S.alertFilter));
 const filters=Object.entries({all:'Todas',open:'Sin revisar',critical:'Críticas',warning:'Advertencias'}).map(([k,v])=>`<button class="tab ${S.alertFilter===k?'active':''}" data-alert-filter="${k}">${v} · ${counts[k]}</button>`).join('');
 const rows=filtered.map(a=>`<div class="alert-row"><div class="alert-icon ${a.severity}">${ico('alert')}</div><div class="alert-body"><strong>${esc(a.title)} <span class="status-pill ${a.severity}" style="margin-left:7px">${a.severity==='critical'?'CRÍTICA':'ADVERTENCIA'}</span></strong><p>${esc(a.description)}</p><span class="alert-meta">${a.asset_id} · ${a.zone} · ${timeLabel(a.created_at,true)}</span></div><button class="ack-btn ${a.acknowledged?'done':''}" data-ack="${a.id}" ${a.acknowledged?'disabled':''}>${a.acknowledged?'Revisada':`${ico('check')} Marcar revisada`}</button></div>`).join('');
 return header('ALERT MANAGEMENT / EVENT INBOX','Centro de alertas','Eventos sintéticos generados a partir de condiciones anómalas. Puedes marcarlos como revisados.',`${simButton()}`)+
 `<div class="kpi-grid"><section class="card kpi-card"><div class="kpi-top">Sin revisar</div><div class="kpi-value">${counts.open}</div><div class="kpi-foot">Requieren clasificación</div></section><section class="card kpi-card"><div class="kpi-top">Severidad crítica</div><div class="kpi-value" style="color:#fb8b95">${counts.critical}</div><div class="kpi-foot">Simulación de fallo avanzado</div></section><section class="card kpi-card"><div class="kpi-top">Advertencias</div><div class="kpi-value" style="color:#f4bd7c">${counts.warning}</div><div class="kpi-foot">Degradación temprana</div></section><section class="card kpi-card"><div class="kpi-top">Total de eventos</div><div class="kpi-value">${counts.all}</div><div class="kpi-foot">Almacenados en SQLite</div></section></div><div class="card"><div style="padding:17px 21px;border-bottom:1px solid #27404b"><div class="tab-strip">${filters}</div></div><div class="alert-queue">${rows||`<div class="empty-state">${ico('check')}<h3>No hay eventos</h3><p>No existen alertas que coincidan con el filtro seleccionado.</p></div>`}</div></div>${footer()}`;
}
function pipelinePage(){
 const q=S.pipeline.quality,stats=S.pipeline.stats;
 const nodes=[['activity','01 · SIMULADOR','Señales de 10 activos','960 lecturas iniciales'],['filter','02 · VALIDACIÓN','Sensores y tipos revisados','0 nulos en demo'],['database','03 · HISTORIADOR','SQLite local indexado',`${stats.total_readings.toLocaleString('es-PE')} registros`],['brain','04 · INFERENCIA','RandomForestClassifier','Riesgo 0–100%']].map(([icon,name,desc,tag])=>`<div class="pipeline-node">${ico(icon)}<strong>${name}</strong><p>${desc}</p><span>${tag}</span></div>`).join('');
 const quality=[['Registros almacenados',q.validated.toLocaleString('es-PE'),'Registros recientes auditados'],['Completitud de campos',fmt(q.data_completeness)+'%','Variables obligatorias presentes'],['Valores faltantes',q.null_values,'En lecturas de sensores'],['Eventos interactivos',q.interactive_rows,'Añadidos mediante simulación']].map(([a,b,c])=>`<div class="quality-card"><small>${a}</small><strong>${b}</strong><span>${c}</span></div>`).join('');
 return header('DATA ENGINEERING / LOCAL PIPELINE','Flujo de ingeniería de datos','Arquitectura reproducible para sintetizar, validar, conservar y analizar telemetría.',`${exportButton()} <button class="btn secondary" id="reset-demo">${ico('refresh')} Restaurar demo</button>`)+
 `<div class="data-note">${ico('info')} Pipeline local sin streaming real: la carga inicial es un proceso por lotes y el simulador inserta eventos mediante API REST. Esquema listo para extender a MQTT.</div>`+
 `<section class="card">${panelTop('Arquitectura del flujo','Entrada de telemetría → validación → persistencia → inferencia',badge('LOCAL / SIN NUBE'))}<div class="pipeline-flow">${nodes}</div></section>`+
 `<div class="col-grid" style="margin-top:17px"><section class="card">${panelTop('Calidad del dataset','Validaciones automatizadas sobre las lecturas',`<span class="chip">DATA QUALITY</span>`)}<div class="quality-grid">${quality}</div></section><section class="card">${panelTop('Inventario del dataset','Origen y almacenamiento del laboratorio')}<div style="padding:18px 22px;display:flex;flex-direction:column;gap:17px">${[
 ['Fuente primaria','Simulador determinista NumPy'],['Fuente de eventos','API REST / simulador interactivo'],['Activos registrados',`${stats.assets} activos industriales`],['Ventana histórica','24 horas (datos iniciales)'],['Intervalo de muestra','15 minutos'],['Persistencia','SQLite + índice por activo/fecha']].map(([a,b])=>`<div style="display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #203945;padding-bottom:12px;font-size:11px"><span style="color:#819ca8">${a}</span><strong style="color:#d3e7e5;text-align:right">${b}</strong></div>`).join('')}</div></section></div>`+
 `<section class="section-head"><h2>Diccionario de datos</h2><span>MODELO DE LECTURAS / SENSOR EVENTS</span></section><section class="card table-panel"><table class="table schema-table"><thead><tr><th>Campo</th><th>Tipo / unidad</th><th>Descripción</th></tr></thead><tbody>${S.pipeline.schema.map(s=>`<tr><td>${esc(s.field)}</td><td>${esc(s.type)}</td><td>${esc(s.description)}</td></tr>`).join('')}</tbody></table></section>${footer()}`;
}
const pages={overview:overviewPage,telemetry:telemetryPage,assets:assetsPage,model:modelPage,alerts:alertsPage,pipeline:pipelinePage};
function render(){if(!S.overview)return;root.innerHTML=pages[S.view]();bindViewActions();}
function bindViewActions(){
  document.querySelectorAll('[data-action="open-simulator"]').forEach(b=>b.addEventListener('click',openSimulator));
  document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>viewNav(b.dataset.go)));
  document.querySelectorAll('[data-asset]').forEach(b=>b.addEventListener('click',()=>selectAsset(b.dataset.asset)));
  document.querySelectorAll('[data-metric]').forEach(b=>b.addEventListener('click',()=>{S.selectedMetric=b.dataset.metric;render()}));
  document.querySelectorAll('[data-asset-filter]').forEach(b=>b.addEventListener('click',()=>{S.assetFilter=b.dataset.assetFilter;render()}));
  document.querySelectorAll('[data-alert-filter]').forEach(b=>b.addEventListener('click',()=>{S.alertFilter=b.dataset.alertFilter;render()}));
  document.querySelectorAll('[data-ack]').forEach(b=>b.addEventListener('click',()=>acknowledge(Number(b.dataset.ack))));
  const search=document.getElementById('asset-search');if(search)search.addEventListener('input',e=>{S.assetSearch=e.target.value;const cursor=e.target.selectionStart;render();const next=document.getElementById('asset-search');next.focus();next.setSelectionRange(cursor,cursor)});
  const selector=document.getElementById('asset-select');if(selector)selector.addEventListener('change',e=>selectAsset(e.target.value));
  const reset=document.getElementById('reset-demo');if(reset)reset.addEventListener('click',async()=>{if(!confirm('¿Restaurar las lecturas y alertas originales de demostración?'))return;try{await api('/api/demo/reset',{method:'POST'});await sync();render();showToast('Demo restaurada con 960 lecturas originales.');}catch(e){showToast(e.message,true)}});
}
async function selectAsset(id){S.selectedAsset=id;S.view='telemetry';document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view==='telemetry'));document.getElementById('breadcrumb').textContent=NAV.telemetry;S.assetDetail=null;render();try{S.assetDetail=await api('/api/assets/'+encodeURIComponent(id));render();window.scrollTo(0,0)}catch(e){showToast(e.message,true)}}
function openSimulator(){const node=document.getElementById('sim-asset');node.innerHTML=S.assets.map(a=>`<option value="${a.id}" ${a.id===S.selectedAsset?'selected':''}>${a.id} — ${esc(a.name)}</option>`).join('');document.getElementById('simulator-modal').hidden=false;}
function closeSimulator(){document.getElementById('simulator-modal').hidden=true;}
async function simulate(){const btn=document.getElementById('run-simulation');btn.disabled=true;btn.textContent='Procesando...';try{
  const asset_id=document.getElementById('sim-asset').value;const scenario=document.getElementById('sim-scenario').value;
  const response=await api('/api/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({asset_id,scenario})});
  closeSimulator();await sync();S.assetDetail=null;
  if(S.view==='telemetry'){S.selectedAsset=asset_id;S.assetDetail=await api('/api/assets/'+asset_id);}render();
  showToast(`Lectura registrada para ${asset_id} · Riesgo estimado ${pct(response.reading.risk)}.`);
}catch(e){showToast(e.message,true)}finally{btn.disabled=false;btn.innerHTML=`${ico('play')} Ejecutar simulación`;}}
async function acknowledge(id){try{await api('/api/alerts/'+id+'/acknowledge',{method:'POST'});await sync();render();showToast('Alerta marcada como revisada.')}catch(e){showToast(e.message,true)}}
function clock(){document.getElementById('clock').textContent=new Date().toLocaleString('es-PE',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});}
async function boot(){
 clock();setInterval(clock,30000);
 document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>{viewNav(b.dataset.view);if(b.dataset.view==='telemetry'&&!S.assetDetail)selectAsset(S.selectedAsset);}));
 document.getElementById('menu-toggle').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));
 document.getElementById('bell-button').addEventListener('click',()=>viewNav('alerts'));
 document.getElementById('close-modal').addEventListener('click',closeSimulator);
 document.getElementById('cancel-modal').addEventListener('click',closeSimulator);
 document.getElementById('simulator-modal').addEventListener('click',e=>{if(e.target.id==='simulator-modal')closeSimulator()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSimulator()});
 document.getElementById('run-simulation').addEventListener('click',simulate);
 try{await sync();S.assetDetail=await api('/api/assets/'+S.selectedAsset);render();}catch(e){root.innerHTML=`<div class="empty-state">${ico('alert')}<h3>No se pudo iniciar la demo</h3><p>${esc(e.message)}. Verifica el backend FastAPI.</p></div>`;}
}
boot();
