const DASHBOARD_TIMEZONE = 'Asia/Manila';

async function loadData() {
  const res = await fetch('./data.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load data.json');
  return res.json();
}

function currentDateInDashboardTZ() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DASHBOARD_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

function statCard(label, value) {
  return `<article class="stat-card"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></article>`;
}

function yesNoChip(label, done, detail = '') {
  const cls = done ? 'chip done' : 'chip';
  return `<span class="${cls}"><i class="dot"></i>${label}${detail ? ` · ${detail}` : ''}</span>`;
}

function renderTotals(totals) {
  const node = document.getElementById('totals');
  node.innerHTML = [
    statCard('Barbell Sessions', totals.barbell_sessions ?? 0),
    statCard('Cardio Sessions', totals.cardio_sessions ?? 0),
    statCard('Rings Sessions', totals.rings_sessions ?? 0),
    statCard('Total Training Days', totals.total_training_days ?? 0),
    statCard('Active Days (14d)', totals.active_days_last_14 ?? 0)
  ].join('');
}

function renderWeekHeader(weekHeader) {
  const node = document.getElementById('weekHeaderBanner');
  if (!node) return;
  if (!weekHeader) {
    node.innerHTML = '<div class="week-header-title">Cycle info unavailable</div>';
    return;
  }
  const mainNums = String(weekHeader.main_pct || '').split('/').map((x) => Number(String(x).replace('%', ''))).filter((n) => Number.isFinite(n));
  const suppNum = Number(String(weekHeader.supp_pct || '').replace('%', ''));
  const clampPct = (n) => Math.max(0, Math.min(100, Number(n) || 0));
  const pctHue = (n) => {
    const p = clampPct(n);
    const t = Math.max(0, Math.min(1, (p - 60) / 40)); // 60→100 maps 0→1
    return 120 - (120 * t); // green → red
  };
  const barFill = (n) => {
    const h = pctHue(n);
    const c1 = `hsl(${h.toFixed(0)} 85% 66%)`;
    const c2 = `hsl(${h.toFixed(0)} 80% 52%)`;
    const c3 = `hsl(${h.toFixed(0)} 88% 42%)`;
    return `linear-gradient(90deg, ${c1} 0%, ${c2} 55%, ${c3} 100%)`;
  };
  const bars = mainNums.map((n) => `<div class="pct-bar"><span style="width:${clampPct(n)}%; background:${barFill(n)}"></span><label>${n}%</label></div>`).join('');
  const deloadBadge = weekHeader.deload_code ? `<span class="chip done">Deload: ${weekHeader.deload_name || weekHeader.deload_code}</span>` : '';

  node.innerHTML = `
    <div class="week-header-title">5/3/1 · ${weekHeader.block_type} · Week ${weekHeader.week_in_block} ${deloadBadge}</div>
    <div class="week-header-meta">Main: ${weekHeader.main_pct} · Supplemental: ${weekHeader.supp_pct}</div>
    <div class="pct-bars">${bars}${Number.isFinite(suppNum) ? `<div class="pct-bar supp"><span style="width:${clampPct(suppNum)}%; background:${barFill(suppNum)}"></span><label>Supp ${suppNum}%</label></div>` : ''}</div>
  `;
}

function renderCycleControl(cycleControl = {}) {
  const node = document.getElementById('cycleControlPanel');
  if (!node) return;
  const latest = cycleControl.latestBlock || {};
  const active = cycleControl.activeDeload || null;
  const profiles = cycleControl.profiles || [];
  const options = profiles.map((p) => `<option value="${p.code}" data-days="${p.default_days || 7}">${p.name}</option>`).join('');
  const events = (cycleControl.recentEvents || []).slice(0, 5).map((e) => `<li>${e.event_date} · ${e.event_type}${e.deload_code ? ` (${e.deload_code})` : ''}</li>`).join('');
  const tmCards = (cycleControl.currentTM || []).map((r) => `
    <article class="tm-card">
      <div class="tm-head">
        <strong>${r.lift}</strong>
        <span class="muted">${r.effective_date || '—'}</span>
      </div>
      <div class="tm-value">${Number(r.tm_kg || 0).toFixed(1)} kg</div>
      <div class="tm-actions">
        <button class="status-btn" data-tm-lift="${r.lift}" data-tm-delta="-2.5" type="button">-2.5</button>
        <button class="status-btn" data-tm-lift="${r.lift}" data-tm-delta="2.5" type="button">+2.5</button>
        <button class="status-btn" data-tm-lift="${r.lift}" data-tm-delta="5" type="button">+5</button>
      </div>
      <div class="tm-set-row">
        <input class="status-input tm-set-input" id="tmSet-${r.lift}" type="number" step="0.5" placeholder="Set exact kg" />
        <button class="status-btn" data-tm-set="${r.lift}" type="button">Set</button>
      </div>
    </article>
  `).join('');

  node.innerHTML = `
    <section class="cycle-control-grid">
      <article class="cycle-control-card">
        <h3 class="cycle-section-title">Cycle</h3>
        <div class="muted">Current block: <strong>#${latest.block_no || '—'}</strong> · ${latest.block_type || '—'}</div>
        <div class="muted">Start: <strong>${latest.start_date || '—'}</strong></div>
        <div class="status-actions compact">
          <input id="newCycleStartInput" class="status-input" type="date" />
          <select id="newCycleTypeInput" class="status-input"><option value="Leader">Leader</option><option value="Anchor">Anchor</option></select>
          <button id="startCycleBtn" class="status-btn" type="button">Start New Cycle</button>
        </div>
      </article>

      <article class="cycle-control-card">
        <h3 class="cycle-section-title">Deload</h3>
        <div class="muted">Active: <strong>${active ? `${active.name || active.deload_code} (${active.start_date} → ${active.end_date})` : 'none'}</strong></div>
        <div class="status-actions compact">
          <select id="deloadTypeInput" class="status-input">${options}</select>
          <input id="deloadStartInput" class="status-input" type="date" />
          <input id="deloadDaysInput" class="status-input" type="number" min="1" step="1" placeholder="Days" />
          <button id="applyDeloadBtn" class="status-btn" type="button">Apply Deload</button>
        </div>
      </article>
    </section>

    <section class="cycle-control-card">
      <h3 class="cycle-section-title">Training Max</h3>
      <div class="tm-grid">${tmCards || '<p class="muted">No TM data.</p>'}</div>
    </section>

    <section class="cycle-control-card">
      <h3 class="cycle-section-title">Recent cycle events</h3>
      <ul class="detail-list">${events || '<li>No events yet.</li>'}</ul>
    </section>
  `;
}

function renderTodayGlance(days = [], weekRows = [], details = {}) {
  const node = document.getElementById('todayGlance');
  if (!node) return;

  const today = currentDateInDashboardTZ();
  const d = (days || []).find((x) => x.session_date === today);
  if (!d) {
    node.innerHTML = '<div class="today-title">TODAY</div><div class="today-meta">No data for today yet.</div>';
    return;
  }

  const barbellRows = (details?.barbellByDate?.[today] || []);
  const hasMain = barbellRows.some((r) => r.category === 'main');
  const hasSupp = barbellRows.some((r) => r.category === 'supplemental');

  const plannedMain = !!d.planned_barbell_main;
  const plannedSupp = !!d.planned_barbell_supp;
  const plannedCardio = !!d.planned_cardio && d.planned_cardio !== 'OFF';
  const plannedRings = !!d.planned_rings;
  const plannedCount = [plannedMain, plannedSupp, plannedCardio, plannedRings].filter(Boolean).length;
  const doneCount = [plannedMain && hasMain, plannedSupp && hasSupp, plannedCardio && d.has_cardio, plannedRings && d.has_rings].filter(Boolean).length;
  const status = doneCount === 0 ? 'Not Started' : (doneCount === plannedCount ? 'Completed' : 'In Progress');
  const pct = plannedCount ? Math.round((doneCount / plannedCount) * 100) : 0;

  const line = (emoji, plannedText, done) => {
    if (!plannedText) return '';
    return `<div class="today-line"><span class="today-chip ${done ? 'done' : 'pending'}">${done ? 'done' : 'pending'}</span>${emoji} ${plannedText}</div>`;
  };

  const mainText = plannedMain ? `${d.planned_barbell_main}` : '';
  const suppText = plannedSupp ? `${d.planned_barbell_supp} ${d.planned_supp_sets || ''}x${d.planned_supp_reps || ''}` : '';
  const cardioText = plannedCardio ? d.planned_cardio : '';
  const ringsText = plannedRings ? `Rings ${d.planned_rings}` : '';
  const estMin = ((plannedMain || plannedSupp) ? 60 : 0) + (plannedCardio ? 30 : 0) + (plannedRings ? 20 : 0);

  node.innerHTML = `
    <div class="today-title">
      <span><strong>TODAY</strong> · ${today}</span>
      <span class="today-progress"><span class="status-dot ${d.pain_level || 'green'}"></span>${doneCount}/${plannedCount || 0} · ${pct}%</span>
    </div>
    <div class="today-meta">Status: <strong>${status}</strong> · Planned time: <strong>${Math.floor(estMin/60)}h ${estMin%60}m</strong></div>
    <div class="today-lines">
      ${line('🏋', mainText, hasMain)}
      ${line('🏋+', suppText, hasSupp)}
      ${line('❤️', cardioText, !!d.has_cardio)}
      ${line('🤸', ringsText, !!d.has_rings)}
    </div>
    ${status === 'Not Started' ? '<div class="today-cta"><button class="btn-primary" type="button" id="startSessionBtn">Start Session</button></div>' : ''}
  `;
}

function renderWeeklyCompletion(weekRows = [], details = {}) {
  let planned = 0;
  let done = 0;

  weekRows.forEach((r) => {
    const rows = details?.barbellByDate?.[r.session_date] || [];
    const hasMain = rows.some((x) => x.category === 'main');
    const hasSupp = rows.some((x) => x.category === 'supplemental');

    const pMain = !!r.main_lift;
    const pSupp = !!r.main_lift;
    const pCardio = !!r.cardio_plan && r.cardio_plan !== 'OFF';
    const pRings = !!r.rings_plan;

    if (pMain) { planned += 1; if (hasMain) done += 1; }
    if (pSupp) { planned += 1; if (hasSupp) done += 1; }
    if (pCardio) { planned += 1; if (r.cardio_done) done += 1; }
    if (pRings) { planned += 1; if (r.rings_done) done += 1; }
  });

  const pct = planned ? Math.round((done / planned) * 100) : 0;
  const pill = document.getElementById('weeklyCompletion');
  if (pill) pill.textContent = `Week: ${done}/${planned} (${pct}%)`;
}

