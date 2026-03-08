(()=>{var Te=(t)=>document.getElementById(t),L=(t)=>Te(t)?.value??"",Fe=(t)=>Boolean(Te(t)?.checked),we=(t,g)=>t.target instanceof Element?t.target.closest(g):null;async function ze(){let t=await fetch("./data.json",{cache:"no-store"});if(!t.ok)throw Error("Could not load data.json");return t.json()}function fe(){let t=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date),g=t.find((f)=>f.type==="year")?.value,c=t.find((f)=>f.type==="month")?.value,s=t.find((f)=>f.type==="day")?.value;return`${g}-${c}-${s}`}function xe(t,g){return`<article class="stat-card"><div class="stat-label">${t}</div><div class="stat-value">${g}</div></article>`}function Ne(t,g,c=""){return`<span class="${g?"chip done":"chip"}"><i class="dot"></i>${t}${c?` · ${c}`:""}</span>`}function je(t){let g=document.getElementById("totals");g.innerHTML=[xe("Barbell Sessions",t.barbell_sessions??0),xe("Cardio Sessions",t.cardio_sessions??0),xe("Rings Sessions",t.rings_sessions??0),xe("Total Training Days",t.total_training_days??0),xe("Active Days (14d)",t.active_days_last_14??0)].join("")}function We(t){let g=document.getElementById("weekHeaderBanner");if(!g)return;if(!t){g.innerHTML='<div class="week-header-title">Cycle info unavailable</div>';return}let c=String(t.main_pct||"").split("/").map((h)=>Number(String(h).replace("%",""))).filter((h)=>Number.isFinite(h)),s=Number(String(t.supp_pct||"").replace("%","")),f=(h)=>Math.max(0,Math.min(100,Number(h)||0)),i=(h)=>{let a=f(h);return 120-120*Math.max(0,Math.min(1,(a-60)/40))},n=(h)=>{let a=i(h),d=`hsl(${a.toFixed(0)} 85% 66%)`,l=`hsl(${a.toFixed(0)} 80% 52%)`,v=`hsl(${a.toFixed(0)} 88% 42%)`;return`linear-gradient(90deg, ${d} 0%, ${l} 55%, ${v} 100%)`},r=c.map((h)=>`<div class="pct-bar"><span style="width:${f(h)}%; background:${n(h)}"></span><label>${h}%</label></div>`).join(""),o=t.deload_code?`<span class="chip done">Deload: ${t.deload_name||t.deload_code}</span>`:"";g.innerHTML=`
    <div class="week-header-title">5/3/1 · ${t.block_type} · Week ${t.week_in_block} ${o}</div>
    <div class="week-header-meta">Main: ${t.main_pct} · Supplemental: ${t.supp_pct}</div>
    <div class="pct-bars">${r}${Number.isFinite(s)?`<div class="pct-bar supp"><span style="width:${f(s)}%; background:${n(s)}"></span><label>Supp ${s}%</label></div>`:""}</div>
  `}function Ze(t={}){let g=document.getElementById("cycleControlPanel");if(!g)return;let c=t.latestBlock||{},s=t.activeDeload||null,i=(t.profiles||[]).map((o)=>`<option value="${o.code}" data-days="${o.default_days||7}">${o.name}</option>`).join(""),n=(t.recentEvents||[]).slice(0,5).map((o)=>`<li>${o.event_date} · ${o.event_type}${o.deload_code?` (${o.deload_code})`:""}</li>`).join(""),r=(t.currentTM||[]).map((o)=>`
    <article class="tm-card">
      <div class="tm-head">
        <strong>${o.lift}</strong>
        <span class="muted">${o.effective_date||"—"}</span>
      </div>
      <div class="tm-value">${Number(o.tm_kg||0).toFixed(1)} kg</div>
      <div class="tm-actions">
        <button class="status-btn" data-tm-lift="${o.lift}" data-tm-delta="-2.5" type="button">-2.5</button>
        <button class="status-btn" data-tm-lift="${o.lift}" data-tm-delta="2.5" type="button">+2.5</button>
        <button class="status-btn" data-tm-lift="${o.lift}" data-tm-delta="5" type="button">+5</button>
      </div>
      <div class="tm-set-row">
        <input class="status-input tm-set-input" id="tmSet-${o.lift}" type="number" step="0.5" placeholder="Set exact kg" />
        <button class="status-btn" data-tm-set="${o.lift}" type="button">Set</button>
      </div>
    </article>
  `).join("");g.innerHTML=`
    <section class="cycle-control-grid">
      <article class="cycle-control-card">
        <h3 class="cycle-section-title">Cycle</h3>
        <div class="muted">Current block: <strong>#${c.block_no||"—"}</strong> · ${c.block_type||"—"}</div>
        <div class="muted">Start: <strong>${c.start_date||"—"}</strong></div>
        <div class="status-actions compact">
          <input id="newCycleStartInput" class="status-input" type="date" />
          <select id="newCycleTypeInput" class="status-input"><option value="Leader">Leader</option><option value="Anchor">Anchor</option></select>
          <button id="startCycleBtn" class="status-btn" type="button">Start New Cycle</button>
        </div>
      </article>

      <article class="cycle-control-card">
        <h3 class="cycle-section-title">Deload</h3>
        <div class="muted">Active: <strong>${s?`${s.name||s.deload_code} (${s.start_date} → ${s.end_date})`:"none"}</strong></div>
        <div class="status-actions compact">
          <select id="deloadTypeInput" class="status-input">${i}</select>
          <input id="deloadStartInput" class="status-input" type="date" />
          <input id="deloadDaysInput" class="status-input" type="number" min="1" step="1" placeholder="Days" />
          <button id="applyDeloadBtn" class="status-btn" type="button">Apply Deload</button>
        </div>
      </article>
    </section>

    <section class="cycle-control-card">
      <h3 class="cycle-section-title">Training Max</h3>
      <div class="tm-grid">${r||'<p class="muted">No TM data.</p>'}</div>
    </section>

    <section class="cycle-control-card">
      <h3 class="cycle-section-title">Recent cycle events</h3>
      <ul class="detail-list">${n||"<li>No events yet.</li>"}</ul>
    </section>
  `}function Ve(t=[],g=[],c={}){let s=document.getElementById("todayGlance");if(!s)return;let f=fe(),i=(t||[]).find((D)=>D.session_date===f);if(!i){s.innerHTML='<div class="today-title">TODAY</div><div class="today-meta">No data for today yet.</div>';return}let n=c?.barbellByDate?.[f]||[],r=n.some((D)=>D.category==="main"),o=n.some((D)=>D.category==="supplemental"),h=!!i.planned_barbell_main,a=!!i.planned_barbell_supp,d=!!i.planned_cardio&&i.planned_cardio!=="OFF",l=!!i.planned_rings,v=[h,a,d,l].filter(Boolean).length,p=[h&&r,a&&o,d&&i.has_cardio,l&&i.has_rings].filter(Boolean).length,y=p===0?"Not Started":p===v?"Completed":"In Progress",$=v?Math.round(p/v*100):0,x=(D,A,V)=>{if(!A)return"";return`<div class="today-line"><span class="today-chip ${V?"done":"pending"}">${V?"done":"pending"}</span>${D} ${A}</div>`},E=h?`${i.planned_barbell_main}`:"",w=a?`${i.planned_barbell_supp} ${i.planned_supp_sets||""}x${i.planned_supp_reps||""}`:"",C=d?i.planned_cardio:"",P=l?`Rings ${i.planned_rings}`:"",Z=(h||a?60:0)+(d?30:0)+(l?20:0);s.innerHTML=`
    <div class="today-title">
      <span><strong>TODAY</strong> · ${f}</span>
      <span class="today-progress"><span class="status-dot ${i.pain_level||"green"}"></span>${p}/${v||0} · ${$}%</span>
    </div>
    <div class="today-meta">Status: <strong>${y}</strong> · Planned time: <strong>${Math.floor(Z/60)}h ${Z%60}m</strong></div>
    <div class="today-lines">
      ${x("\uD83C\uDFCB",E,r)}
      ${x("\uD83C\uDFCB+",w,o)}
      ${x("❤️",C,!!i.has_cardio)}
      ${x("\uD83E\uDD38",P,!!i.has_rings)}
    </div>
    ${y==="Not Started"?'<div class="today-cta"><button class="btn-primary" type="button" id="startSessionBtn">Start Session</button></div>':""}
  `}function qe(t=[],g={}){let c=0,s=0;t.forEach((n)=>{let r=g?.barbellByDate?.[n.session_date]||[],o=r.some((p)=>p.category==="main"),h=r.some((p)=>p.category==="supplemental"),a=!!n.main_lift,d=!!n.main_lift,l=!!n.cardio_plan&&n.cardio_plan!=="OFF",v=!!n.rings_plan;if(a){if(c+=1,o)s+=1}if(d){if(c+=1,h)s+=1}if(l){if(c+=1,n.cardio_done)s+=1}if(v){if(c+=1,n.rings_done)s+=1}});let f=c?Math.round(s/c*100):0,i=document.getElementById("weeklyCompletion");if(i)i.textContent=`Week: ${s}/${c} (${f}%)`}function Ue(t=[],g={}){let c=document.getElementById("performanceKpis");if(!c)return;let s=t.reduce((_,S)=>_+!!S.main_lift+!!S.main_lift+(!!S.cardio_plan&&S.cardio_plan!=="OFF")+!!S.rings_plan,0),f=t.reduce((_,S)=>{let I=g?.barbellByDate?.[S.session_date]||[],oe=I.some((ee)=>ee.category==="main"),De=I.some((ee)=>ee.category==="supplemental");return _+(oe?1:0)+(De?1:0)+(S.cardio_done?1:0)+(S.rings_done?1:0)},0),i=s?Math.round(f/s*100):0,n=fe(),r=Math.max(1,Math.min(7,(new Date(`${n}T00:00:00`).getDay()+6)%7+1)),o=Math.round(s*(r/7)||0),h=s?Math.round(o/s*100):0,a=Math.max(0,o-f),d=g?.cardioByDate||{},l=Object.values(d).flat(),v=[],p=new Set;for(let _ of l){let S=`${_.session_date}|${_.protocol}`;if(p.has(S))continue;p.add(S),v.push(_)}let y=v.filter((_)=>_.protocol==="Z2"),$=v.filter((_)=>String(_.protocol||"").includes("VO2")),x=y.length,E=$.length,w=Math.max(1,x+E),C=Math.round(x/w*100),P=100-C,Z=v.reduce((_,S)=>_+Number(S.duration_min||0),0),D=120,A=(()=>{let _=new Date(`${n}T00:00:00`),S=(_.getDay()+6)%7;return _.setDate(_.getDate()-S),_.toISOString().slice(0,10)})(),V=(()=>{let _=new Date(`${A}T00:00:00`);return _.setDate(_.getDate()+6),_.toISOString().slice(0,10)})(),U=y.filter((_)=>_.session_date>=A&&_.session_date<=V).reduce((_,S)=>_+Number(S.duration_min||0),0),N=g?.barbellByDate||{},O=(_,S)=>{let I=new Date(`${_}T12:00:00Z`);return I.setUTCDate(I.getUTCDate()+S),I.toISOString().slice(0,10)},Y=(_,S)=>{let I=[],oe=_;while(oe<=S)I.push(oe),oe=O(oe,1);return I},J=O(n,-13),B=O(n,-27),Se=O(n,-14),de=Y(J,n),he=Y(B,Se),me=de.map((_)=>(N[_]||[]).reduce((S,I)=>S+Number(I.actual_weight_kg||0)*Number(I.actual_reps||0),0)),Ee=de.map((_)=>(N[_]||[]).filter((S)=>S.category==="main").reduce((S,I)=>S+Number(I.actual_weight_kg||0)*Number(I.actual_reps||0),0)),Me=de.map((_)=>(N[_]||[]).filter((S)=>S.category==="supplemental").reduce((S,I)=>S+Number(I.actual_weight_kg||0)*Number(I.actual_reps||0),0)),Le=de.map((_)=>(d[_]||[]).reduce((S,I)=>S+Number(I.duration_min||0),0)),$e=i>=h?"\uD83D\uDFE2 On pace":a>=2?`\uD83D\uDD34 Behind by ${a} sessions`:"\uD83D\uDFE1 Slightly behind",Ae=C>=75?"\uD83D\uDFE2 Z2-dominant":C>=65?"\uD83D\uDFE1 Slightly VO2-heavy":"\uD83D\uDD34 Too VO2-heavy",Re=U>=D?`\uD83D\uDFE2 Target met (+${U-D}m)`:`\uD83D\uDD34 Under target (${D-U}m short)`;c.innerHTML=`
    <article class="kpi-card"><div class="muted">Training status · weekly execution</div><div class="kpi-value">${i}%</div><div class="muted">Expected by today: ≥${h}% (${o}/${s})</div><div class="muted">${$e}</div></article>
    <article class="kpi-card"><div class="muted">Intensity distribution (Z2 vs VO2)</div><div class="kpi-value">${C}% / ${P}%</div><div class="muted">Target: 75% / 25%</div><div class="muted">${Ae}</div></article>
    <article class="kpi-card"><div class="muted">Z2 volume</div><div class="kpi-value">${U} / ${D} min</div><div class="muted">${Re}</div></article>
  `}function Xe(t=[]){let g=document.getElementById("est1rmRows");if(!g)return;if(!t.length){g.innerHTML='<p class="muted">No main-set data in the last 12 weeks yet.</p>';return}let c=(s=[])=>{let f=(Array.isArray(s)?s:[]).slice().reverse();if(f.length<2)return"";let i=f.map((v)=>Number(v.e1rm)).filter((v)=>Number.isFinite(v));if(i.length<2)return"";let n=120,r=26,o=2,h=Math.min(...i),a=Math.max(...i),d=Math.max(1,a-h),l=i.map((v,p)=>`${(p*(n/(i.length-1))).toFixed(1)},${(r-o-(v-h)/d*(r-2*o)).toFixed(1)}`).join(" ");return`<svg viewBox="0 0 ${n} ${r}" class="spark"><polyline points="${l}" fill="none" stroke="#9ad0ff" stroke-width="2"/></svg>`};g.innerHTML=t.map((s)=>{let f=[];if(typeof s.trend_points==="string")try{f=JSON.parse(s.trend_points)||[]}catch{f=[]}else if(Array.isArray(s.trend_points))f=s.trend_points;let i=Number(s.delta_4w_kg||0),n=i>0?"↑":i<0?"↓":"→",r=Math.max(0,Math.min(100,Number(s.progress_to_next_pct||0)));return`
    <article class="est1rm-card">
      <div class="est1rm-lift">${s.lift}</div>
      <div class="est1rm-value">${s.est_1rm_kg} kg</div>
      <div class="est1rm-level">${s.strength_level} · ${s.bw_ratio}x BW</div>
      <div class="est1rm-meta">4w: ${n} ${Math.abs(i).toFixed(1)} kg · Cycle: ${Number(s.delta_cycle_kg||0).toFixed(1)} kg</div>
      ${c(f)}
      <div class="est1rm-meta">${s.next_level!=="—"?`Next: ${s.next_level} at ${s.next_level_kg} kg`:"Top level reached"} · BW ${s.bodyweight_kg} kg</div>
      <div class="progress-track"><span style="width:${r}%"></span></div>
      <div class="est1rm-meta">${r}% to next level · from ${s.source_weight_kg}×${s.source_reps} (${s.source_date})</div>
    </article>`}).join("")}function Ke(t=[]){let g=document.getElementById("cyclePlanRows");if(!g)return;if(!t.length){g.innerHTML='<p class="muted">No planned sessions found for current cycle.</p>';return}let c=new Map;for(let p of t){if(!c.has(p.session_date))c.set(p.session_date,[]);c.get(p.session_date).push(p)}let s=(p)=>{let y=new Date(`${p}T12:00:00Z`),$=(y.getUTCDay()+6)%7;return y.setUTCDate(y.getUTCDate()-$),y.toISOString().slice(0,10)},f=(p)=>{let y=[...new Set(p.filter((w)=>w.category==="main").map((w)=>w.lift))],$=[...new Set(p.filter((w)=>w.category==="supplemental").map((w)=>w.lift))],x=y.length?y.join(" + "):"Rest",E=$.length?$.join(" + "):"—";return{mainTxt:x,suppTxt:E}},i=(p,y)=>{let $=p.filter((w)=>w.category===y);if(!$.length)return'<p class="muted">—</p>';let x=new Map;for(let w of $){if(!x.has(w.lift))x.set(w.lift,[]);x.get(w.lift).push(w)}let E=[];for(let[w,C]of x.entries()){let P=new Map;for(let A of C){let V=`${A.prescribed_reps}|${A.planned_weight_kg}`;P.set(V,(P.get(V)||0)+1)}let Z=Array.from(P.entries()),D=Z.length===1?(()=>{let[[A,V]]=Z,[U,N]=A.split("|");return`${V}×${U} @ ${N}kg`})():C.map((A)=>`${A.planned_weight_kg}×${A.prescribed_reps}`).join(" · ");E.push(`<li><strong>${w}</strong>: ${D}</li>`)}return`<ul class="detail-list">${E.join("")}</ul>`},n=Array.from(c.keys()).sort(),r=(p,y)=>{let $=new Date(`${p}T12:00:00Z`);return $.setUTCDate($.getUTCDate()+y),$.toISOString().slice(0,10)},o=s(n[0]),h=s(n[n.length-1]),a=[];for(let p=o;p<=h;p=r(p,7))a.push(p);let d=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];g.innerHTML=a.map((p,y)=>{let $=[];for(let x=0;x<7;x++){let E=r(p,x),w=c.get(E)||[];if(!w.length)continue;let{mainTxt:C,suppTxt:P}=f(w);$.push(`<article class="cycle-day-tile" data-cycle-date="${E}" tabindex="0"><div class="tile-date">${d[x]} · ${E}</div><div class="tile-main">${C}</div><div class="muted">Supp: ${P}</div></article>`)}return`
      <section class="cycle-week-block">
        <div class="panel-head"><h3>Week ${y+1} <span class="muted">· ${p}</span></h3></div>
        <div class="cycle-calendar-grid">
          ${$.join("")}
        </div>
      </section>`}).join("");let l=document.getElementById("cyclePlanModal");if(!l)l=document.createElement("div"),l.id="cyclePlanModal",l.className="modal",l.innerHTML='<div class="modal-card" role="dialog" aria-modal="true"><div class="modal-head"><h3 id="cyclePlanTitle">Planned session</h3><button type="button" class="modal-close" id="cyclePlanClose">×</button></div><div id="cyclePlanBody" class="modal-body"></div></div>',document.body.appendChild(l),l.addEventListener("click",(p)=>{if(p.target===l)l.classList.remove("open")}),l.querySelector("#cyclePlanClose")?.addEventListener("click",()=>l.classList.remove("open"));let v=(p)=>{let y=c.get(p)||[],$=document.getElementById("cyclePlanTitle"),x=document.getElementById("cyclePlanBody");if(!$||!x)return;$.textContent=`Planned session · ${p}`,x.innerHTML=`
      <section class="detail-section"><h4>Main</h4>${i(y,"main")}</section>
      <section class="detail-section"><h4>Supplemental</h4>${i(y,"supplemental")}</section>
    `,l.classList.add("open")};g.querySelectorAll(".cycle-day-tile").forEach((p)=>{let y=()=>v(p.getAttribute("data-cycle-date"));p.addEventListener("click",y),p.addEventListener("keydown",($)=>{if($.key==="Enter"||$.key===" ")$.preventDefault(),y()})})}function Ye(t={}){let g=document.getElementById("cardioAnalytics");if(!g)return;let c=t.total_z2||0,s=t.z2_in_cap||0,f=t.z2_compliance_pct??0,i=(e)=>{if(Array.isArray(e))return e;if(typeof e==="string")try{return JSON.parse(e)}catch{return[]}return[]},n=i(t.z2_points),r=n.map((e)=>{let m=Number(e.avg_hr),k=Number(e.max_hr);if(Number.isFinite(m)&&m>0)return{date:e.session_date,hr:m,estimated:!1};if(Number.isFinite(k)&&k>0)return{date:e.session_date,hr:k,estimated:!0};return null}).filter((e)=>e&&Number.isFinite(e.hr)&&e.hr>0).sort((e,m)=>e.date<m.date?-1:1),o=i(t.z2_scatter_points).map((e)=>({date:e.session_date,hr:Number(e.avg_hr),speed:Number(e.speed_kmh)})).filter((e)=>e.hr>0&&e.speed>0).sort((e,m)=>e.date<m.date?-1:1).slice(-8),h=i(t.z2_efficiency_points).map((e)=>({date:e.session_date,efficiency:Number(e.efficiency),speedAt120:Number(e.speed_at_120),speedAt140:Number(e.speed_at_140)})).filter((e)=>e.efficiency>0).sort((e,m)=>e.date<m.date?-1:1),a=i(t.z2_decoupling_points).map((e)=>({date:e.session_date,decoupling:Number(e.decoupling_pct)})).filter((e)=>Number.isFinite(e.decoupling)).sort((e,m)=>e.date<m.date?-1:1),d=i(t.vo2_points),l=(window.__dashboardData?.aerobicTests||[]).map((e)=>({...e})),v='<p class="muted">No Z2 HR data in last 12 weeks.</p>',p=r.slice(-8);if(p.length>=2){let z=p.map((b)=>Number(b.hr)),X=Math.floor((Math.min(...z)-3)/5)*5,K=Math.ceil((Math.max(...z)+3)/5)*5,M=Math.max(5,K-X),se=278,ge=92,j=p.map((b,u)=>({x:32+u*(278/(p.length-1)),y:10+(1-(Number(b.hr)-X)/M)*92,hr:Number(b.hr),date:b.date,estimated:!!b.estimated})),G=[0,0.25,0.5,0.75,1].map((b)=>({hr:Math.round(X+b*M),y:10+(1-b)*92})),te=125,ne=10+(1-(125-X)/M)*92,ce=j.map((b)=>`${b.x},${b.y}`).join(" "),W=G.map((b)=>`<line x1="32" y1="${b.y}" x2="310" y2="${b.y}" class="z2-grid"/>`).join(""),R=G.map((b)=>`<text x="26" y="${b.y+3}" class="z2-label" text-anchor="end">${b.hr}</text>`).join(""),Q=j.map((b)=>`<g><circle cx="${b.x}" cy="${b.y}" r="2.8" style="opacity:${b.estimated?"0.65":"1"}"></circle><title>${b.date}: HR ${b.hr}${b.estimated?" (from max HR)":""}</title></g>`).join(""),be=new Map(n.map((b)=>[b.session_date,Number(b.speed_kmh)])),ae=j.map((b)=>{let u=Number(be.get(b.date));return Number.isFinite(u)&&u>0&&b.hr>0?{x:b.x,eff:u/b.hr}:null}).filter(Boolean),pe="",ve="efficiency line: need speed+HR logs";if(ae.length>=2){let b=Math.min(...ae.map((ue)=>ue.eff)),u=Math.max(...ae.map((ue)=>ue.eff)),H=Math.max(0.0001,u-b);pe=`<polyline points="${ae.map((ue)=>({x:ue.x,y:10+(1-(ue.eff-b)/H)*92})).map((ue)=>`${ue.x},${ue.y}`).join(" ")}" fill="none" stroke="#ff8cc6" stroke-width="2" stroke-dasharray="4 2"/>`;let ye=ae[0].eff,Oe=(ae[ae.length-1].eff-ye)/ye*100;ve=`efficiency Δ ${Oe>=0?"+":""}${Oe.toFixed(1)}%`}let _e=(j[j.length-1].hr-j[0].hr).toFixed(1),le=p.filter((b)=>b.estimated).length;v=`
      <div class="z2-graph-wrap">
        <svg viewBox="0 0 320 120" class="z2-graph" role="img" aria-label="Z2 average HR trend">
          ${W}${R}
          <line x1="32" y1="102" x2="310" y2="102" class="z2-axis"/>
          <line x1="32" y1="10" x2="32" y2="102" class="z2-axis"/>
          <line x1="32" y1="${ne}" x2="310" y2="${ne}" stroke="#ffc15a" stroke-dasharray="3 2" stroke-width="1.2"/>
          <text x="310" y="${Math.max(8,ne-3)}" class="z2-label" text-anchor="end">Z2 cap 125</text>
          <polyline points="${ce}" class="z2-line"/>
          ${pe}
          ${Q}
          <text x="32" y="117" class="z2-label">${j[0]?.date||""}</text>
          <text x="310" y="117" class="z2-label" text-anchor="end">${j[j.length-1]?.date||""}</text>
        </svg>
        <div class="muted">Last ${p.length} Z2 sessions · HR trend Δ ${_e} bpm${le?` · ${le} points estimated from max HR`:""} · ${ve}</div>
      </div>`}let y='<div class="cardio-empty"><div><strong>Unlock this chart</strong></div><div class="muted">Log speed in notes as: <code>@ 6.2 km/h</code></div></div>';if(o.length>=2){let z=Math.min(...o.map((R)=>R.speed))-0.2,X=Math.max(...o.map((R)=>R.speed))+0.2,K=Math.floor((Math.min(...o.map((R)=>R.hr))-3)/5)*5,M=Math.ceil((Math.max(...o.map((R)=>R.hr))+3)/5)*5,se=Math.max(0.5,X-z),ge=Math.max(5,M-K),j=272,G=144,ne=o.map((R,Q)=>({...R,i:Q,x:36+(R.speed-z)/se*272,y:12+(1-(R.hr-K)/ge)*144,opacity:(0.35+0.65*(Q+1)/o.length).toFixed(2)})).map((R)=>`<circle cx="${R.x}" cy="${R.y}" r="3.2" style="fill:#59a8ff;opacity:${R.opacity}"><title>${R.date}: ${R.speed.toFixed(1)} km/h · HR ${R.hr}</title></circle>`).join(""),ce="",W="Need ≥4 sessions for a stable trendline";if(o.length>=4){let R=o.reduce((u,H)=>u+H.speed,0)/o.length,Q=o.reduce((u,H)=>u+H.hr,0)/o.length,be=o.reduce((u,H)=>u+(H.speed-R)*(H.hr-Q),0),ae=o.reduce((u,H)=>u+(H.speed-R)**2,0)||1,pe=be/ae,ve=Q-pe*R,_e=pe*z+ve,le=pe*X+ve,b=(u)=>12+(1-(u-K)/ge)*144;ce=`<line x1="36" y1="${b(_e)}" x2="308" y2="${b(le)}" class="vo2-line line-44"/>`,W="Trendline shown (≥4 sessions)"}y=`
      <div class="z2-graph-wrap">
        <svg viewBox="0 0 320 180" class="z2-graph" role="img" aria-label="Z2 speed vs HR scatter">
          <line x1="36" y1="156" x2="308" y2="156" class="z2-axis"/>
          <line x1="36" y1="12" x2="36" y2="156" class="z2-axis"/>
          ${ce}
          ${ne}
          <text x="160" y="176" class="z2-label" text-anchor="middle">Speed (km/h)</text>
          <text x="12" y="90" class="z2-label" text-anchor="middle" transform="rotate(-90 12 ${"90"})">Avg HR</text>
        </svg>
        <div class="muted">Older = lighter dot · newer = darker dot · ${W}</div>
      </div>`}let $='<p class="muted">Adaptation status unavailable.</p>',x='<p class="muted">No Z2 KPI data yet.</p>',E='<p class="muted">No Z2 efficiency points yet.</p>',w='<p class="muted">Aerobic status unavailable.</p>';if(h.length>=1){let e=h.slice(-8),m=e[e.length-1],k=e[0],T=h[0],F=h.slice(-4),q=F.reduce((te,ne)=>te+ne.efficiency,0)/F.length,z=k?(m.efficiency-k.efficiency)/k.efficiency*100:0,X=T?(m.efficiency-T.efficiency)/T.efficiency*100:0,K=z>1?"Improving":z<-1?"Regressing":"Flat",M=z>1&&f>=70?"\uD83D\uDFE2 On track":f<60?"\uD83D\uDFE1 Needs consistency":"\uD83D\uDFE1 Stable but no gain",se=z>1?"Keep current Z2 structure.":"Increase Z2 volume by +20 min/week or progress treadmill speed slightly.",j=[...d].slice(-6).filter((te)=>Number(te.avg_speed_kmh||te.max_speed_kmh||0)>0).length>=2?"Adequate":"Low";$=`
      <div class="cardio-z2-card" style="grid-column:1 / -1">
        <div class="muted">Am I adapting?</div>
        <div class="cardio-z2-big">${z>1&&f>=70&&j==="Adequate"?"\uD83D\uDFE2 Adapting":f<60||z<-1?"\uD83D\uDD34 Off track":"\uD83D\uDFE1 In progress"}</div>
        <div class="muted">Efficiency ${K} · Compliance ${f}% · VO2 stimulus ${j} · Drift data ${a.length?"present":"missing"}</div>
      </div>`,x=`
      <div class="cardio-z2-card">
        <div class="muted">Z2 KPI status</div>
        <div class="cardio-z2-big">${K}</div>
        <div class="muted">${M}</div>
        <div class="muted">Baseline: ${T.efficiency.toFixed(3)} (${T.date})</div>
        <div class="muted">Current: ${m.efficiency.toFixed(3)} (${m.date})</div>
        <div class="muted">${F.length}-session avg: ${q.toFixed(3)} · MoM proxy Δ ${z.toFixed(1)}%</div>
      </div>`,E=`
      <div class="cardio-z2-card">
        <div class="muted">Fixed-HR benchmark (primary)</div>
        <div class="cardio-z2-big">${Number.isFinite(m.speedAt120)?m.speedAt120.toFixed(2):"—"} km/h</div>
        <div class="muted">at 120 bpm · Efficiency ${m.efficiency.toFixed(3)}</div>
        <div class="muted">Example: ${Number.isFinite(m.speedAt120)?m.speedAt120.toFixed(1):"6.1"} km/h @ 120 bpm</div>
        <div class="muted">Δ ${X.toFixed(1)}% vs baseline · Alt @140: ${Number.isFinite(m.speedAt140)?m.speedAt140.toFixed(2):"—"} km/h</div>
      </div>`,w=`
      <div class="cardio-z2-card" style="grid-column:1 / -1">
        <div class="muted">Aerobic Status</div>
        <div class="muted">Efficiency: ${K} · Compliance: ${f}% · Drift data: ${a.length?"Available":"Missing"} </div>
        <div class="muted"><strong>Recommendation:</strong> ${se}</div>
      </div>`}let C='<p class="muted">No decoupling data yet (requires end HR in notes, e.g. "end BPM 141").</p>';if(a.length)C=`
      <div class="cardio-z2-card">
        <div class="muted">Aerobic decoupling (quarterly check)</div>
        ${a.slice(-5).map((k)=>{let T=k.decoupling<5?"good":k.decoupling<=7?"watch":"high";return`<div class="muted">${k.date}: ${k.decoupling.toFixed(1)}% (${T})</div>`}).join("")}
        <div class="muted">Guide: &lt;5% good · 5–7% watch · &gt;7% high drift</div>
      </div>`;let P=(e,m,k=(T)=>T)=>{if((e||[]).length<2)return'<p class="muted">Need at least 2 tests.</p>';let T=320,F=120,q=30,z=8,X=10,K=18,M=e.map(m).map(Number).filter((W)=>Number.isFinite(W));if(M.length<2)return'<p class="muted">Insufficient numeric data.</p>';let se=Math.min(...M),ge=Math.max(...M),j=Math.max(1,ge-se),G=T-q-z,te=F-X-K,ne=e.map((W,R)=>{let Q=Number(m(W));return{x:q+R*(G/(e.length-1)),y:X+(1-(Q-se)/j)*te,v:Q,d:W.date}}),ce=ne.map((W)=>`${W.x},${W.y}`).join(" ");return`<svg viewBox="0 0 ${T} ${F}" class="z2-graph"><line x1="${q}" y1="${F-K}" x2="${T-z}" y2="${F-K}" class="z2-axis"/><line x1="${q}" y1="${X}" x2="${q}" y2="${F-K}" class="z2-axis"/><polyline points="${ce}" class="z2-line"/>${ne.map((W)=>`<circle cx="${W.x}" cy="${W.y}" r="2.6"><title>${W.d}: ${k(W.v)}</title></circle>`).join("")}</svg>`},Z=l.filter((e)=>e.test_type==="FIXED_SPEED"&&Number(e.avg_hr)>0),D=l.filter((e)=>e.test_type==="FIXED_HR"&&Number(e.avg_speed)>0),A=l.filter((e)=>e.test_type==="ZONE2_SESSION"&&Number(e.decoupling_percent)>=0),V=Z[Z.length-1],U=D[D.length-1],N=A[A.length-1],O=(e,m,k)=>Math.max(m,Math.min(e,k)),Y=(e)=>O(100*(170-Number(e))/30,0,100),J=(e)=>O(100*(Number(e)-5)/4,0,100),B=(e)=>O(100*(10-Number(e))/10,0,100),Se=(e)=>e>=80?"excellent":e>=65?"strong":e>=50?"average":e>=35?"developing":"weak base",de=new Map;for(let e of l){let m=String(e.date||"").slice(0,7);if(!m)continue;if(!de.has(m))de.set(m,{});let k=de.get(m);k[e.test_type]=e}let he=Array.from(de.entries()).sort((e,m)=>e[0]<m[0]?-1:1).map(([e,m])=>{if(!m.FIXED_SPEED||!m.FIXED_HR||!m.ZONE2_SESSION)return null;let k=Y(m.FIXED_SPEED.avg_hr),T=J(m.FIXED_HR.avg_speed),F=B(m.ZONE2_SESSION.decoupling_percent),q=0.4*T+0.35*k+0.25*F;return{date:`${e}-01`,afs:Number(q.toFixed(1)),eff:k,cap:T,dur:F}}).filter(Boolean),me=he[he.length-1]||null,Ee=he.length>1?he[he.length-2]:null,Me=me&&Ee?me.afs-Ee.afs:null,Le=(e)=>{if(!e)return 999;let m=new Date(`${fe()}T00:00:00`).getTime()-new Date(`${e}T00:00:00`).getTime();return Math.floor(m/86400000)},$e=(e,m)=>{let k=Le(m);if(k>35)return`${e}: overdue (${k}d)`;if(k>27)return`${e}: due soon (${k}d)`;return`${e}: ok (${k}d)`},Re=`
    <div class="cardio-z2-card ${((e)=>{if(e==null||!Number.isFinite(e))return"afs-none";if(e>=80)return"afs-elite";if(e>=65)return"afs-green";if(e>=50)return"afs-yellow";if(e>=35)return"afs-orange";return"afs-red"})(me?.afs)}"><div class="muted">Aerobic Fitness Score (AFS)</div><div class="cardio-z2-big">${me?me.afs.toFixed(1):"—"}</div><div class="muted">${me?Se(me.afs):"need all 3 monthly tests"}${Me==null?"":` · ${Me>=0?"↑":"↓"} ${Math.abs(Me).toFixed(1)}`}</div></div>
    <div class="cardio-z2-card"><div class="muted">Cardio Efficiency (HR @ 11 km/h)</div><div class="cardio-z2-big">${V?Number(V.avg_hr).toFixed(0):"—"}</div><div class="muted">Trend target: ↓</div></div>
    <div class="cardio-z2-card"><div class="muted">Aerobic Capacity (speed @ 120 bpm)</div><div class="cardio-z2-big">${U?Number(U.avg_speed).toFixed(2):"—"} km/h</div><div class="muted">Trend target: ↑</div></div>
    <div class="cardio-z2-card"><div class="muted">Aerobic Durability (Pa:Hr)</div><div class="cardio-z2-big">${N?Number(N.decoupling_percent).toFixed(1):"—"}%</div><div class="muted">Trend target: ↓</div></div>
    <div class="cardio-z2-card"><div class="muted">Monthly test scheduler</div><div class="muted">${$e("Fixed-speed",V?.date)}<br/>${$e("Fixed-HR",U?.date)}<br/>${$e("Decoupling",N?.date)}</div></div>
  `,_=[...d||[]].slice(-16),S='<p class="muted">No VO2 data in last 12 weeks.</p>';if(_.length>=1){let z={VO2_4x4:3,VO2_1min:1},X=_.map((M)=>({date:M.session_date,protocol:M.protocol,speed:Number(M.avg_speed_kmh||M.max_speed_kmh||0),hr:Number(M.avg_hr??M.max_hr??0),workMin:Number(M.work_min||(M.protocol==="VO2_4x4"?4:M.protocol==="VO2_1min"?1:0)),restMin:Number(M.easy_min||M.rest_min||z[M.protocol]||0)})).filter((M)=>M.hr>0&&(M.protocol==="VO2_4x4"||M.protocol==="VO2_1min")).sort((M,se)=>M.date<se.date?-1:1),K=(M,se,ge,j)=>{let G=X.filter((u)=>u.protocol===M);if(!G.length)return`<div class="z2-graph-wrap"><p class="muted">${j}: no data.</p></div>`;let te=Math.floor((Math.min(...G.map((u)=>u.hr))-3)/5)*5,ne=Math.ceil((Math.max(...G.map((u)=>u.hr))+3)/5)*5,ce=Math.max(5,ne-te),W=266,R=92,Q=G.map((u,H)=>({...u,x:G.length===1?32+W/2:32+H*(W/(G.length-1)),y:10+(1-(u.hr-te)/ce)*R})),be=Q.length>=2?`<polyline points="${Q.map((u)=>`${u.x},${u.y}`).join(" ")}" class="vo2-line ${ge}"/>`:"",ae=Q.map((u,H)=>{let re=H%2===0?-6:12,ye=Number.isFinite(u.speed)&&u.speed>0?`${u.speed}k`:"",Pe=u.workMin>0?`${u.workMin}/${u.restMin||0}m`:"n/a";return`<g><circle cx="${u.x}" cy="${u.y}" r="2.8" class="${se}"></circle>${ye?`<text x="${u.x}" y="${u.y+re}" class="z2-point-label" text-anchor="middle">${ye}</text>`:""}<title>${u.date} ${M}: ${Number.isFinite(u.speed)&&u.speed>0?`${u.speed} km/h`:"no speed logged"} · HR ${u.hr} · work/rest ${Pe}</title></g>`}).join(""),pe=[0,0.25,0.5,0.75,1].map((u)=>{let H=Math.round(te+u*ce),re=10+(1-u)*R;return{hrTick:H,y:re}}),ve=pe.map((u)=>`<line x1="32" y1="${u.y}" x2="298" y2="${u.y}" class="z2-grid"/>`).join(""),_e=pe.map((u)=>`<text x="26" y="${u.y+3}" class="z2-label" text-anchor="end">${u.hrTick}</text>`).join(""),le=G.filter((u)=>Number.isFinite(u.speed)&&u.speed>0&&Number.isFinite(u.hr)&&u.hr>0).map((u)=>{let H=Math.max(0,u.workMin||0),re=Math.max(0,u.restMin||0),ye=H>0&&re>0?H/re:H>0?1:0;return{...u,eff:u.speed/u.hr*ye}}),b=`${j}: need ≥2 sessions with speed + HR logged`;if(le.length>=2){let u=le[0],H=le[le.length-1],re=(H.eff-u.eff)/u.eff*100;b=`${j} efficiency Δ ${re>=0?"+":""}${re.toFixed(1)}% (${u.eff.toFixed(4)} → ${H.eff.toFixed(4)}, ${le.length} sessions, rest-adjusted)`}return`
        <div class="z2-graph-wrap" style="margin-bottom:10px">
          <div class="muted" style="margin-bottom:4px">${j}</div>
          <svg viewBox="0 0 320 120" class="z2-graph" role="img" aria-label="${j} HR efficiency trend">
            ${ve}
            ${_e}
            <line x1="32" y1="102" x2="298" y2="102" class="z2-axis"/>
            <line x1="32" y1="10" x2="32" y2="102" class="z2-axis"/>
            ${be}
            ${ae}
          </svg>
          <div class="vo2-legend"><span class="muted">${b}</span></div>
        </div>
      `};S=`${K("VO2_4x4","vo2-pt-44","line-44","VO2 4x4")} ${K("VO2_1min","vo2-pt-18","line-18","VO2 1min")}`}g.innerHTML=`
    <div class="cardio-analytics">
      ${$}
      <div class="cardio-z2-card">
        <div class="muted">Z2 compliance</div>
        <div class="cardio-z2-big">${f}%</div>
        <div class="muted">${s}/${c} sessions in cap</div>
      </div>
      ${x}
      ${E}
      ${C}
      ${w}
      <div class="cardio-vo2-list" style="grid-column:1 / -1">
        <div class="muted" style="margin-bottom:6px">Aerobic Fitness (monthly tests)</div>
        <div class="cardio-analytics">${Re}</div>
        <div class="test-specs">
          <div><strong>Fixed-Speed Cardiovascular Efficiency</strong> · Run at <strong>11.0 km/h</strong>, <strong>0% incline</strong>, <strong>2.4 km</strong> (~13:05). Log avg/max HR. Lower HR over time = better.</div>
          <div><strong>Fixed-HR Aerobic Capacity</strong> · <strong>30 min</strong> treadmill at <strong>0% incline</strong>, hold <strong>120 bpm</strong>. Log avg speed. Higher speed over time = better.</div>
          <div><strong>Aerobic Decoupling (Pa:Hr)</strong> · During steady Z2 run (prefer <strong>40+ min</strong>, min 30), keep pace constant. Log first-half HR and second-half HR. Lower % drift = better.</div>
        </div>
        <div class="status-actions" style="margin-top:8px">
          <button type="button" class="status-btn" id="logFixedSpeedBtn">Log Fixed-Speed (11 km/h)</button>
          <button type="button" class="status-btn" id="logFixedHrBtn">Log Fixed-HR (120 bpm)</button>
          <button type="button" class="status-btn" id="logDecouplingBtn">Log Decoupling (Z2)</button>
        </div>
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">Aerobic Fitness Score (AFS)</div>
        ${P(he,(e)=>e.afs,(e)=>`${Number(e).toFixed(1)}`)}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">HR at 11 km/h</div>
        ${P(Z,(e)=>e.avg_hr,(e)=>`${e} bpm`)}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">Speed at 120 bpm</div>
        ${P(D,(e)=>e.avg_speed,(e)=>`${Number(e).toFixed(2)} km/h`)}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">Aerobic Decoupling %</div>
        ${P(A,(e)=>e.decoupling_percent,(e)=>`${Number(e).toFixed(1)}%`)}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">Z2 HR variation trend</div>
        ${v}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">Z2 speed vs HR (scatter + trendline)</div>
        ${y}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">VO2 HR efficiency trends (by protocol)</div>
        ${S}
      </div>
    </div>
  `;let I=async(e)=>{let m=await fetch("/api/log-aerobic-test",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(!m.ok){let k=`failed (${m.status})`;try{let T=await m.json();if(T?.error)k=T.error}catch{}throw Error(k)}},oe=fe(),De=()=>{let e=document.getElementById("aerobicEntryModal");if(e)return e;return e=document.createElement("div"),e.id="aerobicEntryModal",e.className="modal",e.innerHTML=`
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="aeroTitle">
        <div class="modal-head">
          <h3 id="aeroTitle">Log aerobic test</h3>
          <button type="button" class="modal-close" id="aeroCloseBtn">×</button>
        </div>
        <div id="aeroBody" class="modal-body"></div>
      </div>`,document.body.appendChild(e),e.addEventListener("click",(m)=>{if(m.target===e)e.classList.remove("open")}),e.querySelector("#aeroCloseBtn")?.addEventListener("click",()=>e.classList.remove("open")),e},ee=(e)=>{let m=parseFloat(L(e));return Number.isFinite(m)?m:null},Be=(e)=>{let m=De(),k=m.querySelector("#aeroTitle"),T=m.querySelector("#aeroBody");if(!k||!T)return;if(e==="FIXED_SPEED")k.textContent="Log Fixed-Speed Test (11.0 km/h, 0% incline, 2.4 km)",T.innerHTML=`
        <div class="status-actions"><input id="aeroAvgHr" class="status-input" type="number" step="1" placeholder="Average HR" /><input id="aeroMaxHr" class="status-input" type="number" step="1" placeholder="Max HR (optional)" /></div>
        <div class="status-actions"><button type="button" class="status-btn" id="aeroSaveBtn">Save Test</button></div>`,T.querySelector("#aeroSaveBtn")?.addEventListener("click",async()=>{let F=ee("aeroAvgHr"),q=ee("aeroMaxHr");if(!F||F<=0)return alert("Enter average HR");await I({testType:"FIXED_SPEED",date:oe,speed:11,distance:2.4,duration:13,avgHr:F,maxHr:q,notes:"Monthly fixed-speed test"}),m.classList.remove("open"),await window.__renderDashboard()});if(e==="FIXED_HR")k.textContent="Log Fixed-HR Test (120 bpm, 30 min, 0% incline)",T.innerHTML=`
        <div class="status-actions"><input id="aeroAvgSpeed" class="status-input" type="number" step="0.1" placeholder="Average speed (km/h)" /><input id="aeroAvgHr" class="status-input" type="number" step="1" placeholder="Average HR (default 120)" value="120" /></div>
        <div class="status-actions"><button type="button" class="status-btn" id="aeroSaveBtn">Save Test</button></div>`,T.querySelector("#aeroSaveBtn")?.addEventListener("click",async()=>{let F=ee("aeroAvgSpeed"),q=ee("aeroAvgHr")||120;if(!F||F<=0)return alert("Enter average speed");await I({testType:"FIXED_HR",date:oe,duration:30,avgSpeed:F,avgHr:q,notes:"Monthly fixed-HR test"}),m.classList.remove("open"),await window.__renderDashboard()});if(e==="ZONE2_SESSION")k.textContent="Log Decoupling Test (steady Z2)",T.innerHTML=`
        <div class="status-actions"><input id="aeroHr1" class="status-input" type="number" step="1" placeholder="HR first half" /><input id="aeroHr2" class="status-input" type="number" step="1" placeholder="HR second half" /></div>
        <div class="status-actions"><input id="aeroS1" class="status-input" type="number" step="0.1" placeholder="Speed first half (optional)" /><input id="aeroS2" class="status-input" type="number" step="0.1" placeholder="Speed second half (optional)" /></div>
        <div class="status-actions"><button type="button" class="status-btn" id="aeroSaveBtn">Save Test</button></div>`,T.querySelector("#aeroSaveBtn")?.addEventListener("click",async()=>{let F=ee("aeroHr1"),q=ee("aeroHr2"),z=ee("aeroS1"),X=ee("aeroS2");if(!F||!q||F<=0)return alert("Enter first and second half HR");await I({testType:"ZONE2_SESSION",date:oe,duration:40,hrFirstHalf:F,hrSecondHalf:q,speedFirstHalf:z,speedSecondHalf:X,notes:"Monthly decoupling test"}),m.classList.remove("open"),await window.__renderDashboard()});m.classList.add("open")},Ie=document.getElementById("logFixedSpeedBtn");if(Ie)Ie.onclick=()=>Be("FIXED_SPEED");let Ce=document.getElementById("logFixedHrBtn");if(Ce)Ce.onclick=()=>Be("FIXED_HR");let He=document.getElementById("logDecouplingBtn");if(He)He.onclick=()=>Be("ZONE2_SESSION")}function Je(t=[]){let g=document.getElementById("auditLogPanel");if(!g)return;if(!t.length){g.innerHTML='<p class="muted">No audit events yet.</p>';return}g.innerHTML=`<div class="audit-list">${t.map((c)=>{let s=(c.event_time||"").replace("T"," ").slice(0,19),f=c.old_value||c.new_value?`${c.old_value??"∅"} → ${c.new_value??"∅"}`:"";return`
      <div class="audit-row">
        <div class="audit-top">
          <span>${c.domain} · ${c.action} · ${c.key_name||"-"}</span>
          <span>${s}</span>
        </div>
        ${f?`<div class="audit-meta">${f}</div>`:""}
        ${c.note?`<div class="audit-meta">${c.note}</div>`:""}
      </div>
    `}).join("")}</div>`}function Ge(t){let g=document.getElementById("weekRows"),c=fe();g.innerHTML=t.map((s)=>{let f=[!!s.main_lift,!!s.cardio_plan&&s.cardio_plan!=="OFF",!!s.rings_plan].filter(Boolean).length,i=[!!s.barbell_done,!!s.cardio_done,!!s.rings_done].filter(Boolean).length;return`
    <article class="week-row ${i===f&&f>0?"done-all":i>0?"partial":s.session_date>=c?"upcoming":""}" role="button" tabindex="0" data-date="${s.session_date}">
      <div class="week-meta">
        <div class="week-day">${s.day_name.slice(0,3)}</div>
        <div class="muted">${s.session_date.slice(5)}</div>
      </div>
      <div class="week-chips">
        ${Ne("\uD83C\uDFCB",s.barbell_done,s.main_lift||"—")}
        ${Ne("❤️",s.cardio_done,s.cardio_plan||"OFF")}
        ${Ne("\uD83E\uDD38",s.rings_done,s.rings_plan||"—")}
      </div>
    </article>`}).join("")}function Qe(t,g={}){let c=document.getElementById("dailyTiles"),s=fe(),f=({icon:n,planned:r,done:o,detail:h,isPast:a})=>{if(!r)return"";let d="badge planned";if(o)d="badge done";else if(!o&&a)d="badge missed";return`<span class="${d}">${n} ${h||""}</span>`},i=[...t].reverse();c.innerHTML=i.map((n)=>{let r=n.session_date<s,o=g?.barbellByDate?.[n.session_date]||[],h=o.some((U)=>U.category==="main"),a=o.some((U)=>U.category==="supplemental"),d=!!n.planned_barbell_main,l=!!n.planned_barbell_supp,v=!!n.planned_cardio&&n.planned_cardio!=="OFF",p=!!n.planned_rings,y=d?`${n.planned_barbell_main}`.trim():n.barbell_lift,$=l?`${n.planned_barbell_supp} ${n.planned_supp_sets||""}x${n.planned_supp_reps||""}`.trim():"",x=n.planned_cardio||n.cardio_protocol,E=n.planned_rings||n.rings_template,w=n.pain_level||"green",P=[`<span class="status-dot clickable ${w}" data-date="${n.session_date}" data-status="${w}" data-role="status-dot" title="Recovery status: ${w} (tap to change)"></span>`,f({icon:"\uD83C\uDFCB",planned:d,done:h,detail:y,isPast:r}),f({icon:"\uD83C\uDFCB+",planned:l,done:a,detail:$,isPast:r}),f({icon:"❤️",planned:v,done:!!n.has_cardio,detail:x,isPast:r}),f({icon:"\uD83E\uDD38",planned:p,done:!!n.has_rings,detail:E,isPast:r})].filter(Boolean).join(""),Z=[d&&h,l&&a,v&&n.has_cardio,p&&n.has_rings].filter(Boolean).length,D=[d,l,v,p].filter(Boolean).length,A=D===0?"Rest day":`${Z}/${D} complete`,V=new Date(`${n.session_date}T00:00:00`).toLocaleDateString(void 0,{weekday:"short"});return`
      <article class="tile" role="button" tabindex="0" data-date="${n.session_date}">
        <div class="tile-date">${V} · ${n.session_date}</div>
        <div class="tile-main">${A}</div>
        <div class="tile-flags">${P}</div>
      </article>
    `}).join("")}function ke(t,g){return`<section class="detail-section"><h4>${t}</h4>${g}</section>`}function et(t){let g=["green","yellow","red"];async function c(s){let f=s.target.closest('[data-role="status-dot"]');if(!f)return;s.preventDefault(),s.stopPropagation();let i=f.dataset.date,n=f.dataset.status||"green",r=g[(g.indexOf(n)+1)%g.length];try{let o=await fetch(`/api/set-status?date=${encodeURIComponent(i)}&status=${encodeURIComponent(r)}`,{method:"POST"});if(!o.ok)throw Error(`set-status failed (${o.status})`);await t()}catch(o){console.error(o)}}document.addEventListener("click",c,!0),document.addEventListener("touchend",c,!0)}function tt(t,g=[],c=[]){let s=document.getElementById("detailModal"),f=document.getElementById("detailTitle"),i=document.getElementById("detailBody"),n=document.getElementById("detailClose");function r(){s.classList.remove("open")}let o=Object.fromEntries((g||[]).map((a)=>[a.session_date,a]));for(let a of c||[])if(!o[a.session_date])o[a.session_date]={session_date:a.session_date,pain_level:a.pain_level||"green",planned_barbell_main:a.main_lift,planned_cardio:a.cardio_plan,planned_rings:a.rings_plan};function h(a){window.__activeDetailDate=a,f.textContent=`Training details · ${a}`;let d=t?.barbellByDate?.[a]||[],l=t?.cardioByDate?.[a]||[],v=t?.ringsByDate?.[a]||[],y={...o?.[a]||{},plannedBarbellRows:t?.plannedBarbellByDate?.[a]||[],plannedCardio:(t?.plannedCardioByDate?.[a]||[])[0]||null,plannedRingsRows:t?.plannedRingsByDate?.[a]||[]};window.__activePlanned=y;let $=(y.plannedBarbellRows||[]).filter((B)=>B.category==="main"),x=$.length?$[$.length-1]:null,E=$.length?$.map((B)=>`${B.planned_weight_kg}×${B.prescribed_reps}`).join(" · "):"—",w=(y.plannedBarbellRows||[]).filter((B)=>B.category==="supplemental"),C=w[0]||null,P=w.length?`${w.length}×${C?.prescribed_reps??"-"} @ ${C?.planned_weight_kg??"-"} kg`:"—",Z=y.plannedCardio||null,D=y.plannedRingsRows||[],A=[...new Set(D.map((B)=>B.template_code).filter(Boolean))],V=A.length?A.join("+"):y.planned_rings?String(y.planned_rings):null,U=D.filter((B)=>B.item_no!=null).map((B)=>`[${B.template_code}] ${B.item_no}. ${B.exercise} ${B.sets_text||""}x${B.reps_or_time||""}`).join("<br/>")||"Not scheduled",N=(d||[]).some((B)=>B.category==="main"),O=(d||[]).some((B)=>B.category==="supplemental"),Y=(l||[]).length>0,J=(v||[]).length>0;i.innerHTML=[ke("Main Lift",`
        <p><strong>Main – ${x?.lift||"—"}</strong><br/>Working sets prescribed: ${E}<br/>Top set prescribed: ${x?.planned_weight_kg||"—"} × ${x?.prescribed_reps||"—"}</p>
        <div class="status-actions">
          <input id="mainWeightInput" class="status-input" type="number" step="0.5" placeholder="Top set weight" />
          <input id="mainRepsInput" class="status-input" type="number" step="1" placeholder="Top set reps" />
          <input id="mainRpeInput" class="status-input" type="number" step="0.5" placeholder="RPE (optional)" />
          <button type="button" class="status-btn" onclick="window.logSessionAction('main_done')" ${N?"disabled":""}>${N?"Main Recorded ✓":"Mark Main Complete"}</button>
        </div>
      `),ke("Supplemental",`
        <p><strong>${C?.lift||"—"}</strong><br/>Prescribed: ${P}</p>
        <div class="status-actions">
          <label><input id="suppCompletedInput" type="checkbox" checked /> Completed as prescribed</label>
          <label><input id="suppModifiedInput" type="checkbox" /> Modified</label>
        </div>
        <div class="status-actions">
          <input id="suppWeightInput" class="status-input" type="number" step="0.5" placeholder="Modified weight" />
          <input id="suppSetsInput" class="status-input" type="number" step="1" placeholder="Sets completed" />
          <button type="button" class="status-btn" onclick="window.logSessionAction('supp_done')" ${O?"disabled":""}>${O?"Supp Recorded ✓":"Mark Supp Complete"}</button>
          <button type="button" class="status-btn" onclick="window.logSessionAction('supp_modified')" ${O?"disabled":""}>${O?"Supp Recorded ✓":"Save Supp Modified"}</button>
        </div>
      `),ke("Cardio",`
        <p><strong>${Z?.session_type||"Z2"}</strong></p>
        <div class="status-actions">
          <input id="cardioDurationInput" class="status-input" type="number" step="1" placeholder="Duration (min)" value="${Z?.duration_min||""}" />
          <input id="cardioAvgHrInput" class="status-input" type="number" step="1" placeholder="Avg HR" />
          <input id="cardioSpeedInput" class="status-input" type="number" step="0.1" placeholder="Speed (optional)" />
        </div>
        <div class="status-actions">
          <input id="cardioWorkMinInput" class="status-input" type="number" step="0.5" placeholder="Work interval (min)" value="${Z?.vo2_work_min||""}" />
          <input id="cardioRestMinInput" class="status-input" type="number" step="0.5" placeholder="Rest interval (min)" value="${Z?.vo2_easy_min||""}" />
          <button type="button" class="status-btn" onclick="window.logSessionAction('cardio_done')" ${Y?"disabled":""}>${Y?"Cardio Recorded ✓":"Mark Cardio Complete"}</button>
        </div>
      `),ke("Rings",`
        <p><strong>Template ${V||"—"}</strong></p>
        <p class="muted">${U}</p>
        <div class="status-actions">
          <label><input id="ringsCompletedInput" type="checkbox" ${J?"checked disabled":""}/> Completed as prescribed</label>
          <button type="button" class="status-btn" onclick="window.logSessionAction('rings_done')" ${J?"disabled":""}>${J?"Rings Recorded ✓":"Mark Rings Complete"}</button>
        </div>
      `),ke("Finish Session",`
        <div class="status-actions">
          <button type="button" class="status-btn" onclick="window.logSessionAction('finish_session')">Finish Session</button>
        </div>
      `)].join(""),s.classList.add("open")}window.__openDetailForDate=h,n.addEventListener("click",r),s.addEventListener("click",(a)=>{if(a.target===s)r()}),window.addEventListener("keydown",(a)=>{if(a.key==="Escape")r()}),document.querySelectorAll(".tile, .week-row").forEach((a)=>{let d=(l)=>{if(l?.target?.closest?.('[data-role="status-dot"]'))return;h(a.dataset.date||"")};a.addEventListener("click",d),a.addEventListener("keydown",(l)=>{if(l.key==="Enter"||l.key===" ")l.preventDefault(),d(l)})})}function nt(){let t=document.getElementById("athleteViewBtn"),g=document.getElementById("logViewBtn");if(!t||!g)return;let c=Array.from(document.querySelectorAll(".athlete-only")),s=Array.from(document.querySelectorAll(".log-only")),f=(i)=>{let n=i!=="log";t.classList.toggle("active",n),g.classList.toggle("active",!n),c.forEach((r)=>r.classList.toggle("hidden-view",!n)),s.forEach((r)=>r.classList.toggle("hidden-view",n))};t.addEventListener("click",()=>f("athlete")),g.addEventListener("click",()=>f("log")),f("athlete")}function st(){let t=({kind:g,inputId:c,btnId:s,statusId:f,boxId:i})=>{let n=document.getElementById(c),r=document.getElementById(s),o=document.getElementById(f),h=document.getElementById(i);if(!n||!r||!o||!h)return;let a=async(d)=>{if(!d)return;r.disabled=!0,o.textContent=`Uploading ${d.name}...`;try{let l=new FormData;l.append("kind",g),l.append("file",d);let v=await fetch("/api/upload-health",{method:"POST",body:l}),p=await v.json().catch(()=>({}));if(!v.ok||!p.ok)throw Error(p.error||`upload failed (${v.status})`);o.textContent=`Uploaded: ${p.path}`}catch(l){o.textContent=`Upload failed: ${l.message||l}`}finally{r.disabled=!1}};r.addEventListener("click",async()=>a(n.files?.[0])),n.addEventListener("change",async()=>{let d=n.files;if(d?.[0])await a(d[0])}),h.addEventListener("dragover",(d)=>{d.preventDefault(),h.classList.add("dragging")}),h.addEventListener("dragleave",()=>h.classList.remove("dragging")),h.addEventListener("drop",async(d)=>{d.preventDefault(),h.classList.remove("dragging");let l=d.dataTransfer?.files?.[0];if(l)await a(l)})};t({kind:"apple",inputId:"appleFileInput",btnId:"appleUploadBtn",statusId:"appleUploadStatus",boxId:"appleDropBox"}),t({kind:"polar",inputId:"polarFileInput",btnId:"polarUploadBtn",statusId:"polarUploadStatus",boxId:"polarDropBox"})}function at(){let t=Array.from(document.querySelectorAll(".tabs .tab-btn[data-tab]")),g=Array.from(document.querySelectorAll(".tab-panel"));if(!t.length||!g.length)return;let c=(i,n=!0)=>{if(t.forEach((r)=>{let o=r.dataset.tab===i;r.classList.toggle("active",o),r.setAttribute("aria-selected",o?"true":"false")}),g.forEach((r)=>{r.classList.toggle("active",r.dataset.tabPanel===i)}),n){let r=`tab-${i}`;if(window.location.hash!==`#${r}`)history.replaceState(null,"",`#${r}`)}};t.forEach((i)=>{i.addEventListener("click",()=>c(i.dataset.tab||"overview"))});let s=(window.location.hash||"").replace("#tab-",""),f=t.some((i)=>i.dataset.tab===s)?s:t[0]?.dataset.tab||"overview";c(f,!1),window.__setActiveTab=(i)=>c(i)}async function ie(){let t=await ze();window.__dashboardData=t,We(t.weekHeader||null),Ve(t.dailyTiles||[],t.weekProgress||[],t.details||{}),je(t.totals||{}),Ue(t.weekProgress||[],t.details||{}),Ze(t.cycleControl||{}),Xe(t.est1RM||[]),Ke(t.currentCyclePlan||[]),Ye(t.cardioAnalytics||{}),Je(t.auditLog||[]),Ge(t.weekProgress||[]),Qe(t.dailyTiles||[],t.details||{}),tt(t.details||{},t.dailyTiles||[],t.weekProgress||[]),qe(t.weekProgress||[],t.details||{}),document.getElementById("generatedAt").textContent=`Data generated: ${new Date(t.generatedAt).toLocaleString()}`}(async function(){try{window.__renderDashboard=ie,window.setRecoveryStatus=async(i,n)=>{let r=i||window.__activeDetailDate;if(!r)return;try{let o=await fetch(`/api/set-status?date=${encodeURIComponent(r)}&status=${encodeURIComponent(n)}`,{method:"POST"});if(!o.ok)throw Error(`set-status failed (${o.status})`);if(await ie(),window.__openDetailForDate)window.__openDetailForDate(r)}catch(o){console.error(o)}},window.logSessionAction=async(i)=>{let n=window.__activeDetailDate,r=window.__activePlanned||{};if(!n)return;let o={action:i,date:n,plannedBarbellRows:r.plannedBarbellRows||[],plannedCardio:r.plannedCardio||null},h=async(a)=>{let d=await fetch("/api/log-action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(a)});if(!d.ok){let l=`log-action failed (${d.status})`;try{let v=await d.json();if(v?.error)l=v.error}catch{}throw Error(l)}};if(i==="finish_session"){let a=parseFloat(L("mainWeightInput")),d=parseInt(L("mainRepsInput"),10),l=parseFloat(L("mainRpeInput")),v=Fe("suppCompletedInput"),p=Fe("suppModifiedInput"),y=parseFloat(L("suppWeightInput")),$=parseInt(L("suppSetsInput"),10),x=parseInt(L("cardioDurationInput"),10),E=parseInt(L("cardioAvgHrInput"),10),w=parseFloat(L("cardioSpeedInput")),C=parseFloat(L("cardioWorkMinInput")),P=parseFloat(L("cardioRestMinInput")),Z=Fe("ringsCompletedInput");if(Number.isFinite(a)&&Number.isFinite(d)&&a>0&&d>0)await h({action:"main_done",date:n,plannedBarbellRows:(r.plannedBarbellRows||[]).map((N)=>N.category==="main"?{...N,planned_weight_kg:a,prescribed_reps:d,note:Number.isFinite(l)?`RPE ${l}`:N.note}:N),plannedCardio:r.plannedCardio||null});if(p&&Number.isFinite(y)&&y>0){let N=(r.plannedBarbellRows||[]).find((Y)=>Y.category==="supplemental")?.prescribed_reps||5,O=Number.isFinite($)&&$>0?$:10;await h({action:"supp_modified",date:n,plannedBarbellRows:r.plannedBarbellRows||[],plannedCardio:r.plannedCardio||null,suppModifiedText:`${O}x${N}@${y}`})}else if(v)await h({action:"supp_done",date:n,plannedBarbellRows:r.plannedBarbellRows||[],plannedCardio:r.plannedCardio||null});if(Number.isFinite(x)&&x>0&&Number.isFinite(E)&&E>0){let N={...r.plannedCardio||{},duration_min:x};await h({action:"cardio_done",date:n,plannedBarbellRows:r.plannedBarbellRows||[],plannedCardio:N,avgHr:E,speedKmh:Number.isFinite(w)&&w>0?w:void 0,workMin:Number.isFinite(C)&&C>0?C:void 0,restMin:Number.isFinite(P)&&P>=0?P:void 0})}if(Z)await h({action:"rings_done",date:n,plannedBarbellRows:r.plannedBarbellRows||[],plannedCardio:r.plannedCardio||null});let D="—",A="—";if(Number.isFinite(a)&&Number.isFinite(d)&&a>0&&d>0){let N=a*(1+d/30);D=`${N.toFixed(1)} kg`;let O=((window.__dashboardData?.details?.barbellByDate||{})[n]||[]).filter((J)=>J.category==="main"),Y=O.length?O[O.length-1]:null;if(Y?.actual_weight_kg&&Y?.actual_reps){let J=Number(Y.actual_weight_kg)*(1+Number(Y.actual_reps)/30),B=N-J;A=`${B>=0?"+":""}${B.toFixed(1)} kg vs previous logged main`}}let V=Number.isFinite(E)?E<=125?"Yes":"No":"—",U=(()=>{let N=Number.isFinite(a)&&Number.isFinite(d)&&a>0&&d>0,O=Number.isFinite(x)&&Number.isFinite(E)&&x>0&&E>0,Y=v||p&&Number.isFinite(y)&&y>0,J=[N,Y,O].filter(Boolean).length;if(J===3)return"A (full session)";if(J===2)return"B (mostly complete)";if(J===1)return"C (partial)";return"D (logged but incomplete)"})();if(await ie(),window.__openDetailForDate)window.__openDetailForDate(n);alert(`Session finished

Top set e1RM: ${D}
Delta: ${A}
Z2 in cap: ${V}
Session quality: ${U}`);return}if(i==="supp_modified"){let a=parseFloat(L("suppWeightInput")),d=parseInt(L("suppSetsInput"),10),l=(r.plannedBarbellRows||[]).find((p)=>p.category==="supplemental")?.prescribed_reps||5;if(!Number.isFinite(a)||a<=0){alert("Enter modified supplemental weight first.");return}let v=Number.isFinite(d)&&d>0?d:10;o.suppModifiedText=`${v}x${l}@${a}`}if(i==="cardio_done"||i==="z2_fixed_hr_test"){let a=L("cardioAvgHrInput").trim(),d=parseInt(L("cardioDurationInput"),10),l=parseFloat(L("cardioSpeedInput")),v=parseFloat(L("cardioWorkMinInput")),p=parseFloat(L("cardioRestMinInput"));if(!a){alert("Enter Avg HR in the Cardio section first, then tap Mark Cardio Complete.");return}let y=parseInt(a,10);if(!Number.isFinite(y)||y<=0){alert("Please enter a valid average HR number.");return}if(o.avgHr=y,o.plannedCardio={...r.plannedCardio||{},duration_min:Number.isFinite(d)&&d>0?d:(r.plannedCardio||{}).duration_min||30},Number.isFinite(l)&&l>0)o.speedKmh=l;let $=String((o.plannedCardio||{}).session_type||(o.plannedCardio||{}).protocol||""),x=$.includes("VO2")||$==="VO2_4x4"||$==="VO2_1min",E=$.includes("4x4")||$==="VO2_4x4"?4:1,w=$.includes("4x4")||$==="VO2_4x4"?3:1;if(Number.isFinite(v)&&v>0)o.workMin=v;if(Number.isFinite(p)&&p>=0)o.restMin=p;if(i==="cardio_done"&&x){if(!Number.isFinite(o.workMin)||o.workMin<=0)o.workMin=E;if(!Number.isFinite(o.restMin)||o.restMin<0)o.restMin=w}if(i==="z2_fixed_hr_test"&&!o.speedKmh){alert("For Fixed-HR test, enter speed (km/h) before saving.");return}}if(i==="main_done"){let a=parseFloat(L("mainWeightInput")),d=parseInt(L("mainRepsInput"),10);if(Number.isFinite(a)&&a>0&&Number.isFinite(d)&&d>0)o.plannedBarbellRows=(r.plannedBarbellRows||[]).map((l)=>l.category==="main"?{...l,planned_weight_kg:a,prescribed_reps:d}:l)}try{let a=await fetch("/api/log-action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)});if(!a.ok){let d=`log-action failed (${a.status})`;try{let l=await a.json();if(l?.error)d=l.error}catch{}throw Error(d)}if(await ie(),window.__openDetailForDate)window.__openDetailForDate(n);if(i==="cardio_done")alert("Cardio session saved.");if(i==="z2_fixed_hr_test")alert("Monthly Z2 fixed-HR test saved.")}catch(a){console.error(a),alert(`Could not save action: ${a.message||a}`)}},await ie(),et(ie),at(),nt(),st();let g=document.getElementById("todayBtn");if(g)g.addEventListener("click",()=>{if(window.__setActiveTab)window.__setActiveTab("overview");let i=fe(),n=document.querySelector(`[data-date="${i}"]`);if(n)n.scrollIntoView({behavior:"smooth",block:"center"});if(window.__openDetailForDate)window.__openDetailForDate(i)});document.addEventListener("click",(i)=>{if(!we(i,"#startSessionBtn"))return;let r=fe();if(window.__openDetailForDate)window.__openDetailForDate(r)});let c=Te("refreshBtn"),s=Te("refreshHealthBtn");async function f({includeHealth:i=!1}={}){let n=i?s:c;if(!n)return;let r=n.textContent;if(n.disabled=!0,c&&i)c.disabled=!0;if(s&&!i)s.disabled=!0;n.textContent=i?"Importing health + refreshing...":"Refreshing...";try{let h=await fetch(i?"/api/refresh?includeHealth=1":"/api/refresh",{method:"POST"});if(!h.ok)throw Error(`Refresh failed (${h.status})`);await ie(),n.textContent=i?"Health + DB Updated ✓":"Updated ✓",setTimeout(()=>{n.textContent=r},1200)}catch(o){console.error(o),n.textContent=i?"Health refresh failed":"Refresh failed",setTimeout(()=>{n.textContent=r},2200)}finally{if(n.disabled=!1,c)c.disabled=!1;if(s)s.disabled=!1}}if(c)c.addEventListener("click",async()=>{await f({includeHealth:!1})});if(s)s.addEventListener("click",async()=>{await f({includeHealth:!0})});document.addEventListener("click",async(i)=>{let n=we(i,"[data-tm-delta]");if(n){let a=n.getAttribute("data-tm-lift"),d=parseFloat(n.getAttribute("data-tm-delta")||"0");try{n.disabled=!0;let l=await fetch("/api/tm/update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lift:a,mode:"delta",value:d})});if(!l.ok)throw Error(`TM update failed (${l.status})`);await ie()}catch(l){alert(`Could not update TM: ${l.message||l}`)}finally{n.disabled=!1}return}let r=we(i,"[data-tm-set]");if(r){let a=r.getAttribute("data-tm-set"),d=parseFloat(L(`tmSet-${a}`));if(!Number.isFinite(d)||d<=0){alert("Enter a valid TM kg value first.");return}try{r.disabled=!0;let l=await fetch("/api/tm/update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lift:a,mode:"set",value:d})});if(!l.ok)throw Error(`TM set failed (${l.status})`);await ie()}catch(l){alert(`Could not set TM: ${l.message||l}`)}finally{r.disabled=!1}return}let o=we(i,"#startCycleBtn");if(o){let a=L("newCycleStartInput"),d=L("newCycleTypeInput")||"Leader";try{o.disabled=!0;let l=await fetch("/api/cycle/start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({startDate:a,blockType:d})});if(!l.ok)throw Error(`Start cycle failed (${l.status})`);await ie(),alert("New cycle created.")}catch(l){alert(`Could not start cycle: ${l.message||l}`)}finally{o.disabled=!1}return}let h=we(i,"#applyDeloadBtn");if(h){let a=L("deloadTypeInput"),d=L("deloadStartInput"),l=parseInt(L("deloadDaysInput"),10)||7;try{h.disabled=!0;let v=await fetch("/api/cycle/deload",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({deloadCode:a,startDate:d,durationDays:l})});if(!v.ok)throw Error(`Apply deload failed (${v.status})`);await ie(),alert("Deload applied.")}catch(v){alert(`Could not apply deload: ${v.message||v}`)}finally{h.disabled=!1}}})}catch(g){document.body.innerHTML=`<main class="app"><p>Failed to load dashboard data. Run export script first.</p><pre>${g}</pre></main>`}})();})();
