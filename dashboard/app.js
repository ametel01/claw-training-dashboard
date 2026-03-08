(()=>{var ve=(t)=>document.getElementById(t),F=(t)=>ve(t)?.value??"",_e=(t)=>Boolean(ve(t)?.checked),fe=(t,d)=>t.target instanceof Element?t.target.closest(d):null;function ee(){let t=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date),d=t.find((a)=>a.type==="year")?.value,l=t.find((a)=>a.type==="month")?.value,n=t.find((a)=>a.type==="day")?.value;return`${d}-${l}-${n}`}function Ce(t){let d=["green","yellow","red"];async function l(n){let a=n.target instanceof Element?n.target.closest('[data-role="status-dot"]'):null;if(!a)return;n.preventDefault(),n.stopPropagation();let i=a.dataset.date,s=a.dataset.status||"green",r=d[(d.indexOf(s)+1)%d.length];try{let o=await fetch(`/api/set-status?date=${encodeURIComponent(i)}&status=${encodeURIComponent(r)}`,{method:"POST"});if(!o.ok)throw Error(`set-status failed (${o.status})`);await t()}catch(o){console.error(o)}}document.addEventListener("click",l,!0),document.addEventListener("touchend",l,!0)}function He(){let t=document.getElementById("athleteViewBtn"),d=document.getElementById("logViewBtn");if(!t||!d)return;let l=Array.from(document.querySelectorAll(".athlete-only")),n=Array.from(document.querySelectorAll(".log-only")),a=(i)=>{let s=i!=="log";t.classList.toggle("active",s),d.classList.toggle("active",!s),l.forEach((r)=>r.classList.toggle("hidden-view",!s)),n.forEach((r)=>r.classList.toggle("hidden-view",s))};t.addEventListener("click",()=>a("athlete")),d.addEventListener("click",()=>a("log")),a("athlete")}function Pe(){let t=({kind:d,inputId:l,buttonId:n,statusId:a,boxId:i})=>{let s=document.getElementById(l),r=document.getElementById(n),o=document.getElementById(a),m=document.getElementById(i);if(!s||!r||!o||!m)return;let c=async(u)=>{if(!u)return;r.disabled=!0,o.textContent=`Uploading ${u.name}...`;try{let p=new FormData;p.append("kind",d),p.append("file",u);let b=await fetch("/api/upload-health",{method:"POST",body:p}),g=await b.json().catch(()=>({}));if(!b.ok||!g.ok)throw Error(g.error||`upload failed (${b.status})`);o.textContent=`Uploaded: ${g.path}`}catch(p){o.textContent=`Upload failed: ${p.message||p}`}finally{r.disabled=!1}};r.addEventListener("click",async()=>c(s.files?.[0])),s.addEventListener("change",async()=>{if(s.files?.[0])await c(s.files[0])}),m.addEventListener("dragover",(u)=>{u.preventDefault(),m.classList.add("dragging")}),m.addEventListener("dragleave",()=>m.classList.remove("dragging")),m.addEventListener("drop",async(u)=>{u.preventDefault(),m.classList.remove("dragging");let p=u.dataTransfer?.files?.[0];if(p)await c(p)})};t({kind:"apple",inputId:"appleFileInput",buttonId:"appleUploadBtn",statusId:"appleUploadStatus",boxId:"appleDropBox"}),t({kind:"polar",inputId:"polarFileInput",buttonId:"polarUploadBtn",statusId:"polarUploadStatus",boxId:"polarDropBox"})}function Oe(){let t=Array.from(document.querySelectorAll(".tabs .tab-btn[data-tab]")),d=Array.from(document.querySelectorAll(".tab-panel"));if(!t.length||!d.length)return;let l=(i,s=!0)=>{if(t.forEach((r)=>{let o=r.dataset.tab===i;r.classList.toggle("active",o),r.setAttribute("aria-selected",o?"true":"false")}),d.forEach((r)=>{r.classList.toggle("active",r.dataset.tabPanel===i)}),s){let r=`tab-${i}`;if(window.location.hash!==`#${r}`)history.replaceState(null,"",`#${r}`)}};t.forEach((i)=>{i.addEventListener("click",()=>l(i.dataset.tab||"overview"))});let n=(window.location.hash||"").replace("#tab-",""),a=t.some((i)=>i.dataset.tab===n)?n:t[0]?.dataset.tab||"overview";l(a,!1),window.__setActiveTab=(i)=>l(i)}function ze(){return{refreshButton:ve("refreshBtn"),refreshHealthButton:ve("refreshHealthBtn")}}async function je(){let t=await fetch("./data.json",{cache:"no-store"});if(!t.ok)throw Error("Could not load data.json");return t.json()}function We(t=[]){let d=document.getElementById("auditLogPanel");if(!d)return;if(!t.length){d.innerHTML='<p class="muted">No audit events yet.</p>';return}d.innerHTML=`<div class="audit-list">${t.map((l)=>{let n=(l.event_time||"").replace("T"," ").slice(0,19),a=l.old_value||l.new_value?`${l.old_value??"∅"} → ${l.new_value??"∅"}`:"";return`
      <div class="audit-row">
        <div class="audit-top">
          <span>${l.domain} · ${l.action} · ${l.key_name||"-"}</span>
          <span>${n}</span>
        </div>
        ${a?`<div class="audit-meta">${a}</div>`:""}
        ${l.note?`<div class="audit-meta">${l.note}</div>`:""}
      </div>
    `}).join("")}</div>`}function Ze(t={}){let d=document.getElementById("cardioAnalytics");if(!d)return;let l=t.total_z2||0,n=t.z2_in_cap||0,a=t.z2_compliance_pct??0,i=(e)=>{if(Array.isArray(e))return e;if(typeof e==="string")try{return JSON.parse(e)}catch{return[]}return[]},s=i(t.z2_points),r=s.map((e)=>{let h=Number(e.avg_hr),x=Number(e.max_hr);if(Number.isFinite(h)&&h>0)return{date:e.session_date,hr:h,estimated:!1};if(Number.isFinite(x)&&x>0)return{date:e.session_date,hr:x,estimated:!0};return null}).filter((e)=>e&&Number.isFinite(e.hr)&&e.hr>0).sort((e,h)=>e.date<h.date?-1:1),o=i(t.z2_scatter_points).map((e)=>({date:e.session_date,hr:Number(e.avg_hr),speed:Number(e.speed_kmh)})).filter((e)=>e.hr>0&&e.speed>0).sort((e,h)=>e.date<h.date?-1:1).slice(-8),m=i(t.z2_efficiency_points).map((e)=>({date:e.session_date,efficiency:Number(e.efficiency),speedAt120:Number(e.speed_at_120),speedAt140:Number(e.speed_at_140)})).filter((e)=>e.efficiency>0).sort((e,h)=>e.date<h.date?-1:1),c=i(t.z2_decoupling_points).map((e)=>({date:e.session_date,decoupling:Number(e.decoupling_pct)})).filter((e)=>Number.isFinite(e.decoupling)).sort((e,h)=>e.date<h.date?-1:1),u=i(t.vo2_points),p=(window.__dashboardData?.aerobicTests||[]).map((e)=>({...e})),b='<p class="muted">No Z2 HR data in last 12 weeks.</p>',g=r.slice(-8);if(g.length>=2){let P=g.map((v)=>Number(v.hr)),V=Math.floor((Math.min(...P)-3)/5)*5,q=Math.ceil((Math.max(...P)+3)/5)*5,k=Math.max(5,q-V),Y=278,ce=92,O=g.map((v,f)=>({x:32+f*(278/(g.length-1)),y:10+(1-(Number(v.hr)-V)/k)*92,hr:Number(v.hr),date:v.date,estimated:!!v.estimated})),U=[0,0.25,0.5,0.75,1].map((v)=>({hr:Math.round(V+v*k),y:10+(1-v)*92})),J=125,G=10+(1-(125-V)/k)*92,oe=O.map((v)=>`${v.x},${v.y}`).join(" "),j=U.map((v)=>`<line x1="32" y1="${v.y}" x2="310" y2="${v.y}" class="z2-grid"/>`).join(""),N=U.map((v)=>`<text x="26" y="${v.y+3}" class="z2-label" text-anchor="end">${v.hr}</text>`).join(""),K=O.map((v)=>`<g><circle cx="${v.x}" cy="${v.y}" r="2.8" style="opacity:${v.estimated?"0.65":"1"}"></circle><title>${v.date}: HR ${v.hr}${v.estimated?" (from max HR)":""}</title></g>`).join(""),he=new Map(s.map((v)=>[v.session_date,Number(v.speed_kmh)])),Q=O.map((v)=>{let f=Number(he.get(v.date));return Number.isFinite(f)&&f>0&&v.hr>0?{x:v.x,eff:f/v.hr}:null}).filter(Boolean),re="",ue="efficiency line: need speed+HR logs";if(Q.length>=2){let v=Math.min(...Q.map((de)=>de.eff)),f=Math.max(...Q.map((de)=>de.eff)),I=Math.max(0.0001,f-v);re=`<polyline points="${Q.map((de)=>({x:de.x,y:10+(1-(de.eff-v)/I)*92})).map((de)=>`${de.x},${de.y}`).join(" ")}" fill="none" stroke="#ff8cc6" stroke-width="2" stroke-dasharray="4 2"/>`;let me=Q[0].eff,Ae=(Q[Q.length-1].eff-me)/me*100;ue=`efficiency Δ ${Ae>=0?"+":""}${Ae.toFixed(1)}%`}let ye=(O[O.length-1].hr-O[0].hr).toFixed(1),se=g.filter((v)=>v.estimated).length;b=`
      <div class="z2-graph-wrap">
        <svg viewBox="0 0 320 120" class="z2-graph" role="img" aria-label="Z2 average HR trend">
          ${j}${N}
          <line x1="32" y1="102" x2="310" y2="102" class="z2-axis"/>
          <line x1="32" y1="10" x2="32" y2="102" class="z2-axis"/>
          <line x1="32" y1="${G}" x2="310" y2="${G}" stroke="#ffc15a" stroke-dasharray="3 2" stroke-width="1.2"/>
          <text x="310" y="${Math.max(8,G-3)}" class="z2-label" text-anchor="end">Z2 cap 125</text>
          <polyline points="${oe}" class="z2-line"/>
          ${re}
          ${K}
          <text x="32" y="117" class="z2-label">${O[0]?.date||""}</text>
          <text x="310" y="117" class="z2-label" text-anchor="end">${O[O.length-1]?.date||""}</text>
        </svg>
        <div class="muted">Last ${g.length} Z2 sessions · HR trend Δ ${ye} bpm${se?` · ${se} points estimated from max HR`:""} · ${ue}</div>
      </div>`}let y='<div class="cardio-empty"><div><strong>Unlock this chart</strong></div><div class="muted">Log speed in notes as: <code>@ 6.2 km/h</code></div></div>';if(o.length>=2){let P=Math.min(...o.map((N)=>N.speed))-0.2,V=Math.max(...o.map((N)=>N.speed))+0.2,q=Math.floor((Math.min(...o.map((N)=>N.hr))-3)/5)*5,k=Math.ceil((Math.max(...o.map((N)=>N.hr))+3)/5)*5,Y=Math.max(0.5,V-P),ce=Math.max(5,k-q),O=272,U=144,G=o.map((N,K)=>({...N,x:36+(N.speed-P)/Y*272,y:12+(1-(N.hr-q)/ce)*144,opacity:(0.35+0.65*(K+1)/o.length).toFixed(2)})).map((N)=>`<circle cx="${N.x}" cy="${N.y}" r="3.2" style="fill:#59a8ff;opacity:${N.opacity}"><title>${N.date}: ${N.speed.toFixed(1)} km/h · HR ${N.hr}</title></circle>`).join(""),oe="",j="Need ≥4 sessions for a stable trendline";if(o.length>=4){let N=o.reduce((f,I)=>f+I.speed,0)/o.length,K=o.reduce((f,I)=>f+I.hr,0)/o.length,he=o.reduce((f,I)=>f+(I.speed-N)*(I.hr-K),0),Q=o.reduce((f,I)=>f+(I.speed-N)**2,0)||1,re=he/Q,ue=K-re*N,ye=re*P+ue,se=re*V+ue,v=(f)=>12+(1-(f-q)/ce)*144;oe=`<line x1="36" y1="${v(ye)}" x2="308" y2="${v(se)}" class="vo2-line line-44"/>`,j="Trendline shown (≥4 sessions)"}y=`
      <div class="z2-graph-wrap">
        <svg viewBox="0 0 320 180" class="z2-graph" role="img" aria-label="Z2 speed vs HR scatter">
          <line x1="36" y1="156" x2="308" y2="156" class="z2-axis"/>
          <line x1="36" y1="12" x2="36" y2="156" class="z2-axis"/>
          ${oe}
          ${G}
          <text x="160" y="176" class="z2-label" text-anchor="middle">Speed (km/h)</text>
          <text x="12" y="90" class="z2-label" text-anchor="middle" transform="rotate(-90 12 ${"90"})">Avg HR</text>
        </svg>
        <div class="muted">Older = lighter dot · newer = darker dot · ${j}</div>
      </div>`}let _='<p class="muted">Adaptation status unavailable.</p>',$='<p class="muted">No Z2 KPI data yet.</p>',W='<p class="muted">No Z2 efficiency points yet.</p>',T='<p class="muted">Aerobic status unavailable.</p>';if(m.length>=1){let e=m.slice(-8),h=e[e.length-1],x=e[0],M=m[0],R=m.slice(-4),Z=R.reduce((J,G)=>J+G.efficiency,0)/R.length,P=x?(h.efficiency-x.efficiency)/x.efficiency*100:0,V=M?(h.efficiency-M.efficiency)/M.efficiency*100:0,q=P>1?"Improving":P<-1?"Regressing":"Flat",k=P>1&&a>=70?"\uD83D\uDFE2 On track":a<60?"\uD83D\uDFE1 Needs consistency":"\uD83D\uDFE1 Stable but no gain",Y=P>1?"Keep current Z2 structure.":"Increase Z2 volume by +20 min/week or progress treadmill speed slightly.",O=[...u].slice(-6).filter((J)=>Number(J.avg_speed_kmh||J.max_speed_kmh||0)>0).length>=2?"Adequate":"Low";_=`
      <div class="cardio-z2-card" style="grid-column:1 / -1">
        <div class="muted">Am I adapting?</div>
        <div class="cardio-z2-big">${P>1&&a>=70&&O==="Adequate"?"\uD83D\uDFE2 Adapting":a<60||P<-1?"\uD83D\uDD34 Off track":"\uD83D\uDFE1 In progress"}</div>
        <div class="muted">Efficiency ${q} · Compliance ${a}% · VO2 stimulus ${O} · Drift data ${c.length?"present":"missing"}</div>
      </div>`,$=`
      <div class="cardio-z2-card">
        <div class="muted">Z2 KPI status</div>
        <div class="cardio-z2-big">${q}</div>
        <div class="muted">${k}</div>
        <div class="muted">Baseline: ${M.efficiency.toFixed(3)} (${M.date})</div>
        <div class="muted">Current: ${h.efficiency.toFixed(3)} (${h.date})</div>
        <div class="muted">${R.length}-session avg: ${Z.toFixed(3)} · MoM proxy Δ ${P.toFixed(1)}%</div>
      </div>`,W=`
      <div class="cardio-z2-card">
        <div class="muted">Fixed-HR benchmark (primary)</div>
        <div class="cardio-z2-big">${Number.isFinite(h.speedAt120)?h.speedAt120.toFixed(2):"—"} km/h</div>
        <div class="muted">at 120 bpm · Efficiency ${h.efficiency.toFixed(3)}</div>
        <div class="muted">Example: ${Number.isFinite(h.speedAt120)?h.speedAt120.toFixed(1):"6.1"} km/h @ 120 bpm</div>
        <div class="muted">Δ ${V.toFixed(1)}% vs baseline · Alt @140: ${Number.isFinite(h.speedAt140)?h.speedAt140.toFixed(2):"—"} km/h</div>
      </div>`,T=`
      <div class="cardio-z2-card" style="grid-column:1 / -1">
        <div class="muted">Aerobic Status</div>
        <div class="muted">Efficiency: ${q} · Compliance: ${a}% · Drift data: ${c.length?"Available":"Missing"} </div>
        <div class="muted"><strong>Recommendation:</strong> ${Y}</div>
      </div>`}let A='<p class="muted">No decoupling data yet (requires end HR in notes, e.g. "end BPM 141").</p>';if(c.length)A=`
      <div class="cardio-z2-card">
        <div class="muted">Aerobic decoupling (quarterly check)</div>
        ${c.slice(-5).map((x)=>{let M=x.decoupling<5?"good":x.decoupling<=7?"watch":"high";return`<div class="muted">${x.date}: ${x.decoupling.toFixed(1)}% (${M})</div>`}).join("")}
        <div class="muted">Guide: &lt;5% good · 5–7% watch · &gt;7% high drift</div>
      </div>`;let z=(e,h,x=(M)=>M)=>{if((e||[]).length<2)return'<p class="muted">Need at least 2 tests.</p>';let M=320,R=120,Z=30,P=8,V=10,q=18,k=e.map(h).map(Number).filter((j)=>Number.isFinite(j));if(k.length<2)return'<p class="muted">Insufficient numeric data.</p>';let Y=Math.min(...k),ce=Math.max(...k),O=Math.max(1,ce-Y),U=M-Z-P,J=R-V-q,G=e.map((j,N)=>{let K=Number(h(j));return{x:Z+N*(U/(e.length-1)),y:V+(1-(K-Y)/O)*J,value:K,date:j.date}}),oe=G.map((j)=>`${j.x},${j.y}`).join(" ");return`<svg viewBox="0 0 ${M} ${R}" class="z2-graph"><line x1="${Z}" y1="${R-q}" x2="${M-P}" y2="${R-q}" class="z2-axis"/><line x1="${Z}" y1="${V}" x2="${Z}" y2="${R-q}" class="z2-axis"/><polyline points="${oe}" class="z2-line"/>${G.map((j)=>`<circle cx="${j.x}" cy="${j.y}" r="2.6"><title>${j.date}: ${x(j.value)}</title></circle>`).join("")}</svg>`},L=p.filter((e)=>e.test_type==="FIXED_SPEED"&&Number(e.avg_hr)>0),w=p.filter((e)=>e.test_type==="FIXED_HR"&&Number(e.avg_speed)>0),E=p.filter((e)=>e.test_type==="ZONE2_SESSION"&&Number(e.decoupling_percent)>=0),B=L[L.length-1],H=w[w.length-1],X=E[E.length-1],te=(e,h,x)=>Math.max(h,Math.min(e,x)),S=(e)=>te(100*(170-Number(e))/30,0,100),C=(e)=>te(100*(Number(e)-5)/4,0,100),D=(e)=>te(100*(10-Number(e))/10,0,100),xe=(e)=>e>=80?"excellent":e>=65?"strong":e>=50?"average":e>=35?"developing":"weak base",ge=new Map;for(let e of p){let h=String(e.date||"").slice(0,7);if(!h)continue;if(!ge.has(h))ge.set(h,{});let x=ge.get(h);x[e.test_type]=e}let ne=Array.from(ge.entries()).sort((e,h)=>e[0]<h[0]?-1:1).map(([e,h])=>{if(!h.FIXED_SPEED||!h.FIXED_HR||!h.ZONE2_SESSION)return null;let x=S(h.FIXED_SPEED.avg_hr),M=C(h.FIXED_HR.avg_speed),R=D(h.ZONE2_SESSION.decoupling_percent),Z=0.4*M+0.35*x+0.25*R;return{date:`${e}-01`,afs:Number(Z.toFixed(1)),efficiency:x,capacity:M,durability:R}}).filter(Boolean),pe=ne[ne.length-1]||null,Be=ne.length>1?ne[ne.length-2]:null,we=pe&&Be?pe.afs-Be.afs:null,at=(e)=>{if(!e)return 999;let h=new Date(`${ee()}T00:00:00`).getTime()-new Date(`${e}T00:00:00`).getTime();return Math.floor(h/86400000)},ke=(e,h)=>{let x=at(h);if(x>35)return`${e}: overdue (${x}d)`;if(x>27)return`${e}: due soon (${x}d)`;return`${e}: ok (${x}d)`},it=`
    <div class="cardio-z2-card ${((e)=>{if(e==null||!Number.isFinite(e))return"afs-none";if(e>=80)return"afs-elite";if(e>=65)return"afs-green";if(e>=50)return"afs-yellow";if(e>=35)return"afs-orange";return"afs-red"})(pe?.afs)}"><div class="muted">Aerobic Fitness Score (AFS)</div><div class="cardio-z2-big">${pe?pe.afs.toFixed(1):"—"}</div><div class="muted">${pe?xe(pe.afs):"need all 3 monthly tests"}${we==null?"":` · ${we>=0?"↑":"↓"} ${Math.abs(we).toFixed(1)}`}</div></div>
    <div class="cardio-z2-card"><div class="muted">Cardio Efficiency (HR @ 11 km/h)</div><div class="cardio-z2-big">${B?Number(B.avg_hr).toFixed(0):"—"}</div><div class="muted">Trend target: ↓</div></div>
    <div class="cardio-z2-card"><div class="muted">Aerobic Capacity (speed @ 120 bpm)</div><div class="cardio-z2-big">${H?Number(H.avg_speed).toFixed(2):"—"} km/h</div><div class="muted">Trend target: ↑</div></div>
    <div class="cardio-z2-card"><div class="muted">Aerobic Durability (Pa:Hr)</div><div class="cardio-z2-big">${X?Number(X.decoupling_percent).toFixed(1):"—"}%</div><div class="muted">Trend target: ↓</div></div>
    <div class="cardio-z2-card"><div class="muted">Monthly test scheduler</div><div class="muted">${ke("Fixed-speed",B?.date)}<br/>${ke("Fixed-HR",H?.date)}<br/>${ke("Decoupling",X?.date)}</div></div>
  `,Ne=[...u||[]].slice(-16),Fe='<p class="muted">No VO2 data in last 12 weeks.</p>';if(Ne.length>=1){let P={VO2_4x4:3,VO2_1min:1},V=Ne.map((k)=>({date:k.session_date,protocol:k.protocol,speed:Number(k.avg_speed_kmh||k.max_speed_kmh||0),hr:Number(k.avg_hr??k.max_hr??0),workMin:Number(k.work_min||(k.protocol==="VO2_4x4"?4:k.protocol==="VO2_1min"?1:0)),restMin:Number(k.easy_min||k.rest_min||P[k.protocol]||0)})).filter((k)=>k.hr>0&&(k.protocol==="VO2_4x4"||k.protocol==="VO2_1min")).sort((k,Y)=>k.date<Y.date?-1:1),q=(k,Y,ce,O)=>{let U=V.filter((f)=>f.protocol===k);if(!U.length)return`<div class="z2-graph-wrap"><p class="muted">${O}: no data.</p></div>`;let J=Math.floor((Math.min(...U.map((f)=>f.hr))-3)/5)*5,G=Math.ceil((Math.max(...U.map((f)=>f.hr))+3)/5)*5,oe=Math.max(5,G-J),j=266,N=92,K=U.map((f,I)=>({...f,x:U.length===1?32+j/2:32+I*(j/(U.length-1)),y:10+(1-(f.hr-J)/oe)*N})),he=K.length>=2?`<polyline points="${K.map((f)=>`${f.x},${f.y}`).join(" ")}" class="vo2-line ${ce}"/>`:"",Q=K.map((f,I)=>{let ae=I%2===0?-6:12,me=Number.isFinite(f.speed)&&f.speed>0?`${f.speed}k`:"",Ie=f.workMin>0?`${f.workMin}/${f.restMin||0}m`:"n/a";return`<g><circle cx="${f.x}" cy="${f.y}" r="2.8" class="${Y}"></circle>${me?`<text x="${f.x}" y="${f.y+ae}" class="z2-point-label" text-anchor="middle">${me}</text>`:""}<title>${f.date} ${k}: ${Number.isFinite(f.speed)&&f.speed>0?`${f.speed} km/h`:"no speed logged"} · HR ${f.hr} · work/rest ${Ie}</title></g>`}).join(""),re=[0,0.25,0.5,0.75,1].map((f)=>{let I=Math.round(J+f*oe),ae=10+(1-f)*N;return{hrTick:I,y:ae}}),ue=re.map((f)=>`<line x1="32" y1="${f.y}" x2="298" y2="${f.y}" class="z2-grid"/>`).join(""),ye=re.map((f)=>`<text x="26" y="${f.y+3}" class="z2-label" text-anchor="end">${f.hrTick}</text>`).join(""),se=U.filter((f)=>Number.isFinite(f.speed)&&f.speed>0&&Number.isFinite(f.hr)&&f.hr>0).map((f)=>{let I=Math.max(0,f.workMin||0),ae=Math.max(0,f.restMin||0),me=I>0&&ae>0?I/ae:I>0?1:0;return{...f,eff:f.speed/f.hr*me}}),v=`${O}: need ≥2 sessions with speed + HR logged`;if(se.length>=2){let f=se[0],I=se[se.length-1],ae=(I.eff-f.eff)/f.eff*100;v=`${O} efficiency Δ ${ae>=0?"+":""}${ae.toFixed(1)}% (${f.eff.toFixed(4)} → ${I.eff.toFixed(4)}, ${se.length} sessions, rest-adjusted)`}return`
        <div class="z2-graph-wrap" style="margin-bottom:10px">
          <div class="muted" style="margin-bottom:4px">${O}</div>
          <svg viewBox="0 0 320 120" class="z2-graph" role="img" aria-label="${O} HR efficiency trend">
            ${ue}
            ${ye}
            <line x1="32" y1="102" x2="298" y2="102" class="z2-axis"/>
            <line x1="32" y1="10" x2="32" y2="102" class="z2-axis"/>
            ${he}
            ${Q}
          </svg>
          <div class="vo2-legend"><span class="muted">${v}</span></div>
        </div>
      `};Fe=`${q("VO2_4x4","vo2-pt-44","line-44","VO2 4x4")} ${q("VO2_1min","vo2-pt-18","line-18","VO2 1min")}`}d.innerHTML=`
    <div class="cardio-analytics">
      ${_}
      <div class="cardio-z2-card">
        <div class="muted">Z2 compliance</div>
        <div class="cardio-z2-big">${a}%</div>
        <div class="muted">${n}/${l} sessions in cap</div>
      </div>
      ${$}
      ${W}
      ${A}
      ${T}
      <div class="cardio-vo2-list" style="grid-column:1 / -1">
        <div class="muted" style="margin-bottom:6px">Aerobic Fitness (monthly tests)</div>
        <div class="cardio-analytics">${it}</div>
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
        ${z(ne,(e)=>e.afs,(e)=>`${Number(e).toFixed(1)}`)}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">HR at 11 km/h</div>
        ${z(L,(e)=>e.avg_hr,(e)=>`${e} bpm`)}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">Speed at 120 bpm</div>
        ${z(w,(e)=>e.avg_speed,(e)=>`${Number(e).toFixed(2)} km/h`)}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">Aerobic Decoupling %</div>
        ${z(E,(e)=>e.decoupling_percent,(e)=>`${Number(e).toFixed(1)}%`)}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">Z2 HR variation trend</div>
        ${b}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">Z2 speed vs HR (scatter + trendline)</div>
        ${y}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">VO2 HR efficiency trends (by protocol)</div>
        ${Fe}
      </div>
    </div>
  `;let Se=async(e)=>{let h=await fetch("/api/log-aerobic-test",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(!h.ok){let x=`failed (${h.status})`;try{let M=await h.json();if(M?.error)x=M.error}catch{}throw Error(x)}},Me=ee(),ot=()=>{let e=document.getElementById("aerobicEntryModal");if(e)return e;return e=document.createElement("div"),e.id="aerobicEntryModal",e.className="modal",e.innerHTML=`
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="aeroTitle">
        <div class="modal-head">
          <h3 id="aeroTitle">Log aerobic test</h3>
          <button type="button" class="modal-close" id="aeroCloseBtn">×</button>
        </div>
        <div id="aeroBody" class="modal-body"></div>
      </div>`,document.body.appendChild(e),e.addEventListener("click",(h)=>{if(h.target===e)e.classList.remove("open")}),e.querySelector("#aeroCloseBtn")?.addEventListener("click",()=>e?.classList.remove("open")),e},le=(e)=>{let h=Number.parseFloat(F(e));return Number.isFinite(h)?h:null},Te=(e)=>{let h=ot(),x=h.querySelector("#aeroTitle"),M=h.querySelector("#aeroBody");if(!x||!M)return;if(e==="FIXED_SPEED")x.textContent="Log Fixed-Speed Test (11.0 km/h, 0% incline, 2.4 km)",M.innerHTML=`
        <div class="status-actions"><input id="aeroAvgHr" class="status-input" type="number" step="1" placeholder="Average HR" /><input id="aeroMaxHr" class="status-input" type="number" step="1" placeholder="Max HR (optional)" /></div>
        <div class="status-actions"><button type="button" class="status-btn" id="aeroSaveBtn">Save Test</button></div>`,M.querySelector("#aeroSaveBtn")?.addEventListener("click",async()=>{let R=le("aeroAvgHr"),Z=le("aeroMaxHr");if(!R||R<=0)return alert("Enter average HR");await Se({testType:"FIXED_SPEED",date:Me,speed:11,distance:2.4,duration:13,avgHr:R,maxHr:Z,notes:"Monthly fixed-speed test"}),h.classList.remove("open"),await window.__renderDashboard?.()});if(e==="FIXED_HR")x.textContent="Log Fixed-HR Test (120 bpm, 30 min, 0% incline)",M.innerHTML=`
        <div class="status-actions"><input id="aeroAvgSpeed" class="status-input" type="number" step="0.1" placeholder="Average speed (km/h)" /><input id="aeroAvgHr" class="status-input" type="number" step="1" placeholder="Average HR (default 120)" value="120" /></div>
        <div class="status-actions"><button type="button" class="status-btn" id="aeroSaveBtn">Save Test</button></div>`,M.querySelector("#aeroSaveBtn")?.addEventListener("click",async()=>{let R=le("aeroAvgSpeed"),Z=le("aeroAvgHr")||120;if(!R||R<=0)return alert("Enter average speed");await Se({testType:"FIXED_HR",date:Me,duration:30,avgSpeed:R,avgHr:Z,notes:"Monthly fixed-HR test"}),h.classList.remove("open"),await window.__renderDashboard?.()});if(e==="ZONE2_SESSION")x.textContent="Log Decoupling Test (steady Z2)",M.innerHTML=`
        <div class="status-actions"><input id="aeroHr1" class="status-input" type="number" step="1" placeholder="HR first half" /><input id="aeroHr2" class="status-input" type="number" step="1" placeholder="HR second half" /></div>
        <div class="status-actions"><input id="aeroS1" class="status-input" type="number" step="0.1" placeholder="Speed first half (optional)" /><input id="aeroS2" class="status-input" type="number" step="0.1" placeholder="Speed second half (optional)" /></div>
        <div class="status-actions"><button type="button" class="status-btn" id="aeroSaveBtn">Save Test</button></div>`,M.querySelector("#aeroSaveBtn")?.addEventListener("click",async()=>{let R=le("aeroHr1"),Z=le("aeroHr2"),P=le("aeroS1"),V=le("aeroS2");if(!R||!Z||R<=0)return alert("Enter first and second half HR");await Se({testType:"ZONE2_SESSION",date:Me,duration:40,hrFirstHalf:R,hrSecondHalf:Z,speedFirstHalf:P,speedSecondHalf:V,notes:"Monthly decoupling test"}),h.classList.remove("open"),await window.__renderDashboard?.()});h.classList.add("open")},Re=document.getElementById("logFixedSpeedBtn");if(Re)Re.onclick=()=>Te("FIXED_SPEED");let De=document.getElementById("logFixedHrBtn");if(De)De.onclick=()=>Te("FIXED_HR");let Le=document.getElementById("logDecouplingBtn");if(Le)Le.onclick=()=>Te("ZONE2_SESSION")}function be(t,d){return`<section class="detail-section"><h4>${t}</h4>${d}</section>`}function Ve(t,d=[],l=[]){let n=document.getElementById("detailModal"),a=document.getElementById("detailTitle"),i=document.getElementById("detailBody"),s=document.getElementById("detailClose");if(!n||!a||!i||!s)return;function r(){n.classList.remove("open")}let o=Object.fromEntries((d||[]).map((c)=>[c.session_date,c]));for(let c of l||[])if(!o[c.session_date])o[c.session_date]={session_date:c.session_date,pain_level:c.pain_level||"green",planned_barbell_main:c.main_lift,planned_cardio:c.cardio_plan,planned_rings:c.rings_plan};function m(c){window.__activeDetailDate=c,a.textContent=`Training details · ${c}`;let u=t?.barbellByDate?.[c]||[],p=t?.cardioByDate?.[c]||[],b=t?.ringsByDate?.[c]||[],y={...o?.[c]||{},plannedBarbellRows:t?.plannedBarbellByDate?.[c]||[],plannedCardio:(t?.plannedCardioByDate?.[c]||[])[0]||null,plannedRingsRows:t?.plannedRingsByDate?.[c]||[]};window.__activePlanned=y;let _=(y.plannedBarbellRows||[]).filter((D)=>D.category==="main"),$=_.length?_[_.length-1]:null,W=_.length?_.map((D)=>`${D.planned_weight_kg}×${D.prescribed_reps}`).join(" · "):"—",T=(y.plannedBarbellRows||[]).filter((D)=>D.category==="supplemental"),A=T[0]||null,z=T.length?`${T.length}×${A?.prescribed_reps??"-"} @ ${A?.planned_weight_kg??"-"} kg`:"—",L=y.plannedCardio||null,w=y.plannedRingsRows||[],E=[...new Set(w.map((D)=>D.template_code).filter(Boolean))],B=E.length?E.join("+"):y.planned_rings?String(y.planned_rings):null,H=w.filter((D)=>D.item_no!=null).map((D)=>`[${D.template_code}] ${D.item_no}. ${D.exercise} ${D.sets_text||""}x${D.reps_or_time||""}`).join("<br/>")||"Not scheduled",X=(u||[]).some((D)=>D.category==="main"),te=(u||[]).some((D)=>D.category==="supplemental"),S=(p||[]).length>0,C=(b||[]).length>0;i.innerHTML=[be("Main Lift",`
        <p><strong>Main – ${$?.lift||"—"}</strong><br/>Working sets prescribed: ${W}<br/>Top set prescribed: ${$?.planned_weight_kg||"—"} × ${$?.prescribed_reps||"—"}</p>
        <div class="status-actions">
          <input id="mainWeightInput" class="status-input" type="number" step="0.5" placeholder="Top set weight" />
          <input id="mainRepsInput" class="status-input" type="number" step="1" placeholder="Top set reps" />
          <input id="mainRpeInput" class="status-input" type="number" step="0.5" placeholder="RPE (optional)" />
          <button type="button" class="status-btn" onclick="window.logSessionAction('main_done')" ${X?"disabled":""}>${X?"Main Recorded ✓":"Mark Main Complete"}</button>
        </div>
      `),be("Supplemental",`
        <p><strong>${A?.lift||"—"}</strong><br/>Prescribed: ${z}</p>
        <div class="status-actions">
          <label><input id="suppCompletedInput" type="checkbox" checked /> Completed as prescribed</label>
          <label><input id="suppModifiedInput" type="checkbox" /> Modified</label>
        </div>
        <div class="status-actions">
          <input id="suppWeightInput" class="status-input" type="number" step="0.5" placeholder="Modified weight" />
          <input id="suppSetsInput" class="status-input" type="number" step="1" placeholder="Sets completed" />
          <button type="button" class="status-btn" onclick="window.logSessionAction('supp_done')" ${te?"disabled":""}>${te?"Supp Recorded ✓":"Mark Supp Complete"}</button>
          <button type="button" class="status-btn" onclick="window.logSessionAction('supp_modified')" ${te?"disabled":""}>${te?"Supp Recorded ✓":"Save Supp Modified"}</button>
        </div>
      `),be("Cardio",`
        <p><strong>${L?.session_type||"Z2"}</strong></p>
        <div class="status-actions">
          <input id="cardioDurationInput" class="status-input" type="number" step="1" placeholder="Duration (min)" value="${L?.duration_min||""}" />
          <input id="cardioAvgHrInput" class="status-input" type="number" step="1" placeholder="Avg HR" />
          <input id="cardioSpeedInput" class="status-input" type="number" step="0.1" placeholder="Speed (optional)" />
        </div>
        <div class="status-actions">
          <input id="cardioWorkMinInput" class="status-input" type="number" step="0.5" placeholder="Work interval (min)" value="${L?.vo2_work_min||""}" />
          <input id="cardioRestMinInput" class="status-input" type="number" step="0.5" placeholder="Rest interval (min)" value="${L?.vo2_easy_min||""}" />
          <button type="button" class="status-btn" onclick="window.logSessionAction('cardio_done')" ${S?"disabled":""}>${S?"Cardio Recorded ✓":"Mark Cardio Complete"}</button>
        </div>
      `),be("Rings",`
        <p><strong>Template ${B||"—"}</strong></p>
        <p class="muted">${H}</p>
        <div class="status-actions">
          <label><input id="ringsCompletedInput" type="checkbox" ${C?"checked disabled":""}/> Completed as prescribed</label>
          <button type="button" class="status-btn" onclick="window.logSessionAction('rings_done')" ${C?"disabled":""}>${C?"Rings Recorded ✓":"Mark Rings Complete"}</button>
        </div>
      `),be("Finish Session",`
        <div class="status-actions">
          <button type="button" class="status-btn" onclick="window.logSessionAction('finish_session')">Finish Session</button>
        </div>
      `)].join(""),n.classList.add("open")}window.__openDetailForDate=m,s.addEventListener("click",r),n.addEventListener("click",(c)=>{if(c.target===n)r()}),window.addEventListener("keydown",(c)=>{if(c.key==="Escape")r()});for(let c of document.querySelectorAll(".tile, .week-row")){let u=(p)=>{if(p?.target?.closest?.('[data-role="status-dot"]'))return;m(c.dataset.date||"")};c.addEventListener("click",u),c.addEventListener("keydown",(p)=>{if(p.key==="Enter"||p.key===" ")p.preventDefault(),u(p)})}}function $e(t,d){return`<article class="stat-card"><div class="stat-label">${t}</div><div class="stat-value">${d}</div></article>`}function Ee(t,d,l=""){return`<span class="${d?"chip done":"chip"}"><i class="dot"></i>${t}${l?` · ${l}`:""}</span>`}function qe(t){let d=document.getElementById("totals");if(!d)return;d.innerHTML=[$e("Barbell Sessions",t.barbell_sessions??0),$e("Cardio Sessions",t.cardio_sessions??0),$e("Rings Sessions",t.rings_sessions??0),$e("Total Training Days",t.total_training_days??0),$e("Active Days (14d)",t.active_days_last_14??0)].join("")}function Ue(t){let d=document.getElementById("weekHeaderBanner");if(!d)return;if(!t){d.innerHTML='<div class="week-header-title">Cycle info unavailable</div>';return}let l=String(t.main_pct||"").split("/").map((m)=>Number(String(m).replace("%",""))).filter((m)=>Number.isFinite(m)),n=Number(String(t.supp_pct||"").replace("%","")),a=(m)=>Math.max(0,Math.min(100,Number(m)||0)),i=(m)=>{let c=a(m);return 120-120*Math.max(0,Math.min(1,(c-60)/40))},s=(m)=>{let c=i(m),u=`hsl(${c.toFixed(0)} 85% 66%)`,p=`hsl(${c.toFixed(0)} 80% 52%)`,b=`hsl(${c.toFixed(0)} 88% 42%)`;return`linear-gradient(90deg, ${u} 0%, ${p} 55%, ${b} 100%)`},r=l.map((m)=>`<div class="pct-bar"><span style="width:${a(m)}%; background:${s(m)}"></span><label>${m}%</label></div>`).join(""),o=t.deload_code?`<span class="chip done">Deload: ${t.deload_name||t.deload_code}</span>`:"";d.innerHTML=`
    <div class="week-header-title">5/3/1 · ${t.block_type} · Week ${t.week_in_block} ${o}</div>
    <div class="week-header-meta">Main: ${t.main_pct} · Supplemental: ${t.supp_pct}</div>
    <div class="pct-bars">${r}${Number.isFinite(n)?`<div class="pct-bar supp"><span style="width:${a(n)}%; background:${s(n)}"></span><label>Supp ${n}%</label></div>`:""}</div>
  `}function Xe(t=[],d=[],l={}){let n=document.getElementById("todayGlance");if(!n)return;let a=ee(),i=(t||[]).find((w)=>w.session_date===a);if(!i){n.innerHTML='<div class="today-title">TODAY</div><div class="today-meta">No data for today yet.</div>';return}let s=l?.barbellByDate?.[a]||[],r=s.some((w)=>w.category==="main"),o=s.some((w)=>w.category==="supplemental"),m=!!i.planned_barbell_main,c=!!i.planned_barbell_supp,u=!!i.planned_cardio&&i.planned_cardio!=="OFF",p=!!i.planned_rings,b=[m,c,u,p].filter(Boolean).length,g=[m&&r,c&&o,u&&i.has_cardio,p&&i.has_rings].filter(Boolean).length,y=g===0?"Not Started":g===b?"Completed":"In Progress",_=b?Math.round(g/b*100):0,$=(w,E,B)=>{if(!E)return"";return`<div class="today-line"><span class="today-chip ${B?"done":"pending"}">${B?"done":"pending"}</span>${w} ${E}</div>`},W=m?`${i.planned_barbell_main}`:"",T=c?`${i.planned_barbell_supp} ${i.planned_supp_sets||""}x${i.planned_supp_reps||""}`:"",A=u?i.planned_cardio:"",z=p?`Rings ${i.planned_rings}`:"",L=(m||c?60:0)+(u?30:0)+(p?20:0);n.innerHTML=`
    <div class="today-title">
      <span><strong>TODAY</strong> · ${a}</span>
      <span class="today-progress"><span class="status-dot ${i.pain_level||"green"}"></span>${g}/${b||0} · ${_}%</span>
    </div>
    <div class="today-meta">Status: <strong>${y}</strong> · Planned time: <strong>${Math.floor(L/60)}h ${L%60}m</strong></div>
    <div class="today-lines">
      ${$("\uD83C\uDFCB",W,r)}
      ${$("\uD83C\uDFCB+",T,o)}
      ${$("❤️",A,!!i.has_cardio)}
      ${$("\uD83E\uDD38",z,!!i.has_rings)}
    </div>
    ${y==="Not Started"?'<div class="today-cta"><button class="btn-primary" type="button" id="startSessionBtn">Start Session</button></div>':""}
  `}function Ke(t=[],d={}){let l=0,n=0;for(let s of t){let r=d?.barbellByDate?.[s.session_date]||[],o=r.some((g)=>g.category==="main"),m=r.some((g)=>g.category==="supplemental"),c=!!s.main_lift,u=!!s.main_lift,p=!!s.cardio_plan&&s.cardio_plan!=="OFF",b=!!s.rings_plan;if(c){if(l+=1,o)n+=1}if(u){if(l+=1,m)n+=1}if(p){if(l+=1,s.cardio_done)n+=1}if(b){if(l+=1,s.rings_done)n+=1}}let a=l?Math.round(n/l*100):0,i=document.getElementById("weeklyCompletion");if(i)i.textContent=`Week: ${n}/${l} (${a}%)`}function Je(t=[],d={}){let l=document.getElementById("performanceKpis");if(!l)return;let n=t.reduce((S,C)=>S+!!C.main_lift+!!C.main_lift+(!!C.cardio_plan&&C.cardio_plan!=="OFF")+!!C.rings_plan,0),a=t.reduce((S,C)=>{let D=d?.barbellByDate?.[C.session_date]||[],xe=D.some((ne)=>ne.category==="main"),ge=D.some((ne)=>ne.category==="supplemental");return S+(xe?1:0)+(ge?1:0)+(C.cardio_done?1:0)+(C.rings_done?1:0)},0),i=n?Math.round(a/n*100):0,s=ee(),r=Math.max(1,Math.min(7,(new Date(`${s}T00:00:00`).getDay()+6)%7+1)),o=Math.round(n*(r/7)||0),m=n?Math.round(o/n*100):0,c=Math.max(0,o-a),u=d?.cardioByDate||{},p=Object.values(u).flat(),b=[],g=new Set;for(let S of p){let C=`${S.session_date}|${S.protocol}`;if(g.has(C))continue;g.add(C),b.push(S)}let y=b.filter((S)=>S.protocol==="Z2"),_=b.filter((S)=>String(S.protocol||"").includes("VO2")),$=y.length,W=_.length,T=Math.max(1,$+W),A=Math.round($/T*100),z=100-A,L=120,w=(()=>{let S=new Date(`${s}T00:00:00`),C=(S.getDay()+6)%7;return S.setDate(S.getDate()-C),S.toISOString().slice(0,10)})(),E=(()=>{let S=new Date(`${w}T00:00:00`);return S.setDate(S.getDate()+6),S.toISOString().slice(0,10)})(),B=y.filter((S)=>S.session_date>=w&&S.session_date<=E).reduce((S,C)=>S+Number(C.duration_min||0),0),H=i>=m?"\uD83D\uDFE2 On pace":c>=2?`\uD83D\uDD34 Behind by ${c} sessions`:"\uD83D\uDFE1 Slightly behind",X=A>=75?"\uD83D\uDFE2 Z2-dominant":A>=65?"\uD83D\uDFE1 Slightly VO2-heavy":"\uD83D\uDD34 Too VO2-heavy",te=B>=L?`\uD83D\uDFE2 Target met (+${B-L}m)`:`\uD83D\uDD34 Under target (${L-B}m short)`;l.innerHTML=`
    <article class="kpi-card"><div class="muted">Training status · weekly execution</div><div class="kpi-value">${i}%</div><div class="muted">Expected by today: ≥${m}% (${o}/${n})</div><div class="muted">${H}</div></article>
    <article class="kpi-card"><div class="muted">Intensity distribution (Z2 vs VO2)</div><div class="kpi-value">${A}% / ${z}%</div><div class="muted">Target: 75% / 25%</div><div class="muted">${X}</div></article>
    <article class="kpi-card"><div class="muted">Z2 volume</div><div class="kpi-value">${B} / ${L} min</div><div class="muted">${te}</div></article>
  `}function Ge(t){let d=document.getElementById("weekRows");if(!d)return;let l=ee();d.innerHTML=t.map((n)=>{let a=[!!n.main_lift,!!n.cardio_plan&&n.cardio_plan!=="OFF",!!n.rings_plan].filter(Boolean).length,i=[!!n.barbell_done,!!n.cardio_done,!!n.rings_done].filter(Boolean).length;return`
    <article class="week-row ${i===a&&a>0?"done-all":i>0?"partial":n.session_date>=l?"upcoming":""}" role="button" tabindex="0" data-date="${n.session_date}">
      <div class="week-meta">
        <div class="week-day">${n.day_name.slice(0,3)}</div>
        <div class="muted">${n.session_date.slice(5)}</div>
      </div>
      <div class="week-chips">
        ${Ee("\uD83C\uDFCB",n.barbell_done,n.main_lift||"—")}
        ${Ee("❤️",n.cardio_done,n.cardio_plan||"OFF")}
        ${Ee("\uD83E\uDD38",n.rings_done,n.rings_plan||"—")}
      </div>
    </article>`}).join("")}function Ye(t,d={}){let l=document.getElementById("dailyTiles");if(!l)return;let n=ee(),a=({icon:s,planned:r,done:o,detail:m,isPast:c})=>{if(!r)return"";let u="badge planned";if(o)u="badge done";else if(!o&&c)u="badge missed";return`<span class="${u}">${s} ${m||""}</span>`},i=[...t].reverse();l.innerHTML=i.map((s)=>{let r=s.session_date<n,o=d?.barbellByDate?.[s.session_date]||[],m=o.some((H)=>H.category==="main"),c=o.some((H)=>H.category==="supplemental"),u=!!s.planned_barbell_main,p=!!s.planned_barbell_supp,b=!!s.planned_cardio&&s.planned_cardio!=="OFF",g=!!s.planned_rings,y=u?`${s.planned_barbell_main}`.trim():s.barbell_lift,_=p?`${s.planned_barbell_supp} ${s.planned_supp_sets||""}x${s.planned_supp_reps||""}`.trim():"",$=s.planned_cardio||s.cardio_protocol,W=s.planned_rings||s.rings_template,T=s.pain_level||"green",z=[`<span class="status-dot clickable ${T}" data-date="${s.session_date}" data-status="${T}" data-role="status-dot" title="Recovery status: ${T} (tap to change)"></span>`,a({icon:"\uD83C\uDFCB",planned:u,done:m,detail:y,isPast:r}),a({icon:"\uD83C\uDFCB+",planned:p,done:c,detail:_,isPast:r}),a({icon:"❤️",planned:b,done:!!s.has_cardio,detail:$,isPast:r}),a({icon:"\uD83E\uDD38",planned:g,done:!!s.has_rings,detail:W,isPast:r})].filter(Boolean).join(""),L=[u&&m,p&&c,b&&s.has_cardio,g&&s.has_rings].filter(Boolean).length,w=[u,p,b,g].filter(Boolean).length,E=w===0?"Rest day":`${L}/${w} complete`,B=new Date(`${s.session_date}T00:00:00`).toLocaleDateString(void 0,{weekday:"short"});return`
      <article class="tile" role="button" tabindex="0" data-date="${s.session_date}">
        <div class="tile-date">${B} · ${s.session_date}</div>
        <div class="tile-main">${E}</div>
        <div class="tile-flags">${z}</div>
      </article>
    `}).join("")}function Qe(t={}){let d=document.getElementById("cycleControlPanel");if(!d)return;let l=t.latestBlock||{},n=t.activeDeload||null,i=(t.profiles||[]).map((o)=>`<option value="${o.code}" data-days="${o.default_days||7}">${o.name}</option>`).join(""),s=(t.recentEvents||[]).slice(0,5).map((o)=>`<li>${o.event_date} · ${o.event_type}${o.deload_code?` (${o.deload_code})`:""}</li>`).join(""),r=(t.currentTM||[]).map((o)=>`
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
  `).join("");d.innerHTML=`
    <section class="cycle-control-grid">
      <article class="cycle-control-card">
        <h3 class="cycle-section-title">Cycle</h3>
        <div class="muted">Current block: <strong>#${l.block_no||"—"}</strong> · ${l.block_type||"—"}</div>
        <div class="muted">Start: <strong>${l.start_date||"—"}</strong></div>
        <div class="status-actions compact">
          <input id="newCycleStartInput" class="status-input" type="date" />
          <select id="newCycleTypeInput" class="status-input"><option value="Leader">Leader</option><option value="Anchor">Anchor</option></select>
          <button id="startCycleBtn" class="status-btn" type="button">Start New Cycle</button>
        </div>
      </article>

      <article class="cycle-control-card">
        <h3 class="cycle-section-title">Deload</h3>
        <div class="muted">Active: <strong>${n?`${n.name||n.deload_code} (${n.start_date} → ${n.end_date})`:"none"}</strong></div>
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
      <ul class="detail-list">${s||"<li>No events yet.</li>"}</ul>
    </section>
  `}function et(t=[]){let d=document.getElementById("est1rmRows");if(!d)return;if(!t.length){d.innerHTML='<p class="muted">No main-set data in the last 12 weeks yet.</p>';return}let l=(n=[])=>{let a=(Array.isArray(n)?n:[]).slice().reverse();if(a.length<2)return"";let i=a.map((b)=>Number(b.e1rm)).filter((b)=>Number.isFinite(b));if(i.length<2)return"";let s=120,r=26,o=2,m=Math.min(...i),c=Math.max(...i),u=Math.max(1,c-m),p=i.map((b,g)=>`${(g*(s/(i.length-1))).toFixed(1)},${(r-o-(b-m)/u*(r-2*o)).toFixed(1)}`).join(" ");return`<svg viewBox="0 0 ${s} ${r}" class="spark"><polyline points="${p}" fill="none" stroke="#9ad0ff" stroke-width="2"/></svg>`};d.innerHTML=t.map((n)=>{let a=[];if(typeof n.trend_points==="string")try{a=JSON.parse(n.trend_points)||[]}catch{a=[]}else if(Array.isArray(n.trend_points))a=n.trend_points;let i=Number(n.delta_4w_kg||0),s=i>0?"↑":i<0?"↓":"→",r=Math.max(0,Math.min(100,Number(n.progress_to_next_pct||0)));return`
    <article class="est1rm-card">
      <div class="est1rm-lift">${n.lift}</div>
      <div class="est1rm-value">${n.est_1rm_kg} kg</div>
      <div class="est1rm-level">${n.strength_level} · ${n.bw_ratio}x BW</div>
      <div class="est1rm-meta">4w: ${s} ${Math.abs(i).toFixed(1)} kg · Cycle: ${Number(n.delta_cycle_kg||0).toFixed(1)} kg</div>
      ${l(a)}
      <div class="est1rm-meta">${n.next_level!=="—"?`Next: ${n.next_level} at ${n.next_level_kg} kg`:"Top level reached"} · BW ${n.bodyweight_kg} kg</div>
      <div class="progress-track"><span style="width:${r}%"></span></div>
      <div class="est1rm-meta">${r}% to next level · from ${n.source_weight_kg}×${n.source_reps} (${n.source_date})</div>
    </article>`}).join("")}function tt(t=[]){let d=document.getElementById("cyclePlanRows");if(!d)return;if(!t.length){d.innerHTML='<p class="muted">No planned sessions found for current cycle.</p>';return}let l=new Map;for(let g of t){if(!l.has(g.session_date))l.set(g.session_date,[]);l.get(g.session_date).push(g)}let n=(g)=>{let y=new Date(`${g}T12:00:00Z`),_=(y.getUTCDay()+6)%7;return y.setUTCDate(y.getUTCDate()-_),y.toISOString().slice(0,10)},a=(g)=>{let y=[...new Set(g.filter(($)=>$.category==="main").map(($)=>$.lift))],_=[...new Set(g.filter(($)=>$.category==="supplemental").map(($)=>$.lift))];return{mainTxt:y.length?y.join(" + "):"Rest",suppTxt:_.length?_.join(" + "):"—"}},i=(g,y)=>{let _=g.filter((T)=>T.category===y);if(!_.length)return'<p class="muted">—</p>';let $=new Map;for(let T of _){if(!$.has(T.lift))$.set(T.lift,[]);$.get(T.lift).push(T)}let W=[];for(let[T,A]of $.entries()){let z=new Map;for(let E of A){let B=`${E.prescribed_reps}|${E.planned_weight_kg}`;z.set(B,(z.get(B)||0)+1)}let L=Array.from(z.entries()),w=L.length===1?(()=>{let[[E,B]]=L,[H,X]=E.split("|");return`${B}×${H} @ ${X}kg`})():A.map((E)=>`${E.planned_weight_kg}×${E.prescribed_reps}`).join(" · ");W.push(`<li><strong>${T}</strong>: ${w}</li>`)}return`<ul class="detail-list">${W.join("")}</ul>`},s=Array.from(l.keys()).sort(),r=(g,y)=>{let _=new Date(`${g}T12:00:00Z`);return _.setUTCDate(_.getUTCDate()+y),_.toISOString().slice(0,10)},o=n(s[0]),m=n(s[s.length-1]),c=[];for(let g=o;g<=m;g=r(g,7))c.push(g);let u=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];d.innerHTML=c.map((g,y)=>{let _=[];for(let $=0;$<7;$+=1){let W=r(g,$),T=l.get(W)||[];if(!T.length)continue;let{mainTxt:A,suppTxt:z}=a(T);_.push(`<article class="cycle-day-tile" data-cycle-date="${W}" tabindex="0"><div class="tile-date">${u[$]} · ${W}</div><div class="tile-main">${A}</div><div class="muted">Supp: ${z}</div></article>`)}return`
      <section class="cycle-week-block">
        <div class="panel-head"><h3>Week ${y+1} <span class="muted">· ${g}</span></h3></div>
        <div class="cycle-calendar-grid">
          ${_.join("")}
        </div>
      </section>`}).join("");let p=document.getElementById("cyclePlanModal");if(!p)p=document.createElement("div"),p.id="cyclePlanModal",p.className="modal",p.innerHTML='<div class="modal-card" role="dialog" aria-modal="true"><div class="modal-head"><h3 id="cyclePlanTitle">Planned session</h3><button type="button" class="modal-close" id="cyclePlanClose">×</button></div><div id="cyclePlanBody" class="modal-body"></div></div>',document.body.appendChild(p),p.addEventListener("click",(g)=>{if(g.target===p)p.classList.remove("open")}),p.querySelector("#cyclePlanClose")?.addEventListener("click",()=>p?.classList.remove("open"));let b=(g)=>{let y=l.get(g)||[],_=document.getElementById("cyclePlanTitle"),$=document.getElementById("cyclePlanBody");if(!_||!$||!p)return;_.textContent=`Planned session · ${g}`,$.innerHTML=`
      <section class="detail-section"><h4>Main</h4>${i(y,"main")}</section>
      <section class="detail-section"><h4>Supplemental</h4>${i(y,"supplemental")}</section>
    `,p.classList.add("open")};for(let g of d.querySelectorAll(".cycle-day-tile")){let y=()=>b(g.getAttribute("data-cycle-date"));g.addEventListener("click",y),g.addEventListener("keydown",(_)=>{if(_.key==="Enter"||_.key===" ")_.preventDefault(),y()})}}async function ie(){let t=await je();window.__dashboardData=t,Ue(t.weekHeader||null),Xe(t.dailyTiles||[],t.weekProgress||[],t.details||{}),qe(t.totals||{}),Je(t.weekProgress||[],t.details||{}),Qe(t.cycleControl||{}),et(t.est1RM||[]),tt(t.currentCyclePlan||[]),Ze(t.cardioAnalytics||{}),We(t.auditLog||[]),Ge(t.weekProgress||[]),Ye(t.dailyTiles||[],t.details||{}),Ve(t.details||{},t.dailyTiles||[],t.weekProgress||[]),Ke(t.weekProgress||[],t.details||{});let d=document.getElementById("generatedAt");if(d)d.textContent=`Data generated: ${new Date(t.generatedAt).toLocaleString()}`}function nt(t){window.setRecoveryStatus=async(d,l)=>{let n=d||window.__activeDetailDate;if(!n)return;try{let a=await fetch(`/api/set-status?date=${encodeURIComponent(n)}&status=${encodeURIComponent(l)}`,{method:"POST"});if(!a.ok)throw Error(`set-status failed (${a.status})`);await t(),window.__openDetailForDate?.(n)}catch(a){console.error(a)}},window.logSessionAction=async(d)=>{let l=window.__activeDetailDate,n=window.__activePlanned||{};if(!l)return;let a={action:d,date:l,plannedBarbellRows:n.plannedBarbellRows||[],plannedCardio:n.plannedCardio||null},i=async(s)=>{let r=await fetch("/api/log-action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(s)});if(!r.ok){let o=`log-action failed (${r.status})`;try{let m=await r.json();if(m?.error)o=m.error}catch{}throw Error(o)}};if(d==="finish_session"){let s=Number.parseFloat(F("mainWeightInput")),r=Number.parseInt(F("mainRepsInput"),10),o=Number.parseFloat(F("mainRpeInput")),m=_e("suppCompletedInput"),c=_e("suppModifiedInput"),u=Number.parseFloat(F("suppWeightInput")),p=Number.parseInt(F("suppSetsInput"),10),b=Number.parseInt(F("cardioDurationInput"),10),g=Number.parseInt(F("cardioAvgHrInput"),10),y=Number.parseFloat(F("cardioSpeedInput")),_=Number.parseFloat(F("cardioWorkMinInput")),$=Number.parseFloat(F("cardioRestMinInput")),W=_e("ringsCompletedInput");if(Number.isFinite(s)&&Number.isFinite(r)&&s>0&&r>0)await i({action:"main_done",date:l,plannedBarbellRows:(n.plannedBarbellRows||[]).map((w)=>w.category==="main"?{...w,planned_weight_kg:s,prescribed_reps:r,note:Number.isFinite(o)?`RPE ${o}`:w.note}:w),plannedCardio:n.plannedCardio||null});if(c&&Number.isFinite(u)&&u>0){let w=(n.plannedBarbellRows||[]).find((B)=>B.category==="supplemental")?.prescribed_reps||5,E=Number.isFinite(p)&&p>0?p:10;await i({action:"supp_modified",date:l,plannedBarbellRows:n.plannedBarbellRows||[],plannedCardio:n.plannedCardio||null,suppModifiedText:`${E}x${w}@${u}`})}else if(m)await i({action:"supp_done",date:l,plannedBarbellRows:n.plannedBarbellRows||[],plannedCardio:n.plannedCardio||null});if(Number.isFinite(b)&&b>0&&Number.isFinite(g)&&g>0){let w={...n.plannedCardio||{},duration_min:b};await i({action:"cardio_done",date:l,plannedBarbellRows:n.plannedBarbellRows||[],plannedCardio:w,avgHr:g,speedKmh:Number.isFinite(y)&&y>0?y:void 0,workMin:Number.isFinite(_)&&_>0?_:void 0,restMin:Number.isFinite($)&&$>=0?$:void 0})}if(W)await i({action:"rings_done",date:l,plannedBarbellRows:n.plannedBarbellRows||[],plannedCardio:n.plannedCardio||null});let T="—",A="—";if(Number.isFinite(s)&&Number.isFinite(r)&&s>0&&r>0){let w=s*(1+r/30);T=`${w.toFixed(1)} kg`;let E=(window.__dashboardData?.details?.barbellByDate?.[l]||[]).filter((H)=>H.category==="main"),B=E.length?E[E.length-1]:null;if(B?.actual_weight_kg&&B?.actual_reps){let H=Number(B.actual_weight_kg)*(1+Number(B.actual_reps)/30),X=w-H;A=`${X>=0?"+":""}${X.toFixed(1)} kg vs previous logged main`}}let z=Number.isFinite(g)?g<=125?"Yes":"No":"—",L=(()=>{let w=Number.isFinite(s)&&Number.isFinite(r)&&s>0&&r>0,E=Number.isFinite(b)&&Number.isFinite(g)&&b>0&&g>0,B=m||c&&Number.isFinite(u)&&u>0,H=[w,B,E].filter(Boolean).length;if(H===3)return"A (full session)";if(H===2)return"B (mostly complete)";if(H===1)return"C (partial)";return"D (logged but incomplete)"})();await t(),window.__openDetailForDate?.(l),alert(`Session finished

Top set e1RM: ${T}
Delta: ${A}
Z2 in cap: ${z}
Session quality: ${L}`);return}if(d==="supp_modified"){let s=Number.parseFloat(F("suppWeightInput")),r=Number.parseInt(F("suppSetsInput"),10),o=(n.plannedBarbellRows||[]).find((c)=>c.category==="supplemental")?.prescribed_reps||5;if(!Number.isFinite(s)||s<=0){alert("Enter modified supplemental weight first.");return}let m=Number.isFinite(r)&&r>0?r:10;a.suppModifiedText=`${m}x${o}@${s}`}if(d==="cardio_done"||d==="z2_fixed_hr_test"){let s=F("cardioAvgHrInput").trim(),r=Number.parseInt(F("cardioDurationInput"),10),o=Number.parseFloat(F("cardioSpeedInput")),m=Number.parseFloat(F("cardioWorkMinInput")),c=Number.parseFloat(F("cardioRestMinInput"));if(!s){alert("Enter Avg HR in the Cardio section first, then tap Mark Cardio Complete.");return}let u=Number.parseInt(s,10);if(!Number.isFinite(u)||u<=0){alert("Please enter a valid average HR number.");return}if(a.avgHr=u,a.plannedCardio={...n.plannedCardio||{},duration_min:Number.isFinite(r)&&r>0?r:n.plannedCardio?.duration_min||30},Number.isFinite(o)&&o>0)a.speedKmh=o;let p=String(a.plannedCardio?.session_type||a.plannedCardio?.protocol||""),b=p.includes("VO2")||p==="VO2_4x4"||p==="VO2_1min",g=p.includes("4x4")||p==="VO2_4x4"?4:1,y=p.includes("4x4")||p==="VO2_4x4"?3:1;if(Number.isFinite(m)&&m>0)a.workMin=m;if(Number.isFinite(c)&&c>=0)a.restMin=c;if(d==="cardio_done"&&b){if(!Number.isFinite(a.workMin)||a.workMin<=0)a.workMin=g;if(!Number.isFinite(a.restMin)||a.restMin<0)a.restMin=y}if(d==="z2_fixed_hr_test"&&!a.speedKmh){alert("For Fixed-HR test, enter speed (km/h) before saving.");return}}if(d==="main_done"){let s=Number.parseFloat(F("mainWeightInput")),r=Number.parseInt(F("mainRepsInput"),10);if(Number.isFinite(s)&&s>0&&Number.isFinite(r)&&r>0)a.plannedBarbellRows=(n.plannedBarbellRows||[]).map((o)=>o.category==="main"?{...o,planned_weight_kg:s,prescribed_reps:r}:o)}try{if(await i(a),await t(),window.__openDetailForDate?.(l),d==="cardio_done")alert("Cardio session saved.");if(d==="z2_fixed_hr_test")alert("Monthly Z2 fixed-HR test saved.")}catch(s){console.error(s),alert(`Could not save action: ${s.message||s}`)}}}async function st(){try{window.__renderDashboard=ie,nt(ie),await ie(),Ce(ie),Oe(),He(),Pe();let t=document.getElementById("todayBtn");if(t)t.addEventListener("click",()=>{window.__setActiveTab?.("overview");let a=ee(),i=document.querySelector(`[data-date="${a}"]`);if(i)i.scrollIntoView({behavior:"smooth",block:"center"});window.__openDetailForDate?.(a)});document.addEventListener("click",(a)=>{if(!fe(a,"#startSessionBtn"))return;window.__openDetailForDate?.(ee())});let{refreshButton:d,refreshHealthButton:l}=ze(),n=async({includeHealth:a=!1}={})=>{let i=a?l:d;if(!i)return;let s=i.textContent;if(i.disabled=!0,d&&a)d.disabled=!0;if(l&&!a)l.disabled=!0;i.textContent=a?"Importing health + refreshing...":"Refreshing...";try{let o=await fetch(a?"/api/refresh?includeHealth=1":"/api/refresh",{method:"POST"});if(!o.ok)throw Error(`Refresh failed (${o.status})`);await ie(),i.textContent=a?"Health + DB Updated ✓":"Updated ✓",setTimeout(()=>{i.textContent=s},1200)}catch(r){console.error(r),i.textContent=a?"Health refresh failed":"Refresh failed",setTimeout(()=>{i.textContent=s},2200)}finally{if(i.disabled=!1,d)d.disabled=!1;if(l)l.disabled=!1}};d?.addEventListener("click",async()=>{await n({includeHealth:!1})}),l?.addEventListener("click",async()=>{await n({includeHealth:!0})}),document.addEventListener("click",async(a)=>{let i=fe(a,"[data-tm-delta]");if(i){let m=i.getAttribute("data-tm-lift"),c=Number.parseFloat(i.getAttribute("data-tm-delta")||"0");try{i.disabled=!0;let u=await fetch("/api/tm/update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lift:m,mode:"delta",value:c})});if(!u.ok)throw Error(`TM update failed (${u.status})`);await ie()}catch(u){alert(`Could not update TM: ${u.message||u}`)}finally{i.disabled=!1}return}let s=fe(a,"[data-tm-set]");if(s){let m=s.getAttribute("data-tm-set"),c=Number.parseFloat(F(`tmSet-${m}`));if(!Number.isFinite(c)||c<=0){alert("Enter a valid TM kg value first.");return}try{s.disabled=!0;let u=await fetch("/api/tm/update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lift:m,mode:"set",value:c})});if(!u.ok)throw Error(`TM set failed (${u.status})`);await ie()}catch(u){alert(`Could not set TM: ${u.message||u}`)}finally{s.disabled=!1}return}let r=fe(a,"#startCycleBtn");if(r){let m=F("newCycleStartInput"),c=F("newCycleTypeInput")||"Leader";try{r.disabled=!0;let u=await fetch("/api/cycle/start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({startDate:m,blockType:c})});if(!u.ok)throw Error(`Start cycle failed (${u.status})`);await ie(),alert("New cycle created.")}catch(u){alert(`Could not start cycle: ${u.message||u}`)}finally{r.disabled=!1}return}let o=fe(a,"#applyDeloadBtn");if(o){let m=F("deloadTypeInput"),c=F("deloadStartInput"),u=Number.parseInt(F("deloadDaysInput"),10)||7;try{o.disabled=!0;let p=await fetch("/api/cycle/deload",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({deloadCode:m,startDate:c,durationDays:u})});if(!p.ok)throw Error(`Apply deload failed (${p.status})`);await ie(),alert("Deload applied.")}catch(p){alert(`Could not apply deload: ${p.message||p}`)}finally{o.disabled=!1}}})}catch(t){document.body.innerHTML=`<main class="app"><p>Failed to load dashboard data. Run export script first.</p><pre>${t}</pre></main>`}}st();})();