function renderPerformanceKpis(weekRows = [], details = {}) {
  const node = document.getElementById('performanceKpis');
  if (!node) return;

  const plannedWeek = weekRows.reduce((a, r) => a + (!!r.main_lift) + (!!r.main_lift) + (!!r.cardio_plan && r.cardio_plan !== 'OFF') + (!!r.rings_plan), 0);
  const doneWeek = weekRows.reduce((a, r) => {
    const rows = details?.barbellByDate?.[r.session_date] || [];
    const hasMain = rows.some((x) => x.category === 'main');
    const hasSupp = rows.some((x) => x.category === 'supplemental');
    return a + (hasMain ? 1 : 0) + (hasSupp ? 1 : 0) + (!!r.cardio_done ? 1 : 0) + (!!r.rings_done ? 1 : 0);
  }, 0);
  const weekPct = plannedWeek ? Math.round((doneWeek / plannedWeek) * 100) : 0;

  const today = currentDateInDashboardTZ();
  const dayIdx = Math.max(1, Math.min(7, ((new Date(`${today}T00:00:00`).getDay() + 6) % 7) + 1));
  const expectedByToday = Math.round((plannedWeek * (dayIdx / 7)) || 0);
  const expectedPct = plannedWeek ? Math.round((expectedByToday / plannedWeek) * 100) : 0;
  const behind = Math.max(0, expectedByToday - doneWeek);

  const cardioByDate = details?.cardioByDate || {};
  const cardioRows = Object.values(cardioByDate).flat();
  const cardioSessions = [];
  const seenCardio = new Set();
  for (const r of cardioRows) {
    const key = `${r.session_date}|${r.protocol}`;
    if (seenCardio.has(key)) continue;
    seenCardio.add(key);
    cardioSessions.push(r);
  }
  const z2Sessions = cardioSessions.filter((r) => r.protocol === 'Z2');
  const vo2Sessions = cardioSessions.filter((r) => String(r.protocol || '').includes('VO2'));
  const z2Count = z2Sessions.length;
  const vo2Count = vo2Sessions.length;
  const totalIntensity = Math.max(1, z2Count + vo2Count);
  const z2Pct = Math.round((z2Count / totalIntensity) * 100);
  const vo2Pct = 100 - z2Pct;
  const cardioMin = cardioSessions.reduce((a, r) => a + Number(r.duration_min || 0), 0);

  const z2WeeklyTarget = 120; // 4 x 30 min weekly
  const weekStart = (() => {
    const d = new Date(`${today}T00:00:00`);
    const day = (d.getDay() + 6) % 7; // Mon=0
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
  })();
  const weekEnd = (() => {
    const d = new Date(`${weekStart}T00:00:00`);
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  })();
  const z2WeekMin = z2Sessions
    .filter((r) => r.session_date >= weekStart && r.session_date <= weekEnd)
    .reduce((a, r) => a + Number(r.duration_min || 0), 0);

  const barbellByDate = details?.barbellByDate || {};
  const shiftDate = (iso, deltaDays) => {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + deltaDays);
    return d.toISOString().slice(0, 10);
  };
  const makeDateRange = (startStr, endStr) => {
    const out = [];
    let cur = startStr;
    while (cur <= endStr) {
      out.push(cur);
      cur = shiftDate(cur, 1);
    }
    return out;
  };
  const recentStart = shiftDate(today, -13);
  const priorStart = shiftDate(today, -27);
  const priorEnd = shiftDate(today, -14);
  const recentDates = makeDateRange(recentStart, today);
  const priorDates = makeDateRange(priorStart, priorEnd);
  const volSeries = recentDates.map((d) => (barbellByDate[d] || []).reduce((a, r) => a + (Number(r.actual_weight_kg || 0) * Number(r.actual_reps || 0)), 0));
  const mainSeries = recentDates.map((d) => (barbellByDate[d] || [])
    .filter((r) => r.category === 'main')
    .reduce((a, r) => a + (Number(r.actual_weight_kg || 0) * Number(r.actual_reps || 0)), 0));
  const suppSeries = recentDates.map((d) => (barbellByDate[d] || [])
    .filter((r) => r.category === 'supplemental')
    .reduce((a, r) => a + (Number(r.actual_weight_kg || 0) * Number(r.actual_reps || 0)), 0));
  const cardioSeries = recentDates.map((d) => (cardioByDate[d] || []).reduce((a, r) => a + Number(r.duration_min || 0), 0));

  const weeklyVerdict = weekPct >= expectedPct ? '🟢 On pace' : (behind >= 2 ? `🔴 Behind by ${behind} sessions` : '🟡 Slightly behind');
  const intensityVerdict = z2Pct >= 75 ? '🟢 Z2-dominant' : (z2Pct >= 65 ? '🟡 Slightly VO2-heavy' : '🔴 Too VO2-heavy');
  const z2Verdict = z2WeekMin >= z2WeeklyTarget ? `🟢 Target met (+${z2WeekMin-z2WeeklyTarget}m)` : `🔴 Under target (${z2WeeklyTarget-z2WeekMin}m short)`;

  node.innerHTML = `
    <article class="kpi-card"><div class="muted">Training status · weekly execution</div><div class="kpi-value">${weekPct}%</div><div class="muted">Expected by today: ≥${expectedPct}% (${expectedByToday}/${plannedWeek})</div><div class="muted">${weeklyVerdict}</div></article>
    <article class="kpi-card"><div class="muted">Intensity distribution (Z2 vs VO2)</div><div class="kpi-value">${z2Pct}% / ${vo2Pct}%</div><div class="muted">Target: 75% / 25%</div><div class="muted">${intensityVerdict}</div></article>
    <article class="kpi-card"><div class="muted">Z2 volume</div><div class="kpi-value">${z2WeekMin} / ${z2WeeklyTarget} min</div><div class="muted">${z2Verdict}</div></article>
  `;
}

