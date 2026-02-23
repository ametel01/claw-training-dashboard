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
  node.innerHTML = `
    <div class="week-header-title">${weekHeader.block_type} Week ${weekHeader.week_in_block}</div>
    <div class="week-header-meta">Main: ${weekHeader.main_pct} · Supplemental: ${weekHeader.supp_pct}</div>
  `;
}

function renderTodayGlance(days = []) {
  const node = document.getElementById('todayGlance');
  if (!node) return;

  const today = currentDateInDashboardTZ();
  const d = (days || []).find((x) => x.session_date === today);
  if (!d) {
    node.innerHTML = '<div class="today-title">Today at a glance</div><div class="today-meta">No data for today yet.</div>';
    return;
  }

  const plannedBarbell = !!d.planned_barbell_main;
  const plannedCardio = !!d.planned_cardio && d.planned_cardio !== 'OFF';
  const plannedRings = !!d.planned_rings;
  const plannedCount = [plannedBarbell, plannedCardio, plannedRings].filter(Boolean).length;
  const doneCount = [plannedBarbell && d.has_barbell, plannedCardio && d.has_cardio, plannedRings && d.has_rings].filter(Boolean).length;

  const line = (label, plannedText, done) => {
    if (!plannedText) return '';
    return `<div class="today-line"><span class="today-chip ${done ? 'done' : 'pending'}">${done ? 'done' : 'pending'}</span><strong>${label}</strong> ${plannedText}</div>`;
  };

  const barbellText = plannedBarbell
    ? `${d.planned_barbell_main}${d.planned_barbell_supp ? ` + ${d.planned_barbell_supp} ${d.planned_supp_sets || ''}x${d.planned_supp_reps || ''}` : ''}`
    : '';
  const cardioText = plannedCardio ? d.planned_cardio : '';
  const ringsText = plannedRings ? `Template ${d.planned_rings}` : '';

  node.innerHTML = `
    <div class="today-title">
      <span>Today at a glance · ${today}</span>
      <span><span class="status-dot ${d.pain_level || 'green'}"></span>${doneCount}/${plannedCount || 0}</span>
    </div>
    <div class="today-meta">Planned + adjusted + completion in one view</div>
    <div class="today-lines">
      ${line('Barbell:', barbellText, !!d.has_barbell)}
      ${line('Cardio:', cardioText, !!d.has_cardio)}
      ${line('Rings:', ringsText, !!d.has_rings)}
    </div>
  `;
}

function renderWeeklyCompletion(weekRows = []) {
  let planned = 0;
  let done = 0;

  weekRows.forEach((r) => {
    const pBarbell = !!r.main_lift;
    const pCardio = !!r.cardio_plan && r.cardio_plan !== 'OFF';
    const pRings = !!r.rings_plan;

    if (pBarbell) {
      planned += 1;
      if (r.barbell_done) done += 1;
    }
    if (pCardio) {
      planned += 1;
      if (r.cardio_done) done += 1;
    }
    if (pRings) {
      planned += 1;
      if (r.rings_done) done += 1;
    }
  });

  const pct = planned ? Math.round((done / planned) * 100) : 0;
  const pill = document.getElementById('weeklyCompletion');
  if (pill) pill.textContent = `Week: ${done}/${planned} (${pct}%)`;
}

function renderEst1RM(rows = []) {
  const node = document.getElementById('est1rmRows');
  if (!node) return;

  if (!rows.length) {
    node.innerHTML = '<p class="muted">No main-set data in the last 12 weeks yet.</p>';
    return;
  }

  node.innerHTML = rows.map((r) => `
    <article class="est1rm-card">
      <div class="est1rm-lift">${r.lift}</div>
      <div class="est1rm-value">${r.est_1rm_kg} kg</div>
      <div class="est1rm-level">${r.strength_level} · ${r.bw_ratio}x BW</div>
      <div class="est1rm-meta">${r.next_level !== '—' ? `Next: ${r.next_level} at ${r.next_level_kg} kg` : 'Top level reached'} · BW ${r.bodyweight_kg} kg</div>
      <div class="est1rm-meta">from ${r.source_weight_kg}×${r.source_reps} (${r.source_date})</div>
    </article>
  `).join('');
}

