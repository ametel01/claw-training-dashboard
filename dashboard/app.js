async function loadData() {
  const res = await fetch('./data.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load data.json');
  return res.json();
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

function renderWeekProgress(rows) {
  const node = document.getElementById('weekRows');
  node.innerHTML = rows.map((r) => `
    <article class="week-row" role="button" tabindex="0" data-date="${r.session_date}">
      <div>
        <div class="week-day">${r.day_name}</div>
        <div class="muted">${r.session_date}</div>
      </div>
      <div>${yesNoChip('Barbell', r.barbell_done, r.main_lift)}</div>
      <div>${yesNoChip('Cardio', r.cardio_done, r.cardio_plan || 'OFF')}</div>
      <div>${yesNoChip('Rings', r.rings_done, r.rings_plan || '-')}</div>
    </article>
  `).join('');
}

function renderDailyTiles(days) {
  const node = document.getElementById('dailyTiles');
  const today = new Date().toISOString().slice(0, 10);

  const badgeFor = ({ label, planned, done, detail, isPast }) => {
    const text = planned
      ? `${label}${detail ? `: ${detail}` : ''}`
      : `${label}: not expected`;
    let cls = 'badge idle';
    if (planned && done) cls = 'badge done';
    else if (planned && !done && isPast) cls = 'badge missed';
    else if (planned) cls = 'badge planned';
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

    const badges = [
      badgeFor({ label: 'Barbell', planned: plannedBarbell, done: !!d.has_barbell, detail: barbellDetail, isPast }),
      badgeFor({ label: 'Cardio', planned: plannedCardio, done: !!d.has_cardio, detail: cardioDetail, isPast }),
      badgeFor({ label: 'Rings', planned: plannedRings, done: !!d.has_rings, detail: ringsDetail, isPast })
    ].join('');

    const completionCount = [d.has_barbell, d.has_cardio, d.has_rings].filter(Boolean).length;
    const plannedCount = [plannedBarbell, plannedCardio, plannedRings].filter(Boolean).length;
    const title = completionCount
      ? `Completed: ${completionCount}/3`
      : (plannedCount === 0 ? 'Rest day (no training expected)' : (isPast ? 'Not completed yet' : 'Planned'));

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

function renderBarbellDetails(rows = [], planned = {}) {
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

    return `
      <p class="muted">No barbell session logged.</p>
      <div class="planned-block">
        <div class="planned-title">Planned (not completed yet)</div>
        <p><strong>Main ${main[0]?.lift || ''}:</strong> ${mainText || '-'}</p>
        ${suppText ? `<p><strong>Supplemental:</strong> ${suppText}</p>` : ''}
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
  if (!rows.length) {
    const p = planned?.plannedCardio || null;
    if (!p || !p.session_type || p.session_type === 'OFF') return '<p class="muted">Not expected today (rest / off day).</p>';

    const intervalText = p.vo2_intervals_min
      ? `${p.vo2_intervals_min}${p.vo2_intervals_max && p.vo2_intervals_max !== p.vo2_intervals_min ? `-${p.vo2_intervals_max}` : ''} × ${p.vo2_work_min}m hard / ${p.vo2_easy_min}m easy`
      : '';

    return `
      <p class="muted">No cardio session logged.</p>
      <div class="planned-block">
        <div class="planned-title">Planned (not completed yet)</div>
        <p><strong>${p.session_type}</strong> · ${p.duration_min || '-'} min</p>
        ${intervalText ? `<p>${intervalText}</p>` : ''}
        ${p.speed_low_kmh ? `<p>Speed: ${p.speed_low_kmh}${p.speed_high_kmh ? `-${p.speed_high_kmh}` : ''} km/h</p>` : ''}
        ${p.target_hr_min ? `<p>Target HR: ${p.target_hr_min}${p.target_hr_max ? `-${p.target_hr_max}` : ''} bpm</p>` : ''}
      </div>
    `;
  }
  const head = rows[0];
  const intervals = rows.filter((r) => r.interval_no != null);
  const intervalList = intervals.length
    ? `<ul class="detail-list">${intervals.map((r) => `<li>Interval ${r.interval_no}: ${r.work_min}m hard / ${r.easy_min}m easy @ ${r.target_speed_kmh ?? '-'} km/h${r.achieved_hr ? ` · HR ${r.achieved_hr}` : ''}</li>`).join('')}</ul>`
    : '<p class="muted">No interval breakdown stored.</p>';

  return `
    <p><strong>${head.protocol}</strong> · ${head.duration_min ?? '-'} min${head.max_hr ? ` · max HR ${head.max_hr}` : ''}</p>
    ${head.notes ? `<p class="detail-note">${head.notes}</p>` : ''}
    ${intervalList}
  `;
}

function renderRingsDetails(rows = [], planned = {}) {
  if (!rows.length) {
    const pRows = planned?.plannedRingsRows || [];
    if (!pRows.length || !pRows[0]?.template_code) return '<p class="muted">Not expected today.</p>';

    const tpl = pRows[0].template_code;
    const list = pRows
      .filter((r) => r.item_no != null)
      .map((r) => `<li>${r.item_no}. ${r.exercise} · ${r.sets_text}×${r.reps_or_time}${r.tempo ? ` @ ${r.tempo}` : ''}${r.rest_text ? ` · rest ${r.rest_text}` : ''}</li>`)
      .join('');

    return `
      <p class="muted">No rings session logged.</p>
      <div class="planned-block">
        <div class="planned-title">Planned (not completed yet)</div>
        <p><strong>Template ${tpl}</strong></p>
        <ul class="detail-list">${list}</ul>
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
        planned_barbell_main: w.main_lift,
        planned_cardio: w.cardio_plan,
        planned_rings: w.rings_plan
      };
    }
  }

  function openForDate(date) {
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

    body.innerHTML = [
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
    const open = () => openForDate(el.dataset.date);
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  });
}

async function renderDashboard() {
  const data = await loadData();
  renderTotals(data.totals || {});
  renderWeekProgress(data.weekProgress || []);
  renderDailyTiles(data.dailyTiles || []);
  bindDetailClicks(data.details || {}, data.dailyTiles || [], data.weekProgress || []);
  renderWeeklyCompletion(data.weekProgress || []);
  document.getElementById('generatedAt').textContent = `Data generated: ${new Date(data.generatedAt).toLocaleString()}`;
}

(async function init() {
  try {
    await renderDashboard();

    const todayBtn = document.getElementById('todayBtn');
    if (todayBtn) {
      todayBtn.addEventListener('click', () => {
        const today = new Date().toISOString().slice(0, 10);
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