function renderEst1RM(rows = []) {
  const node = document.getElementById('est1rmRows');
  if (!node) return;

  if (!rows.length) {
    node.innerHTML = '<p class="muted">No main-set data in the last 12 weeks yet.</p>';
    return;
  }

  const spark = (series = []) => {
    const arr = (Array.isArray(series) ? series : []).slice().reverse();
    if (arr.length < 2) return '';
    const vals = arr.map((p) => Number(p.e1rm)).filter((n) => Number.isFinite(n));
    if (vals.length < 2) return '';
    const w = 120, h = 26, pad = 2;
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = Math.max(1, max - min);
    const pts = vals.map((v, i) => `${(i*(w/(vals.length-1))).toFixed(1)},${(h-pad-(((v-min)/span)*(h-2*pad))).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" class="spark"><polyline points="${pts}" fill="none" stroke="#9ad0ff" stroke-width="2"/></svg>`;
  };

  node.innerHTML = rows.map((r) => {
    let trend = [];
    if (typeof r.trend_points === 'string') {
      try { trend = JSON.parse(r.trend_points) || []; } catch { trend = []; }
    } else if (Array.isArray(r.trend_points)) trend = r.trend_points;
    const d4 = Number(r.delta_4w_kg || 0);
    const arrow = d4 > 0 ? '↑' : (d4 < 0 ? '↓' : '→');
    const pctToNext = Math.max(0, Math.min(100, Number(r.progress_to_next_pct || 0)));
    return `
    <article class="est1rm-card">
      <div class="est1rm-lift">${r.lift}</div>
      <div class="est1rm-value">${r.est_1rm_kg} kg</div>
      <div class="est1rm-level">${r.strength_level} · ${r.bw_ratio}x BW</div>
      <div class="est1rm-meta">4w: ${arrow} ${Math.abs(d4).toFixed(1)} kg · Cycle: ${(Number(r.delta_cycle_kg||0)).toFixed(1)} kg</div>
      ${spark(trend)}
      <div class="est1rm-meta">${r.next_level !== '—' ? `Next: ${r.next_level} at ${r.next_level_kg} kg` : 'Top level reached'} · BW ${r.bodyweight_kg} kg</div>
      <div class="progress-track"><span style="width:${pctToNext}%"></span></div>
      <div class="est1rm-meta">${pctToNext}% to next level · from ${r.source_weight_kg}×${r.source_reps} (${r.source_date})</div>
    </article>`;
  }).join('');
}

function renderCurrentCyclePlan(rows = []) {
  const node = document.getElementById('cyclePlanRows');
  if (!node) return;
  if (!rows.length) {
    node.innerHTML = '<p class="muted">No planned sessions found for current cycle.</p>';
    return;
  }

  const byDate = new Map();
  for (const r of rows) {
    if (!byDate.has(r.session_date)) byDate.set(r.session_date, []);
    byDate.get(r.session_date).push(r);
  }

  const weekStart = (iso) => {
    const d = new Date(`${iso}T12:00:00Z`);
    const day = (d.getUTCDay() + 6) % 7; // Mon=0
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
  };

  const summarizeTile = (items) => {
    const mainLifts = [...new Set(items.filter((x) => x.category === 'main').map((x) => x.lift))];
    const suppLifts = [...new Set(items.filter((x) => x.category === 'supplemental').map((x) => x.lift))];
    const mainTxt = mainLifts.length ? mainLifts.join(' + ') : 'Rest';
    const suppTxt = suppLifts.length ? suppLifts.join(' + ') : '—';
    return { mainTxt, suppTxt };
  };

  const summarizeModal = (items, category) => {
    const rows2 = items.filter((x) => x.category === category);
    if (!rows2.length) return '<p class="muted">—</p>';
    const byLift = new Map();
    for (const r of rows2) {
      if (!byLift.has(r.lift)) byLift.set(r.lift, []);
      byLift.get(r.lift).push(r);
    }
    const lines = [];
    for (const [lift, arr] of byLift.entries()) {
      const grouped = new Map();
      for (const s of arr) {
        const k = `${s.prescribed_reps}|${s.planned_weight_kg}`;
        grouped.set(k, (grouped.get(k) || 0) + 1);
      }
      const uniq = Array.from(grouped.entries());
      const detail = uniq.length === 1
        ? (() => { const [[k, c]] = uniq; const [reps, wt] = k.split('|'); return `${c}×${reps} @ ${wt}kg`; })()
        : arr.map((s) => `${s.planned_weight_kg}×${s.prescribed_reps}`).join(' · ');
      lines.push(`<li><strong>${lift}</strong>: ${detail}</li>`);
    }
    return `<ul class="detail-list">${lines.join('')}</ul>`;
  };

  const allDates = Array.from(byDate.keys()).sort();
  const shiftDate = (iso, delta) => {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  };
  const start = weekStart(allDates[0]);
  const end = weekStart(allDates[allDates.length - 1]);

  const weekStarts = [];
  for (let d = start; d <= end; d = shiftDate(d, 7)) weekStarts.push(d);

  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  node.innerHTML = weekStarts.map((ws, idx) => {
    const cells = [];
    for (let i = 0; i < 7; i++) {
      const date = shiftDate(ws, i);
      const items = byDate.get(date) || [];
      if (!items.length) continue; // show training days only
      const { mainTxt, suppTxt } = summarizeTile(items);
      cells.push(`<article class="cycle-day-tile" data-cycle-date="${date}" tabindex="0"><div class="tile-date">${dow[i]} · ${date}</div><div class="tile-main">${mainTxt}</div><div class="muted">Supp: ${suppTxt}</div></article>`);
    }
    return `
      <section class="cycle-week-block">
        <div class="panel-head"><h3>Week ${idx + 1} <span class="muted">· ${ws}</span></h3></div>
        <div class="cycle-calendar-grid">
          ${cells.join('')}
        </div>
      </section>`;
  }).join('');

  let modal = document.getElementById('cyclePlanModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'cyclePlanModal';
    modal.className = 'modal';
    modal.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true"><div class="modal-head"><h3 id="cyclePlanTitle">Planned session</h3><button type="button" class="modal-close" id="cyclePlanClose">×</button></div><div id="cyclePlanBody" class="modal-body"></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
    modal.querySelector('#cyclePlanClose')?.addEventListener('click', () => modal.classList.remove('open'));
  }

  const openCycleModal = (date) => {
    const items = byDate.get(date) || [];
    const title = document.getElementById('cyclePlanTitle');
    const body = document.getElementById('cyclePlanBody');
    if (!title || !body) return;
    title.textContent = `Planned session · ${date}`;
    body.innerHTML = `
      <section class="detail-section"><h4>Main</h4>${summarizeModal(items, 'main')}</section>
      <section class="detail-section"><h4>Supplemental</h4>${summarizeModal(items, 'supplemental')}</section>
    `;
    modal.classList.add('open');
  };

  node.querySelectorAll('.cycle-day-tile').forEach((el) => {
    const open = () => openCycleModal(el.getAttribute('data-cycle-date'));
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });
}

function renderCardioAnalytics(data = {}) {
  const node = document.getElementById('cardioAnalytics');
  if (!node) return;

  const totalZ2 = data.total_z2 || 0;
  const inCap = data.z2_in_cap || 0;
  const pct = data.z2_compliance_pct ?? 0;

  const parseJsonArray = (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch { return []; }
    }
    return [];
  };

  const z2Points = parseJsonArray(data.z2_points);
  const z2TrendPoints = z2Points
    .map((p) => {
      const avg = Number(p.avg_hr);
      const max = Number(p.max_hr);
      if (Number.isFinite(avg) && avg > 0) return { date: p.session_date, hr: avg, estimated: false };
      if (Number.isFinite(max) && max > 0) return { date: p.session_date, hr: max, estimated: true };
      return null;
    })
    .filter((p) => p && Number.isFinite(p.hr) && p.hr > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const z2Scatter = parseJsonArray(data.z2_scatter_points)
    .map((p) => ({ date: p.session_date, hr: Number(p.avg_hr), speed: Number(p.speed_kmh) }))
    .filter((p) => p.hr > 0 && p.speed > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-8);

  const z2Efficiency = parseJsonArray(data.z2_efficiency_points)
    .map((p) => ({
      date: p.session_date,
      efficiency: Number(p.efficiency),
      speedAt120: Number(p.speed_at_120),
      speedAt140: Number(p.speed_at_140)
    }))
    .filter((p) => p.efficiency > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const z2Decoupling = parseJsonArray(data.z2_decoupling_points)
    .map((p) => ({ date: p.session_date, decoupling: Number(p.decoupling_pct) }))
    .filter((p) => Number.isFinite(p.decoupling))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const vo2Points = parseJsonArray(data.vo2_points);
  const aerobicTests = (window.__dashboardData?.aerobicTests || []).map((r) => ({ ...r }));

  let z2HrTrend = '<p class="muted">No Z2 HR data in last 12 weeks.</p>';
  const recentZ2 = z2TrendPoints.slice(-8);
  if (recentZ2.length >= 2) {
    const w = 320, h = 120, left = 32, right = 10, top = 10, bottom = 18;
    const hrs = recentZ2.map((p) => Number(p.hr));
    const minHr = Math.floor((Math.min(...hrs) - 3) / 5) * 5;
    const maxHr = Math.ceil((Math.max(...hrs) + 3) / 5) * 5;
    const span = Math.max(5, maxHr - minHr);
    const plotW = w - left - right, plotH = h - top - bottom;
    const pts = recentZ2.map((p, i) => ({
      x: left + (i * (plotW / (recentZ2.length - 1))),
      y: top + (1 - ((Number(p.hr) - minHr) / span)) * plotH,
      hr: Number(p.hr),
      date: p.date,
      estimated: !!p.estimated
    }));
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ hr: Math.round(minHr + t * span), y: top + (1 - t) * plotH }));
    const z2Cap = 125;
    const z2CapY = top + (1 - ((z2Cap - minHr) / span)) * plotH;
    const poly = pts.map((p) => `${p.x},${p.y}`).join(' ');
    const grid = ticks.map((t) => `<line x1="${left}" y1="${t.y}" x2="${w-right}" y2="${t.y}" class="z2-grid"/>`).join('');
    const yLabels = ticks.map((t) => `<text x="${left-6}" y="${t.y+3}" class="z2-label" text-anchor="end">${t.hr}</text>`).join('');
    const circles = pts.map((p) => `<g><circle cx="${p.x}" cy="${p.y}" r="2.8" style="opacity:${p.estimated ? '0.65' : '1'}"></circle><title>${p.date}: HR ${p.hr}${p.estimated ? ' (from max HR)' : ''}</title></g>`).join('');

    const speedByDate = new Map(z2Points.map((r) => [r.session_date, Number(r.speed_kmh)]));
    const effRaw = pts
      .map((p) => {
        const sp = speedByDate.get(p.date);
        return (Number.isFinite(sp) && sp > 0 && p.hr > 0) ? { x: p.x, eff: sp / p.hr } : null;
      })
      .filter(Boolean);
    let effPolyline = '';
    let effLegend = 'efficiency line: need speed+HR logs';
    if (effRaw.length >= 2) {
      const minE = Math.min(...effRaw.map((e) => e.eff));
      const maxE = Math.max(...effRaw.map((e) => e.eff));
      const spanE = Math.max(0.0001, maxE - minE);
      const effPts = effRaw.map((e) => ({ x: e.x, y: top + (1 - ((e.eff - minE) / spanE)) * plotH }));
      effPolyline = `<polyline points="${effPts.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="#ff8cc6" stroke-width="2" stroke-dasharray="4 2"/>`;
      const firstE = effRaw[0].eff, lastE = effRaw[effRaw.length - 1].eff;
      const d = ((lastE - firstE) / firstE) * 100;
      effLegend = `efficiency Δ ${d >= 0 ? '+' : ''}${d.toFixed(1)}%`;
    }
    const delta = (pts[pts.length - 1].hr - pts[0].hr).toFixed(1);
    const estCount = recentZ2.filter((p) => p.estimated).length;
    z2HrTrend = `
      <div class="z2-graph-wrap">
        <svg viewBox="0 0 ${w} ${h}" class="z2-graph" role="img" aria-label="Z2 average HR trend">
          ${grid}${yLabels}
          <line x1="${left}" y1="${h-bottom}" x2="${w-right}" y2="${h-bottom}" class="z2-axis"/>
          <line x1="${left}" y1="${top}" x2="${left}" y2="${h-bottom}" class="z2-axis"/>
          <line x1="${left}" y1="${z2CapY}" x2="${w-right}" y2="${z2CapY}" stroke="#ffc15a" stroke-dasharray="3 2" stroke-width="1.2"/>
          <text x="${w-right}" y="${Math.max(8, z2CapY - 3)}" class="z2-label" text-anchor="end">Z2 cap ${z2Cap}</text>
          <polyline points="${poly}" class="z2-line"/>
          ${effPolyline}
          ${circles}
          <text x="${left}" y="${h-3}" class="z2-label">${pts[0]?.date || ''}</text>
          <text x="${w-right}" y="${h-3}" class="z2-label" text-anchor="end">${pts[pts.length-1]?.date || ''}</text>
        </svg>
        <div class="muted">Last ${recentZ2.length} Z2 sessions · HR trend Δ ${delta} bpm${estCount ? ` · ${estCount} points estimated from max HR` : ''} · ${effLegend}</div>
      </div>`;
  }

  let z2ScatterGraph = '<div class="cardio-empty"><div><strong>Unlock this chart</strong></div><div class="muted">Log speed in notes as: <code>@ 6.2 km/h</code></div></div>';
  if (z2Scatter.length >= 2) {
    const w = 320, h = 180, left = 36, right = 12, top = 12, bottom = 24;
    const minX = Math.min(...z2Scatter.map((p) => p.speed)) - 0.2;
    const maxX = Math.max(...z2Scatter.map((p) => p.speed)) + 0.2;
    const minY = Math.floor((Math.min(...z2Scatter.map((p) => p.hr)) - 3) / 5) * 5;
    const maxY = Math.ceil((Math.max(...z2Scatter.map((p) => p.hr)) + 3) / 5) * 5;
    const xSpan = Math.max(0.5, maxX - minX);
    const ySpan = Math.max(5, maxY - minY);
    const plotW = w - left - right, plotH = h - top - bottom;
    const withXY = z2Scatter.map((p, i) => ({
      ...p,
      i,
      x: left + ((p.speed - minX) / xSpan) * plotW,
      y: top + (1 - ((p.hr - minY) / ySpan)) * plotH,
      opacity: (0.35 + (0.65 * (i + 1) / z2Scatter.length)).toFixed(2)
    }));
    const circles = withXY.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="3.2" style="fill:#59a8ff;opacity:${p.opacity}"><title>${p.date}: ${p.speed.toFixed(1)} km/h · HR ${p.hr}</title></circle>`).join('');

    let trendline = '';
    let trendlineNote = 'Need ≥4 sessions for a stable trendline';
    if (z2Scatter.length >= 4) {
      const mx = z2Scatter.reduce((a, p) => a + p.speed, 0) / z2Scatter.length;
      const my = z2Scatter.reduce((a, p) => a + p.hr, 0) / z2Scatter.length;
      const cov = z2Scatter.reduce((a, p) => a + ((p.speed - mx) * (p.hr - my)), 0);
      const varX = z2Scatter.reduce((a, p) => a + ((p.speed - mx) ** 2), 0) || 1;
      const slope = cov / varX;
      const intercept = my - (slope * mx);
      const y1 = slope * minX + intercept;
      const y2 = slope * maxX + intercept;
      const toY = (val) => top + (1 - ((val - minY) / ySpan)) * plotH;
      trendline = `<line x1="${left}" y1="${toY(y1)}" x2="${w-right}" y2="${toY(y2)}" class="vo2-line line-44"/>`;
      trendlineNote = 'Trendline shown (≥4 sessions)';
    }

    z2ScatterGraph = `
      <div class="z2-graph-wrap">
        <svg viewBox="0 0 ${w} ${h}" class="z2-graph" role="img" aria-label="Z2 speed vs HR scatter">
          <line x1="${left}" y1="${h-bottom}" x2="${w-right}" y2="${h-bottom}" class="z2-axis"/>
          <line x1="${left}" y1="${top}" x2="${left}" y2="${h-bottom}" class="z2-axis"/>
          ${trendline}
          ${circles}
          <text x="${w/2}" y="${h-4}" class="z2-label" text-anchor="middle">Speed (km/h)</text>
          <text x="12" y="${h/2}" class="z2-label" text-anchor="middle" transform="rotate(-90 12 ${h/2})">Avg HR</text>
        </svg>
        <div class="muted">Older = lighter dot · newer = darker dot · ${trendlineNote}</div>
      </div>`;
  }

  let adaptBlock = '<p class="muted">Adaptation status unavailable.</p>';
  let z2KpiBlock = '<p class="muted">No Z2 KPI data yet.</p>';
  let efficiencyBlock = '<p class="muted">No Z2 efficiency points yet.</p>';
  let aerobicSnapshot = '<p class="muted">Aerobic status unavailable.</p>';
  if (z2Efficiency.length >= 1) {
    const recent = z2Efficiency.slice(-8);
    const last = recent[recent.length - 1];
    const first = recent[0];
    const baseline = z2Efficiency[0];
    const rolling4 = z2Efficiency.slice(-4);
    const rolling4Avg = rolling4.reduce((a, p) => a + p.efficiency, 0) / rolling4.length;
    const deltaRecent = first ? (((last.efficiency - first.efficiency) / first.efficiency) * 100) : 0;
    const deltaBaseline = baseline ? (((last.efficiency - baseline.efficiency) / baseline.efficiency) * 100) : 0;
    const status = deltaRecent > 1 ? 'Improving' : (deltaRecent < -1 ? 'Regressing' : 'Flat');
    const verdict = deltaRecent > 1 && pct >= 70 ? '🟢 On track' : (pct < 60 ? '🟡 Needs consistency' : '🟡 Stable but no gain');
    const recommendation = deltaRecent > 1 ? 'Keep current Z2 structure.' : 'Increase Z2 volume by +20 min/week or progress treadmill speed slightly.';

    const vo2Recent = [...vo2Points].slice(-6).filter((p) => Number(p.avg_speed_kmh || p.max_speed_kmh || 0) > 0);
    const vo2Stimulus = vo2Recent.length >= 2 ? 'Adequate' : 'Low';
    const adaptState = (deltaRecent > 1 && pct >= 70 && vo2Stimulus === 'Adequate') ? '🟢 Adapting' : ((pct < 60 || deltaRecent < -1) ? '🔴 Off track' : '🟡 In progress');

    adaptBlock = `
      <div class="cardio-z2-card" style="grid-column:1 / -1">
        <div class="muted">Am I adapting?</div>
        <div class="cardio-z2-big">${adaptState}</div>
        <div class="muted">Efficiency ${status} · Compliance ${pct}% · VO2 stimulus ${vo2Stimulus} · Drift data ${z2Decoupling.length ? 'present' : 'missing'}</div>
      </div>`;

    z2KpiBlock = `
      <div class="cardio-z2-card">
        <div class="muted">Z2 KPI status</div>
        <div class="cardio-z2-big">${status}</div>
        <div class="muted">${verdict}</div>
        <div class="muted">Baseline: ${baseline.efficiency.toFixed(3)} (${baseline.date})</div>
        <div class="muted">Current: ${last.efficiency.toFixed(3)} (${last.date})</div>
        <div class="muted">${rolling4.length}-session avg: ${rolling4Avg.toFixed(3)} · MoM proxy Δ ${deltaRecent.toFixed(1)}%</div>
      </div>`;

    efficiencyBlock = `
      <div class="cardio-z2-card">
        <div class="muted">Fixed-HR benchmark (primary)</div>
        <div class="cardio-z2-big">${Number.isFinite(last.speedAt120) ? last.speedAt120.toFixed(2) : '—'} km/h</div>
        <div class="muted">at 120 bpm · Efficiency ${last.efficiency.toFixed(3)}</div>
        <div class="muted">Example: ${(Number.isFinite(last.speedAt120) ? last.speedAt120.toFixed(1) : '6.1')} km/h @ 120 bpm</div>
        <div class="muted">Δ ${deltaBaseline.toFixed(1)}% vs baseline · Alt @140: ${Number.isFinite(last.speedAt140) ? last.speedAt140.toFixed(2) : '—'} km/h</div>
      </div>`;

    aerobicSnapshot = `
      <div class="cardio-z2-card" style="grid-column:1 / -1">
        <div class="muted">Aerobic Status</div>
        <div class="muted">Efficiency: ${status} · Compliance: ${pct}% · Drift data: ${z2Decoupling.length ? 'Available' : 'Missing'} </div>
        <div class="muted"><strong>Recommendation:</strong> ${recommendation}</div>
      </div>`;
  }

  let decouplingBlock = '<p class="muted">No decoupling data yet (requires end HR in notes, e.g. "end BPM 141").</p>';
  if (z2Decoupling.length) {
    const recent = z2Decoupling.slice(-5);
    const rows = recent.map((r) => {
      const tag = r.decoupling < 5 ? 'good' : (r.decoupling <= 7 ? 'watch' : 'high');
      return `<div class="muted">${r.date}: ${r.decoupling.toFixed(1)}% (${tag})</div>`;
    }).join('');
    decouplingBlock = `
      <div class="cardio-z2-card">
        <div class="muted">Aerobic decoupling (quarterly check)</div>
        ${rows}
        <div class="muted">Guide: &lt;5% good · 5–7% watch · &gt;7% high drift</div>
      </div>`;
  }

  const drawMiniSeries = (rows, getY, yFmt = (v) => v) => {
    if ((rows || []).length < 2) return '<p class="muted">Need at least 2 tests.</p>';
    const w = 320, h = 120, left = 30, right = 8, top = 10, bottom = 18;
    const vals = rows.map(getY).map(Number).filter((v) => Number.isFinite(v));
    if (vals.length < 2) return '<p class="muted">Insufficient numeric data.</p>';
    const min = Math.min(...vals), max = Math.max(...vals), span = Math.max(1, max - min);
    const plotW = w - left - right, plotH = h - top - bottom;
    const pts = rows.map((r, i) => {
      const v = Number(getY(r));
      return { x: left + (i * (plotW / (rows.length - 1))), y: top + (1 - ((v - min) / span)) * plotH, v, d: r.date };
    });
    const poly = pts.map((p) => `${p.x},${p.y}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" class="z2-graph"><line x1="${left}" y1="${h-bottom}" x2="${w-right}" y2="${h-bottom}" class="z2-axis"/><line x1="${left}" y1="${top}" x2="${left}" y2="${h-bottom}" class="z2-axis"/><polyline points="${poly}" class="z2-line"/>${pts.map((p)=>`<circle cx="${p.x}" cy="${p.y}" r="2.6"><title>${p.d}: ${yFmt(p.v)}</title></circle>`).join('')}</svg>`;
  };

  const fs = aerobicTests.filter((t) => t.test_type === 'FIXED_SPEED' && Number(t.avg_hr) > 0);
  const fh = aerobicTests.filter((t) => t.test_type === 'FIXED_HR' && Number(t.avg_speed) > 0);
  const dz = aerobicTests.filter((t) => t.test_type === 'ZONE2_SESSION' && Number(t.decoupling_percent) >= 0);

  const fsLast = fs[fs.length - 1];
  const fhLast = fh[fh.length - 1];
  const dzLast = dz[dz.length - 1];

  const clamp = (x, a, b) => Math.max(a, Math.min(x, b));
  const scoreEff = (hr) => clamp(100 * (170 - Number(hr)) / 30, 0, 100);
  const scoreCap = (spd) => clamp(100 * (Number(spd) - 5) / 4, 0, 100);
  const scoreDur = (dec) => clamp(100 * (10 - Number(dec)) / 10, 0, 100);
  const afsLabel = (v) => (v >= 80 ? 'excellent' : v >= 65 ? 'strong' : v >= 50 ? 'average' : v >= 35 ? 'developing' : 'weak base');

  const byMonth = new Map();
  for (const t of aerobicTests) {
    const m = String(t.date || '').slice(0, 7);
    if (!m) continue;
    if (!byMonth.has(m)) byMonth.set(m, {});
    const slot = byMonth.get(m);
    slot[t.test_type] = t;
  }
  const afsSeries = Array.from(byMonth.entries())
    .sort((a, b) => a[0] < b[0] ? -1 : 1)
    .map(([month, v]) => {
      if (!v.FIXED_SPEED || !v.FIXED_HR || !v.ZONE2_SESSION) return null;
      const eff = scoreEff(v.FIXED_SPEED.avg_hr);
      const cap = scoreCap(v.FIXED_HR.avg_speed);
      const dur = scoreDur(v.ZONE2_SESSION.decoupling_percent);
      const afs = 0.40 * cap + 0.35 * eff + 0.25 * dur;
      return { date: `${month}-01`, afs: Number(afs.toFixed(1)), eff, cap, dur };
    })
    .filter(Boolean);
  const afsLast = afsSeries[afsSeries.length - 1] || null;
  const afsPrev = afsSeries.length > 1 ? afsSeries[afsSeries.length - 2] : null;
  const afsDelta = afsLast && afsPrev ? (afsLast.afs - afsPrev.afs) : null;

  const daysSince = (d) => {
    if (!d) return 999;
    const ms = (new Date(`${currentDateInDashboardTZ()}T00:00:00`) - new Date(`${d}T00:00:00`));
    return Math.floor(ms / 86400000);
  };
  const dueLine = (name, dt) => {
    const ds = daysSince(dt);
    if (ds > 35) return `${name}: overdue (${ds}d)`;
    if (ds > 27) return `${name}: due soon (${ds}d)`;
    return `${name}: ok (${ds}d)`;
  };

  const afsBand = (v) => {
    if (v == null || !Number.isFinite(v)) return 'afs-none';
    if (v >= 80) return 'afs-elite';
    if (v >= 65) return 'afs-green';
    if (v >= 50) return 'afs-yellow';
    if (v >= 35) return 'afs-orange';
    return 'afs-red';
  };

  const aerobicCards = `
    <div class="cardio-z2-card ${afsBand(afsLast?.afs)}"><div class="muted">Aerobic Fitness Score (AFS)</div><div class="cardio-z2-big">${afsLast ? afsLast.afs.toFixed(1) : '—'}</div><div class="muted">${afsLast ? afsLabel(afsLast.afs) : 'need all 3 monthly tests'}${afsDelta == null ? '' : ` · ${afsDelta >= 0 ? '↑' : '↓'} ${Math.abs(afsDelta).toFixed(1)}`}</div></div>
    <div class="cardio-z2-card"><div class="muted">Cardio Efficiency (HR @ 11 km/h)</div><div class="cardio-z2-big">${fsLast ? Number(fsLast.avg_hr).toFixed(0) : '—'}</div><div class="muted">Trend target: ↓</div></div>
    <div class="cardio-z2-card"><div class="muted">Aerobic Capacity (speed @ 120 bpm)</div><div class="cardio-z2-big">${fhLast ? Number(fhLast.avg_speed).toFixed(2) : '—'} km/h</div><div class="muted">Trend target: ↑</div></div>
    <div class="cardio-z2-card"><div class="muted">Aerobic Durability (Pa:Hr)</div><div class="cardio-z2-big">${dzLast ? Number(dzLast.decoupling_percent).toFixed(1) : '—'}%</div><div class="muted">Trend target: ↓</div></div>
    <div class="cardio-z2-card"><div class="muted">Monthly test scheduler</div><div class="muted">${dueLine('Fixed-speed', fsLast?.date)}<br/>${dueLine('Fixed-HR', fhLast?.date)}<br/>${dueLine('Decoupling', dzLast?.date)}</div></div>
  `;

  const recentVO2 = [...(vo2Points || [])].slice(-16);
  let vo2Graph = '<p class="muted">No VO2 data in last 12 weeks.</p>';
  if (recentVO2.length >= 1) {
    const w = 320;
    const h = 120;
    const leftPad = 32;
    const rightPad = 22;
    const topPad = 10;
    const bottomPad = 18;

    const defaultRestByProtocol = {
      VO2_4x4: 3,
      VO2_1min: 1
    };

    const rows = recentVO2
      .map((p) => ({
        date: p.session_date,
        protocol: p.protocol,
        speed: Number(p.avg_speed_kmh || p.max_speed_kmh || 0),
        hr: Number(p.avg_hr ?? p.max_hr ?? 0),
        workMin: Number(p.work_min || (p.protocol === 'VO2_4x4' ? 4 : (p.protocol === 'VO2_1min' ? 1 : 0))),
        restMin: Number(p.easy_min || p.rest_min || defaultRestByProtocol[p.protocol] || 0)
      }))
      .filter((p) => p.hr > 0 && (p.protocol === 'VO2_4x4' || p.protocol === 'VO2_1min'))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    const makeProtocolChart = (protocol, pointCls, lineCls, label) => {
      const series = rows.filter((r) => r.protocol === protocol);
      if (!series.length) {
        return `<div class="z2-graph-wrap"><p class="muted">${label}: no data.</p></div>`;
      }

      const minHr = Math.floor((Math.min(...series.map((r) => r.hr)) - 3) / 5) * 5;
      const maxHr = Math.ceil((Math.max(...series.map((r) => r.hr)) + 3) / 5) * 5;
      const span = Math.max(5, maxHr - minHr);
      const plotW = w - leftPad - rightPad;
      const plotH = h - topPad - bottomPad;

      const withXY = series.map((r, i) => ({
        ...r,
        x: series.length === 1 ? leftPad + plotW / 2 : leftPad + (i * (plotW / (series.length - 1))),
        y: topPad + (1 - ((r.hr - minHr) / span)) * plotH
      }));

      const polyline = withXY.length >= 2 ? `<polyline points="${withXY.map((p) => `${p.x},${p.y}`).join(' ')}" class="vo2-line ${lineCls}"/>` : '';
      const points = withXY.map((p, idx) => {
        const dy = idx % 2 === 0 ? -6 : 12;
        const speedLabel = (Number.isFinite(p.speed) && p.speed > 0) ? `${p.speed}k` : '';
        const wr = p.workMin > 0 ? `${p.workMin}/${p.restMin || 0}m` : 'n/a';
        return `<g><circle cx="${p.x}" cy="${p.y}" r="2.8" class="${pointCls}"></circle>${speedLabel ? `<text x="${p.x}" y="${p.y + dy}" class="z2-point-label" text-anchor="middle">${speedLabel}</text>` : ''}<title>${p.date} ${protocol}: ${Number.isFinite(p.speed) && p.speed > 0 ? `${p.speed} km/h` : 'no speed logged'} · HR ${p.hr} · work/rest ${wr}</title></g>`;
      }).join('');

      const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
        const hrTick = Math.round(minHr + t * span);
        const y = topPad + (1 - t) * plotH;
        return { hrTick, y };
      });
      const grid = ticks.map((t) => `<line x1="${leftPad}" y1="${t.y}" x2="${w - rightPad}" y2="${t.y}" class="z2-grid"/>`).join('');
      const yLabels = ticks.map((t) => `<text x="${leftPad - 6}" y="${t.y + 3}" class="z2-label" text-anchor="end">${t.hrTick}</text>`).join('');

      const effRows = series.filter((r) => Number.isFinite(r.speed) && r.speed > 0 && Number.isFinite(r.hr) && r.hr > 0)
        .map((r) => {
          const work = Math.max(0, r.workMin || 0);
          const rest = Math.max(0, r.restMin || 0);
          const restFactor = (work > 0 && rest > 0) ? (work / rest) : (work > 0 ? 1 : 0);
          return { ...r, eff: (r.speed / r.hr) * restFactor };
        });

      let trendText = `${label}: need ≥2 sessions with speed + HR logged`;
      if (effRows.length >= 2) {
        const first = effRows[0];
        const last = effRows[effRows.length - 1];
        const effDelta = (((last.eff - first.eff) / first.eff) * 100);
        trendText = `${label} efficiency Δ ${effDelta >= 0 ? '+' : ''}${effDelta.toFixed(1)}% (${first.eff.toFixed(4)} → ${last.eff.toFixed(4)}, ${effRows.length} sessions, rest-adjusted)`;
      }

      return `
        <div class="z2-graph-wrap" style="margin-bottom:10px">
          <div class="muted" style="margin-bottom:4px">${label}</div>
          <svg viewBox="0 0 ${w} ${h}" class="z2-graph" role="img" aria-label="${label} HR efficiency trend">
            ${grid}
            ${yLabels}
            <line x1="${leftPad}" y1="${h - bottomPad}" x2="${w - rightPad}" y2="${h - bottomPad}" class="z2-axis"/>
            <line x1="${leftPad}" y1="${topPad}" x2="${leftPad}" y2="${h - bottomPad}" class="z2-axis"/>
            ${polyline}
            ${points}
          </svg>
          <div class="vo2-legend"><span class="muted">${trendText}</span></div>
        </div>
      `;
    };

    vo2Graph = `${makeProtocolChart('VO2_4x4', 'vo2-pt-44', 'line-44', 'VO2 4x4')} ${makeProtocolChart('VO2_1min', 'vo2-pt-18', 'line-18', 'VO2 1min')}`;
  }

  node.innerHTML = `
    <div class="cardio-analytics">
      ${adaptBlock}
      <div class="cardio-z2-card">
        <div class="muted">Z2 compliance</div>
        <div class="cardio-z2-big">${pct}%</div>
        <div class="muted">${inCap}/${totalZ2} sessions in cap</div>
      </div>
      ${z2KpiBlock}
      ${efficiencyBlock}
      ${decouplingBlock}
      ${aerobicSnapshot}
      <div class="cardio-vo2-list" style="grid-column:1 / -1">
        <div class="muted" style="margin-bottom:6px">Aerobic Fitness (monthly tests)</div>
        <div class="cardio-analytics">${aerobicCards}</div>
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
        ${drawMiniSeries(afsSeries, (r) => r.afs, (v) => `${Number(v).toFixed(1)}`)}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">HR at 11 km/h</div>
        ${drawMiniSeries(fs, (r) => r.avg_hr, (v) => `${v} bpm`)}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">Speed at 120 bpm</div>
        ${drawMiniSeries(fh, (r) => r.avg_speed, (v) => `${Number(v).toFixed(2)} km/h`)}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">Aerobic Decoupling %</div>
        ${drawMiniSeries(dz, (r) => r.decoupling_percent, (v) => `${Number(v).toFixed(1)}%`)}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">Z2 HR variation trend</div>
        ${z2HrTrend}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">Z2 speed vs HR (scatter + trendline)</div>
        ${z2ScatterGraph}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">VO2 HR efficiency trends (by protocol)</div>
        ${vo2Graph}
      </div>
    </div>
  `;

  const postAerobic = async (payload) => {
    const res = await fetch('/api/log-aerobic-test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!res.ok) {
      let msg = `failed (${res.status})`;
      try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
      throw new Error(msg);
    }
  };

  const today = currentDateInDashboardTZ();

  const ensureAerobicModal = () => {
    let modal = document.getElementById('aerobicEntryModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'aerobicEntryModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="aeroTitle">
        <div class="modal-head">
          <h3 id="aeroTitle">Log aerobic test</h3>
          <button type="button" class="modal-close" id="aeroCloseBtn">×</button>
        </div>
        <div id="aeroBody" class="modal-body"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
    modal.querySelector('#aeroCloseBtn')?.addEventListener('click', () => modal.classList.remove('open'));
    return modal;
  };

  const num = (id) => {
    const v = parseFloat(document.getElementById(id)?.value || '');
    return Number.isFinite(v) ? v : null;
  };

  const openAerobicForm = (kind) => {
    const modal = ensureAerobicModal();
    const title = modal.querySelector('#aeroTitle');
    const body = modal.querySelector('#aeroBody');
    if (!title || !body) return;

    if (kind === 'FIXED_SPEED') {
      title.textContent = 'Log Fixed-Speed Test (11.0 km/h, 0% incline, 2.4 km)';
      body.innerHTML = `
        <div class="status-actions"><input id="aeroAvgHr" class="status-input" type="number" step="1" placeholder="Average HR" /><input id="aeroMaxHr" class="status-input" type="number" step="1" placeholder="Max HR (optional)" /></div>
        <div class="status-actions"><button type="button" class="status-btn" id="aeroSaveBtn">Save Test</button></div>`;
      body.querySelector('#aeroSaveBtn')?.addEventListener('click', async () => {
        const avgHr = num('aeroAvgHr');
        const maxHr = num('aeroMaxHr');
        if (!avgHr || avgHr <= 0) return alert('Enter average HR');
        await postAerobic({ testType:'FIXED_SPEED', date: today, speed:11, distance:2.4, duration:13, avgHr, maxHr, notes:'Monthly fixed-speed test' });
        modal.classList.remove('open');
        await window.__renderDashboard();
      });
    }

    if (kind === 'FIXED_HR') {
      title.textContent = 'Log Fixed-HR Test (120 bpm, 30 min, 0% incline)';
      body.innerHTML = `
        <div class="status-actions"><input id="aeroAvgSpeed" class="status-input" type="number" step="0.1" placeholder="Average speed (km/h)" /><input id="aeroAvgHr" class="status-input" type="number" step="1" placeholder="Average HR (default 120)" value="120" /></div>
        <div class="status-actions"><button type="button" class="status-btn" id="aeroSaveBtn">Save Test</button></div>`;
      body.querySelector('#aeroSaveBtn')?.addEventListener('click', async () => {
        const avgSpeed = num('aeroAvgSpeed');
        const avgHr = num('aeroAvgHr') || 120;
        if (!avgSpeed || avgSpeed <= 0) return alert('Enter average speed');
        await postAerobic({ testType:'FIXED_HR', date: today, duration:30, avgSpeed, avgHr, notes:'Monthly fixed-HR test' });
        modal.classList.remove('open');
        await window.__renderDashboard();
      });
    }

    if (kind === 'ZONE2_SESSION') {
      title.textContent = 'Log Decoupling Test (steady Z2)';
      body.innerHTML = `
        <div class="status-actions"><input id="aeroHr1" class="status-input" type="number" step="1" placeholder="HR first half" /><input id="aeroHr2" class="status-input" type="number" step="1" placeholder="HR second half" /></div>
        <div class="status-actions"><input id="aeroS1" class="status-input" type="number" step="0.1" placeholder="Speed first half (optional)" /><input id="aeroS2" class="status-input" type="number" step="0.1" placeholder="Speed second half (optional)" /></div>
        <div class="status-actions"><button type="button" class="status-btn" id="aeroSaveBtn">Save Test</button></div>`;
      body.querySelector('#aeroSaveBtn')?.addEventListener('click', async () => {
        const hr1 = num('aeroHr1');
        const hr2 = num('aeroHr2');
        const s1 = num('aeroS1');
        const s2 = num('aeroS2');
        if (!hr1 || !hr2 || hr1 <= 0) return alert('Enter first and second half HR');
        await postAerobic({ testType:'ZONE2_SESSION', date: today, duration:40, hrFirstHalf:hr1, hrSecondHalf:hr2, speedFirstHalf:s1, speedSecondHalf:s2, notes:'Monthly decoupling test' });
        modal.classList.remove('open');
        await window.__renderDashboard();
      });
    }

    modal.classList.add('open');
  };

  const fsBtn = document.getElementById('logFixedSpeedBtn');
  if (fsBtn) fsBtn.onclick = () => openAerobicForm('FIXED_SPEED');
  const fhBtn = document.getElementById('logFixedHrBtn');
  if (fhBtn) fhBtn.onclick = () => openAerobicForm('FIXED_HR');
  const dzBtn = document.getElementById('logDecouplingBtn');
  if (dzBtn) dzBtn.onclick = () => openAerobicForm('ZONE2_SESSION');
}