function renderCardioAnalytics(data = {}) {
  const node = document.getElementById('cardioAnalytics');
  if (!node) return;

  const totalZ2 = data.total_z2 || 0;
  const inCap = data.z2_in_cap || 0;
  const pct = data.z2_compliance_pct ?? 0;

  let z2Points = data.z2_points || [];
  if (typeof z2Points === 'string') {
    try { z2Points = JSON.parse(z2Points); } catch { z2Points = []; }
  }

  let vo2Points = data.vo2_points || [];
  if (typeof vo2Points === 'string') {
    try { vo2Points = JSON.parse(vo2Points); } catch { vo2Points = []; }
  }

  const recentZ2 = [...(z2Points || [])].filter((p) => p.avg_hr != null).slice(-10);
  let z2Graph = '<p class="muted">No Z2 HR data in last 12 weeks.</p>';
  if (recentZ2.length === 1) {
    const p = recentZ2[0];
    z2Graph = `<p><strong>Only one Z2 HR point so far:</strong> ${p.session_date} · HR ${p.avg_hr}</p>`;
  }
  if (recentZ2.length >= 2) {
    const w = 320;
    const h = 110;
    const pad = 14;
    const hrs = recentZ2.map((p) => Number(p.avg_hr));
    const minHr = Math.min(105, ...hrs) - 2;
    const maxHr = Math.max(130, ...hrs) + 2;
    const span = Math.max(1, maxHr - minHr);

    const pts = recentZ2.map((p, i) => {
      const x = pad + (i * ((w - pad * 2) / (recentZ2.length - 1)));
      const y = h - pad - ((Number(p.avg_hr) - minHr) / span) * (h - pad * 2);
      return { x, y, hr: p.avg_hr, date: p.session_date };
    });

    const poly = pts.map((p) => `${p.x},${p.y}`).join(' ');
    const circles = pts.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="2.8"><title>${p.date}: HR ${p.hr}</title></circle>`).join('');
    const latest = pts[pts.length - 1];
    const first = pts[0];
    const delta = (Number(latest.hr) - Number(first.hr)).toFixed(1);

    z2Graph = `
      <div class="z2-graph-wrap">
        <svg viewBox="0 0 ${w} ${h}" class="z2-graph" role="img" aria-label="Z2 average HR trend">
          <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" class="z2-axis"/>
          <polyline points="${poly}" class="z2-line"/>
          ${circles}
        </svg>
        <div class="muted">Last ${recentZ2.length} Z2 sessions · HR trend Δ ${delta}</div>
      </div>
    `;
  }

  const recentVO2 = [...(vo2Points || [])].slice(-8);
  const maxSpeed = Math.max(15, ...recentVO2.map((p) => Number(p.max_speed_kmh || p.avg_speed_kmh || 0)));

  const vo2Rows = recentVO2.length
    ? recentVO2.map((p) => {
        const speed = Number(p.avg_speed_kmh || p.max_speed_kmh || 0);
        const hr = p.avg_hr ?? p.max_hr ?? '-';
        const barPct = Math.max(0, Math.min(100, (speed / maxSpeed) * 100));
        return `
          <div class="cardio-vo2-row">
            <div>${p.session_date}</div>
            <div>${p.protocol}</div>
            <div>
              <div>${speed || '-'} km/h · HR ${hr}</div>
              <div class="cardio-vo2-bar"><span style="width:${barPct}%"></span></div>
            </div>
          </div>
        `;
      }).join('')
    : '<p class="muted">No VO2 data in last 12 weeks.</p>';

  node.innerHTML = `
    <div class="cardio-analytics">
      <div class="cardio-z2-card">
        <div class="muted">Z2 compliance</div>
        <div class="cardio-z2-big">${pct}%</div>
        <div class="muted">${inCap}/${totalZ2} sessions in cap</div>
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">Z2 HR variation trend</div>
        ${z2Graph}
      </div>
      <div class="cardio-vo2-list">
        <div class="muted" style="margin-bottom:6px">VO2 speed vs HR trend</div>
        ${vo2Rows}
      </div>
    </div>
  `;
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
  node.innerHTML = rows.map((r) => `
    <article class="week-row" role="button" tabindex="0" data-date="${r.session_date}">
      <div class="week-meta">
        <div class="week-day">${r.day_name}</div>
        <div class="muted">${r.session_date}</div>
      </div>
      <div class="week-chips">
        ${yesNoChip('Barbell', r.barbell_done, r.main_lift || '—')}
        ${yesNoChip('Cardio', r.cardio_done, r.cardio_plan || 'OFF')}
        ${yesNoChip('Rings', r.rings_done, r.rings_plan || '—')}
      </div>
    </article>
  `).join('');
}

function renderDailyTiles(days) {
  const node = document.getElementById('dailyTiles');
  const today = currentDateInDashboardTZ();

  const badgeFor = ({ label, planned, done, detail, isPast }) => {
    if (!planned) return '';
    const text = `${label}${detail ? `: ${detail}` : ''}`;
    let cls = 'badge planned';
    if (done) cls = 'badge done';
    else if (!done && isPast) cls = 'badge missed';
    return `<span class="${cls}">${text}</span>`;
  };

  const orderedDays = [...days].reverse();

  node.innerHTML = orderedDays.map((d) => {
    const isPast = d.session_date < today;

    const plannedBarbell = !!d.planned_barbell_main;
    const plannedCardio = !!d.planned_cardio && d.planned_cardio !== 'OFF';
    const plannedRings = !!d.planned_rings;

    const barbellDetail = plannedBarbell
      ? `${d.planned_barbell_main}${d.planned_barbell_supp ? ` + ${d.planned_barbell_supp} ${d.planned_supp_sets || ''}x${d.planned_supp_reps || ''}` : ''}`.trim()
      : d.barbell_lift;

    const cardioDetail = d.planned_cardio || d.cardio_protocol;
    const ringsDetail = d.planned_rings || d.rings_template;

    const pain = d.pain_level || 'green';
    const painBadge = `<span class="status-dot clickable ${pain}" data-date="${d.session_date}" data-status="${pain}" data-role="status-dot" title="Recovery status: ${pain} (tap to change)"></span>`;

    const badges = [
      painBadge,
      badgeFor({ label: 'Barbell', planned: plannedBarbell, done: !!d.has_barbell, detail: barbellDetail, isPast }),
      badgeFor({ label: 'Cardio', planned: plannedCardio, done: !!d.has_cardio, detail: cardioDetail, isPast }),
      badgeFor({ label: 'Rings', planned: plannedRings, done: !!d.has_rings, detail: ringsDetail, isPast })
    ].filter(Boolean).join('');

    const completionCount = [
      plannedBarbell && d.has_barbell,
      plannedCardio && d.has_cardio,
      plannedRings && d.has_rings
    ].filter(Boolean).length;
    const plannedCount = [plannedBarbell, plannedCardio, plannedRings].filter(Boolean).length;
    const title = plannedCount === 0
      ? 'Rest day (no training expected)'
      : `Completed: ${completionCount}/${plannedCount}`;

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

    const pain = planned.pain_level || 'green';
    body.innerHTML = [
      section('Day status', `
        <p><span class="status-dot ${pain}" title="Recovery status: ${pain}"></span>${planned.pain_note ? ` ${planned.pain_note}` : ''}</p>
        <div class="status-actions">
          <button type="button" class="status-btn" onclick="window.setRecoveryStatus(null,'green')">🟢 Green</button>
          <button type="button" class="status-btn" onclick="window.setRecoveryStatus(null,'yellow')">🟡 Yellow</button>
          <button type="button" class="status-btn" onclick="window.setRecoveryStatus(null,'red')">🔴 Red</button>
        </div>
        <div class="status-actions">
          <button type="button" class="status-btn" onclick="window.logSessionAction('main_done')">Main done</button>
          <button type="button" class="status-btn" onclick="window.logSessionAction('supp_modified')">Supplemental modified</button>
          <button type="button" class="status-btn" onclick="window.logSessionAction('cardio_done')">Cardio done</button>
        </div>
      `),
      section('Planned vs Completed (Delta)', renderPlannedVsCompleted(planned, { barbell, cardio, rings })),
      section('Next Session Suggestion', renderNextSessionSuggestion(planned, { barbell, cardio, rings })),
      section('Barbell', renderBarbellDetails(barbell, planned)),
      section('Cardio', renderCardioDetails(cardio, planned)),
      section('Rings', renderRingsDetails(rings, planned))
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

async function renderDashboard() {
  const data = await loadData();
  renderWeekHeader(data.weekHeader || null);
  renderTodayGlance(data.dailyTiles || []);
  renderTotals(data.totals || {});
  renderEst1RM(data.est1RM || []);
  renderCardioAnalytics(data.cardioAnalytics || {});
  renderAuditLog(data.auditLog || []);
  renderWeekProgress(data.weekProgress || []);
  renderDailyTiles(data.dailyTiles || []);
  bindDetailClicks(data.details || {}, data.dailyTiles || [], data.weekProgress || []);
  renderWeeklyCompletion(data.weekProgress || []);
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

      if (action === 'supp_modified') {
        const txt = prompt('Enter modified supplemental in format 5x10@60');
        if (!txt) return;
        payload.suppModifiedText = txt;
      }

      if (action === 'cardio_done') {
        const hrTxt = prompt('Enter average HR for this cardio session (e.g., 118)');
        if (!hrTxt) return;
        const avgHr = parseInt(hrTxt, 10);
        if (!Number.isFinite(avgHr) || avgHr <= 0) {
          alert('Please enter a valid average HR number.');
          return;
        }
        payload.avgHr = avgHr;
      }

      try {
        const res = await fetch('/api/log-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`log-action failed (${res.status})`);
        await renderDashboard();
        if (window.__openDetailForDate) window.__openDetailForDate(date);
      } catch (err) {
        console.error(err);
      }
    };

    await renderDashboard();
    bindStatusPicker(renderDashboard);

    const todayBtn = document.getElementById('todayBtn');
    if (todayBtn) {
      todayBtn.addEventListener('click', () => {
        const today = currentDateInDashboardTZ();
        const target = document.querySelector(`[data-date="${today}"]`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (window.__openDetailForDate) window.__openDetailForDate(today);
      });
    }

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        const old = refreshBtn.textContent;
        refreshBtn.disabled = true;
        refreshBtn.textContent = 'Refreshing...';
        try {
          const res = await fetch('/api/refresh', { method: 'POST' });
          if (!res.ok) throw new Error(`Refresh failed (${res.status})`);
          await renderDashboard();
          refreshBtn.textContent = 'Updated ✓';
          setTimeout(() => { refreshBtn.textContent = old; }, 1200);
        } catch (e) {
          console.error(e);
          refreshBtn.textContent = 'Refresh failed';
          setTimeout(() => { refreshBtn.textContent = old; }, 2000);
        } finally {
          refreshBtn.disabled = false;
        }
      });
    }
  } catch (err) {
    document.body.innerHTML = `<main class="app"><p>Failed to load dashboard data. Run export script first.</p><pre>${err}</pre></main>`;
  }
})();