function renderAuditLog(rows = []) {
  const node = document.getElementById('auditLogPanel');
  if (!node) return;
  if (!rows.length) {
    node.innerHTML = '<p class="muted">No audit events yet.</p>';
    return;
  }

  node.innerHTML = `<div class="audit-list">${rows.map((r) => {
    const ts = (r.event_time || '').replace('T', ' ').slice(0, 19);
    const change = r.old_value || r.new_value
      ? `${r.old_value ?? '∅'} → ${r.new_value ?? '∅'}`
      : '';
    return `
      <div class="audit-row">
        <div class="audit-top">
          <span>${r.domain} · ${r.action} · ${r.key_name || '-'}</span>
          <span>${ts}</span>
        </div>
        ${change ? `<div class="audit-meta">${change}</div>` : ''}
        ${r.note ? `<div class="audit-meta">${r.note}</div>` : ''}
      </div>
    `;
  }).join('')}</div>`;
}

function renderWeekProgress(rows) {
  const node = document.getElementById('weekRows');
  const today = currentDateInDashboardTZ();
  node.innerHTML = rows.map((r) => {
    const planned = [!!r.main_lift, !!r.cardio_plan && r.cardio_plan !== 'OFF', !!r.rings_plan].filter(Boolean).length;
    const done = [!!r.barbell_done, !!r.cardio_done, !!r.rings_done].filter(Boolean).length;
    const cls = done === planned && planned > 0 ? 'done-all' : (done > 0 ? 'partial' : (r.session_date >= today ? 'upcoming' : ''));
    return `
    <article class="week-row ${cls}" role="button" tabindex="0" data-date="${r.session_date}">
      <div class="week-meta">
        <div class="week-day">${r.day_name.slice(0,3)}</div>
        <div class="muted">${r.session_date.slice(5)}</div>
      </div>
      <div class="week-chips">
        ${yesNoChip('🏋', r.barbell_done, r.main_lift || '—')}
        ${yesNoChip('❤️', r.cardio_done, r.cardio_plan || 'OFF')}
        ${yesNoChip('🤸', r.rings_done, r.rings_plan || '—')}
      </div>
    </article>`;
  }).join('');
}

function renderDailyTiles(days, details = {}) {
  const node = document.getElementById('dailyTiles');
  const today = currentDateInDashboardTZ();

  const badgeFor = ({ icon, planned, done, detail, isPast }) => {
    if (!planned) return '';
    let cls = 'badge planned';
    if (done) cls = 'badge done';
    else if (!done && isPast) cls = 'badge missed';
    return `<span class="${cls}">${icon} ${detail || ''}</span>`;
  };

  const orderedDays = [...days].reverse();

  node.innerHTML = orderedDays.map((d) => {
    const isPast = d.session_date < today;
    const rows = details?.barbellByDate?.[d.session_date] || [];
    const hasMain = rows.some((x) => x.category === 'main');
    const hasSupp = rows.some((x) => x.category === 'supplemental');

    const plannedMain = !!d.planned_barbell_main;
    const plannedSupp = !!d.planned_barbell_supp;
    const plannedCardio = !!d.planned_cardio && d.planned_cardio !== 'OFF';
    const plannedRings = !!d.planned_rings;

    const mainDetail = plannedMain ? `${d.planned_barbell_main}`.trim() : d.barbell_lift;
    const suppDetail = plannedSupp ? `${d.planned_barbell_supp} ${d.planned_supp_sets || ''}x${d.planned_supp_reps || ''}`.trim() : '';
    const cardioDetail = d.planned_cardio || d.cardio_protocol;
    const ringsDetail = d.planned_rings || d.rings_template;

    const pain = d.pain_level || 'green';
    const painBadge = `<span class="status-dot clickable ${pain}" data-date="${d.session_date}" data-status="${pain}" data-role="status-dot" title="Recovery status: ${pain} (tap to change)"></span>`;

    const badges = [
      painBadge,
      badgeFor({ icon: '🏋', planned: plannedMain, done: hasMain, detail: mainDetail, isPast }),
      badgeFor({ icon: '🏋+', planned: plannedSupp, done: hasSupp, detail: suppDetail, isPast }),
      badgeFor({ icon: '❤️', planned: plannedCardio, done: !!d.has_cardio, detail: cardioDetail, isPast }),
      badgeFor({ icon: '🤸', planned: plannedRings, done: !!d.has_rings, detail: ringsDetail, isPast })
    ].filter(Boolean).join('');

    const completionCount = [plannedMain && hasMain, plannedSupp && hasSupp, plannedCardio && d.has_cardio, plannedRings && d.has_rings].filter(Boolean).length;
    const plannedCount = [plannedMain, plannedSupp, plannedCardio, plannedRings].filter(Boolean).length;
    const title = plannedCount === 0 ? 'Rest day' : `${completionCount}/${plannedCount} complete`;

    const dow = new Date(`${d.session_date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
    return `
      <article class="tile" role="button" tabindex="0" data-date="${d.session_date}">
        <div class="tile-date">${dow} · ${d.session_date}</div>
        <div class="tile-main">${title}</div>
        <div class="tile-flags">${badges}</div>
      </article>
    `;
  }).join('');
}

function section(title, content) {
  return `<section class="detail-section"><h4>${title}</h4>${content}</section>`;
}

function summarizePlannedBarbell(plannedRows = []) {
  const main = plannedRows.filter((r) => r.category === 'main');
  const supp = plannedRows.filter((r) => r.category === 'supplemental');

  const mainText = main.length
    ? `${main[0].lift}: ${main.map((r) => `${r.planned_weight_kg}×${r.prescribed_reps}`).join(' · ')}`
    : 'None';

  let suppText = 'None';
  if (supp.length) {
    const s = supp[0];
    suppText = `${s.lift}: ${supp.length}×${s.prescribed_reps} @ ${s.planned_weight_kg} kg`;
  }

  return { mainText, suppText };
}

function summarizeActualBarbell(actualRows = []) {
  const main = actualRows.filter((r) => r.category === 'main');
  const supp = actualRows.filter((r) => r.category === 'supplemental');

  const mainText = main.length
    ? `${main[0].lift}: ${main.map((r) => `${r.actual_weight_kg ?? '-'}×${r.actual_reps ?? '-'}`).join(' · ')}`
    : 'None';

  let suppText = 'None';
  if (supp.length) {
    const byLift = new Map();
    for (const r of supp) {
      if (!byLift.has(r.lift)) byLift.set(r.lift, []);
      byLift.get(r.lift).push(r);
    }
    const parts = [];
    for (const [lift, arr] of byLift.entries()) {
      const reps = [...new Set(arr.map((x) => x.actual_reps).filter((v) => v != null))];
      const weights = [...new Set(arr.map((x) => x.actual_weight_kg).filter((v) => v != null))];
      const repText = reps.length === 1 ? reps[0] : arr.map((x) => x.actual_reps ?? '-').join('/');
      const wtText = weights.length === 1 ? ` @ ${weights[0]} kg` : '';
      parts.push(`${lift}: ${arr.length}×${repText}${wtText}`);
    }
    suppText = parts.join(' | ');
  }

  return { mainText, suppText };
}

function renderNextSessionSuggestion(planned = {}, actual = {}) {
  const pain = planned?.pain_level || 'green';
  const painNote = (planned?.pain_note || '').toLowerCase();
  const barbell = actual?.barbell || [];

  const date = planned?.session_date;
  let nextDate = '';
  if (date) {
    const d = new Date(`${date}T00:00:00`);
    d.setDate(d.getDate() + 1);
    nextDate = d.toISOString().slice(0, 10);
  }

  let suggestion = 'Proceed as planned next session.';

  const plannedSupp = (planned?.plannedBarbellRows || []).filter((r) => r.category === 'supplemental');
  const actualSupp = barbell.filter((r) => r.category === 'supplemental');
  const substitutedSupplemental = plannedSupp.length && actualSupp.length && (
    plannedSupp[0].lift !== actualSupp[0].lift ||
    plannedSupp.length !== actualSupp.length ||
    plannedSupp[0].prescribed_reps !== actualSupp[0].actual_reps ||
    plannedSupp[0].planned_weight_kg !== actualSupp[0].actual_weight_kg
  );

  if (pain === 'red') {
    suggestion = 'Recovery day next: no heavy barbell/rings; easy walk + mobility only.';
  } else if (pain === 'yellow' || painNote.includes('pain') || painNote.includes('stiff')) {
    suggestion = 'Keep main lift, reduce supplemental ~20%, and swap VO2 to Z2 if needed.';
  } else if (substitutedSupplemental) {
    suggestion = 'Keep the same modified supplemental pattern for one more session, then re-test planned loading.';
  } else if (barbell.length) {
    suggestion = 'Session looked stable — continue the planned progression next session.';
  }

  return `<p><strong>Next session${nextDate ? ` (${nextDate})` : ''}:</strong> ${suggestion}</p>`;
}

function renderPlannedVsCompleted(planned = {}, actual = {}) {
  const plannedBarbellRows = planned?.plannedBarbellRows || [];
  const actualBarbellRows = actual?.barbell || [];

  const p = summarizePlannedBarbell(plannedBarbellRows);
  const a = summarizeActualBarbell(actualBarbellRows);

  const deltas = [];
  if (plannedBarbellRows.length && actualBarbellRows.length) {
    const pSupp = plannedBarbellRows.filter((r) => r.category === 'supplemental');
    const aSupp = actualBarbellRows.filter((r) => r.category === 'supplemental');

    if (pSupp.length && aSupp.length) {
      const pLift = pSupp[0].lift;
      const pSets = pSupp.length;
      const pReps = pSupp[0].prescribed_reps;
      const pWt = pSupp[0].planned_weight_kg;

      const aLift = aSupp[0].lift;
      const aSets = aSupp.length;
      const aReps = aSupp[0].actual_reps;
      const aWt = aSupp[0].actual_weight_kg;

      if (pLift !== aLift || pSets !== aSets || pReps !== aReps || pWt !== aWt) {
        deltas.push(`Substitution detected: planned ${pLift} ${pSets}×${pReps} @ ${pWt} → completed ${aLift} ${aSets}×${aReps} @ ${aWt}`);
      }
    }
  }

  if (!deltas.length) deltas.push('No major substitution detected.');

  return `
    <div class="delta-grid">
      <div class="delta-col">
        <div class="delta-title">Prescribed</div>
        <div class="delta-line"><strong>Main:</strong> ${p.mainText}</div>
        <div class="delta-line"><strong>Supplemental:</strong> ${p.suppText}</div>
      </div>
      <div class="delta-col">
        <div class="delta-title">Completed</div>
        <div class="delta-line"><strong>Main:</strong> ${a.mainText}</div>
        <div class="delta-line"><strong>Supplemental:</strong> ${a.suppText}</div>
      </div>
    </div>
    <ul class="detail-list delta-list">${deltas.map((d) => `<li>${d}</li>`).join('')}</ul>
  `;
}

function renderBarbellDetails(rows = [], planned = {}) {
  const pain = planned?.pain_level || 'green';
  if (!rows.length) {
    const pRows = planned?.plannedBarbellRows || [];
    if (!pRows.length) return '<p class="muted">Not expected today.</p>';

    const main = pRows.filter((r) => r.category === 'main');
    const supp = pRows.filter((r) => r.category === 'supplemental');

    const mainText = main.map((r) => `${r.planned_weight_kg}×${r.prescribed_reps}`).join(' · ');
    let suppText = '';
    if (supp.length) {
      const s = supp[0];
      suppText = `${s.lift}: ${supp.length}×${s.prescribed_reps} @ ${s.planned_weight_kg} kg`;
    }

    const adjust = pain === 'yellow'
      ? `<p><strong>Auto-adjust (YELLOW):</strong> keep main, reduce supplemental volume/load.</p>`
      : (pain === 'red' ? `<p><strong>Auto-adjust (RED):</strong> skip heavy barbell today.</p>` : '');

    return `
      <p class="muted">No barbell session logged.</p>
      <div class="planned-block">
        <div class="planned-title">Planned (not completed yet)</div>
        <p><strong>Main ${main[0]?.lift || ''}:</strong> ${mainText || '-'}</p>
        ${suppText ? `<p><strong>Supplemental:</strong> ${suppText}</p>` : ''}
        ${adjust}
      </div>
    `;
  }

  const mainRows = rows.filter((r) => r.category === 'main');
  const suppRows = rows.filter((r) => r.category === 'supplemental');

  const mainList = mainRows.map((r) => {
    const note = r.note ? `<div class="detail-note">${r.note}</div>` : '';
    return `<li><strong>${r.lift}</strong> · main set ${r.set_no}: ${r.actual_weight_kg ?? '-'} × ${r.actual_reps ?? '-'}${note}</li>`;
  }).join('');

  let supplementalHtml = '<p class="muted">No supplemental work logged.</p>';
  if (suppRows.length) {
    const byLift = new Map();
    for (const r of suppRows) {
      const key = r.lift || 'Supplemental';
      if (!byLift.has(key)) byLift.set(key, []);
      byLift.get(key).push(r);
    }

    const items = [];
    for (const [lift, arr] of byLift.entries()) {
      const setCount = arr.length;
      const repsSet = [...new Set(arr.map((x) => x.actual_reps).filter((v) => v != null))];
      const weightSet = [...new Set(arr.map((x) => x.actual_weight_kg).filter((v) => v != null))];
      const noteSet = [...new Set(arr.map((x) => x.note).filter(Boolean))];

      const repsText = repsSet.length === 1 ? repsSet[0] : arr.map((x) => x.actual_reps ?? '-').join('/');
      const weightText = weightSet.length === 1 ? ` @ ${weightSet[0]} kg` : '';
      const noteText = noteSet.length ? `<div class="detail-note">${noteSet.join(' · ')}</div>` : '';

      items.push(`<li><strong>${lift}</strong> · supplemental: ${setCount}×${repsText}${weightText}${noteText}</li>`);
    }

    supplementalHtml = `<ul class="detail-list">${items.join('')}</ul>`;
  }

  return `
    ${mainList ? `<h5 class="detail-subtitle">Main</h5><ul class="detail-list">${mainList}</ul>` : '<p class="muted">No main work logged.</p>'}
    <h5 class="detail-subtitle">Supplemental (compressed)</h5>
    ${supplementalHtml}
  `;
}

function renderCardioDetails(rows = [], planned = {}) {
  const pain = planned?.pain_level || 'green';
  if (!rows.length) {
    const p = planned?.plannedCardio || null;
    if (!p || !p.session_type || p.session_type === 'OFF') return '<p class="muted">Not expected today (rest / off day).</p>';

    const intervalText = p.vo2_intervals_min
      ? `${p.vo2_intervals_min}${p.vo2_intervals_max && p.vo2_intervals_max !== p.vo2_intervals_min ? `-${p.vo2_intervals_max}` : ''} × ${p.vo2_work_min}m hard / ${p.vo2_easy_min}m easy`
      : '';

    const adjust = pain === 'yellow'
      ? `<p><strong>Auto-adjust (YELLOW):</strong> if VO2, swap to 30 min Z2.</p>`
      : (pain === 'red' ? `<p><strong>Auto-adjust (RED):</strong> recovery walk only.</p>` : '');

    return `
      <p class="muted">No cardio session logged.</p>
      <div class="planned-block">
        <div class="planned-title">Planned (not completed yet)</div>
        <p><strong>${p.session_type}</strong> · ${p.duration_min || '-'} min</p>
        ${intervalText ? `<p>${intervalText}</p>` : ''}
        ${p.speed_low_kmh ? `<p>Speed: ${p.speed_low_kmh}${p.speed_high_kmh ? `-${p.speed_high_kmh}` : ''} km/h</p>` : ''}
        ${p.target_hr_min ? `<p>Target HR: ${p.target_hr_min}${p.target_hr_max ? `-${p.target_hr_max}` : ''} bpm</p>` : ''}
        ${adjust}
      </div>
    `;
  }

  const head = rows[0];
  const intervals = rows.filter((r) => r.interval_no != null);

  let intervalSummary = '<p class="muted">No interval breakdown stored.</p>';
  if (intervals.length) {
    const workSet = [...new Set(intervals.map((r) => r.work_min))];
    const easySet = [...new Set(intervals.map((r) => r.easy_min))];
    const speedSet = [...new Set(intervals.map((r) => r.target_speed_kmh).filter((v) => v != null))];
    const hrSet = [...new Set(intervals.map((r) => r.achieved_hr).filter((v) => v != null))];

    const allSame = workSet.length === 1 && easySet.length === 1 && speedSet.length <= 1 && hrSet.length <= 1;

    if (allSame) {
      intervalSummary = `<p><strong>Intervals:</strong> ${intervals.length}× (${workSet[0]}m hard / ${easySet[0]}m easy)${speedSet.length ? ` @ ${speedSet[0]} km/h` : ''}${hrSet.length ? ` · HR ${hrSet[0]}` : ''}</p>`;
    } else {
      intervalSummary = `<ul class="detail-list">${intervals.map((r) => `<li>#${r.interval_no}: ${r.work_min}m / ${r.easy_min}m${r.target_speed_kmh ? ` @ ${r.target_speed_kmh} km/h` : ''}${r.achieved_hr ? ` · HR ${r.achieved_hr}` : ''}</li>`).join('')}</ul>`;
    }
  }

  return `
    <p><strong>${head.protocol}</strong> · ${head.duration_min ?? '-'} min${head.max_hr ? ` · max HR ${head.max_hr}` : ''}</p>
    ${intervalSummary}
  `;
}

function renderRingsDetails(rows = [], planned = {}) {
  const pain = planned?.pain_level || 'green';
  if (!rows.length) {
    const pRows = planned?.plannedRingsRows || [];
    if (!pRows.length || !pRows[0]?.template_code) return '<p class="muted">Not expected today.</p>';

    const tpl = pRows[0].template_code;
    const list = pRows
      .filter((r) => r.item_no != null)
      .map((r) => `<li>${r.item_no}. ${r.exercise} · ${r.sets_text}×${r.reps_or_time}${r.tempo ? ` @ ${r.tempo}` : ''}${r.rest_text ? ` · rest ${r.rest_text}` : ''}</li>`)
      .join('');

    const adjust = pain === 'red'
      ? `<p><strong>Auto-adjust (RED):</strong> skip rings today.</p>`
      : (pain === 'yellow' ? `<p><strong>Auto-adjust (YELLOW):</strong> keep technique easy, stop if pain rises.</p>` : '');

    return `
      <p class="muted">No rings session logged.</p>
      <div class="planned-block">
        <div class="planned-title">Planned (not completed yet)</div>
        <p><strong>Template ${tpl}</strong></p>
        <ul class="detail-list">${list}</ul>
        ${adjust}
      </div>
    `;
  }
  const tpl = rows[0].template || '-';
  const list = rows.filter((r) => r.item_no != null).map((r) => `<li>${r.item_no}. ${r.exercise}${r.result_text ? ` · ${r.result_text}` : ''}</li>`).join('');
  return `
    <p><strong>Template ${tpl}</strong></p>
    ${list ? `<ul class="detail-list">${list}</ul>` : '<p class="muted">No exercise logs stored.</p>'}
  `;
}

function bindStatusPicker(renderDashboardFn) {
  const order = ['green', 'yellow', 'red'];

  async function handleStatusTap(e) {
    const dot = e.target.closest('[data-role="status-dot"]');
    if (!dot) return;

    e.preventDefault();
    e.stopPropagation();

    const date = dot.dataset.date;
    const current = dot.dataset.status || 'green';
    const next = order[(order.indexOf(current) + 1) % order.length];

    try {
      const res = await fetch(`/api/set-status?date=${encodeURIComponent(date)}&status=${encodeURIComponent(next)}`, { method: 'POST' });
      if (!res.ok) throw new Error(`set-status failed (${res.status})`);
      await renderDashboardFn();
    } catch (err) {
      console.error(err);
    }
  }

  document.addEventListener('click', handleStatusTap, true);
  document.addEventListener('touchend', handleStatusTap, true);
}

function bindDetailClicks(details, dailyTiles = [], weekProgress = []) {
  const modal = document.getElementById('detailModal');
  const title = document.getElementById('detailTitle');
  const body = document.getElementById('detailBody');
  const closeBtn = document.getElementById('detailClose');

  function close() {
    modal.classList.remove('open');
  }

  const planByDate = Object.fromEntries((dailyTiles || []).map((d) => [d.session_date, d]));
  for (const w of (weekProgress || [])) {
    if (!planByDate[w.session_date]) {
      planByDate[w.session_date] = {
        session_date: w.session_date,
        pain_level: w.pain_level || 'green',
        planned_barbell_main: w.main_lift,
        planned_cardio: w.cardio_plan,
        planned_rings: w.rings_plan
      };
    }
  }

  function openForDate(date) {
    window.__activeDetailDate = date;
    title.textContent = `Training details · ${date}`;

    const barbell = details?.barbellByDate?.[date] || [];
    const cardio = details?.cardioByDate?.[date] || [];
    const rings = details?.ringsByDate?.[date] || [];
    const basePlanned = planByDate?.[date] || {};
    const planned = {
      ...basePlanned,
      plannedBarbellRows: details?.plannedBarbellByDate?.[date] || [],
      plannedCardio: (details?.plannedCardioByDate?.[date] || [])[0] || null,
      plannedRingsRows: details?.plannedRingsByDate?.[date] || []
    };
    window.__activePlanned = planned;

    const mainRows = (planned.plannedBarbellRows || []).filter((r) => r.category === 'main');
    const mainTop = mainRows.length ? mainRows[mainRows.length - 1] : null;
    const mainPrescription = mainRows.length ? mainRows.map((r) => `${r.planned_weight_kg}×${r.prescribed_reps}`).join(' · ') : '—';
    const suppRows = (planned.plannedBarbellRows || []).filter((r) => r.category === 'supplemental');
    const supp = suppRows[0] || null;
    const suppPrescription = suppRows.length ? `${suppRows.length}×${supp?.prescribed_reps ?? '-'} @ ${supp?.planned_weight_kg ?? '-'} kg` : '—';
    const cardioPlan = planned.plannedCardio || null;
    const ringsRows = planned.plannedRingsRows || [];
    const uniqueRingTemplates = [...new Set(ringsRows.map((r) => r.template_code).filter(Boolean))];
    const ringsTemplate = uniqueRingTemplates.length
      ? uniqueRingTemplates.join('+')
      : (planned.planned_rings ? String(planned.planned_rings) : null);
    const ringsPlanText = ringsRows
      .filter((r) => r.item_no != null)
      .map((r) => `[${r.template_code}] ${r.item_no}. ${r.exercise} ${r.sets_text || ''}x${r.reps_or_time || ''}`)
      .join('<br/>') || 'Not scheduled';

    const hasMainLogged = (barbell || []).some((r) => r.category === 'main');
    const hasSuppLogged = (barbell || []).some((r) => r.category === 'supplemental');
    const hasCardioLogged = (cardio || []).length > 0;
    const hasRingsLogged = (rings || []).length > 0;

    body.innerHTML = [
      section('Main Lift', `
        <p><strong>Main – ${mainTop?.lift || '—'}</strong><br/>Working sets prescribed: ${mainPrescription}<br/>Top set prescribed: ${mainTop?.planned_weight_kg || '—'} × ${mainTop?.prescribed_reps || '—'}</p>
        <div class="status-actions">
          <input id="mainWeightInput" class="status-input" type="number" step="0.5" placeholder="Top set weight" />
          <input id="mainRepsInput" class="status-input" type="number" step="1" placeholder="Top set reps" />
          <input id="mainRpeInput" class="status-input" type="number" step="0.5" placeholder="RPE (optional)" />
          <button type="button" class="status-btn" onclick="window.logSessionAction('main_done')" ${hasMainLogged ? 'disabled' : ''}>${hasMainLogged ? 'Main Recorded ✓' : 'Mark Main Complete'}</button>
        </div>
      `),
      section('Supplemental', `
        <p><strong>${supp?.lift || '—'}</strong><br/>Prescribed: ${suppPrescription}</p>
        <div class="status-actions">
          <label><input id="suppCompletedInput" type="checkbox" checked /> Completed as prescribed</label>
          <label><input id="suppModifiedInput" type="checkbox" /> Modified</label>
        </div>
        <div class="status-actions">
          <input id="suppWeightInput" class="status-input" type="number" step="0.5" placeholder="Modified weight" />
          <input id="suppSetsInput" class="status-input" type="number" step="1" placeholder="Sets completed" />
          <button type="button" class="status-btn" onclick="window.logSessionAction('supp_done')" ${hasSuppLogged ? 'disabled' : ''}>${hasSuppLogged ? 'Supp Recorded ✓' : 'Mark Supp Complete'}</button>
          <button type="button" class="status-btn" onclick="window.logSessionAction('supp_modified')" ${hasSuppLogged ? 'disabled' : ''}>${hasSuppLogged ? 'Supp Recorded ✓' : 'Save Supp Modified'}</button>
        </div>
      `),
      section('Cardio', `
        <p><strong>${cardioPlan?.session_type || 'Z2'}</strong></p>
        <div class="status-actions">
          <input id="cardioDurationInput" class="status-input" type="number" step="1" placeholder="Duration (min)" value="${cardioPlan?.duration_min || ''}" />
          <input id="cardioAvgHrInput" class="status-input" type="number" step="1" placeholder="Avg HR" />
          <input id="cardioSpeedInput" class="status-input" type="number" step="0.1" placeholder="Speed (optional)" />
        </div>
        <div class="status-actions">
          <input id="cardioWorkMinInput" class="status-input" type="number" step="0.5" placeholder="Work interval (min)" value="${cardioPlan?.vo2_work_min || ''}" />
          <input id="cardioRestMinInput" class="status-input" type="number" step="0.5" placeholder="Rest interval (min)" value="${cardioPlan?.vo2_easy_min || ''}" />
          <button type="button" class="status-btn" onclick="window.logSessionAction('cardio_done')" ${hasCardioLogged ? 'disabled' : ''}>${hasCardioLogged ? 'Cardio Recorded ✓' : 'Mark Cardio Complete'}</button>
        </div>
      `),
      section('Rings', `
        <p><strong>Template ${ringsTemplate || '—'}</strong></p>
        <p class="muted">${ringsPlanText}</p>
        <div class="status-actions">
          <label><input id="ringsCompletedInput" type="checkbox" ${hasRingsLogged ? 'checked disabled' : ''}/> Completed as prescribed</label>
          <button type="button" class="status-btn" onclick="window.logSessionAction('rings_done')" ${hasRingsLogged ? 'disabled' : ''}>${hasRingsLogged ? 'Rings Recorded ✓' : 'Mark Rings Complete'}</button>
        </div>
      `),
      section('Finish Session', `
        <div class="status-actions">
          <button type="button" class="status-btn" onclick="window.logSessionAction('finish_session')">Finish Session</button>
        </div>
      `)
    ].join('');

    modal.classList.add('open');
  }

  window.__openDetailForDate = openForDate;

  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  document.querySelectorAll('.tile, .week-row').forEach((el) => {
    const open = (evt) => {
      if (evt?.target?.closest?.('[data-role="status-dot"]')) return;
      openForDate(el.dataset.date);
    };
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(e);
      }
    });
  });
}

function initOverviewMode() {
  const aBtn = document.getElementById('athleteViewBtn');
  const lBtn = document.getElementById('logViewBtn');
  if (!aBtn || !lBtn) return;
  const athleteOnly = Array.from(document.querySelectorAll('.athlete-only'));
  const logOnly = Array.from(document.querySelectorAll('.log-only'));

  const setMode = (mode) => {
    const athlete = mode !== 'log';
    aBtn.classList.toggle('active', athlete);
    lBtn.classList.toggle('active', !athlete);
    athleteOnly.forEach((el) => el.classList.toggle('hidden-view', !athlete));
    logOnly.forEach((el) => el.classList.toggle('hidden-view', athlete));
  };

  aBtn.addEventListener('click', () => setMode('athlete'));
  lBtn.addEventListener('click', () => setMode('log'));
  setMode('athlete');
}

function initUploadBox() {
  const wire = ({ kind, inputId, btnId, statusId, boxId }) => {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    const status = document.getElementById(statusId);
    const box = document.getElementById(boxId);
    if (!input || !btn || !status || !box) return;

    const upload = async (file) => {
      if (!file) return;
      btn.disabled = true;
      status.textContent = `Uploading ${file.name}...`;
      try {
        const fd = new FormData();
        fd.append('kind', kind);
        fd.append('file', file);
        const res = await fetch('/api/upload-health', { method: 'POST', body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || `upload failed (${res.status})`);
        status.textContent = `Uploaded: ${data.path}`;
      } catch (e) {
        status.textContent = `Upload failed: ${e.message || e}`;
      } finally {
        btn.disabled = false;
      }
    };

    btn.addEventListener('click', async () => upload(input.files?.[0]));
    input.addEventListener('change', async () => {
      if (input.files?.[0]) await upload(input.files[0]);
    });

    box.addEventListener('dragover', (e) => {
      e.preventDefault();
      box.classList.add('dragging');
    });
    box.addEventListener('dragleave', () => box.classList.remove('dragging'));
    box.addEventListener('drop', async (e) => {
      e.preventDefault();
      box.classList.remove('dragging');
      const file = e.dataTransfer?.files?.[0];
      if (file) await upload(file);
    });
  };

  wire({ kind: 'apple', inputId: 'appleFileInput', btnId: 'appleUploadBtn', statusId: 'appleUploadStatus', boxId: 'appleDropBox' });
  wire({ kind: 'polar', inputId: 'polarFileInput', btnId: 'polarUploadBtn', statusId: 'polarUploadStatus', boxId: 'polarDropBox' });
}

function initTabs() {
  const tabButtons = Array.from(document.querySelectorAll('.tabs .tab-btn[data-tab]'));
  const panels = Array.from(document.querySelectorAll('.tab-panel'));
  if (!tabButtons.length || !panels.length) return;

  const activate = (tab, updateHash = true) => {
    tabButtons.forEach((btn) => {
      const isActive = btn.dataset.tab === tab;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    panels.forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.tabPanel === tab);
    });
    if (updateHash) {
      const newHash = `tab-${tab}`;
      if (window.location.hash !== `#${newHash}`) {
        history.replaceState(null, '', `#${newHash}`);
      }
    }
  };

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => activate(btn.dataset.tab));
  });

  const fromHash = (window.location.hash || '').replace('#tab-', '');
  const initialTab = tabButtons.some((b) => b.dataset.tab === fromHash) ? fromHash : (tabButtons[0]?.dataset.tab || 'overview');
  activate(initialTab, false);
  window.__setActiveTab = (tab) => activate(tab);
}

async function renderDashboard() {
  const data = await loadData();
  window.__dashboardData = data;
  renderWeekHeader(data.weekHeader || null);
  renderTodayGlance(data.dailyTiles || [], data.weekProgress || [], data.details || {});
  renderTotals(data.totals || {});
  renderPerformanceKpis(data.weekProgress || [], data.details || {});
  renderCycleControl(data.cycleControl || {});
  renderEst1RM(data.est1RM || []);
  renderCurrentCyclePlan(data.currentCyclePlan || []);
  renderCardioAnalytics(data.cardioAnalytics || {});
  renderAuditLog(data.auditLog || []);
  renderWeekProgress(data.weekProgress || []);
  renderDailyTiles(data.dailyTiles || [], data.details || {});
  bindDetailClicks(data.details || {}, data.dailyTiles || [], data.weekProgress || []);
  renderWeeklyCompletion(data.weekProgress || [], data.details || {});
  document.getElementById('generatedAt').textContent = `Data generated: ${new Date(data.generatedAt).toLocaleString()}`;
}

(async function init() {
  try {
    window.__renderDashboard = renderDashboard;
    window.setRecoveryStatus = async (date, status) => {
      const targetDate = date || window.__activeDetailDate;
      if (!targetDate) return;
      try {
        const res = await fetch(`/api/set-status?date=${encodeURIComponent(targetDate)}&status=${encodeURIComponent(status)}`, { method: 'POST' });
        if (!res.ok) throw new Error(`set-status failed (${res.status})`);
        await renderDashboard();
        if (window.__openDetailForDate) window.__openDetailForDate(targetDate);
      } catch (err) {
        console.error(err);
      }
    };

    window.logSessionAction = async (action) => {
      const date = window.__activeDetailDate;
      const planned = window.__activePlanned || {};
      if (!date) return;

      const payload = {
        action,
        date,
        plannedBarbellRows: planned.plannedBarbellRows || [],
        plannedCardio: planned.plannedCardio || null
      };

      const postLogAction = async (p) => {
        const res = await fetch('/api/log-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p)
        });
        if (!res.ok) {
          let msg = `log-action failed (${res.status})`;
          try {
            const j = await res.json();
            if (j?.error) msg = j.error;
          } catch {}
          throw new Error(msg);
        }
      };

      if (action === 'finish_session') {
        const mainW = parseFloat(document.getElementById('mainWeightInput')?.value || '');
        const mainR = parseInt(document.getElementById('mainRepsInput')?.value || '', 10);
        const mainRpe = parseFloat(document.getElementById('mainRpeInput')?.value || '');

        const suppCompleted = !!document.getElementById('suppCompletedInput')?.checked;
        const suppModified = !!document.getElementById('suppModifiedInput')?.checked;
        const suppW = parseFloat(document.getElementById('suppWeightInput')?.value || '');
        const suppSets = parseInt(document.getElementById('suppSetsInput')?.value || '', 10);

        const cDur = parseInt(document.getElementById('cardioDurationInput')?.value || '', 10);
        const cHr = parseInt(document.getElementById('cardioAvgHrInput')?.value || '', 10);
        const cSpeed = parseFloat(document.getElementById('cardioSpeedInput')?.value || '');
        const cWorkMin = parseFloat(document.getElementById('cardioWorkMinInput')?.value || '');
        const cRestMin = parseFloat(document.getElementById('cardioRestMinInput')?.value || '');
        const ringsCompleted = !!document.getElementById('ringsCompletedInput')?.checked;

        if (Number.isFinite(mainW) && Number.isFinite(mainR) && mainW > 0 && mainR > 0) {
          await postLogAction({
            action: 'main_done',
            date,
            plannedBarbellRows: (planned.plannedBarbellRows || []).map((r) => r.category === 'main' ? { ...r, planned_weight_kg: mainW, prescribed_reps: mainR, note: Number.isFinite(mainRpe) ? `RPE ${mainRpe}` : r.note } : r),
            plannedCardio: planned.plannedCardio || null
          });
        }

        if (suppModified && Number.isFinite(suppW) && suppW > 0) {
          const reps = ((planned.plannedBarbellRows || []).find((r) => r.category === 'supplemental')?.prescribed_reps) || 5;
          const sets = Number.isFinite(suppSets) && suppSets > 0 ? suppSets : 10;
          await postLogAction({
            action: 'supp_modified',
            date,
            plannedBarbellRows: planned.plannedBarbellRows || [],
            plannedCardio: planned.plannedCardio || null,
            suppModifiedText: `${sets}x${reps}@${suppW}`
          });
        } else if (suppCompleted) {
          await postLogAction({
            action: 'supp_done',
            date,
            plannedBarbellRows: planned.plannedBarbellRows || [],
            plannedCardio: planned.plannedCardio || null
          });
        }

        if (Number.isFinite(cDur) && cDur > 0 && Number.isFinite(cHr) && cHr > 0) {
          const pCardio = { ...(planned.plannedCardio || {}), duration_min: cDur };
          await postLogAction({
            action: 'cardio_done',
            date,
            plannedBarbellRows: planned.plannedBarbellRows || [],
            plannedCardio: pCardio,
            avgHr: cHr,
            speedKmh: Number.isFinite(cSpeed) && cSpeed > 0 ? cSpeed : undefined,
            workMin: Number.isFinite(cWorkMin) && cWorkMin > 0 ? cWorkMin : undefined,
            restMin: Number.isFinite(cRestMin) && cRestMin >= 0 ? cRestMin : undefined
          });
        }

        if (ringsCompleted) {
          await postLogAction({
            action: 'rings_done',
            date,
            plannedBarbellRows: planned.plannedBarbellRows || [],
            plannedCardio: planned.plannedCardio || null
          });
        }

        let e1rmText = '—';
        let deltaText = '—';
        if (Number.isFinite(mainW) && Number.isFinite(mainR) && mainW > 0 && mainR > 0) {
          const e1rm = mainW * (1 + (mainR / 30));
          e1rmText = `${e1rm.toFixed(1)} kg`;
          const prevMain = ((details?.barbellByDate || {})[date] || []).filter((r) => r.category === 'main');
          const prevTop = prevMain.length ? prevMain[prevMain.length - 1] : null;
          if (prevTop?.actual_weight_kg && prevTop?.actual_reps) {
            const prevE1 = Number(prevTop.actual_weight_kg) * (1 + (Number(prevTop.actual_reps) / 30));
            const d = e1rm - prevE1;
            const sign = d >= 0 ? '+' : '';
            deltaText = `${sign}${d.toFixed(1)} kg vs previous logged main`;
          }
        }

        const z2InCap = Number.isFinite(cHr) ? (cHr <= 125 ? 'Yes' : 'No') : '—';
        const quality = (() => {
          const mainOk = Number.isFinite(mainW) && Number.isFinite(mainR) && mainW > 0 && mainR > 0;
          const cardioOk = Number.isFinite(cDur) && Number.isFinite(cHr) && cDur > 0 && cHr > 0;
          const suppOk = suppCompleted || (suppModified && Number.isFinite(suppW) && suppW > 0);
          const score = [mainOk, suppOk, cardioOk].filter(Boolean).length;
          if (score === 3) return 'A (full session)';
          if (score === 2) return 'B (mostly complete)';
          if (score === 1) return 'C (partial)';
          return 'D (logged but incomplete)';
        })();

        await renderDashboard();
        if (window.__openDetailForDate) window.__openDetailForDate(date);
        alert(`Session finished\n\nTop set e1RM: ${e1rmText}\nDelta: ${deltaText}\nZ2 in cap: ${z2InCap}\nSession quality: ${quality}`);
        return;
      }

      if (action === 'supp_modified') {
        const suppW = parseFloat(document.getElementById('suppWeightInput')?.value || '');
        const suppSets = parseInt(document.getElementById('suppSetsInput')?.value || '', 10);
        const reps = ((planned.plannedBarbellRows || []).find((r) => r.category === 'supplemental')?.prescribed_reps) || 5;
        if (!Number.isFinite(suppW) || suppW <= 0) {
          alert('Enter modified supplemental weight first.');
          return;
        }
        const sets = Number.isFinite(suppSets) && suppSets > 0 ? suppSets : 10;
        payload.suppModifiedText = `${sets}x${reps}@${suppW}`;
      }

      if (action === 'cardio_done' || action === 'z2_fixed_hr_test') {
        const input = document.getElementById('cardioAvgHrInput');
        const hrTxt = (input?.value || '').trim();
        const durInput = parseInt(document.getElementById('cardioDurationInput')?.value || '', 10);
        const speedInput = parseFloat(document.getElementById('cardioSpeedInput')?.value || '');
        const workMinInput = parseFloat(document.getElementById('cardioWorkMinInput')?.value || '');
        const restMinInput = parseFloat(document.getElementById('cardioRestMinInput')?.value || '');

        if (!hrTxt) {
          alert('Enter Avg HR in the Cardio section first, then tap Mark Cardio Complete.');
          return;
        }

        const avgHr = parseInt(hrTxt, 10);
        if (!Number.isFinite(avgHr) || avgHr <= 0) {
          alert('Please enter a valid average HR number.');
          return;
        }

        payload.avgHr = avgHr;
        payload.plannedCardio = {
          ...(planned.plannedCardio || {}),
          duration_min: Number.isFinite(durInput) && durInput > 0
            ? durInput
            : ((planned.plannedCardio || {}).duration_min || 30)
        };

        if (Number.isFinite(speedInput) && speedInput > 0) payload.speedKmh = speedInput;

        const proto = String((payload.plannedCardio || {}).session_type || (payload.plannedCardio || {}).protocol || '');
        const isVo2 = (proto.includes('VO2') || proto === 'VO2_4x4' || proto === 'VO2_1min');
        const defaultWork = proto.includes('4x4') || proto === 'VO2_4x4' ? 4 : 1;
        const defaultRest = proto.includes('4x4') || proto === 'VO2_4x4' ? 3 : 1;

        if (Number.isFinite(workMinInput) && workMinInput > 0) payload.workMin = workMinInput;
        if (Number.isFinite(restMinInput) && restMinInput >= 0) payload.restMin = restMinInput;

        if (action === 'cardio_done' && isVo2) {
          if (!Number.isFinite(payload.workMin) || payload.workMin <= 0) payload.workMin = defaultWork;
          if (!Number.isFinite(payload.restMin) || payload.restMin < 0) payload.restMin = defaultRest;
        }

        if (action === 'z2_fixed_hr_test' && !payload.speedKmh) {
          alert('For Fixed-HR test, enter speed (km/h) before saving.');
          return;
        }
      }

      if (action === 'main_done') {
        const mainW = parseFloat(document.getElementById('mainWeightInput')?.value || '');
        const mainR = parseInt(document.getElementById('mainRepsInput')?.value || '', 10);
        if (Number.isFinite(mainW) && mainW > 0 && Number.isFinite(mainR) && mainR > 0) {
          payload.plannedBarbellRows = (planned.plannedBarbellRows || []).map((r) => r.category === 'main'
            ? { ...r, planned_weight_kg: mainW, prescribed_reps: mainR }
            : r);
        }
      }

      try {
        const res = await fetch('/api/log-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          let msg = `log-action failed (${res.status})`;
          try {
            const j = await res.json();
            if (j?.error) msg = j.error;
          } catch {}
          throw new Error(msg);
        }
        await renderDashboard();
        if (window.__openDetailForDate) window.__openDetailForDate(date);
        if (action === 'cardio_done') alert('Cardio session saved.');
        if (action === 'z2_fixed_hr_test') alert('Monthly Z2 fixed-HR test saved.');
      } catch (err) {
        console.error(err);
        alert(`Could not save action: ${err.message || err}`);
      }
    };

    await renderDashboard();
    bindStatusPicker(renderDashboard);
    initTabs();
    initOverviewMode();
    initUploadBox();

    const todayBtn = document.getElementById('todayBtn');
    if (todayBtn) {
      todayBtn.addEventListener('click', () => {
        if (window.__setActiveTab) window.__setActiveTab('overview');
        const today = currentDateInDashboardTZ();
        const target = document.querySelector(`[data-date="${today}"]`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (window.__openDetailForDate) window.__openDetailForDate(today);
      });
    }

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#startSessionBtn');
      if (!btn) return;
      const today = currentDateInDashboardTZ();
      if (window.__openDetailForDate) window.__openDetailForDate(today);
    });

    const refreshBtn = document.getElementById('refreshBtn');
    const refreshHealthBtn = document.getElementById('refreshHealthBtn');

    async function runRefresh({ includeHealth = false } = {}) {
      const btn = includeHealth ? refreshHealthBtn : refreshBtn;
      if (!btn) return;
      const old = btn.textContent;
      btn.disabled = true;
      if (refreshBtn && includeHealth) refreshBtn.disabled = true;
      if (refreshHealthBtn && !includeHealth) refreshHealthBtn.disabled = true;
      btn.textContent = includeHealth ? 'Importing health + refreshing...' : 'Refreshing...';
      try {
        const url = includeHealth ? '/api/refresh?includeHealth=1' : '/api/refresh';
        const res = await fetch(url, { method: 'POST' });
        if (!res.ok) throw new Error(`Refresh failed (${res.status})`);
        await renderDashboard();
        btn.textContent = includeHealth ? 'Health + DB Updated ✓' : 'Updated ✓';
        setTimeout(() => { btn.textContent = old; }, 1200);
      } catch (e) {
        console.error(e);
        btn.textContent = includeHealth ? 'Health refresh failed' : 'Refresh failed';
        setTimeout(() => { btn.textContent = old; }, 2200);
      } finally {
        btn.disabled = false;
        if (refreshBtn) refreshBtn.disabled = false;
        if (refreshHealthBtn) refreshHealthBtn.disabled = false;
      }
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        await runRefresh({ includeHealth: false });
      });
    }

    if (refreshHealthBtn) {
      refreshHealthBtn.addEventListener('click', async () => {
        await runRefresh({ includeHealth: true });
      });
    }

    document.addEventListener('click', async (e) => {
      const tmDeltaBtn = e.target.closest('[data-tm-delta]');
      if (tmDeltaBtn) {
        const lift = tmDeltaBtn.getAttribute('data-tm-lift');
        const delta = parseFloat(tmDeltaBtn.getAttribute('data-tm-delta') || '0');
        try {
          tmDeltaBtn.disabled = true;
          const res = await fetch('/api/tm/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lift, mode: 'delta', value: delta })
          });
          if (!res.ok) throw new Error(`TM update failed (${res.status})`);
          await renderDashboard();
        } catch (err) {
          alert(`Could not update TM: ${err.message || err}`);
        } finally {
          tmDeltaBtn.disabled = false;
        }
        return;
      }

      const tmSetBtn = e.target.closest('[data-tm-set]');
      if (tmSetBtn) {
        const lift = tmSetBtn.getAttribute('data-tm-set');
        const v = parseFloat(document.getElementById(`tmSet-${lift}`)?.value || '');
        if (!Number.isFinite(v) || v <= 0) {
          alert('Enter a valid TM kg value first.');
          return;
        }
        try {
          tmSetBtn.disabled = true;
          const res = await fetch('/api/tm/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lift, mode: 'set', value: v })
          });
          if (!res.ok) throw new Error(`TM set failed (${res.status})`);
          await renderDashboard();
        } catch (err) {
          alert(`Could not set TM: ${err.message || err}`);
        } finally {
          tmSetBtn.disabled = false;
        }
        return;
      }

      const startBtn = e.target.closest('#startCycleBtn');
      if (startBtn) {
        const startDate = document.getElementById('newCycleStartInput')?.value || '';
        const blockType = document.getElementById('newCycleTypeInput')?.value || 'Leader';
        try {
          startBtn.disabled = true;
          const res = await fetch('/api/cycle/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate, blockType })
          });
          if (!res.ok) throw new Error(`Start cycle failed (${res.status})`);
          await renderDashboard();
          alert('New cycle created.');
        } catch (err) {
          alert(`Could not start cycle: ${err.message || err}`);
        } finally {
          startBtn.disabled = false;
        }
        return;
      }

      const deloadBtn = e.target.closest('#applyDeloadBtn');
      if (deloadBtn) {
        const deloadCode = document.getElementById('deloadTypeInput')?.value || '';
        const startDate = document.getElementById('deloadStartInput')?.value || '';
        const durationDays = parseInt(document.getElementById('deloadDaysInput')?.value || '', 10) || 7;
        try {
          deloadBtn.disabled = true;
          const res = await fetch('/api/cycle/deload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deloadCode, startDate, durationDays })
          });
          if (!res.ok) throw new Error(`Apply deload failed (${res.status})`);
          await renderDashboard();
          alert('Deload applied.');
        } catch (err) {
          alert(`Could not apply deload: ${err.message || err}`);
        } finally {
          deloadBtn.disabled = false;
        }
      }
    });
  } catch (err) {
    document.body.innerHTML = `<main class="app"><p>Failed to load dashboard data. Run export script first.</p><pre>${err}</pre></main>`;
  }
})();
